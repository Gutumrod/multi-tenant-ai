#!/usr/bin/env node
/**
 * MT01-PRESALE-P1 claims-check-numeric-fixtures — proves ON DEMAND that CHECK 9
 * of `server/scripts/proofs/wu6/claims-check.mjs`
 * (`sales-numbers-agree-with-ledger`) really goes red on both directions of the
 * defect it exists to catch, and stays green on the delivered documents.
 *
 * WHY THIS EXISTS. The check was added because the sales documents kept
 * `51`-totalled test figures after the ledger had moved to `58`, and nothing
 * compared the two files. A gate is only worth what it catches, so every
 * expected-FAIL case below is judged on the child process's EXIT CODE and on the
 * `CHECK sales-numbers-agree-with-ledger` line it printed, and this harness's own
 * exit code is non-zero if any case does not behave as required.
 *
 * HOW IT WORKS. It writes nothing inside the worktree. For each case it copies
 * the delivered document set — `WU6-SALES-EN.md`, `WU6-SALES-TH.md`,
 * `WU6-CLAIMS-EVIDENCE.md` — into a fresh directory under the OS temp dir,
 * applies exactly one mutation to that copy, and runs the REAL
 * `claims-check.mjs` as a child process with `CLAIMS_DOCS_DIR` pointed at the
 * copy. It then reads back the child's exit code and its
 * `CHECK sales-numbers-agree-with-ledger PASS|FAIL` line. The delivered documents
 * themselves are never edited, and the temp directory is removed afterwards.
 *
 * THE CASES:
 *
 *   a. a sales-document figure reverted to the old `51` total   -> check FAIL
 *      (EN V4's set-database file total goes back to the pre-change `(5)`,
 *      which is the old five-file summary; the ledger still states `files(6)`)
 *   b. a sales-document figure reverted to the old `46`/`(5)` file total -> FAIL
 *      (TH V4's set-database file total goes back to `(5)`)
 *   c. the ledger's LIVE figure changed, documents untouched     -> check FAIL
 *      (C39's claim cell loses the live `Tests 58 passed (58)` total)
 *   d. the delivered documents, unmutated                        -> check PASS, exit 0
 *
 * It reads files only, starts no server, opens no database, contacts no host and
 * loads nothing beyond Node's own stdlib (`node:fs`, `node:os`, `node:path`,
 * `node:url`, `node:child_process`).
 *
 * Usage:  node server/scripts/proofs/fu/claims-check-numeric-fixtures.mjs
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = join(HERE, '../../..');
const REPO_DIR = join(SERVER_DIR, '..');
const DOCS_DIR = join(REPO_DIR, 'docs/house-swarm-7');
const CHECK_REL = 'scripts/proofs/wu6/claims-check.mjs';
const CHECK_NAME = 'sales-numbers-agree-with-ledger';
const DOC_FILES = ['WU6-SALES-EN.md', 'WU6-SALES-TH.md', 'WU6-CLAIMS-EVIDENCE.md'];

const EN = 'WU6-SALES-EN.md';
const TH = 'WU6-SALES-TH.md';
const LEDGER = 'WU6-CLAIMS-EVIDENCE.md';

const results = [];

function record(name, passed, detail) {
  results.push({ name, passed });
  console.log(`CHECK ${name} ${passed ? 'PASS' : 'FAIL'} ${detail}`);
}

function observation(line) {
  console.log(`OBSERVATION ${line}`);
}

/** The delivered documents, read once as the fixtures' source (never mutated). */
const SOURCE = new Map();
for (const name of DOC_FILES) {
  SOURCE.set(name, readFileSync(join(DOCS_DIR, name), 'utf8'));
}

/** Replace `old` with `new` exactly once inside a copied document. */
function replaceOnce(dir, file, old, next) {
  const path = join(dir, file);
  const text = readFileSync(path, 'utf8');
  const count = text.split(old).length - 1;
  if (count !== 1) {
    throw new Error(
      `mutation anchor must appear exactly once in ${file}, found ${count}: ${JSON.stringify(old.slice(0, 90))}`
    );
  }
  writeFileSync(path, text.replace(old, next));
}

/**
 * One case: `mutate` gets the temp directory and must apply exactly one change,
 * or be null for the unmutated control. `expect` is 'pass' or 'fail'.
 *
 * Every anchor below is a substring that appears exactly ONCE in the delivered
 * document (asserted by replaceOnce), so a case cannot silently mutate the wrong
 * sentence — or silently stop mutating anything at all — if the documents are
 * reworded later. That is deliberate: a fixture that quietly mutates nothing
 * would PASS for the wrong reason and is worse than no fixture.
 */
const CASES = [
  {
    name: 'a-sales-document-figure-reverted-to-the-old-51-file-total',
    expect: 'fail',
    mutation: `${EN} V4: the set-database file total is reverted to the pre-change \`(5)\` — "exits 0 with \`Test Files 6 passed (6)\`" becomes "exits 0 with \`Test Files 5 passed (5)\`", while the ledger still states files(6)`,
    mutate: (dir) =>
      replaceOnce(
        dir,
        EN,
        '`DATABASE_URL` **set** → exits 0 with `Test Files 6 passed (6)`',
        '`DATABASE_URL` **set** → exits 0 with `Test Files 5 passed (5)`'
      ),
  },
  {
    name: 'b-sales-document-figure-reverted-to-the-old-46-file-total',
    expect: 'fail',
    mutation: `${TH} V4: the set-database file total is reverted to the pre-change \`(5)\` — "→ ออกด้วย 0 ด้วย \`Test Files 6 passed (6)\`" becomes "→ ออกด้วย 0 ด้วย \`Test Files 5 passed (5)\`", while the ledger still states files(6)`,
    mutate: (dir) =>
      replaceOnce(
        dir,
        TH,
        '→ ออกด้วย 0 ด้วย `Test Files 6 passed (6)`',
        '→ ออกด้วย 0 ด้วย `Test Files 5 passed (5)`'
      ),
  },
  {
    name: 'c-ledger-live-figure-changed-documents-untouched',
    expect: 'fail',
    mutation: `${LEDGER} C39 claim cell: the live test total is changed to \`Tests 57 passed (57)\` while both sales documents still state tests(58)`,
    mutate: (dir) =>
      replaceOnce(
        dir,
        LEDGER,
        '`Tests 58 passed (58)`. / ตั้ง DATABASE_URL แล้วได้ 6 passed (6)',
        '`Tests 57 passed (57)`. / ตั้ง DATABASE_URL แล้วได้ 6 passed (6)'
      ),
  },
  {
    name: 'd-delivered-documents-are-pass',
    expect: 'pass',
    mutation: 'none — the delivered documents, copied unmutated',
    mutate: null,
  },
];

/** Run the real claims-check against a documents directory. */
function runCheck(dir) {
  const run = spawnSync(process.execPath, [CHECK_REL], {
    cwd: SERVER_DIR,
    env: { ...process.env, CLAIMS_DOCS_DIR: dir },
    encoding: 'utf8',
  });
  const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  const line = output
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(`CHECK ${CHECK_NAME} `));
  return {
    exitCode: run.status,
    checkLine: line ?? null,
    checkPassed: line === undefined ? false : / PASS /.test(line),
  };
}

let tempRoot = null;

try {
  observation(`repository under test: ${REPO_DIR}`);
  observation(`node: ${process.version}`);
  observation(`rule under test: ${CHECK_REL} CHECK ${CHECK_NAME}`);
  observation(`fixture source documents: ${DOCS_DIR} (read-only; never mutated)`);

  tempRoot = mkdtempSync(join(tmpdir(), 'mt01p1-numeric-fixtures-'));
  observation(`temp directory created under the OS temp dir: ${tempRoot}`);

  for (const testCase of CASES) {
    const dir = join(tempRoot, testCase.name);
    const run = (() => {
      try {
        // Fresh copy of the three delivered documents for every case.
        mkdirSync(dir, { recursive: true });
        for (const name of DOC_FILES) {
          writeFileSync(join(dir, name), SOURCE.get(name));
        }
        if (testCase.mutate !== null) testCase.mutate(dir);
        return runCheck(dir);
      } catch (error) {
        return { exitCode: null, checkLine: null, checkPassed: false, error: error.message };
      }
    })();

    const expectedExit = testCase.expect === 'pass' ? 0 : 'non-zero';
    const behaves =
      run.error === undefined &&
      run.checkLine !== null &&
      run.checkPassed === (testCase.expect === 'pass') &&
      (testCase.expect === 'pass' ? run.exitCode === 0 : run.exitCode !== 0);

    observation(`case ${testCase.name}: mutation = ${testCase.mutation}`);
    observation(`case ${testCase.name}: expected ${testCase.expect} (exit ${expectedExit})`);
    observation(`case ${testCase.name}: observed exit code = ${run.exitCode}`);
    observation(
      `case ${testCase.name}: observed line = ${run.checkLine === null ? '(no CHECK line printed)' : run.checkLine.slice(0, 600)}`
    );
    if (run.error) observation(`case ${testCase.name}: could not run: ${run.error}`);

    record(
      testCase.name,
      behaves,
      `mutation="${testCase.mutation}" expected=${testCase.expect} observed_exit_code=${run.exitCode} observed_check=${run.checkPassed ? 'PASS' : 'FAIL'}${run.error ? ` error=${run.error}` : ''}`
    );
  }
} catch (error) {
  record('harness', false, `unexpected_error=${error.message}`);
} finally {
  if (tempRoot !== null) {
    try {
      rmSync(tempRoot, { recursive: true, force: true });
      observation(
        `removed the temp directory it created: ${tempRoot} (nothing inside the worktree was touched)`
      );
    } catch (error) {
      observation(`could not remove ${tempRoot}: ${error.message}`);
    }
  }
}

const failed = results.filter((result) => !result.passed);
console.log(
  `SUMMARY cases=${results.length} passed=${results.length - failed.length} failed=${failed.length}` +
    (failed.length > 0 ? ` failed_names=[${failed.map((f) => f.name).join(',')}]` : '')
);
if (failed.length > 0) process.exitCode = 1;
