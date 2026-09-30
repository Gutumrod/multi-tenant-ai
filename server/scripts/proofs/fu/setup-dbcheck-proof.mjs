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
 * THE THIRD DEFECT THIS NOW ALSO CATCHES — a duplicated, misnamed diagnostic.
 * On a reachable but entirely un-migrated database `db-check.mjs` printed
 * `CHECK connection PASS ...` and then, one line later, `CHECK connection FAIL
 * relation "plans" does not exist`: it ran its seed-plan query against a table
 * the migrations had not created yet, and its single catch block reported the
 * resulting query error under the name `connection`. The connection had
 * succeeded; the reader was told it had not, and the same word appeared twice
 * in contradictory senses. Cases 8 and 9 below assert the repaired behaviour
 * from the setup.sh side — on the real un-migrated output there is no line
 * claiming a connection failure, the step still says PENDING, and it still
 * exits 0 — and the `unmigrated` stub carries db-check's real post-repair
 * output shape, so this keeps holding when that shape changes. `db-check.mjs`
 * itself now names every check after the step that ran it, and does not run the
 * seed-plan query before the tables it reads exist.
 *
 * WHAT IT ASSERTS. Nine cases, each an independent check, each reporting the
 * exit code it actually observed. Cases 1–7 are the two repairs above; case 8
 * is the Owner's requirement on the diagnostic wording itself, and case 9
 * pins the real post-repair output shape of a reachable-but-unmigrated database
 * so the PENDING recognition cannot regress when that shape changes:
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
 *   8. `unmigrated-output-names-no-connection-failure` — THE OWNER'S REQUIREMENT.
 *      On the real un-migrated output (stub mode `unmigrated`), setup.sh must
 *      print `PENDING` and its whole output must contain NO line claiming a
 *      connection failure, and it must exit 0. This is the case that fails if
 *      db-check ever again reports a post-connect query failure under the name
 *      "connection", because setup.sh would then say the database could not be
 *      reached.
 *   9. `real-unmigrated-output-is-pending-not-unreachable` — the same run, from
 *      the other side: db-check's real post-repair output shape still lands in
 *      the PENDING arm rather than in the unrecognised-failure arm.
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
    // NOTE the exit code: NOT 2. `2` is now db-check's own PENDING code, so a
    // body like this one carried on exit 2 would (correctly) be read as PENDING
    // and this case would prove nothing. `3` is a failure code that is neither
    // "passed" nor "not migrated yet", which is what an unrecognised failure is.
    exitCode: 3,
    body:
      'CHECK something-unexpected FAIL boom\n',
    what: 'a failure whose message is not one of the recognised sentences and whose exit code is neither 0 nor 2 (PENDING), exit 3',
  },
  connection: {
    exitCode: 1,
    body:
      'CHECK database-url-present PASS set, value not printed\n' +
      'CHECK connection FAIL connect ECONNREFUSED 127.0.0.1:5432\n',
    what: 'the recognised connection failure, exit 1',
  },
  migration: {
    exitCode: 2,
    body:
      'CHECK database-url-present PASS set, value not printed\n' +
      'CHECK connection PASS connected to the database in DATABASE_URL\n' +
      'CHECK migration-tables FAIL missing: tenants, plans; start the server once so the migrations run\n',
    what: 'a reachable-but-unmigrated run in its MINIMAL shape — only the migration failure is present, with no seed-plan line at all — carrying db-check\'s PENDING exit code 2',
  },
  // THE DECISIVE CASE FOR "THE EXIT CODE DECIDES, NOT THE TEXT". This body is a
  // byte-identical copy of the PENDING shape above but exits 1 — i.e. what a
  // broken db-check WOULD print if it forgot to set the PENDING code. Reading
  // the text would call this PENDING and let setup.sh continue; reading the exit
  // code calls it a failure. This is the case that fails if anyone re-introduces
  // text matching.
  pendingTextButFailureCode: {
    exitCode: 1,
    body:
      'CHECK database-url-present PASS set, value not printed\n' +
      'CHECK connection PASS connected to the database in DATABASE_URL\n' +
      'CHECK migration-tables FAIL missing: tenants, plans; start the server once so the migrations run\n',
    what: 'a PENDING-shaped message with a FAILURE exit code — the exit code must decide, so setup.sh must stop',
  },
  unmigrated: {
    exitCode: 2,
    // Byte-for-byte what scripts/house-swarm-7/db-check.mjs really prints
    // against a REACHABLE but UNMIGRATED database AFTER the diagnostic repair
    // (observed on a real empty database — `mt01_presale_empty`).
    //
    // `CHECK connection PASS` is the load-bearing line: the connection really
    // succeeded. The two failing checks name the schema and the seed query, and
    // NEITHER of them is called "connection". The seed-plan check says plainly
    // that it was not run because there is no plans table yet, instead of
    // running its query anyway and reporting the resulting
    // `relation "plans" does not exist` error as a connection failure.
    body:
      'CHECK database-url-present PASS DATABASE_URL is set in the process environment, value not printed\n' +
      'CHECK connection PASS connected to the database in DATABASE_URL\n' +
      'CHECK migration-tables PENDING missing: billing_event_ledger, plans, schema_migrations, subscriptions, tenants, usage_counters; start the server once so the migrations run\n' +
      'CHECK seed-plans PENDING not run: the schema is not created yet, so there is no plans table to read; start the server once so the migrations run\n' +
      'db-check: PENDING — the database is reachable but 2 schema check(s) not done yet (migration-tables, seed-plans); the server creates the schema at boot\n',
    what: 'the real post-repair shape of a reachable-but-unmigrated run: connection PASS, migration FAIL, seed-plans FAIL as not-run — no check named "connection" fails, exit 2 (db-check\'s own PENDING code)',
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

/**
 * Whether a run's exit code may be used as an OBSERVATION at all.
 *
 * `spawnSync` reports `status: null` when the child never produced an exit code:
 * it was killed by a signal, it could not be spawned, or (on Windows) the shell
 * shim it was launched through did not propagate one. A null exit is NOT an exit
 * code, so no case may conclude anything from it — least of all a refusal case,
 * which would otherwise pass because "the code was not 0". Every case below
 * asserts `spawn_ok` for exactly this reason, and the whole-run check
 * `every-case-produced-an-exit-code` makes a null exit a FAILURE of the harness
 * rather than a silent detail.
 */
function spawnedWithExitCode(run) {
  return run.error === null && run.signal === null && typeof run.exitCode === 'number';
}

/**
 * True when the run contains a line claiming a CONNECTION failure, whatever
 * produced it: db-check's own `CHECK connection FAIL` line, or setup.sh's
 * explanation for it. The Owner's requirement is that an un-migrated database
 * produces neither. This looks for an actual `CHECK connection FAIL ` line
 * (with a value after the verdict) so it cannot be satisfied by the harmless
 * phrase appearing inside a comment.
 */
function claimsConnectionFailure(text) {
  return /CHECK connection FAIL\s+\S/.test(text) || /could not connect to the database/.test(text);
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

  const normalSpawned = spawnedWithExitCode(normal);

  record(
    'setup-really-executes-db-check',
    executed && !notFound && normalSpawned,
    `db_check_line_present=${executed} module_not_found=${notFound} spawn_ok=${normalSpawned} ` +
      `spawn_error=${normal.error ? normal.error.message : '(none)'} signal=${normal.signal ?? '(none)'} ` +
      `(observed_exit_code=${normal.exitCode}; the old absolute POSIX path produced MODULE_NOT_FOUND here and setup.sh still exited 0)`
  );

  record(
    'setup-exits-zero-with-a-fully-migrated-database',
    normalSpawned && normal.exitCode === 0,
    `observed_exit_code=${normal.exitCode} spawn_ok=${normalSpawned} — needs a reachable database whose migration schema and seed plans exist`
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

  const nonstandardSpawned = spawnedWithExitCode(nonstandard);

  record(
    'unrecognised-dbcheck-failure-makes-setup-exit-non-zero',
    nonstandardSpawned && nonstandard.exitCode !== 0,
    `observed_exit_code=${nonstandard.exitCode} spawn_ok=${nonstandardSpawned} ` +
      `spawn_error=${nonstandard.error ? nonstandard.error.message : '(none)'} signal=${nonstandard.signal ?? '(none)'} ` +
      '(a db-check exiting 3 with an unrecognised message used to give this 0; exit 2 is PENDING, so a failure must not borrow it, and a null exit code is never a refusal)'
  );

  record(
    'no-pass-claimed-when-dbcheck-failed',
    nonstandardSpawned && !claimedDatabasePass(nonstandard.output),
    `claimed_a_pass=${claimedDatabasePass(nonstandard.output)} spawn_ok=${nonstandardSpawned} (the old pass branch printed "database checks passed (exit 2)")`
  );

  // --- case 5: the recognised connection failure keeps its message ----------
  // The GENUINE connection failure: db-check could not open the connection at
  // all, so `CHECK connection FAIL` is the correct line and setup.sh must name
  // it and stop.
  observation(`case connection: ${STUB_MODES.connection.what}`);
  const connection = runSetup(tree, { shimDir, stubMode: 'connection', env: { DATABASE_URL } });
  observation(
    `connection run: setup.sh exit code = ${connection.exitCode} (signal=${connection.signal ?? '(none)'})`
  );
  observation(`connection run, database step: ${JSON.stringify(databaseStepLines(connection.output))}`);

  const connectionFailLine = /CHECK connection FAIL\s+\S/.test(connection.output);
  const connectionNamed = /could not connect to the database/.test(connection.output);

  const connectionSpawned = spawnedWithExitCode(connection);

  record(
    'recognised-connection-failure-still-named',
    connectionSpawned && connection.exitCode !== 0 && connectionFailLine && connectionNamed,
    `observed_exit_code=${connection.exitCode} spawn_ok=${connectionSpawned} ` +
      `check_connection_FAIL_line=${connectionFailLine} named_the_connection_case=${connectionNamed} ` +
      '(an unreachable database must still be reported as one)'
  );

  // --- case 6: the intentional PENDING outcome is preserved -----------------
  observation(`case migration: ${STUB_MODES.migration.what}`);
  const migration = runSetup(tree, { shimDir, stubMode: 'migration', env: { DATABASE_URL } });
  observation(
    `migration run: setup.sh exit code = ${migration.exitCode} (signal=${migration.signal ?? '(none)'})`
  );
  observation(`migration run, database step: ${JSON.stringify(databaseStepLines(migration.output))}`);

  const migrationSpawned = spawnedWithExitCode(migration);

  record(
    'reachable-but-unmigrated-still-reported-pending',
    migrationSpawned && migration.exitCode === 0 && /PENDING: the database is reachable/.test(migration.output),
    `observed_exit_code=${migration.exitCode} spawn_ok=${migrationSpawned} printed_pending=${/PENDING: the database is reachable/.test(
      migration.output
    )} (intentional: the server creates the schema at boot)`
  );

  // --- case 6b / 8: THE OWNER'S REQUIREMENT on the real un-migrated output --
  // Run against the real, post-repair shape of a reachable-but-un-migrated
  // database: `CHECK connection PASS`, a migration failure, and the seed-plan
  // query reported as NOT RUN rather than attempted. The step must call it
  // PENDING, exit 0, and its whole output must contain NO line claiming a
  // connection failure — the duplicated `CHECK connection FAIL` this repair
  // removed. The stub is kept, rather than deleted, precisely so this holds
  // when the real shape changes underneath it.
  observation(`case unmigrated: ${STUB_MODES.unmigrated.what}`);
  const unmigrated = runSetup(tree, { shimDir, stubMode: 'unmigrated', env: { DATABASE_URL } });
  observation(
    `unmigrated run: setup.sh exit code = ${unmigrated.exitCode} (signal=${unmigrated.signal ?? '(none)'})`
  );
  observation(`unmigrated run, database step: ${JSON.stringify(databaseStepLines(unmigrated.output))}`);

  const unmigratedPending = /PENDING: the database is reachable/.test(unmigrated.output);
  const unmigratedCalledUnreachable = claimsConnectionFailure(unmigrated.output);
  const unmigratedPassLines = (unmigrated.output.match(/^CHECK .*$/gm) ?? []).filter((line) =>
    /^CHECK connection PASS\b/.test(line)
  ).length;

  const unmigratedSpawned = spawnedWithExitCode(unmigrated);

  record(
    'unmigrated-output-names-no-connection-failure',
    unmigratedSpawned && unmigrated.exitCode === 0 && unmigratedPending && !unmigratedCalledUnreachable,
    `observed_exit_code=${unmigrated.exitCode} spawn_ok=${unmigratedSpawned} printed_pending=${unmigratedPending} ` +
      `claims_a_connection_failure=${unmigratedCalledUnreachable} connection_PASS_lines=${unmigratedPassLines} ` +
      '(the Owner\'s requirement: on the un-migrated output there must be no "CHECK connection FAIL" line)'
  );

  record(
    'real-unmigrated-output-is-pending-not-unreachable',
    unmigratedSpawned && unmigrated.exitCode === 0 && unmigratedPending && !unmigratedCalledUnreachable,
    `observed_exit_code=${unmigrated.exitCode} spawn_ok=${unmigratedSpawned} printed_pending=${unmigratedPending} ` +
      `called_unreachable=${unmigratedCalledUnreachable} (db-check\'s real post-repair output — connection PASS, migration FAIL, seed-plans not run — must reach the PENDING arm and never the unreachable one)`
  );

  // --- case 6c: THE EXIT CODE DECIDES, NOT THE TEXT -------------------------
  // A byte-identical PENDING-shaped body that carries a FAILURE exit code. Text
  // matching would call this PENDING and let the script continue; the exit code
  // calls it a failure. This is the case that catches a re-introduction of text
  // matching, and it is the mirror of case 6 (a PENDING code with a minimal body,
  // which must be PENDING because the code says so).
  observation(`case pendingTextButFailureCode: ${STUB_MODES.pendingTextButFailureCode.what}`);
  const textOnlyPending = runSetup(tree, {
    shimDir,
    stubMode: 'pendingTextButFailureCode',
    env: { DATABASE_URL },
  });
  observation(
    `pendingTextButFailureCode run: setup.sh exit code = ${textOnlyPending.exitCode} (signal=${textOnlyPending.signal ?? '(none)'})`
  );
  observation(
    `pendingTextButFailureCode run, database step: ${JSON.stringify(databaseStepLines(textOnlyPending.output))}`
  );

  const textOnlyPendingSpawned = spawnedWithExitCode(textOnlyPending);
  const textOnlyClaimedPending = /PENDING: the database is reachable/.test(textOnlyPending.output);

  record(
    'pending-shaped-text-with-a-failure-exit-code-does-not-continue',
    textOnlyPendingSpawned && textOnlyPending.exitCode !== 0 && !textOnlyClaimedPending,
    `observed_exit_code=${textOnlyPending.exitCode} spawn_ok=${textOnlyPendingSpawned} ` +
      `called_it_pending=${textOnlyClaimedPending} (the body is the PENDING shape but the exit code is a failure: ` +
      'the code must decide, so the script must stop and must not print PENDING)'
  );

  // --- case 7: the two environment refusals are untouched -------------------
  const demoAuth = runSetup(tree, { env: { DATABASE_URL, DEMO_AUTH: 'true' } });
  observation(`DEMO_AUTH=true run: setup.sh exit code = ${demoAuth.exitCode}`);
  const noUrl = runSetup(tree, { env: { DATABASE_URL: '' } });
  observation(`DATABASE_URL unset run: setup.sh exit code = ${noUrl.exitCode}`);

  const demoAuthSpawned = spawnedWithExitCode(demoAuth);
  const noUrlSpawned = spawnedWithExitCode(noUrl);

  const demoAuthRefused =
    demoAuthSpawned && demoAuth.exitCode !== 0 && /DEMO_AUTH=true is set/.test(demoAuth.output);
  const databaseUrlRefused =
    noUrlSpawned && noUrl.exitCode !== 0 && /DATABASE_URL is not set/.test(noUrl.output);

  record(
    'demo-auth-refusal-and-database-url-refusal-intact',
    demoAuthRefused && databaseUrlRefused,
    `DEMO_AUTH=true observed_exit_code=${demoAuth.exitCode} spawn_ok=${demoAuthSpawned} refused=${demoAuthRefused}; ` +
      `unset DATABASE_URL observed_exit_code=${noUrl.exitCode} spawn_ok=${noUrlSpawned} refused=${databaseUrlRefused}`
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
