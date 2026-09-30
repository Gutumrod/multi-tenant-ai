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

// WHY THERE IS NO `export { app }` ANY MORE (HOUSE-SWARM-7 WU-4/WU-6; settled by
// H7-REVIEW-FIX-HYGIENE). The base revision `6010332` created the app at MODULE
// SCOPE and exported it:
//
//     const app = createApp();
//     app.listen(port, () => { ... });
//     export { app, createApp };
//
// Two things were wrong with that, and the entry-point guard below is what fixes
// them. First, importing this module bound the port: a test or a proof harness
// that only wanted `createApp` got a live listener on 3003 as a side effect.
// Second, `createApp()` (server/src/app.ts) reads `DEMO_AUTH` and decides which
// gate to mount, so that decision was made at IMPORT time, from whatever the
// importing context's environment happened to say, instead of from the
// environment the process is actually started with.
//
// The export list below is deliberate, and settled on evidence, not preference:
// NOTHING IN THIS REPOSITORY IMPORTS server/src/index.ts. Measured with a
// full-tree specifier search — `git grep -nIE "src/index"` returns only prose and
// the `tsx src/index.ts` entries in `server/package.json`; `git grep` across
// `git rev-list --all` for a specifier resolving to this file returns nothing;
// and `server/scripts/proofs/fu/index-import-safety.mjs` resolves the import
// specifiers of every code file under `server/src`, `server/tests`,
// `server/scripts`, `scripts`, `web` and `modules` — 149 files — and finds zero
// importers. The only consumers of this module are the two package scripts
// (`tsx src/index.ts` / `tsx watch src/index.ts`), which run it AS the entry
// point, where the guard calls `main()`.
//
// So no accessor is invented to replace the removed export: there is no caller to
// serve, and re-creating a module-scope `app` would restore exactly the defect the
// guard was written to remove. A caller that needs an app calls `createApp()`
// after setting its own environment. See
// `server/scripts/proofs/fu/index-import-safety.mjs` for the runnable proof:
// importing this module binds no port, starts no database work, and exports
// exactly `createApp` and `main`. Recorded also in
// `docs/product/WU6-CLAIMS-EVIDENCE.md` §8 and `docs/CURRENT_STATUS.md` §2.

// Auto-start only when this module is the process entry point. Importing it (a
// test or a proof harness) must not bind a port or touch the database.
const entryPath = process.argv[1] ? resolve(process.argv[1]) : '';
const selfPath = resolve(fileURLToPath(import.meta.url));
const invokedDirectly =
  entryPath !== '' && (entryPath === selfPath || entryPath === selfPath.replace(/\.ts$/, '.js'));

if (invokedDirectly) {
  await main();
}
