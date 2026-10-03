import crypto from 'node:crypto';
import net from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { runMigrations } from '../src/lib/persistence/migrate.js';
import { createPostgresRepositories } from '../src/lib/persistence/pg-repositories.js';

const databaseUrl = process.env.DATABASE_URL;
const suite = describe.skipIf(!databaseUrl);

const SECRET = 'whsec_phaseb_route_restart_secret';
const STRIPE_KEY = 'sk_test_phaseb_route_restart_placeholder';
const ACCOUNT_ID = 'phaseb_route_restart_account';
const EVENT_A = 'phaseb_route_restart_event_a';
const EVENT_B = 'phaseb_route_restart_event_b';

function stripeSignature(body: string, timestamp: number): string {
  const signed = `${timestamp}.${body}`;
  const sig = crypto.createHmac('sha256', SECRET).update(signed).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

function makeEvent(id: string, type: string): string {
  return JSON.stringify({
    id,
    type,
    data: {
      object: {
        id: `sub_${id}`,
        metadata: { account_id: ACCOUNT_ID },
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        plan: { id: 'pro' },
      },
    },
  });
}

async function getFreePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Failed to allocate a free port'));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function startServer(port: number): ChildProcess {
  return spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl!,
      PORT: String(port),
      NODE_ENV: 'test',
      DEMO_AUTH: '',
      STRIPE_WEBHOOK_SECRET: SECRET,
      STRIPE_SECRET_KEY: STRIPE_KEY,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function waitForHealth(port: number, child: ChildProcess): Promise<void> {
  let lastError = 'server did not become healthy';
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early with code ${child.exitCode}: ${lastError}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
      lastError = `health returned ${response.status}`;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(lastError);
}

async function stopServer(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
      resolve();
    }, 2000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function postSigned(port: number, body: string): Promise<Response> {
  const timestamp = Math.floor(Date.now() / 1000);
  return await fetch(`http://127.0.0.1:${port}/payment/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': stripeSignature(body, timestamp),
    },
    body,
  });
}

suite('Phase B actual webhook route durable replay across processes', () => {
  let admin: Pool;
  let serverA: ChildProcess;
  let serverB: ChildProcess;
  let portA: number;
  let portB: number;

  beforeAll(async () => {
    admin = new Pool({ connectionString: databaseUrl });
    await runMigrations(admin);
    await admin.query('DELETE FROM billing_event_ledger WHERE event_id = ANY($1::text[])', [
      [EVENT_A, EVENT_B],
    ]);
    await admin.query('DELETE FROM subscriptions WHERE account_id = $1', [ACCOUNT_ID]);

    const repositories = createPostgresRepositories(admin);
    await repositories.subscriptions.save({
      id: 'phaseb_route_restart_sub',
      accountId: ACCOUNT_ID,
      planId: 'pro',
      status: 'active',
      currentPeriodStart: new Date('2026-10-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-11-01T00:00:00.000Z'),
      cancelAtPeriodEnd: false,
      metadata: { source: 'phase-b-route-restart-proof' },
    });

    [portA, portB] = await Promise.all([getFreePort(), getFreePort()]);
    serverA = startServer(portA);
    serverB = startServer(portB);
    await Promise.all([waitForHealth(portA, serverA), waitForHealth(portB, serverB)]);
  }, 15000);

  afterAll(async () => {
    await Promise.all([stopServer(serverA), stopServer(serverB)]);
    if (admin) {
      await admin.query('DELETE FROM billing_event_ledger WHERE event_id = ANY($1::text[])', [
        [EVENT_A, EVENT_B],
      ]);
      await admin.query('DELETE FROM subscriptions WHERE account_id = $1', [ACCOUNT_ID]);
      await admin.end();
    }
  });

  it('keeps event A from re-applying through a second process after event B', async () => {
    const eventA = makeEvent(EVENT_A, 'invoice.payment_failed');
    const eventB = makeEvent(EVENT_B, 'invoice.paid');

    const firstA = await postSigned(portA, eventA);
    expect(firstA.status).toBe(200);

    let state = await admin.query<{
      status: string;
      last_processed_event_id: string | null;
    }>(
      'SELECT status, last_processed_event_id FROM subscriptions WHERE account_id = $1',
      [ACCOUNT_ID]
    );
    expect(state.rows[0]).toMatchObject({
      status: 'grace_period',
      last_processed_event_id: EVENT_A,
    });

    const secondB = await postSigned(portA, eventB);
    expect(secondB.status).toBe(200);

    state = await admin.query(
      'SELECT status, last_processed_event_id FROM subscriptions WHERE account_id = $1',
      [ACCOUNT_ID]
    );
    expect(state.rows[0]).toMatchObject({
      status: 'active',
      last_processed_event_id: EVENT_B,
    });

    // serverB is a separate OS process. Its process-local webhook replay Set has
    // never seen EVENT_A, so this signed replay passes the receiver and reaches
    // the real paymentWebhookHandler -> subscriptionCore.handleBillingEvent path.
    const replayAOnFreshProcess = await postSigned(portB, eventA);
    expect(replayAOnFreshProcess.status).toBe(200);
    await expect(replayAOnFreshProcess.json()).resolves.toMatchObject({ received: true });

    state = await admin.query(
      'SELECT status, last_processed_event_id FROM subscriptions WHERE account_id = $1',
      [ACCOUNT_ID]
    );
    expect(state.rows[0]).toMatchObject({
      status: 'active',
      last_processed_event_id: EVENT_B,
    });

    const ledger = await admin.query<{ event_id: string }>(
      'SELECT event_id FROM billing_event_ledger WHERE event_id = ANY($1::text[]) ORDER BY event_id',
      [[EVENT_A, EVENT_B]]
    );
    expect(ledger.rows.map((row) => row.event_id)).toEqual([EVENT_A, EVENT_B]);
  }, 15000);
});
