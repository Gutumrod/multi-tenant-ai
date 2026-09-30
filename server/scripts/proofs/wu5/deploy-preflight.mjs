#!/usr/bin/env node
/**
 * HOUSE-SWARM-7 WU-5 deploy-preflight — is the artifact internally consistent
 * before anyone deploys it?
 *
 * This harness checks the DEPLOYMENT ARTIFACT, not the running server. It does
 * not start a server, it does not open a database connection, and it does not
 * contact any network host. It reads files in this repository and compares them
 * with each other, so it can be run on a clean checkout at any time.
 *
 * What it is for: the WU-5 deployment manual and the setup script make factual
 * claims about the code (which variables are read, which migrations exist,
 * which routes are registered, which node version is required). Those claims can
 * drift away from the code silently. This harness is the drift alarm.
 *
 * Prints one machine-readable line per check, in exactly this form:
 *
 *   CHECK <name> PASS|FAIL <detail>
 *
 * Exits non-zero if any check fails. Prints no credential: a match that looks
 * like one is reported redacted.
 *
 * Usage:  node scripts/proofs/wu5/deploy-preflight.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = join(HERE, '../../..');
const REPO_DIR = join(SERVER_DIR, '..');

const ENV_EXAMPLE = join(SERVER_DIR, '.env.example');
const SRC_DIR = join(SERVER_DIR, 'src');
const MIGRATIONS_DIR = join(SERVER_DIR, 'migrations');
const MANUAL = join(REPO_DIR, 'docs/product/WU5-DEPLOY.md');
const SETUP_SH = join(REPO_DIR, 'scripts/house-swarm-7/setup.sh');
const SETUP_MD = join(REPO_DIR, 'scripts/house-swarm-7/setup.md');
const WEB_DIR = join(REPO_DIR, 'web');
const APP_TS = join(SRC_DIR, 'app.ts');
const WEB_PAGES_TS = join(SRC_DIR, 'lib/web-pages.ts');

const results = [];

function record(name, passed, detail) {
  results.push({ name, passed, detail });
}

/**
 * The unit's rule, verbatim: a credential-shaped value is a Stripe or webhook
 * prefix followed by at least 20 alphanumeric characters. Bare placeholder
 * prefixes ("sk_test_...", "sk_test_mock") are documentation and must NOT be
 * flagged — the repository is expected to contain those.
 */
const CREDENTIAL_PATTERN = /(?:sk_live_|sk_test_|whsec_)[A-Za-z0-9]{20,}/;

/** Never print a credential: keep the prefix, mask the payload. */
function redact(match) {
  const prefix = match.match(/^(sk_live_|sk_test_|whsec_)/)?.[1] ?? '';
  return `${prefix}***REDACTED***`;
}

function readOrNull(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/** Every file in the repository, skipping node_modules and .git. */
function repoFiles(dir = REPO_DIR, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      repoFiles(full, acc);
    } else if (stat.isFile()) {
      acc.push(full);
    }
  }
  return acc;
}

function rel(path) {
  return relative(REPO_DIR, path).split(sep).join('/');
}

// ---------------------------------------------------------------------------
// CHECK 1 — env-example-covers-manual-variables
//
// Every environment variable the code actually reads must be listed in
// server/.env.example, so an operator reading the example sees the whole set.
//
// The set of variables the code reads is DERIVED from server/src, not
// hardcoded, so adding a variable to the code without documenting it fails
// this check. NODE_ENV is added explicitly: the code tests it as
// `env.NODE_ENV === 'production'` (server/src/middleware/demo-auth.ts), and
// NODE_ENV is part of the documented environment even though it is not read
// through `process.env.NODE_ENV` anywhere.
// ---------------------------------------------------------------------------
{
  const envExample = readOrNull(ENV_EXAMPLE);

  if (envExample === null) {
    record('env-example-covers-manual-variables', false, 'server/.env.example is missing');
  } else {
    const listed = new Set(
      envExample
        .split(/\r?\n/)
        .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1])
        .filter(Boolean)
    );

    const sources = repoFiles(SRC_DIR).filter((file) => /\.(ts|mts|js|mjs)$/.test(file));
    const readNames = new Set();

    for (const file of sources) {
      const text = readFileSync(file, 'utf8');

      // process.env.NAME
      for (const m of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) readNames.add(m[1]);
      // env.NAME  (a ProcessEnv parameter, e.g. demoAuthState(env))
      for (const m of text.matchAll(/(?:^|[^\w.])env\.([A-Z][A-Z0-9_]*)/g)) readNames.add(m[1]);

      // const X_ENV = 'NAME'  ...  env[X_ENV]
      const aliases = new Map();
      for (const m of text.matchAll(/const\s+([A-Z][A-Z0-9_]*)\s*=\s*'([A-Z][A-Z0-9_]*)'/g)) {
        aliases.set(m[1], m[2]);
      }
      for (const m of text.matchAll(/env\[([A-Z][A-Z0-9_]*)\]/g)) {
        const resolved = aliases.get(m[1]);
        if (resolved) readNames.add(resolved);
      }
    }

    readNames.add('NODE_ENV');

    const required = [...readNames].sort();
    const missing = required.filter((name) => !listed.has(name));

    record(
      'env-example-covers-manual-variables',
      missing.length === 0,
      missing.length === 0
        ? `server/.env.example lists all ${required.length} variables the code reads (${required.join(', ')})`
        : `server/.env.example is missing ${missing.length} of ${required.length} variables the code reads: ${missing.join(', ')}`
    );
  }
}

// ---------------------------------------------------------------------------
// CHECK 2 — no-real-credential-in-repo
//
// Rule enforced: a credential-shaped value is a Stripe or webhook prefix
// (sk_live_, sk_test_, whsec_) followed by at least 20 alphanumeric
// characters. A bare placeholder prefix ("sk_test_...", "sk_test_mock") is
// documentation and is deliberately NOT flagged. node_modules and .git are
// excluded: they are not part of the artifact and .git holds no source.
// ---------------------------------------------------------------------------
{
  const hits = [];
  for (const file of repoFiles()) {
    const text = readOrNull(file);
    if (text === null) continue;
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const m = lines[i].match(CREDENTIAL_PATTERN);
      if (m) hits.push(`${rel(file)}:${i + 1} ${redact(m[0])}`);
    }
  }

  record(
    'no-real-credential-in-repo',
    hits.length === 0,
    hits.length === 0
      ? 'no credential-shaped value found (rule: sk_live_/sk_test_/whsec_ followed by >=20 alphanumerics; bare placeholder prefixes are documentation and are allowed)'
      : `${hits.length} credential-shaped value(s) found: ${hits.slice(0, 10).join('; ')}`
  );
}

// ---------------------------------------------------------------------------
// CHECK 3 — demo-auth-not-default-enabled
//
// The demonstration identity gate must be off unless it is switched on
// explicitly, must never be switched on by a file in this repository, and the
// manual must state that it must never be enabled in production (and cite the
// 503 refusal the code performs).
// ---------------------------------------------------------------------------
{
  const problems = [];

  const envExample = readOrNull(ENV_EXAMPLE);
  if (envExample === null) {
    problems.push('server/.env.example is missing');
  } else {
    const demoLine = envExample
      .split(/\r?\n/)
      .find((line) => /^DEMO_AUTH=/.test(line));
    if (!demoLine) {
      problems.push('server/.env.example does not mention DEMO_AUTH');
    } else if (demoLine.trim() !== 'DEMO_AUTH=') {
      problems.push(`server/.env.example sets DEMO_AUTH to a value: ${demoLine.trim()}`);
    }
  }

  // No file other than documentation may ship DEMO_AUTH=true.
  for (const file of repoFiles()) {
    const name = rel(file);
    if (/\.(md|example)$/.test(name)) continue;
    const text = readOrNull(file);
    if (text === null) continue;
    if (/^\s*DEMO_AUTH\s*=\s*true\s*$/m.test(text)) {
      problems.push(`${name} sets DEMO_AUTH=true`);
    }
  }

  const manual = readOrNull(MANUAL);
  if (manual === null) {
    problems.push('the manual docs/product/WU5-DEPLOY.md is missing');
  } else {
    if (!/must never be enabled in production/i.test(manual)) {
      problems.push('the manual does not state that DEMO_AUTH must never be enabled in production');
    }
    if (!manual.includes('DEMO_AUTH_REFUSED_IN_PRODUCTION')) {
      problems.push('the manual does not cite the code-level refusal code DEMO_AUTH_REFUSED_IN_PRODUCTION');
    }
  }

  record(
    'demo-auth-not-default-enabled',
    problems.length === 0,
    problems.length === 0
      ? 'DEMO_AUTH is empty in .env.example, nothing in the repo sets it to true, and the manual states the production prohibition with the refusal code'
      : problems.join('; ')
  );
}

// ---------------------------------------------------------------------------
// CHECK 4 — migration-set-listed
//
// The manual must name exactly the migration files that exist, and must say
// when they run and that they are idempotent.
// ---------------------------------------------------------------------------
{
  const problems = [];

  let files = [];
  try {
    files = readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith('.sql'))
      .sort();
  } catch {
    problems.push('server/migrations is missing');
  }

  const manual = readOrNull(MANUAL);
  if (manual === null) {
    problems.push('the manual docs/product/WU5-DEPLOY.md is missing');
  } else if (files.length > 0) {
    const unlisted = files.filter((name) => !manual.includes(name));
    if (unlisted.length > 0) problems.push(`the manual does not name: ${unlisted.join(', ')}`);

    // The manual must not name a migration file that does not exist.
    const named = [...manual.matchAll(/\b(\d{4}_[a-z0-9_]+\.sql)\b/g)].map((m) => m[1]);
    const invented = [...new Set(named)].filter((name) => !files.includes(name));
    if (invented.length > 0) problems.push(`the manual names non-existent migration files: ${invented.join(', ')}`);

    if (!/idempotent/i.test(manual)) problems.push('the manual does not state that the migrations are idempotent');
    if (!/before[\s\S]{0,80}app\.listen/i.test(manual) && !/at process start/i.test(manual)) {
      problems.push('the manual does not state when the migrations run');
    }
  }

  record(
    'migration-set-listed',
    problems.length === 0,
    problems.length === 0
      ? `the manual names all ${files.length} migration files (${files.join(', ')}) and states when they run and that they are idempotent`
      : problems.join('; ')
  );
}

// ---------------------------------------------------------------------------
// CHECK 5 — web-assets-present
//
// The sample UI files the manual points at must exist, be non-empty, and
// contain no external URL (the UI claims no CDN, no web font, no stock photo).
// ---------------------------------------------------------------------------
{
  const required = [
    'index.html',
    'signup.html',
    'login.html',
    'plans.html',
    'app.html',
    'assets/i18n.js',
    'assets/app.js',
    'assets/app.css',
  ];

  const problems = [];
  let checked = 0;

  for (const name of required) {
    const full = join(WEB_DIR, name);
    const text = readOrNull(full);
    if (text === null) {
      problems.push(`web/${name} is missing`);
      continue;
    }
    if (text.trim() === '') {
      problems.push(`web/${name} is empty`);
      continue;
    }
    checked += 1;
    const url = text.match(/https?:\/\/[^\s"'`)<>]+/);
    if (url) problems.push(`web/${name} references an external URL: ${url[0]}`);
  }

  record(
    'web-assets-present',
    problems.length === 0,
    problems.length === 0
      ? `all ${checked} sample UI files are present, non-empty, and reference no external URL`
      : problems.join('; ')
  );
}

// ---------------------------------------------------------------------------
// CHECK 6 — routes-documented
//
// Every route registered in server/src/app.ts (and every page route in
// server/src/lib/web-pages.ts) must appear in the deployment manual, so an
// operator is never surprised by an endpoint the manual did not mention.
// ---------------------------------------------------------------------------
{
  const manual = readOrNull(MANUAL);
  const problems = [];

  if (manual === null) {
    problems.push('the manual docs/product/WU5-DEPLOY.md is missing');
  } else {
    const appSource = readOrNull(APP_TS) ?? '';
    const literalRoutes = [...appSource.matchAll(/app\.(?:get|post|put|delete|use)\(\s*'([^']+)'/g)].map(
      (m) => m[1]
    );

    const webPagesSource = readOrNull(WEB_PAGES_TS) ?? '';
    const pageRoutes = [...webPagesSource.matchAll(/urlPath:\s*'([^']+)'/g)].map((m) => m[1]);

    const documented = [...new Set([...literalRoutes, ...pageRoutes])].sort();
    const missing = documented.filter((route) => !manual.includes(route));

    if (documented.length === 0) {
      problems.push('no routes could be read from server/src/app.ts');
    } else if (missing.length > 0) {
      problems.push(`the manual does not document these registered routes: ${missing.join(', ')}`);
    } else {
      problems.push('');
    }

    record(
      'routes-documented',
      missing.length === 0 && documented.length > 0,
      missing.length === 0 && documented.length > 0
        ? `all ${documented.length} registered routes are named in the manual`
        : problems.filter(Boolean).join('; ')
    );
  }

  if (manual === null) {
    record('routes-documented', false, problems.join('; '));
  }
}

// ---------------------------------------------------------------------------
// CHECK 7 — manual-has-no-invented-output
//
// Rule enforced (structural, not a judgement call), in two parts:
//
//   (a) for every fenced code block in the manual whose info string marks it as
//       expected output (it contains the word "output"), the block body must not
//       contain a hostname, an IPv4 address, a URL, or a credential-shaped
//       value. A block marked as expected output containing any of those is
//       either invented (nobody observed it) or leaks the author's machine into
//       the buyer's configuration;
//
//   (b) the artifacts the manual tells the operator to run must exist, so the
//       manual cannot reference a script that was never written.
//
// Explicitly allowed, because they are placeholders rather than a real host:
// DB_HOST, HOST, localhost, 0.0.0.0 and 127.0.0.1.
// ---------------------------------------------------------------------------
{
  const manual = readOrNull(MANUAL);

  if (manual === null) {
    record('manual-has-no-invented-output', false, 'the manual docs/product/WU5-DEPLOY.md is missing');
  } else {
    const lines = manual.split(/\r?\n/);
    const blockPatterns = [
      { label: 'a hostname or host placeholder', pattern: /\b(?!DB_HOST\b|HOST\b)[A-Za-z0-9-]+\.(?:com|net|org|io|dev|app|co|th)\b/ },
      { label: 'an IPv4 address', pattern: /\b(?!127\.0\.0\.1\b)\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/ },
      { label: 'a URL', pattern: /[a-z][a-z0-9+.-]*:\/\/[^\s]+/ },
      { label: 'a credential-shaped value', pattern: CREDENTIAL_PATTERN },
    ];

    const problems = [];
    let inBlock = false;
    let isExpectedBlock = false;
    let blockStart = 0;
    let expectedBlocks = 0;

    for (let i = 0; i < lines.length; i += 1) {
      const fence = lines[i].match(/^\s*```(.*)$/);
      if (fence) {
        if (!inBlock) {
          inBlock = true;
          const info = fence[1].trim().toLowerCase();
          isExpectedBlock = info.includes('output');
          blockStart = i + 1;
          if (isExpectedBlock) expectedBlocks += 1;
        } else {
          inBlock = false;
          isExpectedBlock = false;
        }
        continue;
      }

      if (inBlock && isExpectedBlock) {
        for (const { label, pattern } of blockPatterns) {
          const m = lines[i].match(pattern);
          if (m) {
            const shown = m[0].startsWith('sk_') || m[0].startsWith('whsec_')
              ? redact(m[0])
              : m[0];
            problems.push(`line ${i + 1} (block starting line ${blockStart}) contains ${label}: ${shown}`);
          }
        }
      }
    }

    // (b) the artifacts the manual points the operator at must exist.
    if (readOrNull(SETUP_SH) === null) {
      problems.push('the manual directs the operator to scripts/house-swarm-7/setup.sh but that file does not exist');
    }
    if (readOrNull(SETUP_MD) === null) {
      problems.push('the manual directs the operator to scripts/house-swarm-7/setup.md but that file does not exist');
    }

    record(
      'manual-has-no-invented-output',
      problems.length === 0,
      problems.length === 0
        ? `rule: fenced blocks marked as expected output must contain no hostname, IPv4 address, URL or credential-shaped value, and the artifacts the manual points at must exist; checked ${expectedBlocks} expected-output block(s) and both setup artifacts; allowed placeholders are DB_HOST/HOST/localhost/0.0.0.0/127.0.0.1`
        : `${problems.length} problem(s): ${problems.slice(0, 10).join('; ')}`
    );
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
for (const result of results) {
  console.log(`CHECK ${result.name} ${result.passed ? 'PASS' : 'FAIL'} ${result.detail}`);
}

const failed = results.filter((result) => !result.passed);
if (failed.length > 0) {
  console.error(`deploy-preflight: ${failed.length} of ${results.length} checks FAILED`);
  process.exit(1);
}

console.log(`deploy-preflight: all ${results.length} checks PASSED`);
