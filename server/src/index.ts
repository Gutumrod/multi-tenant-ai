import { createApp } from './app.js';
import { initSubscriptionRepositories } from './lib/subscriptions.js';
import { demoAuthRefusalMessage, demoAuthState, DEMO_AUTH_ENV } from './middleware/demo-auth.js';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3003;

/**
 * Start-up order (HOUSE-SWARM-7 WU-4): when DATABASE_URL is configured the
 * pending migrations are applied and the seed plans written BEFORE the first
 * request is served, so the sample UI's plan catalogue is never read against a
 * half-migrated schema. Without DATABASE_URL this is a no-op (initSubscriptionRepositories
 * reports persistent=false) and the process keeps the in-memory repositories.
 *
 * The demonstration identity flag is reported at boot as well as at request time,
 * because a refused activation must be visible in the deployment log.
 */
async function main(): Promise<void> {
  const demoAuth = demoAuthState();
  const refusal = demoAuthRefusalMessage(demoAuth);
  if (refusal) {
    console.error(refusal);
  } else if (demoAuth.active) {
    console.warn(
      `[demo-auth] ${DEMO_AUTH_ENV}=true: demonstration identity mode is ON. This is NOT authentication.`
    );
  }

  try {
    const wired = await initSubscriptionRepositories();
    console.log(
      `Subscription repositories ready: persistent=${wired.persistent} ` +
        `subscriptions=${wired.subscriptionRepo.constructor.name} ` +
        `usageCounters=${wired.usageCounterRepo.constructor.name}`
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Migration/seed failed: ${message}`);
    throw error;
  }

  const app = createApp();

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

export { createApp, main };

// Auto-start only when this module is the process entry point. Importing it (a
// test or a proof harness) must not bind a port or touch the database.
const entryPath = process.argv[1] ? resolve(process.argv[1]) : '';
const selfPath = resolve(fileURLToPath(import.meta.url));
const invokedDirectly =
  entryPath !== '' && (entryPath === selfPath || entryPath === selfPath.replace(/\.ts$/, '.js'));

if (invokedDirectly) {
  await main();
}
