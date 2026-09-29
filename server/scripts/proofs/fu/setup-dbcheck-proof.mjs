#!/usr/bin/env node
/**
 * H7-FU-RATELIMIT-REPAIR4 regression harness (standalone Node ESM).
 *
 * THE TWO DEFECTS THIS EXISTS TO CATCH, both in step 5 of
 * `scripts/house-swarm-7/setup.sh` — the database step.
 *
 * DEFECT 1 — the database step FALSE-PASSES. The script used to decide the
 * result by matching db-check's output against two exact sentences and sending
 * everything else to a pass branch:
 *
 *     case "$CHECK_OUT" in
 *       *"CHECK connection FAIL"*)       die  ...
 *       *"CHECK migration-tables FAIL"*) say "PENDING: ..."
 *       *) say "database checks passed (exit $CHECK_STATUS)" ;;
 *     esac
 *
 * Any failure whose message was neither of those two sentences fell through to
 * the last branch, was announced as "database checks passed", and the script
 * still exited 0. Observed: a db-check printing `CHECK something-unexpected FAIL
 * boom` and exiting 2 produced `[setup] database checks passed (exit 2)` and
 * `SETUP_EXIT=0`. The operator then proceeded believing the schema was verified
 * while the check had failed. A non-zero db-check exit must never be reported as
 * a pass.
 *
 * DEFECT 2 — on Windows/Git-Bash the step could not run at all, and reported
 * that failure as success. `REPO_ROOT` is a POSIX path such as
 * `/d/path/to/project/...`; it was handed straight to native `node.exe`, which does
 * not translate it, so node looked the file up under the current drive and died
 * with `Cannot find module 'D:\d\path\to\project\...\db-check.mjs'`. Git-Bash's
 * `MSYS_NO_PATHCONV` / `MSYS2_ARG_CONV_EXCL` make that rewrite happen; with
 * either one set the absolute POSIX path fails. The same file invoked through a
 * RELATIVE path runs fine and reports `db-check: all 4 checks PASSED` in every
 * combination of those variables. The script's own header claims it runs in
 * Git-Bash on Windows, so this was inside its stated support surface.
 *
 * WHAT IT ASSERTS. Seven cases, each an independent check, each reporting the
 * exit code it actually observed:
 *
 *   1. `setup-really-executes-db-check` — a normal run against a real database
 *      really runs db-check (a `CHECK ` line is printed) and does not die with
 *      MODULE_NOT_FOUND. Forced with MSYS_NO_PATHCONV=1 and
 *      MSYS2_ARG_CONV_EXCL='*' so the run reproduces the Windows/Git-Bash
 *      environment in which defect 2 was observed. THIS IS THE DEFECT-2 CHECK: a
 *      script that silently skips or cannot resolve db-check fails it.
 *   2. `setup-exits-zero-with-a-fully-migrated-database` — and the run exits 0.
 *   3. `unrecognised-dbcheck-failure-makes-setup-exit-non-zero` — a db-check that
 *      exits 2 with an unrecognised message makes setup.sh exit non-zero.
 *      THIS IS THE DEFECT-1 CHECK.
 *   4. `no-pass-claimed-when-dbcheck-failed` — that same run does not claim the
 *      database passed.
 *   5. `recognised-connection-failure-still-named` — the connection case keeps
 *      its helpful message and still stops the script.
 *   6. `reachable-but-unmigrated-still-reported-pending` — the PENDING outcome is
 *      still exit 0, because the server creates the schema at boot. This is
 *      intentional and documented (`scripts/house-swarm-7/setup.md` §3.3).
 *   7. `demo-auth-refusal-and-database-url-refusal-intact` — the two environment
 *      refusals still behave.
 *
 * HOW IT DRIVES A FAILING db-check WITHOUT TOUCHING IT. The database step is
 * exercised by a stand-in `node` placed EARLIER ON PATH inside the temp copy: it
 * forwards every invocation to the real node except one argument ending in
 * `/db-check.mjs`, which it answers with a chosen exit code and output. The
 * repository's own `scripts/house-swarm-7/db-check.mjs` is never edited — it is
 * outside this repair's scope — and setup.sh's own prerequisite checks (which
 * run `node --version` and `npm --version` through the same PATH) prove the
 * stand-in forwards correctly: if it did not, every case would fail loudly at
 * setup.sh step 1.
 *
 * ISOLATION. It never writes inside the worktree: the copy, the stand-in and
 * every temporary artifact live under the OS temp dir, and the only thing it
 * deletes is the directory it created. It starts no server, deploys nothing and
 * reads no credential. The connection string is never printed — only host, port
 * and database name are reported.
 *
 * THE DATABASE. Cases 1 and 2 need a PostgreSQL whose migration schema and seed
 * plans already exist (all four db-check checks passing). The default is the
 * local test instance; override it with `SETUP_DBCHECK_PROOF_DATABASE_URL`. If
 * that database is not reachable, case 2 fails with the observed output rather
 * than reporting a pass.
 *
 * Usage:  node server/scripts/proofs/fu/setup-dbcheck-proof.mjs
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = join(HERE, '../../../..');

const DATABASE_URL =
  process.env.SETUP_DBCHECK_PROOF_DATABASE_URL ?? 'postgres://postgres@127.0.0.1:55432/mt01_fu3';

const SETUP_REL = 'scripts/house-swarm-7/setup.sh';

/**
 * Git-Bash path-conversion variables. Either one rewrites the absolute POSIX
 * path the old script handed to native node, which is how defect 2 appeared;
 * both are set on every normal run so the harness reproduces that environment
 * deterministically instead of depending on the ambient one.
 */
const MSYS_PATH_WRITERS = { MSYS_NO_PATHCONV: '1', MSYS2_ARG_CONV_EXCL: '*' };

/** The stand-in db-check responses. Exit codes and text are the point. */
const STUB_MODES = {
  nonstandard: {
    exitCode: 2,
    body:
      'CHECK something-unexpected FAIL boom\n',
    what: 'a failure whose message is not one of the two recognised sentences, exit 2',
  },
  connection: {
    exitCode: 1,
    body:
      'CHECK database-url-present PASS set, value not printed\n' +
      'CHECK connection FAIL connect ECONNREFUSED 127.0.0.1:5432\n',
    what: 'the recognised connection failure, exit 1',
  },
  migration: {
    exitCode: 1,
    body:
      'CHECK database-url-present PASS set, value not printed\n' +
      'CHECK connection PASS connected to the database in DATABASE_URL\n' +
      'CHECK migration-tables FAIL missing: tenants, plans; start the server once so the migrations run\n',
    what: 'the recognised reachable-but-unmigrated outcome, exit 1',
  },
  unmigrated: {
    exitCode: 1,
    // Byte-for-byte what scripts/house-swarm-7/db-check.mjs really prints
    // against a REACHABLE but UNMIGRATED database (observed on a real one).
    // The second failure line is db-check's own error handler reporting the
    // seed-plan query under the name "connection", even though the connection
    // itself succeeded — that line is what used to make setup.sh call a merely
    // un-migrated database unreachable.
    body:
      'CHECK database-url-present PASS DATABASE_URL is set in the process environment, value not printed\n' +
      'CHECK connection PASS connected to the database in DATABASE_URL\n' +
      'CHECK migration-tables FAIL missing: billing_event_ledger, plans, schema_migrations, subscriptions, tenants, usage_counters; start the server once so the migrations run\n' +
      'CHECK connection FAIL relation "plans" does not exist\n' +
      'db-check: 2 of 4 checks FAILED\n',
    what: 'the real shape of a reachable-but-unmigrated run: migration FAIL plus a second, misattributed connection FAIL, exit 1',
  },
};

const results = [];

function record(name, passed, detail) {
  results.push({ name, passed });
  console.log(`CHECK ${name} ${passed ? 'PASS' : 'FAIL'} ${detail}`);
}

function observation(line) {
  console.log(`OBSERVATION ${line}`);
}

/** host:port/database only — never the whole connection string. */
function describeDatabaseUrl(value) {
  try {
    const url = new URL(value);
    return `${url.hostname}:${url.port || '(default)'}${url.pathname}`;
  } catch {
    return '(unparseable DATABASE_URL; value not printed)';
  }
}

/** The lines of the database step, for the report. */
function databaseStepLines(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.includes('[setup] verifying the database'));
  if (start === -1) return [];
  return lines.slice(start, start + 12).filter((line) => line.trim() !== '');
}

/** True when db-check really ran: it prints one machine-readable CHECK line. */
function dbCheckExecuted(text) {
  return /^CHECK /m.test(text);
}

/** True when node could not resolve the file at all — defect 2's signature. */
function moduleNotFound(text) {
  return /Cannot find module|MODULE_NOT_FOUND/.test(text);
}

/** True when the database step claimed the checks passed, however worded. */
function claimedDatabasePass(text) {
  return /database checks passed|database checks PASSED/i.test(text);
}

let tempRoot = null;

const extraArgs = process.argv.slice(2);
if (extraArgs.length > 0) {
  console.error(
    `setup-dbcheck-proof: this harness takes no arguments, but received: ${extraArgs.join(' ')}. ` +
      'It always tests the repository it lives in. Refusing to run rather than silently ignore an argument.'
  );
  process.exit(2);
}

/**
 * Run setup.sh once. `shimDir` (or null) goes first on PATH; every entry in
 * `env` is added to the child environment; `args` are appended to the command.
 */
function runSetup(tree, { shimDir = null, stubMode = null, env = {}, args = [] } = {}) {
  const childEnv = { ...process.env, NODE_ENV: 'production', ...MSYS_PATH_WRITERS, ...env };
  if (shimDir !== null) {
    childEnv.PATH = `${shimDir}:${process.env.PATH ?? ''}`;
    childEnv.STUB_DBCHECK_MODE = stubMode;
  } else {
    delete childEnv.STUB_DBCHECK_MODE;
  }

  const run = spawnSync('sh', [SETUP_REL, ...args], {
    cwd: tree,
    env: childEnv,
    encoding: 'utf8',
    shell: false,
    timeout: 15 * 60 * 1000,
  });

  return {
    exitCode: run.status,
    signal: run.signal ?? null,
    error: run.error ?? null,
    output: `${run.stdout ?? ''}\n${run.stderr ?? ''}`,
  };
}

/** Write the stand-in `node` that answers db-check and forwards everything else. */
function writeShim(shimDir) {
  mkdirSync(shimDir, { recursive: true });
  const realNode = process.execPath.replace(/\\/g, '/');
  const branches = Object.entries(STUB_MODES)
    .map(([mode, spec]) => {
      const lines = spec.body
        .split('\n')
        .filter((line) => line !== '')
        .map((line) => `          printf '%s\\n' ${JSON.stringify(line)}`)
        .join('\n');
      return `        ${mode})\n${lines}\n          exit ${spec.exitCode}\n          ;;`;
    })
    .join('\n');

  const shim = `#!/bin/sh
# H7-FU-RATELIMIT-REPAIR4 stand-in node (temp copy only, never the repository).
# Forwards to the real node except for db-check.mjs, which it stubs.
REAL_NODE='${realNode}'
for a in "$@"; do
  case "$a" in
    */db-check.mjs)
      case "$STUB_DBCHECK_MODE" in
${branches}
        *)
          printf 'STUB_DBCHECK_MODE is not set\\n' >&2
          exit 3
          ;;
      esac
      ;;
  esac
done
exec "$REAL_NODE" "$@"
`;

  const dest = join(shimDir, 'node');
  writeFileSync(dest, shim);
  chmodSync(dest, 0o755);
  return dest;
}

try {
  observation(`repository under test: ${REPO_DIR}`);
  observation(`node: ${process.version}`);
  observation(`database target (host:port/database only): ${describeDatabaseUrl(DATABASE_URL)}`);
  observation(
    `forcing Git-Bash path-conversion variables on every run: ${Object.entries(MSYS_PATH_WRITERS)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ')} (either one made the old absolute POSIX path unresolvable)`
  );

  // --- the copy ------------------------------------------------------------
  tempRoot = mkdtempSync(join(tmpdir(), 'h7fu4-setup-dbcheck-'));
  const tree = join(tempRoot, 'tree');
  observation(`temp directory created under the OS temp dir: ${tempRoot}`);

  cpSync(REPO_DIR, tree, {
    recursive: true,
    filter: (src) => {
      const base = src.split(/[\\/]/).pop();
      return base !== 'node_modules' && base !== '.git';
    },
  });

  const missing = ['server/package.json', 'server/package-lock.json', SETUP_REL].filter(
    (rel) => !existsSync(join(tree, rel))
  );
  if (missing.length > 0) {
    record('copy-is-complete', false, `the copy is missing: ${missing.join(', ')}`);
    throw new Error('the copy is incomplete; cannot exercise setup.sh');
  }
  record('copy-is-complete', true, `the copy holds ${SETUP_REL} and server/package.json`);

  const shimDir = join(tempRoot, 'shim');
  const shimPath = writeShim(shimDir);
  observation(`stand-in node written for the failing cases: ${shimPath}`);

  const setupPath = join(tree, SETUP_REL);
  if (!existsSync(setupPath)) throw new Error(`${setupPath} is not there`);

  // --- case 1 & 2: a normal run really executes db-check --------------------
  observation('case normal: sh scripts/house-swarm-7/setup.sh  (real db-check, real database)');
  const normal = runSetup(tree, { env: { DATABASE_URL } });
  observation(`normal run: setup.sh exit code = ${normal.exitCode} (signal=${normal.signal ?? '(none)'})`);
  observation(`normal run, database step: ${JSON.stringify(databaseStepLines(normal.output))}`);
  if (normal.error) observation(`normal run could not be spawned: ${normal.error.message}`);

  const executed = dbCheckExecuted(normal.output);
  const notFound = moduleNotFound(normal.output);

  record(
    'setup-really-executes-db-check',
    executed && !notFound,
    `db_check_line_present=${executed} module_not_found=${notFound} ` +
      `(observed_exit_code=${normal.exitCode}; the old absolute POSIX path produced MODULE_NOT_FOUND here and setup.sh still exited 0)`
  );

  record(
    'setup-exits-zero-with-a-fully-migrated-database',
    normal.exitCode === 0,
    `observed_exit_code=${normal.exitCode} — needs a reachable database whose migration schema and seed plans exist`
  );

  // --- case 3 & 4: an unrecognised failure is never a pass -------------------
  observation(
    `case nonstandard: ${STUB_MODES.nonstandard.what} — db-check replaced by the stand-in on PATH`
  );
  const nonstandard = runSetup(tree, {
    shimDir,
    stubMode: 'nonstandard',
    env: { DATABASE_URL },
  });
  observation(
    `nonstandard run: setup.sh exit code = ${nonstandard.exitCode} (signal=${nonstandard.signal ?? '(none)'})`
  );
  observation(`nonstandard run, database step: ${JSON.stringify(databaseStepLines(nonstandard.output))}`);

  record(
    'unrecognised-dbcheck-failure-makes-setup-exit-non-zero',
    nonstandard.exitCode !== 0,
    `observed_exit_code=${nonstandard.exitCode} (a db-check exiting 2 with an unrecognised message used to give this 0)`
  );

  record(
    'no-pass-claimed-when-dbcheck-failed',
    !claimedDatabasePass(nonstandard.output),
    `claimed_a_pass=${claimedDatabasePass(nonstandard.output)} (the old pass branch printed "database checks passed (exit 2)")`
  );

  // --- case 5: the recognised connection failure keeps its message ----------
  observation(`case connection: ${STUB_MODES.connection.what}`);
  const connection = runSetup(tree, { shimDir, stubMode: 'connection', env: { DATABASE_URL } });
  observation(
    `connection run: setup.sh exit code = ${connection.exitCode} (signal=${connection.signal ?? '(none)'})`
  );
  observation(`connection run, database step: ${JSON.stringify(databaseStepLines(connection.output))}`);

  record(
    'recognised-connection-failure-still-named',
    connection.exitCode !== 0 && /could not connect to the database/.test(connection.output),
    `observed_exit_code=${connection.exitCode} named_the_connection_case=${/could not connect to the database/.test(
      connection.output
    )}`
  );

  // --- case 6: the intentional PENDING outcome is preserved -----------------
  observation(`case migration: ${STUB_MODES.migration.what}`);
  const migration = runSetup(tree, { shimDir, stubMode: 'migration', env: { DATABASE_URL } });
  observation(
    `migration run: setup.sh exit code = ${migration.exitCode} (signal=${migration.signal ?? '(none)'})`
  );
  observation(`migration run, database step: ${JSON.stringify(databaseStepLines(migration.output))}`);

  record(
    'reachable-but-unmigrated-still-reported-pending',
    migration.exitCode === 0 && /PENDING: the database is reachable/.test(migration.output),
    `observed_exit_code=${migration.exitCode} printed_pending=${/PENDING: the database is reachable/.test(
      migration.output
    )} (intentional: the server creates the schema at boot)`
  );

  // --- case 6b: the REAL shape of an un-migrated run is not called unreachable -
  // db-check emits a second, misattributed "connection FAIL" line in this case;
  // matching the connection arm first made setup.sh call a reachable database
  // unreachable. This asserts the migration arm wins, using db-check's real
  // output verbatim, so the ordering cannot silently regress without a database.
  observation(`case unmigrated: ${STUB_MODES.unmigrated.what}`);
  const unmigrated = runSetup(tree, { shimDir, stubMode: 'unmigrated', env: { DATABASE_URL } });
  observation(
    `unmigrated run: setup.sh exit code = ${unmigrated.exitCode} (signal=${unmigrated.signal ?? '(none)'})`
  );
  observation(`unmigrated run, database step: ${JSON.stringify(databaseStepLines(unmigrated.output))}`);

  const unmigratedPending = /PENDING: the database is reachable/.test(unmigrated.output);
  const unmigratedCalledUnreachable = /could not connect to the database/.test(unmigrated.output);

  record(
    'real-unmigrated-output-is-pending-not-unreachable',
    unmigrated.exitCode === 0 && unmigratedPending && !unmigratedCalledUnreachable,
    `observed_exit_code=${unmigrated.exitCode} printed_pending=${unmigratedPending} ` +
      `called_unreachable=${unmigratedCalledUnreachable} (db-check's second "connection FAIL relation \"plans\" does not exist" line must not win over the migration line)`
  );

  // --- case 7: the two environment refusals are untouched -------------------
  const demoAuth = runSetup(tree, { env: { DATABASE_URL, DEMO_AUTH: 'true' } });
  observation(`DEMO_AUTH=true run: setup.sh exit code = ${demoAuth.exitCode}`);
  const noUrl = runSetup(tree, { env: { DATABASE_URL: '' } });
  observation(`DATABASE_URL unset run: setup.sh exit code = ${noUrl.exitCode}`);

  const demoAuthRefused =
    demoAuth.exitCode !== 0 && /DEMO_AUTH=true is set/.test(demoAuth.output);
  const databaseUrlRefused =
    noUrl.exitCode !== 0 && /DATABASE_URL is not set/.test(noUrl.output);

  record(
    'demo-auth-refusal-and-database-url-refusal-intact',
    demoAuthRefused && databaseUrlRefused,
    `DEMO_AUTH=true observed_exit_code=${demoAuth.exitCode} refused=${demoAuthRefused}; ` +
      `unset DATABASE_URL observed_exit_code=${noUrl.exitCode} refused=${databaseUrlRefused}`
  );
} catch (error) {
  record('harness', false, `unexpected_error=${error.message}`);
} finally {
  if (tempRoot !== null) {
    try {
      rmSync(tempRoot, { recursive: true, force: true });
      observation(`removed the temp directory it created: ${tempRoot} (nothing outside it was touched)`);
    } catch (error) {
      observation(`could not remove ${tempRoot}: ${error.message}`);
    }
  }
}

const failed = results.filter((r) => !r.passed);
console.log(
  `SUMMARY checks=${results.length} passed=${results.length - failed.length} failed=${failed.length}` +
    (failed.length > 0 ? ` failed_names=[${failed.map((f) => f.name).join(',')}]` : '')
);
if (failed.length > 0) process.exitCode = 1;
