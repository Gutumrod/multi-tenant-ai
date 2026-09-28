#!/usr/bin/env node
/**
 * H7-FU-RATELIMIT-REPAIR3 regression harness (standalone Node ESM).
 *
 * THE DEFECT THIS EXISTS TO CATCH. `scripts/house-swarm-7/setup.md` section 3.1
 * told the reader to `export NODE_ENV=production` and then run
 * `scripts/house-swarm-7/setup.sh`, and the script ran a bare `npm ci`. npm
 * honours `NODE_ENV=production` and OMITS devDependencies from an install made
 * in that environment, and `tsx` and `typescript` are devDependencies — so the
 * documented path installed 84 packages instead of 122, with neither package
 * present. The script's own step 4 (`npm run typecheck`) then died with
 * `'tsc' is not recognized` and exit 1, and `npm run start` (which runs `tsx`)
 * would have died the same way. The documented path did not produce a tree that
 * could start or typecheck.
 *
 * WHAT IT DOES, in order:
 *
 *   1. copies the repository tree to a fresh directory under the OS temp dir,
 *      EXCLUDING `node_modules` and `.git`, so the install inside it starts
 *      from the same state a delivered folder is in (no dependency fetched for
 *      you) without copying this worktree's installed tree;
 *   2. runs `scripts/house-swarm-7/setup.sh` inside that copy with
 *      `NODE_ENV=production` and a `DATABASE_URL` — exactly the environment the
 *      manual prescribes — and reports the exit code VERBATIM;
 *   3. asserts (a) that exit code is 0 and (b) that `server/node_modules/tsx`
 *      and `server/node_modules/typescript` exist afterwards, each with a
 *      readable `package.json` that names the package (so an empty directory
 *      cannot pass);
 *   4. prints one line per observation and exits non-zero if any check failed,
 *      so it is usable as a gate.
 *
 * ISOLATION. It never writes inside the worktree: every step happens in the temp
 * directory it created, and the only thing it deletes is that directory. It
 * starts no server, deploys nothing, opens no network connection of its own and
 * reads no credential.
 *
 * THE DATABASE. `setup.sh` refuses to run without `DATABASE_URL`, so this
 * harness needs a reachable PostgreSQL. The default below is the local test
 * instance; override it with `SETUP_PROOF_DATABASE_URL`. The connection string
 * is never printed — only its host, port and database name are reported.
 *
 * TWO INHERITED MSYS VARIABLES ARE REMOVED FROM THE CHILD ENVIRONMENT, and the
 * harness says so in its output. `MSYS_NO_PATHCONV` and `MSYS2_ARG_CONV_EXCL`
 * make git-bash rewrite the absolute path that `setup.sh` computes for
 * `scripts/house-swarm-7/db-check.mjs`, so the child `node` is handed
 * `C:\tmp\...` instead of the real path and the database step dies with
 * MODULE_NOT_FOUND — and `setup.sh` still exits 0, because step 5 treats a
 * db-check that did not print `CHECK connection FAIL` as a pass. Neither
 * variable is part of the documented environment (section 3.3 of the manual) and
 * neither has anything to do with the defect under test, so they are removed
 * rather than allowed to make this gate unreadable. Note for the reader: that
 * step-5 fall-through is a real weakness in `setup.sh` and is NOT what this
 * harness repairs.
 *
 * Usage:  node server/scripts/proofs/fu/setup-node-env-proof.mjs
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = join(HERE, '../../../..');

const DATABASE_URL =
  process.env.SETUP_PROOF_DATABASE_URL ?? 'postgres://postgres@127.0.0.1:55432/mt01_fu3';

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

/** Count directory entries, or 0 when the directory is not there. */
function countEntries(dir) {
  try {
    return readdirSync(dir).length;
  } catch {
    return 0;
  }
}

/**
 * A package is "installed" only when its directory exists AND its package.json
 * parses AND declares the expected name. An empty directory fails.
 */
function installedPackage(dir, expectedName) {
  const manifestPath = join(dir, 'package.json');
  if (!existsSync(manifestPath)) return { ok: false, detail: `${manifestPath} does not exist` };
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (manifest.name !== expectedName) {
      return { ok: false, detail: `${manifestPath} names "${manifest.name}", expected "${expectedName}"` };
    }
    return { ok: true, detail: `name=${manifest.name} version=${manifest.version}` };
  } catch (error) {
    return { ok: false, detail: `${manifestPath} is not readable JSON: ${error.message}` };
  }
}

/** The setup script's output, trimmed for the report. */
function tail(text, lines = 12) {
  const all = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  return all.slice(-lines);
}

let tempRoot = null;

const extraArgs = process.argv.slice(2);
if (extraArgs.length > 0) {
  console.error(
    `setup-node-env-proof: this harness takes no arguments, but received: ${extraArgs.join(' ')}. ` +
      'It always tests the repository it lives in. Refusing to run rather than silently ignore an argument.'
  );
  process.exit(2);
}

try {
  observation(`repository under test: ${REPO_DIR}`);
  observation(`node: ${process.version}`);

  // --- 1. copy the tree, without any installed dependencies ------------------
  tempRoot = mkdtempSync(join(tmpdir(), 'h7fu3-setup-node-env-'));
  const tree = join(tempRoot, 'tree');
  observation(`temp directory created under the OS temp dir: ${tempRoot}`);

  cpSync(REPO_DIR, tree, {
    recursive: true,
    filter: (src) => {
      const base = src.split(/[\\/]/).pop();
      return base !== 'node_modules' && base !== '.git';
    },
  });

  const copiedServerNodeModules = join(tree, 'server', 'node_modules');
  const copiedFiles = ['server/package.json', 'server/package-lock.json', 'scripts/house-swarm-7/setup.sh'];
  const missing = copiedFiles.filter((rel) => !existsSync(join(tree, rel)));
  observation(`copied tree: node_modules entries at the start = ${countEntries(copiedServerNodeModules)}`);
  record(
    'copy-is-complete-and-has-no-installed-tree',
    missing.length === 0 && !existsSync(copiedServerNodeModules),
    missing.length === 0
      ? `server/package.json, server/package-lock.json and scripts/house-swarm-7/setup.sh are present in the copy and server/node_modules does not exist yet`
      : `the copy is missing: ${missing.join(', ')}`
  );
  if (missing.length > 0) throw new Error('the copy is incomplete; cannot exercise setup.sh');

  // --- 2. run setup.sh in the environment the manual prescribes -------------
  observation(`database target (host:port/database only): ${describeDatabaseUrl(DATABASE_URL)}`);
  observation('running: sh scripts/house-swarm-7/setup.sh  with NODE_ENV=production and DATABASE_URL set');

  // MSYS path-conversion variables are removed: see the note at the top. They
  // are not part of the documented environment and they corrupt the absolute
  // path setup.sh hands to the child node for db-check.mjs.
  const inheritedMsys = ['MSYS_NO_PATHCONV', 'MSYS2_ARG_CONV_EXCL'].filter(
    (name) => process.env[name] !== undefined
  );
  observation(
    inheritedMsys.length === 0
      ? 'MSYS path-conversion variables: none were set in this environment'
      : `MSYS path-conversion variables removed from the child environment: ${inheritedMsys.join(', ')}`
  );

  const childEnv = {
    ...process.env,
    NODE_ENV: 'production',
    DATABASE_URL,
  };
  for (const name of inheritedMsys) delete childEnv[name];

  const run = spawnSync('sh', ['scripts/house-swarm-7/setup.sh'], {
    cwd: tree,
    env: childEnv,
    encoding: 'utf8',
    shell: false,
    timeout: 15 * 60 * 1000,
  });

  const exitCode = run.status;
  const stdout = run.stdout ?? '';
  const stderr = run.stderr ?? '';
  const combined = `${stdout}\n${stderr}`;

  observation(`setup.sh exit code = ${exitCode} (signal=${run.signal ?? '(none)'})`);
  observation(`setup.sh output, last lines: ${JSON.stringify(tail(combined))}`);

  if (run.error) {
    observation(`setup.sh could not be spawned: ${run.error.message}`);
  }

  record(
    'setup-script-exits-zero-under-node-env-production',
    exitCode === 0,
    `observed_exit_code=${exitCode} (a bare "npm ci" under NODE_ENV=production omitted tsc/tsx and made this 1)`
  );

  observation(
    `install line observed: ${
      combined.includes('npm ci --include=dev') ? '"npm ci --include=dev"' : '(not found in the output)'
    }`
  );

  // The script's own last words: if it printed this, it ran to the end.
  record(
    'setup-script-ran-to-completion',
    combined.includes('[setup] setup complete.'),
    `reachable_steps: typecheck=${combined.includes('[setup] running the typecheck')} database=${
      combined.includes('[setup] verifying the database')
    } complete=${combined.includes('[setup] setup complete.')}`
  );

  // --- 3. the devDependencies the documented path used to lose --------------
  const nodeModules = join(tree, 'server', 'node_modules');
  const tsx = installedPackage(join(nodeModules, 'tsx'), 'tsx');
  const typescript = installedPackage(join(nodeModules, 'typescript'), 'typescript');

  observation(`server/node_modules entries after the install = ${countEntries(nodeModules)}`);
  observation(`server/node_modules/tsx exists=${existsSync(join(nodeModules, 'tsx'))} ${tsx.detail}`);
  observation(`server/node_modules/typescript exists=${existsSync(join(nodeModules, 'typescript'))} ${typescript.detail}`);

  record(
    'devdependency-tsx-present-after-production-install',
    exitCode === 0 && tsx.ok,
    tsx.ok
      ? `server/node_modules/tsx is installed (${tsx.detail}); "npm run start" runs tsx, so the tree can start`
      : `server/node_modules/tsx is missing or not a package: ${tsx.detail}`
  );

  record(
    'devdependency-typescript-present-after-production-install',
    exitCode === 0 && typescript.ok,
    typescript.ok
      ? `server/node_modules/typescript is installed (${typescript.detail}); "npm run typecheck" runs tsc, so the tree can typecheck`
      : `server/node_modules/typescript is missing or not a package: ${typescript.detail}`
  );
} catch (error) {
  record('harness', false, `unexpected_error=${error.message}`);
} finally {
  // --- 4. remove exactly the temp directory this run created -----------------
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
