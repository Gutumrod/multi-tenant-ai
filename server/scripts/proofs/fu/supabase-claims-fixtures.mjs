#!/usr/bin/env node
/**
 * H7-REVIEW-FIX-2 supabase-claims-fixtures — proves ON DEMAND that CHECK 3 of
 * `server/scripts/proofs/wu6/claims-check.mjs` (`no-supabase-tested-claim`)
 * rejects every affirmative Supabase claim it says it does, and cannot be
 * satisfied by deleting Supabase from a document.
 *
 * WHY THIS EXISTS. The review that raised this work unit (ISSUE 1) measured the
 * OLD rule and found it vacuous over the exact claim it existed to kill: its
 * affirmative patterns needed a test verb within 60 characters before
 * `with|against|on|using` and then `supabase`, and its Thai list did not contain
 * `ใช้ได้`. Handed a copy whose EN N4 read "…connection string works with
 * Supabase.", the old rule printed `CHECK no-supabase-tested-claim PASS` and
 * exited 0. Meanwhile the old rule REQUIRED that sentence to be present. A gate
 * that passes the claim it is named after is worse than no gate, so the rule was
 * rewritten (see the CHECK 3 comment block) and this harness is the evidence
 * that the new rule really goes red. A fixture case that cannot fail is worse
 * than no case, so every expected-FAIL case below is judged on the exit code
 * AND on the `CHECK no-supabase-tested-claim` line, and the harness's own exit
 * code is non-zero if any case does not behave as required.
 *
 * HOW IT WORKS. It writes nothing inside the worktree. For each case it copies
 * the delivered document set — `WU6-SALES-EN.md`, `WU6-SALES-TH.md`,
 * `WU6-CLAIMS-EVIDENCE.md` — into a fresh directory under the OS temp dir,
 * applies exactly one mutation to that copy, and runs the REAL
 * `claims-check.mjs` as a child process with `CLAIMS_DOCS_DIR` pointed at the
 * copy. It then reads back the child's exit code and its
 * `CHECK no-supabase-tested-claim PASS|FAIL` line. The delivered documents
 * themselves are never edited, and the temp directory is removed afterwards.
 *
 * THE CASES (a-g, plus h and h2):
 *
 *   a. delivered documents, unmutated                        -> check PASS, exit 0
 *   b. EN gains "…connection string works with Supabase."     -> check FAIL
 *      (the review's own measurement: the copy whose EN N4 carries that sentence)
 *   c. TH gains "ใช้งานได้กับ Supabase"                       -> check FAIL
 *   d. TH gains "ใช้กับ Supabase ได้"                         -> check FAIL
 *   e. the required "not been tested with Supabase" removed   -> check FAIL
 *   f. the "not Supabase-backed" denial removed               -> check FAIL
 *   g. every Supabase mention removed from one document       -> check FAIL
 *      (the requirement is satisfied by stating the position, not by silence)
 *   h. the required TH pre-sale commitment removed            -> check FAIL
 *   h2. the affirmative appended to a line that ALREADY carries a negation
 *      marker                                                 -> check PASS
 *      This one is a RECORDED LIMITATION, not a success: the rule is judged per
 *      line, so a line that already says "not" protects everything else on it,
 *      and an affirmative welded onto that same line is not separated from it.
 *      Case b is the same sentence standing on its own line, which the rule
 *      does flag. The limitation is written up in
 *      `FU-REVIEW-FIX-2.md` (vendor-internal, not delivered) rather than left unstated — a
 *      fixture list that only contains cases that pass proves less than it
 *      appears to.
 *
 * It reads files only, starts no server, opens no database, contacts no host,
 * and loads nothing beyond Node's own stdlib (`node:fs`, `node:os`, `node:path`,
 * `node:url`, `node:child_process`).
 *
 * Usage:  node server/scripts/proofs/fu/supabase-claims-fixtures.mjs
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
const CHECK_NAME = 'no-supabase-tested-claim';
const DOC_FILES = ['WU6-SALES-EN.md', 'WU6-SALES-TH.md', 'WU6-CLAIMS-EVIDENCE.md'];

const EN = 'WU6-SALES-EN.md';
const TH = 'WU6-SALES-TH.md';

const results = [];

function record(name, passed, detail) {
  results.push({ name, passed });
  console.log(`CHECK ${name} ${passed ? 'PASS' : 'FAIL'} ${detail}`);
}

function observation(line) {
  console.log(`OBSERVATION ${line}`);
}

/** The delivered documents, read once as the fixtures' source. */
const SOURCE = new Map();
for (const name of DOC_FILES) {
  SOURCE.set(name, readFileSync(join(DOCS_DIR, name), 'utf8'));
}

/** Replace `old` with `new` exactly once inside a copied document. */
function replaceOnce(dir, file, old, next) {
  const path = join(dir, file);
  const text = readFileSync(path, 'utf8');
  if (!text.includes(old)) {
    throw new Error(`mutation anchor not found in ${file}: ${JSON.stringify(old.slice(0, 80))}`);
  }
  writeFileSync(path, text.replace(old, next));
}

/** Insert `line` immediately after the first line containing `after`. */
function insertAfterLine(dir, file, after, line) {
  const path = join(dir, file);
  const lines = readFileSync(path, 'utf8').split('\n');
  const index = lines.findIndex((candidate) => candidate.includes(after));
  if (index === -1) {
    throw new Error(`mutation anchor line not found in ${file}: ${JSON.stringify(after)}`);
  }
  lines.splice(index + 1, 0, line);
  writeFileSync(path, lines.join('\n'));
}

/**
 * One case: `mutate` gets the temp directory and must apply exactly one change,
 * or be null for the unmutated control. `expect` is 'pass' or 'fail'.
 */
const CASES = [
  {
    name: 'a-delivered-documents-are-pass',
    expect: 'pass',
    mutation: 'none — the delivered documents, copied unmutated',
    mutate: null,
  },
  {
    name: 'b-en-affirmative-works-with-supabase',
    expect: 'fail',
    mutation:
      `${EN} line 287 gains the sentence "A buyer's own Supabase Postgres connection string works with Supabase." — the review's measurement, on the line the old rule REQUIRED but could not flag`,
    mutate: (dir) =>
      insertAfterLine(
        dir,
        EN,
        '- **N4 — Supabase has not been tested.**',
        "  A buyer's own Supabase Postgres connection string works with Supabase."
      ),
  },
  {
    name: 'c-th-affirmative-ใช้งานได้กับ-supabase',
    expect: 'fail',
    mutation: `${TH} line 239 gains the sentence "ใช้งานได้กับ Supabase" — ใช้งานได้ was NOT in the old Thai affirmative list`,
    mutate: (dir) => insertAfterLine(dir, TH, '- **N4 — Supabase ยังไม่ถูกทดสอบ**', '  ใช้งานได้กับ Supabase'),
  },
  {
    name: 'd-th-affirmative-ใช้กับ-supabase-ได้',
    expect: 'fail',
    mutation: `${TH} line 239 gains the sentence "ใช้กับ Supabase ได้" — the ใช้ได้ gap in its split form, which the old rule let through`,
    mutate: (dir) => insertAfterLine(dir, TH, '- **N4 — Supabase ยังไม่ถูกทดสอบ**', '  ใช้กับ Supabase ได้'),
  },
  {
    name: 'e-required-not-been-tested-sentence-removed',
    expect: 'fail',
    mutation:
      `${EN} line 288: the required denial is deleted — "has **not** been tested with Supabase" becomes "has been tested with Supabase"`,
    mutate: (dir) =>
      replaceOnce(
        dir,
        EN,
        '16 and has **not** been tested with Supabase;',
        '16 and has been tested with Supabase;'
      ),
  },
  {
    name: 'f-required-not-supabase-backed-denial-removed',
    expect: 'fail',
    mutation: `${EN} line 290: the persistence denial is deleted — "The persistence layer is not Supabase-backed" becomes "The persistence layer is Supabase-backed"`,
    mutate: (dir) =>
      replaceOnce(
        dir,
        EN,
        'The persistence layer is not\n  Supabase-backed:',
        'The persistence layer is\n  Supabase-backed:'
      ),
  },
  {
    name: 'g-supabase-mentions-removed-from-one-document',
    expect: 'fail',
    mutation: `${EN}: every occurrence of the token "supabase" (any case) deleted, so the document goes silent instead of stating the position`,
    mutate: (dir) => {
      const path = join(dir, EN);
      const text = readFileSync(path, 'utf8');
      const count = (text.match(/supabase/gi) ?? []).length;
      if (count === 0) throw new Error(`${EN} carries no "supabase" mention to delete`);
      writeFileSync(path, text.replace(/supabase/gi, ''));
      return `${count} occurrence(s) deleted`;
    },
  },
  {
    name: 'h-required-th-commitment-removed',
    expect: 'fail',
    mutation: `${TH} line 240: the required pre-sale commitment is deleted — "โดยกำหนดจะทดสอบกับโปรเจกต์ Supabase จริงก่อนเปิดขาย" is dropped`,
    mutate: (dir) =>
      replaceOnce(
        dir,
        TH,
        ' โดยกำหนดจะทดสอบกับโปรเจกต์ Supabase จริงก่อนเปิดขาย',
        ''
      ),
  },
  {
    // EXPECTED TO PASS, and recorded here rather than left unstated: the rule is
    // judged per line, and a line that already carries a negation marker
    // (`not`, `ไม่`) protects everything else on that line — so an affirmative
    // appended to a line that ALREADY denies something is not separated from it.
    // This case is the exact shape the review measured, on the line the old rule
    // required; the new rule catches the same sentence when it stands on its own
    // line (case b). Splitting an affirmative appended to a negated line into
    // two lines is left to a human reviewer; what the rule does and does not
    // cover is written up in `FU-REVIEW-FIX-2.md` (vendor-internal, not delivered) rather than
    // hidden by a missing case.
    name: 'h2-appended-to-an-already-negated-line-is-not-separated',
    expect: 'pass',
    mutation: `${EN}: the affirmative appended to the N4 line that itself carries "not" — the per-line escape cannot separate these two halves, so the rule does not flag this line (documented limitation; case b flags the same sentence on its own line)`,
    mutate: (dir) =>
      replaceOnce(
        dir,
        EN,
        '- **N4 — Supabase has not been tested.**',
        "- **N4 — Supabase has not been tested.** A buyer's own Supabase Postgres connection string works with Supabase."
      ),
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

  tempRoot = mkdtempSync(join(tmpdir(), 'h7fix2-supabase-fixtures-'));
  observation(`temp directory created under the OS temp dir: ${tempRoot}`);

  for (const testCase of CASES) {
    const dir = join(tempRoot, testCase.name);
    const mutated = [];
    const run = (() => {
      try {
        // Fresh copy of the three delivered documents for every case.
        mkdirSync(dir, { recursive: true });
        for (const name of DOC_FILES) {
          writeFileSync(join(dir, name), SOURCE.get(name));
        }
        if (testCase.mutate !== null) {
          const extra = testCase.mutate(dir);
          if (typeof extra === 'string') mutated.push(extra);
        }
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

    observation(
      `case ${testCase.name}: mutation = ${testCase.mutation}${mutated.length > 0 ? ` (${mutated.join('; ')})` : ''}`
    );
    observation(`case ${testCase.name}: expected ${testCase.expect} (exit ${expectedExit})`);
    observation(`case ${testCase.name}: observed exit code = ${run.exitCode}`);
    observation(
      `case ${testCase.name}: observed line = ${run.checkLine === null ? '(no CHECK line printed)' : run.checkLine.slice(0, 400)}`
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
      observation(`removed the temp directory it created: ${tempRoot} (nothing inside the worktree was touched)`);
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
