#!/usr/bin/env node
/**
 * H7-REVIEW-FIX-HYGIENE index-import-safety proof (standalone Node ESM).
 *
 * THE QUESTION THIS SETTLES. The base revision of `server/src/index.ts`
 * (`6010332`) created the app at MODULE SCOPE and exported it:
 *
 *     const app = createApp();
 *     app.listen(port, () => { ... });
 *     export { app, createApp };
 *
 * So importing that module bound the port at import time, and `createApp()` —
 * which reads `DEMO_AUTH` and decides which gate to mount — ran at import time
 * too. WU-4/WU-6 replaced that with a `main()` that owns creation plus an
 * entry-point guard, and the export list became `export { createApp, main }`; the
 * module-scope `app` is gone. Review
 * `REVIEW-SWARM-7-MT01-WU2-WU6-CLAUDE-2026-09-28.md` recorded the removal and
 * asked for it to be settled on evidence.
 *
 * This harness is that evidence, and it asserts the properties the removal rests
 * on rather than trusting a comment:
 *
 *   1. importing `server/src/index.ts` binds NO listening port;
 *   2. importing it starts NO database work (no migration, no seed, no pool use);
 *   3. it exports exactly `createApp` and `main` — `app` is not an export;
 *   4. the module-scope `app` is really gone and the entry-point guard is really
 *      there in the source; and
 *   5. nothing in this repository imports `server/src/index.ts`, which is what
 *      makes the missing `app` export a non-issue rather than a broken API.
 *
 * HOW 1 AND 2 ARE OBSERVED, not assumed. A small driver is written to the OS temp
 * dir at run time and started as a CHILD process with
 * `node --import tsx <driver>`. Before it imports the real `index.ts` the driver
 * (a) replaces `net.Server.prototype.listen` with a recorder, so every attempt to
 * bind a listening port is captured with its arguments, and (b) captures the
 * console output the module emits, so an app boot line (`Server listening on port
 * …`, `Subscription repositories ready: …`, `[demo-auth] …`, `Migration/seed
 * failed: …`) would be visible if `main()` had run. It then imports
 * `server/src/index.ts`, prints one `INDEX_IMPORT_PROBE` JSON line with what it
 * saw, and exits.
 *
 * The driver runs TWICE, so the "no database work" claim does not depend on the
 * caller's environment:
 *
 *   * run A — `DATABASE_URL` points at a DEAD loopback port. If `main()` ran, the
 *     migration call would fail within the connect timeout and the process would
 *     print `Migration/seed failed: …`. It must print nothing of the sort.
 *   * run B — `DATABASE_URL` is removed. If `main()` ran it would still print
 *     `Subscription repositories ready: persistent=false …`. It must not.
 *
 * The observed `TCPServerWrap` entries in `process.getActiveResourcesInfo()` are
 * reported as a second, independent signal for check 1: a process holding a bound
 * TCP server has such a handle, and this one must have none. Each child's exit
 * code is reported and asserted to be 0.
 *
 * HOW 5 IS CHECKED. Every code file in this repository (`.ts`, `.mts`, `.mjs`,
 * `.js`, `.cjs`) outside `node_modules` is scanned for import/require/export
 * specifiers, and each specifier is resolved relative to its own file. A
 * specifier that resolves to `server/src/index.ts` is a real importer. Prose in
 * markdown — which legitimately names `server/src/index.ts` — is not an import
 * and is not scanned.
 *
 * It writes nothing inside the worktree: the driver and every temporary artifact
 * live under the OS temp dir, and the harness removes the directory it created.
 * It binds no port, opens no database connection (the child's connection attempt
 * is to a dead port and is expected to be refused), and prints no credential.
 *
 * Usage:  cd server && npx tsx scripts/proofs/fu/index-import-safety.mjs
 *         (or: node <this file> — the child, not this harness, needs tsx)
 *
 * `INDEX_IMPORT_SAFETY_INDEX` exists so a reviewer can watch this harness go red
 * on demand: it points every check at a different module instead of
 * `server/src/index.ts` (used during this work unit to run it against a mutant
 * that restores the base revision's module-scope app). It defaults to
 * `server/src/index.ts`, and the delivered source file is the one under that
 * default.
 *
 * It prints one `CHECK <name> PASS|FAIL <detail>` line per check and exits
 * non-zero if any check fails.
 */
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = resolve(HERE, '../../..');
const REPO_DIR = resolve(SERVER_DIR, '..');
const INDEX_PATH = process.env.INDEX_IMPORT_SAFETY_INDEX
  ? resolve(process.env.INDEX_IMPORT_SAFETY_INDEX)
  : join(SERVER_DIR, 'src/index.ts');
const INDEX_URL = pathToFileURL(INDEX_PATH).href;

/** Deterministically dead: loopback, reserved discard port, refused instantly. */
const DEAD_DATABASE_URL = 'postgres://postgres@127.0.0.1:9/mt01_dead_port_never_used';

const results = [];

function record(name, passed, detail) {
  results.push({ name, passed });
  console.log(`CHECK ${name} ${passed ? 'PASS' : 'FAIL'} ${detail}`);
}

function observation(line) {
  console.log(`OBSERVATION ${line}`);
}

const extraArgs = process.argv.slice(2);
if (extraArgs.length > 0) {
  console.error(
    `index-import-safety: this harness takes no arguments, but received: ${extraArgs.join(' ')}. ` +
      'It always tests the repository it lives in. Refusing to run rather than silently ignore an argument.'
  );
  process.exit(2);
}

/**
 * The driver: records every `net.Server#listen` call and every console line the
 * imported module emits, imports the real index.ts, and reports what it saw.
 */
const DRIVER = `// H7-REVIEW-FIX-HYGIENE index-import-safety driver (temp file, written by the harness).
const net = await import('node:net');

const listens = [];
const realListen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  listens.push(args.map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a))).join('|'));
  return realListen.apply(this, args);
};

const bootLines = [];
const realLog = console.log;
const realError = console.error;
const realWrite = process.stderr.write.bind(process.stderr);
const capture = (stream) => (...args) => {
  const line = args.map((a) => String(a)).join(' ');
  bootLines.push(stream + ': ' + line);
  realWrite('[imported-index] ' + line + '\\n');
};
console.log = capture('stdout');
console.error = capture('stderr');

let failure = null;
let moduleExports = null;
try {
  const mod = await import(${JSON.stringify(INDEX_URL)});
  moduleExports = Object.keys(mod).sort();
} catch (error) {
  failure = String((error && error.message) || error);
}

console.log = realLog;
console.error = realError;

realLog(
  'INDEX_IMPORT_PROBE ' +
    JSON.stringify({
      listens,
      bootLines,
      exports: moduleExports,
      failure,
      databaseUrlSet: typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL !== '',
      tcpServerWraps: process.getActiveResourcesInfo().filter((r) => /TCPServerWrap/.test(r)).length,
    })
);
`;

let tempRoot = null;

/** Run the driver once in a child process and parse its probe line. */
function runDriver(label, { databaseUrl }) {
  const driverPath = join(tempRoot, `driver-${label}.mjs`);
  writeFileSync(driverPath, DRIVER);

  const childEnv = { ...process.env, NODE_ENV: 'development' };
  if (databaseUrl === null) delete childEnv.DATABASE_URL;
  else childEnv.DATABASE_URL = databaseUrl;

  const started = Date.now();
  const run = spawnSync(process.execPath, ['--import', 'tsx', driverPath], {
    cwd: SERVER_DIR,
    env: childEnv,
    encoding: 'utf8',
    shell: false,
    timeout: 120_000,
  });
  const elapsedMs = Date.now() - started;
  const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;

  const probeLine = (run.stdout ?? '')
    .split(/\r?\n/)
    .find((line) => line.startsWith('INDEX_IMPORT_PROBE '));

  let probe = null;
  if (probeLine) {
    try {
      probe = JSON.parse(probeLine.slice('INDEX_IMPORT_PROBE '.length));
    } catch (error) {
      probe = { parseError: error.message };
    }
  }

  return {
    exitCode: run.status,
    signal: run.signal ?? null,
    error: run.error ?? null,
    elapsedMs,
    output,
    probe,
    importedIndexBootLines: (run.stderr ?? '')
      .split(/\r?\n/)
      .filter((line) => line.startsWith('[imported-index]')),
  };
}

/** The boot lines that prove a start-up routine actually ran. */
const BOOT_SIGNATURES = [
  'Server listening on port',
  'Subscription repositories ready',
  'Migration/seed failed',
  '[demo-auth]',
];

const CODE_EXTENSIONS = new Set(['.ts', '.mts', '.mjs', '.js', '.cjs']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);

/**
 * The file minus its comments and string bodies' effect on the source-level
 * assertions below. Without this a comment that QUOTES the base revision's
 * `const app = createApp();` — which the delivered file legitimately does, to
 * explain itself — would be read as that line coming back. Comments are not code.
 */
function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/(^|\s)\/\/.*$/, '$1'))
    .join('\n');
}

/** Every code file under `dir`, excluding node_modules and friends. */
function codeFiles(dir, found = []) {
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      codeFiles(join(dir, entry.name), found);
    } else if (CODE_EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf('.')))) {
      found.push(join(dir, entry.name));
    }
  }
  return found;
}

/** Import/require/export specifiers of a source file, as raw strings. */
function specifiersOf(text) {
  const found = [];
  const patterns = [
    /(?:^|[^\w$.])(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]/g,
    /(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /^\s*import\s*['"]([^'"]+)['"]/gm,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) found.push(match[1]);
  }
  return found;
}

/** True when a relative specifier from `file` lands on server/src/index.ts. */
function resolvesToIndex(file, spec) {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return false;

  const base = resolve(dirname(file), spec);
  const candidates = [base];
  const withoutExtension = base.replace(/\.(?:js|ts|mjs|cjs|mts)$/, '');
  for (const ext of ['.ts', '.js', '.mjs', '.mts', '.cjs']) {
    candidates.push(withoutExtension + ext);
    candidates.push(join(withoutExtension, `index${ext}`));
  }
  if (!/\.\w+$/.test(base)) candidates.push(join(base, 'index.ts'), join(base, 'index.js'));

  return candidates.some((candidate) => resolve(candidate) === INDEX_PATH);
}

/** Where the importer search looks. */
const SEARCH_ROOTS = ['server/src', 'server/tests', 'server/scripts', 'scripts', 'web', 'modules'];

try {
  observation(`index under test: ${INDEX_PATH}`);
  observation(`repository root: ${REPO_DIR}`);
  observation(`node: ${process.version}`);

  for (const rel of ['src/index.ts']) {
    if (!statSync(join(SERVER_DIR, rel)).isFile()) {
      throw new Error(`${join(SERVER_DIR, rel)} is not there`);
    }
  }

  tempRoot = mkdtempSync(join(tmpdir(), 'h7fu3-index-import-'));
  observation(`temp directory created under the OS temp dir for the driver: ${tempRoot}`);

  // --- the two child runs ---------------------------------------------------
  observation(`child A: DATABASE_URL -> dead loopback port (${DEAD_DATABASE_URL.replace(/\/\/.*@/, '//<credential-elided>@')})`);
  const runA = runDriver('a', { databaseUrl: DEAD_DATABASE_URL });
  observation(
    `child A: exit code = ${runA.exitCode} (signal=${runA.signal ?? '(none)'}) after ${runA.elapsedMs} ms; ` +
      `imported-index boot lines = ${JSON.stringify(runA.importedIndexBootLines)}`
  );

  observation('child B: DATABASE_URL removed from the child environment');
  const runB = runDriver('b', { databaseUrl: null });
  observation(
    `child B: exit code = ${runB.exitCode} (signal=${runB.signal ?? '(none)'}) after ${runB.elapsedMs} ms; ` +
      `imported-index boot lines = ${JSON.stringify(runB.importedIndexBootLines)}`
  );

  const bothProbes = { a: runA.probe, b: runB.probe };
  for (const [label, run] of [['A', runA], ['B', runB]]) {
    if (run.probe === null) {
      console.log(`  child ${label} printed no INDEX_IMPORT_PROBE line; raw output follows`);
      console.log(run.output.split(/\r?\n/).slice(0, 20).map((l) => `    ${l}`).join('\n'));
    }
  }

  // --- 1. no listening port -------------------------------------------------
  {
    const problems = [];
    for (const [label, run] of [['A', runA], ['B', runB]]) {
      const probe = run.probe;
      if (probe === null) {
        problems.push(`child ${label} produced no probe line, so its import could not be observed`);
        continue;
      }
      if (probe.failure) problems.push(`child ${label}: importing index.ts threw: ${probe.failure}`);
      if (run.exitCode !== 0) problems.push(`child ${label} exited ${run.exitCode}, not 0`);
      if (probe.listens.length > 0) {
        problems.push(`child ${label}: net.Server#listen was called with ${JSON.stringify(probe.listens)}`);
      }
      if (probe.tcpServerWraps > 0) {
        problems.push(`child ${label}: the process holds ${probe.tcpServerWraps} TCPServerWrap handle(s), i.e. a bound TCP server`);
      }
      const boot = probe.bootLines.join(' | ');
      for (const signature of ['Server listening on port']) {
        if (boot.includes(signature)) {
          problems.push(`child ${label}: the module printed a boot line matching "${signature}"`);
        }
      }
    }

    const listensA = runA.probe ? JSON.stringify(runA.probe.listens) : '(no probe)';
    const listensB = runB.probe ? JSON.stringify(runB.probe.listens) : '(no probe)';

    record(
      'index-import-binds-no-listening-port',
      problems.length === 0,
      problems.length === 0
        ? `rule: importing server/src/index.ts must call net.Server#listen zero times and leave no bound TCP server handle, in two independent child processes; observed listen_calls child_A=${listensA} child_B=${listensB}, tcp_server_wraps child_A=${runA.probe.tcpServerWraps} child_B=${runB.probe.tcpServerWraps}, both exit 0. The base revision bound the port at import time; the entry-point guard is what makes this hold (check 4)`
        : problems.join('; ')
    );
  }

  // --- 2. no database work --------------------------------------------------
  {
    const problems = [];
    for (const [label, run] of [['A', runA], ['B', runB]]) {
      const probe = run.probe;
      if (probe === null) {
        problems.push(`child ${label} produced no probe line`);
        continue;
      }
      const boot = probe.bootLines.join(' | ');
      for (const signature of BOOT_SIGNATURES) {
        if (boot.includes(signature) && signature !== 'Server listening on port') {
          problems.push(`child ${label}: the module printed "${signature}", so main() ran`);
        }
      }
    }
    if (runA.probe && runA.probe.databaseUrlSet !== true) {
      problems.push('child A did not see the DATABASE_URL it was given, so its dead-port run proves nothing');
    }
    if (runB.probe && runB.probe.databaseUrlSet !== false) {
      problems.push('child B still saw a DATABASE_URL, so its DB-less run proves nothing');
    }

    const bootA = runA.probe ? JSON.stringify(runA.probe.bootLines) : '(no probe)';
    const bootB = runB.probe ? JSON.stringify(runB.probe.bootLines) : '(no probe)';

    record(
      'index-import-starts-no-database-work',
      problems.length === 0,
      problems.length === 0
        ? `rule: importing server/src/index.ts must emit none of "Subscription repositories ready", "Migration/seed failed" or "[demo-auth]", with DATABASE_URL set to a dead loopback port (child A) and with DATABASE_URL removed (child B). If main() had run, child A would have failed its migration call and child B would have reported persistent=false. Observed boot lines child_A=${bootA} child_B=${bootB}`
        : problems.join('; ')
    );
  }

  // --- 3. the export list ---------------------------------------------------
  {
    const problems = [];
    const source = codeOnly(readFileSync(INDEX_PATH, 'utf8'));
    for (const [label, run] of [['A', runA], ['B', runB]]) {
      const probe = run.probe;
      if (probe === null) {
        problems.push(`child ${label} produced no probe line`);
        continue;
      }
      const exported = probe.exports ?? [];
      for (const name of ['createApp', 'main']) {
        if (!exported.includes(name)) problems.push(`child ${label}: "${name}" is not exported`);
      }
      if (exported.includes('app')) {
        problems.push(`child ${label}: the module exports "app"`);
      }
    }
    if (!/export\s*\{\s*createApp,\s*main\s*\}/.test(source)) {
      problems.push('server/src/index.ts does not carry `export { createApp, main };`');
    }
    if (/export\s*\{[^}]*\bapp\b/.test(source)) {
      problems.push('server/src/index.ts still exports `app`');
    }

    const exportedA = runA.probe ? JSON.stringify(runA.probe.exports) : '(no probe)';
    record(
      'index-exports-createApp-and-main-without-app',
      problems.length === 0,
      problems.length === 0
        ? `rule: the imported module's own export list must be exactly ["createApp","main"] and the source must carry \`export { createApp, main };\` with no \`app\` export; observed exports child_A=${exportedA} child_B=${JSON.stringify(runB.probe.exports)}`
        : problems.join('; ')
    );
  }

  // --- 4. the guard is what makes 1 and 2 hold ------------------------------
  {
    const source = codeOnly(readFileSync(INDEX_PATH, 'utf8'));
    const problems = [];

    if (!/const\s+invokedDirectly\s*=/.test(source)) {
      problems.push('the entry-point guard (`invokedDirectly`) is missing');
    }
    if (!/if\s*\(\s*invokedDirectly\s*\)\s*\{[\s\S]*?await\s+main\(\);/.test(source)) {
      problems.push('main() is not called only under the entry-point guard');
    }
    // MODULE SCOPE means column zero: inside main() the same two statements are
    // indented, and they are supposed to be there. Only an unindented one is the
    // base revision's defect coming back.
    if (/^const\s+app\s*=\s*createApp\(\)\s*;/m.test(source)) {
      problems.push('the module-scope `const app = createApp();` is back');
    }
    if (/^app\.listen\(/m.test(source)) {
      problems.push('a module-scope `app.listen(...)` call is back');
    }

    // The two facts the guard exists for: creation reads DEMO_AUTH and decides
    // which gate to mount, and the base bound the port at import time.
    const appSource = readFileSync(join(SERVER_DIR, 'src/app.ts'), 'utf8');
    const createAppIndex = appSource.indexOf('export function createApp');
    const createAppBody =
      createAppIndex === -1 ? '' : appSource.slice(createAppIndex, createAppIndex + 4000);
    if (!/DEMO_AUTH|demoAuthState|demoAuth/.test(createAppBody)) {
      problems.push(
        'createApp() no longer reads the demo-auth state, so the documented reason for the guard (creation decides which gate to mount) is stale'
      );
    }

    record(
      'module-scope-app-removed-and-entry-guard-present',
      problems.length === 0,
      problems.length === 0
        ? `rule: server/src/index.ts must carry the entry-point guard (main() called only when the module IS the process entry point), must NOT create the app or call listen at module scope, and createApp() must still be the thing that reads the demo-auth state — the base revision (6010332) did \`const app = createApp(); app.listen(port, …); export { app, createApp };\` at module scope, which is why importing it bound the port; observed guard_present=true module_scope_app=false createApp_reads_demo_auth=true`
        : problems.join('; ')
    );
  }

  // --- 5. nothing imports this module --------------------------------------
  {
    const problems = [];
    const importers = [];
    let scanned = 0;

    for (const rel of SEARCH_ROOTS) {
      for (const file of codeFiles(join(REPO_DIR, rel))) {
        if (resolve(file) === INDEX_PATH) continue;
        let text = '';
        try {
          text = readFileSync(file, 'utf8');
        } catch {
          continue;
        }
        scanned += 1;
        for (const spec of specifiersOf(text)) {
          if (resolvesToIndex(file, spec)) {
            const line = text.split(/\r?\n/).findIndex((l) => l.includes(spec)) + 1;
            importers.push(`${relative(REPO_DIR, file).split(sep).join('/')}:${line} imports '${spec}'`);
          }
        }
      }
    }

    if (importers.length > 0) {
      problems.push(`file(s) import server/src/index.ts: ${importers.join('; ')}`);
    }

    record(
      'nothing-imports-server-index',
      problems.length === 0,
      problems.length === 0
        ? `rule: no code file under ${SEARCH_ROOTS.join(', ')} (excluding node_modules) may import server/src/index.ts — prose that names the file in markdown is not an import and is not scanned; scanned ${scanned} code file(s), found 0 importers. This is what makes the removal of the module-scope \`app\` export a non-issue: no caller exists to be broken`
        : problems.join('; ')
    );
  }
} catch (error) {
  record('harness', false, `unexpected_error=${error.message}`);
} finally {
  if (tempRoot !== null) {
    try {
      rmSync(tempRoot, { recursive: true, force: true });
      observation(`removed the temp directory it created: ${tempRoot} (nothing inside the worktree was written)`);
    } catch (error) {
      observation(`could not remove ${tempRoot}: ${error.message}`);
    }
  }
}

const failed = results.filter((result) => !result.passed);
console.log(
  `SUMMARY checks=${results.length} passed=${results.length - failed.length} failed=${failed.length}` +
    (failed.length > 0 ? ` failed_names=[${failed.map((f) => f.name).join(',')}]` : '')
);
if (failed.length > 0) process.exitCode = 1;
