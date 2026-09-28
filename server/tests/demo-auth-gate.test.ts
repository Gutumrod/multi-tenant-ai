import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * HOUSE-SWARM-7 WU-4 — the DEMO_AUTH gate, observed over real HTTP.
 *
 * What this suite proves, and why each assertion is a real observation rather
 * than a restatement of the source:
 *
 *   1. With DEMO_AUTH unset (and with DEMO_AUTH=false) the paid routes sit behind
 *      the ORIGINAL `authMiddleware`: `POST /ai/demo` and `GET /me` answer the
 *      real 503 `Auth not configured on this server instance`, and the demo
 *      middleware is provably NOT mounted — an invalid `x-demo-account` (path
 *      traversal, >64 chars, a space) still gets that same 503 instead of the
 *      demo middleware's 400 DEMO_ACCOUNT_ID_INVALID. If the demo middleware were
 *      mounted anywhere on these routes, the invalid-id request would be the one
 *      to observe it.
 *   2. With DEMO_AUTH=true and NODE_ENV=production the server REFUSES to serve a
 *      demo identity: even a perfectly valid `x-demo-account` gets 503 with code
 *      DEMO_AUTH_REFUSED_IN_PRODUCTION, and `demoAuthState()` reports
 *      `active: false` with `refusal: 'production'`. A refusal that a valid id
 *      could talk its way past would not be a refusal.
 *   3. With DEMO_AUTH=true on a normal instance a valid `x-demo-account` DOES
 *      establish a demo identity (observable as `auth.metadata.demoAuth === true`
 *      and no session/token), while an invalid one is refused with 400
 *      DEMO_ACCOUNT_ID_INVALID.
 *
 * Every scenario is driven through `app.listen(0)` on an ephemeral port and
 * `fetch`, so the gate is exercised through express's real middleware chain in
 * the real order (tenantMiddleware first, then the paid-route gate) — not by
 * calling a middleware function with a hand-built request.
 *
 * Hermetic by construction: DATABASE_URL is cleared before any server module is
 * imported (which is why every import below is dynamic), so the process resolves
 * the in-memory repositories and this suite touches no database. The environment
 * is rewritten per scenario and restored afterwards.
 *
 * Run with:  npm run test:web   (or: npx vitest run tests/demo-auth-gate.test.ts)
 */

/** The exact 503 body the real authMiddleware returns when Supabase is absent. */
const AUTH_NOT_CONFIGURED = { error: 'Auth not configured on this server instance' };

/**
 * Each scenario re-imports the whole server app (`vi.resetModules()` + dynamic
 * import) so the middleware choice is genuinely re-decided under the scenario's
 * environment. The first such import in this file also pays the TypeScript
 * transform cost for the app and its module graph, which alone exceeded
 * vitest's 5s default. The timeout is raised for that cost, not to hide a hang:
 * every request in this file is asserted on its observed status and body.
 */
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

/** Codes only the demo middleware can emit — their absence proves it did not run. */
const DEMO_ONLY_CODES = ['DEMO_AUTH_DISABLED', 'DEMO_AUTH_REFUSED_IN_PRODUCTION'];

type Booted = { server: Server; baseUrl: string };

/** Environment keys this suite rewrites; restored after every scenario. */
const MANAGED_KEYS = ['DEMO_AUTH', 'NODE_ENV', 'DATABASE_URL', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const savedEnv = new Map<string, string | undefined>();
for (const key of MANAGED_KEYS) savedEnv.set(key, process.env[key]);

// Cleared before the first dynamic import so no scenario can pick up a database.
delete process.env.DATABASE_URL;

/** Sets the managed keys to exactly `env` (anything not named is deleted). */
function applyEnv(env: Record<string, string>): void {
  for (const key of MANAGED_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(env)) process.env[key] = value;
}

/**
 * Builds a fresh app under `env` and binds it to an ephemeral port.
 *
 * `vi.resetModules()` first is what makes this a real per-scenario observation:
 * `server/src/app.ts` decides which middleware to mount at construction time by
 * reading `demoAuthState()`, so the module must be re-evaluated after the
 * environment changes rather than reusing a previously constructed app.
 */
async function bootApp(env: Record<string, string>): Promise<Booted> {
  applyEnv(env);
  vi.resetModules();

  const { createApp } = await import('../src/app.js');
  const app = createApp();

  const server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  const address = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function shutdown(booted: Booted | null): Promise<void> {
  if (!booted) return;
  await new Promise<void>((resolve, reject) => {
    booted.server.close((error) => (error ? reject(error) : resolve()));
  });
}

/** Parses a response body without assuming JSON, so a non-JSON body is reported. */
async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

let booted: Booted | null = null;

afterEach(async () => {
  await shutdown(booted);
  booted = null;
  for (const key of MANAGED_KEYS) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('DEMO_AUTH off (the default): the real auth path is unchanged', () => {
  /**
   * The three invalid-id shapes the work unit names: a path traversal, an id
   * longer than the 64-character maximum, and an id containing a space.
   */
  const INVALID_DEMO_ACCOUNTS: { label: string; value: string }[] = [
    { label: 'path-traversal', value: '../../etc/passwd' },
    { label: 'longer-than-64-chars', value: 'a'.repeat(65) },
    { label: 'contains-a-space', value: 'demo account' },
  ];

  for (const demoAuthValue of [undefined, 'false'] as const) {
    describe(`DEMO_AUTH=${demoAuthValue ?? '(unset)'}`, () => {
      it('POST /ai/demo with x-tenant-id answers 503 "Auth not configured on this server instance"', async () => {
        booted = await bootApp(
          demoAuthValue === undefined
            ? { NODE_ENV: 'test' }
            : { NODE_ENV: 'test', DEMO_AUTH: demoAuthValue }
        );

        const response = await fetch(`${booted.baseUrl}/ai/demo`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-tenant-id': 'demo_off_account' },
          body: JSON.stringify({ prompt: 'hello' }),
        });

        const body = await readBody(response);
        expect(response.status).toBe(503);
        expect(body).toEqual(AUTH_NOT_CONFIGURED);
        // The real auth middleware sends no `code`; the demo middleware's refusals
        // always carry one. Its absence is the observable difference.
        expect((body as Record<string, unknown>).code).toBeUndefined();
        expect(DEMO_ONLY_CODES).not.toContain((body as Record<string, unknown>).code);
      });

      it('GET /me with x-tenant-id answers the same 503', async () => {
        booted = await bootApp(
          demoAuthValue === undefined
            ? { NODE_ENV: 'test' }
            : { NODE_ENV: 'test', DEMO_AUTH: demoAuthValue }
        );

        const response = await fetch(`${booted.baseUrl}/me`, {
          headers: { 'x-tenant-id': 'demo_off_account' },
        });

        const body = await readBody(response);
        expect(response.status).toBe(503);
        expect(body).toEqual(AUTH_NOT_CONFIGURED);
        expect((body as Record<string, unknown>).code).toBeUndefined();
      });

      for (const { label, value } of INVALID_DEMO_ACCOUNTS) {
        it(`no demo identity middleware is mounted: an x-demo-account that is ${label} still gets the auth 503, not DEMO_ACCOUNT_ID_INVALID`, async () => {
          booted = await bootApp(
            demoAuthValue === undefined
              ? { NODE_ENV: 'test' }
              : { NODE_ENV: 'test', DEMO_AUTH: demoAuthValue }
          );

          const response = await fetch(`${booted.baseUrl}/me`, {
            headers: { 'x-tenant-id': 'demo_off_account', 'x-demo-account': value },
          });

          const body = await readBody(response);
          // The demo middleware answers 400 DEMO_ACCOUNT_ID_INVALID for exactly
          // these shapes, so a 400 here would be the observation that it ran.
          expect(response.status).toBe(503);
          expect(body).toEqual(AUTH_NOT_CONFIGURED);
          expect((body as Record<string, unknown>).code).not.toBe('DEMO_ACCOUNT_ID_INVALID');
        });
      }

      it('reports demoAuthState() as inactive and, over HTTP, refuses to establish any demo identity', async () => {
        booted = await bootApp(
          demoAuthValue === undefined
            ? { NODE_ENV: 'test' }
            : { NODE_ENV: 'test', DEMO_AUTH: demoAuthValue }
        );

        const { demoAuthState } = await import('../src/middleware/demo-auth.js');
        expect(demoAuthState()).toEqual({ requested: false, active: false, refusal: null });

        // The strongest available observation that the gate is unreachable on
        // this process: a VALID id and an INVALID id produce byte-identical 503s.
        const valid = await fetch(`${booted.baseUrl}/me`, {
          headers: { 'x-tenant-id': 'demo_off_account', 'x-demo-account': 'demo_off_account' },
        });
        const invalid = await fetch(`${booted.baseUrl}/me`, {
          headers: { 'x-tenant-id': 'demo_off_account', 'x-demo-account': 'demo account' },
        });

        // A Response body can only be read once, so each is read exactly here.
        const validBody = await readBody(valid);
        const invalidBody = await readBody(invalid);

        expect(valid.status).toBe(503);
        expect(invalid.status).toBe(503);
        expect(validBody).toEqual(invalidBody);
        expect(validBody).toEqual(AUTH_NOT_CONFIGURED);
      }, 30000);
    });
  }
});

describe('DEMO_AUTH=true with NODE_ENV=production: the server refuses', () => {
  it('demoAuthState() reports active:false with refusal "production"', async () => {
    booted = await bootApp({ DEMO_AUTH: 'true', NODE_ENV: 'production' });

    const { demoAuthState, demoAuthRefusalMessage } = await import('../src/middleware/demo-auth.js');
    const state = demoAuthState();
    expect(state.active).toBe(false);
    expect(state.refusal).toBe('production');
    expect(state.requested).toBe(true);
    // The refusal is accompanied by one stable log line a deployment can grep.
    expect(demoAuthRefusalMessage(state)).toContain('REFUSED');
  });

  it('GET /me with a VALID x-demo-account is refused with 503 DEMO_AUTH_REFUSED_IN_PRODUCTION', async () => {
    booted = await bootApp({ DEMO_AUTH: 'true', NODE_ENV: 'production' });

    const response = await fetch(`${booted.baseUrl}/me`, {
      headers: { 'x-tenant-id': 'demo_prod_account', 'x-demo-account': 'demo_prod_account' },
    });

    const body = (await readBody(response)) as Record<string, unknown>;
    expect(response.status).toBe(503);
    expect(body.code).toBe('DEMO_AUTH_REFUSED_IN_PRODUCTION');
    // No demo identity may be handed back in the body.
    expect(body.auth).toBeUndefined();
    expect(body.tenant).toBeUndefined();
  });

  it('POST /ai/demo with a VALID x-demo-account is refused the same way (no demo identity, no handler run)', async () => {
    booted = await bootApp({ DEMO_AUTH: 'true', NODE_ENV: 'production' });

    const response = await fetch(`${booted.baseUrl}/ai/demo`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-tenant-id': 'demo_prod_account',
        'x-demo-account': 'demo_prod_account',
      },
      body: JSON.stringify({ prompt: 'hello' }),
    });

    const body = (await readBody(response)) as Record<string, unknown>;
    expect(response.status).toBe(503);
    expect(body.code).toBe('DEMO_AUTH_REFUSED_IN_PRODUCTION');
  });

  it('refuses an id that would otherwise be valid on every paid route, so the refusal is not id-dependent', async () => {
    booted = await bootApp({ DEMO_AUTH: 'true', NODE_ENV: 'production' });

    for (const path of ['/me', '/subscription/status'] as const) {
      const response = await fetch(`${booted.baseUrl}${path}`, {
        headers: { 'x-tenant-id': 'demo_prod_account', 'x-demo-account': 'demo_prod_account' },
      });
      const body = (await readBody(response)) as Record<string, unknown>;
      expect({ path, status: response.status, code: body.code }).toEqual({
        path,
        status: 503,
        code: 'DEMO_AUTH_REFUSED_IN_PRODUCTION',
      });
    }
  });
});

describe('DEMO_AUTH=true on a non-production instance: a demo identity can be established', () => {
  it('a valid x-demo-account establishes a demo identity on GET /me', async () => {
    booted = await bootApp({ DEMO_AUTH: 'true', NODE_ENV: 'test' });

    const { demoAuthState } = await import('../src/middleware/demo-auth.js');
    expect(demoAuthState()).toEqual({ requested: true, active: true, refusal: null });

    const accountId = 'wu4_demo_gate_valid';
    const response = await fetch(`${booted.baseUrl}/me`, {
      headers: { 'x-tenant-id': accountId, 'x-demo-account': accountId },
    });
    const body = (await readBody(response)) as {
      tenant?: { tenantId?: string };
      auth?: { userId?: string; tenantId?: string; metadata?: Record<string, unknown> };
    };

    expect(response.status).toBe(200);
    expect(body.tenant?.tenantId).toBe(accountId);
    expect(body.auth?.tenantId).toBe(accountId);
    // The marker the sample UI reads to label itself a demonstration mode.
    expect(body.auth?.metadata?.demoAuth).toBe(true);
    // ...and the marker that says what it is not: there is no session token.
    expect(body.auth?.metadata?.notAuthentication).toBe(true);
    expect(body.auth).not.toHaveProperty('token');
    expect(body.auth).not.toHaveProperty('jwt');
  });

  it('falls back to x-tenant-id when x-demo-account is absent', async () => {
    booted = await bootApp({ DEMO_AUTH: 'true', NODE_ENV: 'test' });

    const response = await fetch(`${booted.baseUrl}/me`, {
      headers: { 'x-tenant-id': 'wu4_demo_gate_fallback' },
    });
    const body = (await readBody(response)) as { auth?: { tenantId?: string; metadata?: Record<string, unknown> } };

    expect(response.status).toBe(200);
    expect(body.auth?.tenantId).toBe('wu4_demo_gate_fallback');
    expect(body.auth?.metadata?.demoAuth).toBe(true);
  });

  it('refuses an invalid x-demo-account with 400 DEMO_ACCOUNT_ID_INVALID, for each named shape', async () => {
    booted = await bootApp({ DEMO_AUTH: 'true', NODE_ENV: 'test' });

    const invalidAccounts: { label: string; value: string }[] = [
      { label: 'path traversal', value: '../../etc/passwd' },
      { label: 'longer than 64 chars', value: 'b'.repeat(65) },
      { label: 'a space', value: 'demo account' },
    ];

    for (const { label, value } of invalidAccounts) {
      const response = await fetch(`${booted.baseUrl}/me`, {
        headers: { 'x-tenant-id': 'wu4_demo_gate_valid', 'x-demo-account': value },
      });
      const body = (await readBody(response)) as Record<string, unknown>;
      expect({ label, status: response.status, code: body.code }).toEqual({
        label,
        status: 400,
        code: 'DEMO_ACCOUNT_ID_INVALID',
      });
      expect(body.auth).toBeUndefined();
      expect(body.tenant).toBeUndefined();
    }
  });

  it('accepts an id at exactly the 64-character boundary', async () => {
    booted = await bootApp({ DEMO_AUTH: 'true', NODE_ENV: 'test' });

    const accountId = 'c'.repeat(64);
    const response = await fetch(`${booted.baseUrl}/me`, {
      headers: { 'x-tenant-id': accountId, 'x-demo-account': accountId },
    });

    expect(response.status).toBe(200);
  });

  it('does NOT let a demo identity past the quota gate: an id with no subscription still gets 402 QUOTA_NOT_ENTITLED', async () => {
    // The point of the gate is that it grants no privilege. This is the same
    // process-wide in-memory subscription repository the route uses, so an id
    // that was never subscribed has no entitlement to consume.
    booted = await bootApp({ DEMO_AUTH: 'true', NODE_ENV: 'test' });

    const response = await fetch(`${booted.baseUrl}/ai/demo`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-tenant-id': 'wu4_demo_gate_no_subscription',
        'x-demo-account': 'wu4_demo_gate_no_subscription',
      },
      body: JSON.stringify({ prompt: 'hello' }),
    });

    const body = (await readBody(response)) as Record<string, unknown>;
    expect(response.status).toBe(402);
    expect(body.code).toBe('QUOTA_NOT_ENTITLED');
  });
});
