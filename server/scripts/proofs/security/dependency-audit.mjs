import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../../..');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function auditDirs() {
  const dirs = [resolve(REPO, 'server')];
  const modulesDir = resolve(REPO, 'modules');
  for (const name of readdirSync(modulesDir).sort()) {
    const dir = resolve(modulesDir, name);
    if (existsSync(resolve(dir, 'package.json'))) dirs.push(dir);
  }
  return dirs;
}

function parseAudit(stdout, stderr, code) {
  let json;
  try {
    json = JSON.parse(stdout);
  } catch {
    return {
      ok: false,
      detail: `npm audit did not return JSON (exit=${code}; stderr=${String(stderr).trim().slice(0, 240) || 'none'})`,
      counts: null,
    };
  }
  const counts = json?.metadata?.vulnerabilities;
  if (!counts || typeof counts.total !== 'number') {
    return { ok: false, detail: 'npm audit JSON has no vulnerability summary', counts: null };
  }
  const ok = counts.total === 0;
  return {
    ok,
    detail: `total=${counts.total} critical=${counts.critical ?? 0} high=${counts.high ?? 0} moderate=${counts.moderate ?? 0} low=${counts.low ?? 0}`,
    counts,
  };
}

function runAudit(dir, prodOnly) {
  const args = ['audit', '--json'];
  if (prodOnly) args.splice(1, 0, '--omit=dev');
  const run = spawnSync(NPM, args, {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
    maxBuffer: 20 * 1024 * 1024,
  });
  return parseAudit(run.stdout ?? '', run.stderr ?? '', run.status ?? 1);
}

function selfTest() {
  const fixtures = [
    ['zero-is-pass', JSON.stringify({ metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } } }), true],
    ['critical-is-fail', JSON.stringify({ metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 1, total: 1 } } }), false],
    ['malformed-is-fail', 'not-json', false],
  ];
  let failed = 0;
  for (const [name, stdout, expected] of fixtures) {
    const got = parseAudit(stdout, '', expected ? 0 : 1).ok;
    const pass = got === expected;
    console.log(`CHECK self-${name} ${pass ? 'PASS' : 'FAIL'} expected=${expected} observed=${got}`);
    if (!pass) failed += 1;
  }
  console.log(`SUMMARY self_tests=${fixtures.length} passed=${fixtures.length - failed} failed=${failed}`);
  return failed === 0 ? 0 : 1;
}

if (process.argv.includes('--self-test')) {
  process.exit(selfTest());
}

let failed = 0;
for (const dir of auditDirs()) {
  const label = relative(REPO, dir).split('\\').join('/');
  for (const [scope, prodOnly] of [['all', false], ['production', true]]) {
    const result = runAudit(dir, prodOnly);
    console.log(`CHECK dependency-audit:${label}:${scope} ${result.ok ? 'PASS' : 'FAIL'} ${result.detail}`);
    if (!result.ok) failed += 1;
  }
}
console.log(`SUMMARY dependency_audit failed_checks=${failed} package_roots=${auditDirs().length}`);
process.exit(failed === 0 ? 0 : 1);
