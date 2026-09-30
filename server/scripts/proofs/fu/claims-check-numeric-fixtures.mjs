#!/usr/bin/env node
/**
 * MT01-PRESALE-P1 claims-check-numeric-fixtures — proves ON DEMAND that CHECK 9
 * of `server/scripts/proofs/wu6/claims-check.mjs`
 * (`sales-numbers-agree-with-ledger`) really goes red on both directions of the
 * defect it exists to catch, and stays green on the delivered documents.
 *
 * EXTENDED in MT01-PRESALE-R2B-A to prove the same for the tenth check,
 * `buyer-facing-documents-are-cited-under-docs-product`: a copy of a delivered
 * document whose buyer-facing citation is restored to the vendor's
 * working-record folder must make that check go FAIL, and the delivered
 * documents must make it PASS. Both checks are judged on the child process's
 * EXIT CODE and on the named `CHECK …` line.
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
 * `CHECK <name> PASS|FAIL` line for the check that case targets. The delivered
 * documents themselves are never edited, and the temp directory is removed
 * afterwards.
 *
 * THE CASES:
 *
 *   a. a sales-document figure reverted to the old `51` total   -> check FAIL
 *      (EN V4's set-database file total goes back to the pre-change `(5)`,
 *      which is the old five-file summary; the ledger still states `files(6)`)
 *   b. a sales-document figure reverted to the old `46`/`(5)` file total -> FAIL
 *      (TH V4's set-database file total goes back to `(5)`)
 *   c. the ledger's LIVE figure changed, documents untouched     -> check FAIL
 *      (C39's claim cell loses the live `Tests 62 passed (62)` total)
 *   e. a sales-document figure reverted to the superseded `58` total -> FAIL
 *   f. a buyer-facing citation restored to the working-record folder -> CHECK 10 FAIL
 *      (EN's "Also in the tree" line cites the vendor folder again)
 *   g. the delivered documents, unmutated                         -> CHECK 10 PASS, exit 0
 *   d. the delivered documents, unmutated                         -> check PASS, exit 0
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
const DOCS_DIR = join(REPO_DIR, 'docs/product');
const CHECK_REL = 'scripts/proofs/wu6/claims-check.mjs';
const CHECK_NAME = 'sales-numbers-agree-with-ledger';
const CITATION_CHECK_NAME = 'buyer-facing-documents-are-cited-under-docs-product';
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
    mutation: `${LEDGER} C39 claim cell: the live test total is changed to \`Tests 59 passed (59)\` while both sales documents still state tests(62)`,
    mutate: (dir) =>
      replaceOnce(
        dir,
        LEDGER,
        '`Tests 62 passed (62)`. / ตั้ง DATABASE_URL แล้วได้ 6 passed (6)',
        '`Tests 59 passed (59)`. / ตั้ง DATABASE_URL แล้วได้ 6 passed (6)'
      ),
  },
  {
    // SUPERSEDED-FIGURE CASE (MT01-PRESALE-P3C). The 58 this lane's predecessor
    // shipped was correct when it was measured and is stale now, exactly as 51
    // was before it. A document reverted to it must go red: without this case the
    // fixture set would prove only that the OLDEST figures are caught, not that
    // the figure this revision replaced is.
    name: 'e-sales-document-figure-reverted-to-the-superseded-58-test-total',
    expect: 'fail',
    mutation: `${EN} V4: the set-database test total is reverted to the superseded \`(58)\` — \`Tests 62 passed (62)\` becomes \`Tests 58 passed (58)\`, while the ledger still states tests(62)`,
    mutate: (dir) =>
      replaceOnce(
        dir,
        EN,
        // Anchored on the V4 claim's own line, so it appears exactly once even
        // though the figure itself is stated in several places in the document.
        '`Tests 62 passed (62)` (measured in this work unit). So: the database-backed test',
        '`Tests 58 passed (58)` (measured in this work unit). So: the database-backed test'
      ),
  },
  {
    name: 'd-delivered-documents-are-pass',
    expect: 'pass',
    check: CHECK_NAME,
    mutation: 'none — the delivered documents, copied unmutated',
    mutate: null,
  },
  {
    // CHECK 10 (added in MT01-PRESALE-R2B-A). The reviewed defect: a
    // buyer-facing document locating itself under the vendor's working-record
    // folder. The mutation restores the wrong folder on a line that names a
    // buyer-facing filename in the SAME line (the TH document's "Also in the
    // tree" line, where the directory token and `WU3-PAID-ROUTE-INVENTORY.md`
    // are not wrapped apart) — CHECK 10 is line-based, so a case must target a
    // same-line site. The wrong folder token is assembled from parts (the same
    // self-reference reason the delivery gate's fixtures give), and the anchor
    // is the delivered sentence, asserted to appear exactly once by replaceOnce.
    name: 'f-buyer-facing-citation-restored-to-the-working-record-folder',
    expect: 'fail',
    check: CITATION_CHECK_NAME,
    mutation: `${TH}'s "Also in the tree" line cites the operating documents under the working-record folder again, on the line that also names WU3-PAID-ROUTE-INVENTORY.md`,
    mutate: (dir) => {
      const wrongDir = 'docs/' + 'house-swarm-7' + '/';
      replaceOnce(
        dir,
        TH,
        'เอกสารปฏิบัติงานใต้ `docs/product/`',
        'เอกสารปฏิบัติงานใต้ `' + wrongDir + '`'
      );
    },
  },
  {
    name: 'g-buyer-facing-citation-on-the-delivered-documents-is-pass',
    expect: 'pass',
    check: CITATION_CHECK_NAME,
    mutation: 'none — the delivered documents, copied unmutated',
    mutate: null,
  },
];

/** Run the real claims-check against a documents directory, reading back one named check. */
function runCheck(dir, checkName) {
  const run = spawnSync(process.execPath, [CHECK_REL], {
    cwd: SERVER_DIR,
    env: { ...process.env, CLAIMS_DOCS_DIR: dir },
    encoding: 'utf8',
  });
  const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  const line = output
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(`CHECK ${checkName} `));
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
        return runCheck(dir, testCase.check ?? CHECK_NAME);
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

    observation(`case ${testCase.name}: targets CHECK ${testCase.check ?? CHECK_NAME}`);
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
