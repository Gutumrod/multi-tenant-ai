#!/usr/bin/env node
/**
 * H7-FU-RATELIMIT-REPAIR6 manual-claims-proof — mechanically checks the factual
 * claims `docs/house-swarm-7/WU5-DEPLOY.md` makes about the test suite.
 *
 * What it checks, and why it exists: the manual has twice carried test counts and
 * a row-leak warning that no longer matched the tree. Prose that "looks edited"
 * is not evidence, so this harness reads the manual and compares its claims with
 * the measured ground truth and with the tree itself:
 *
 *   * the counts with `DATABASE_URL` SET   -> `Test Files 6 passed (6)` / `Tests 58 passed (58)`
 *   * the counts with `DATABASE_URL` UNSET -> `Test Files 5 passed | 1 skipped (6)` / `Tests 53 passed | 5 skipped (58)`
 *   * `server/tests/` really holds SIX test files
 *   * the row leak is FIXED: the suite deletes the rows it creates, three
 *     consecutive runs against one database leave `subscriptions` 0 and
 *     `billing_event_ledger` 0, and the manual must say so
 *   * the obsolete leak warning is GONE (no "does not clean them up", no "this is
 *     the one that leaks", no before/after `{"subscriptions":5` delta) while the
 *     honest history of that obsolete warning is KEPT (an earlier version left
 *     rows and re-running it used to fail), so a reader who finds the old warning
 *     elsewhere learns it is obsolete rather than being left to trust it
 *   * the working stop command is present (`netstat -ano | grep :3003` then
 *     `cmd.exe /c "taskkill /F /PID <pid>"`, plus the check that proves the port
 *     is free)
 *   * the rollback says the `multi-tenant-ai.previous` copy must be taken at
 *     delivery time before any change, and says what a reader who took none can
 *     do instead
 *
 * It reads files only. It starts no server, opens no database connection, loads
 * no dependency beyond Node's own stdlib, and contacts no host.
 *
 * It prints exactly one line per claim checked, in this form:
 *
 *   CHECK <name> PASS|FAIL <detail>
 *
 * and it exits non-zero if ANY claim is stale or absent, printing the offending
 * line of the manual for each failure. It exits 0 only when every claim matches.
 *
 * `FU_DOCS_DIR` exists so a reviewer can watch this harness go red on demand: it
 * repoints the manual lookup at a mutated copy (used to demonstrate the failure
 * mode during this work unit). It defaults to this repository's
 * `docs/house-swarm-7`, and the delivered manual is the one under that default.
 *
 * Usage:  node server/scripts/proofs/fu/manual-claims-proof.mjs
 *         FU_DOCS_DIR=/path/to/mutated/copy node server/scripts/proofs/fu/manual-claims-proof.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = join(HERE, '../../..');
const REPO_DIR = join(SERVER_DIR, '..');

const DOCS_DIR = process.env.FU_DOCS_DIR
  ? process.env.FU_DOCS_DIR
  : join(REPO_DIR, 'docs/house-swarm-7');
const MANUAL_PATH = join(DOCS_DIR, 'WU5-DEPLOY.md');
const TESTS_DIR = join(SERVER_DIR, 'tests');

const results = [];

function record(name, passed, detail) {
  results.push({ name, passed });
  console.log(`CHECK ${name} ${passed ? 'PASS' : 'FAIL'} ${detail}`);
}

const MANUAL = (() => {
  try {
    return readFileSync(MANUAL_PATH, 'utf8');
  } catch {
    return null;
  }
})();

/** The manual's lines, with 1-based numbers. */
const LINES = MANUAL === null ? [] : MANUAL.split(/\r?\n/).map((line, i) => ({ line, n: i + 1 }));

/**
 * Whitespace-collapsed manual text with markdown escapes resolved, so a claim
 * written across a wrap and a claim written inside a table cell (`\|`) are
 * matched the same way as a claim written on one plain line.
 */
const FLAT = MANUAL === null ? '' : MANUAL.replace(/\\\|/g, '|').replace(/\s+/g, ' ').trim();

/** The first manual line matching `pattern`, or null. Used to quote a failure. */
function firstLine(pattern) {
  for (const { line, n } of LINES) {
    if (pattern.test(line.replace(/\\\|/g, '|'))) return { n, line: line.trim() };
  }
  return null;
}

/** Every manual line matching `pattern`, as { n, line }. */
function allLines(pattern) {
  return LINES.filter(({ line }) => pattern.test(line.replace(/\\\|/g, '|'))).map(
    ({ line, n }) => ({ n, line: line.trim() })
  );
}

if (MANUAL === null) {
  record('manual-exists', false, `the manual ${MANUAL_PATH} does not exist`);
  console.log('SUMMARY claims=1 passed=0 failed=1');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// GROUND TRUTH — the figures this work unit was given, measured on this branch.
// ---------------------------------------------------------------------------
const WITH_DB = {
  files: 'Test Files 6 passed (6)',
  tests: 'Tests 58 passed (58)',
};
const WITHOUT_DB = {
  files: 'Test Files 5 passed | 1 skipped (6)',
  tests: 'Tests 53 passed | 5 skipped (58)',
};

/**
 * Stale claims. Each is a claim the manual MUST NOT carry any more, paired with
 * the correct figure it was replaced by. The `(5)` / `(51)` totals are what make
 * these precise: the CORRECT unset-database count legitimately contains the words
 * "5 passed | 1 skipped", so a stale detector without the total would fail the
 * corrected manual.
 */
const STALE = [
  {
    label: 'files-with-db total 5',
    pattern: /Test Files\s+5 passed \(5\)/,
    correct: WITH_DB.files,
  },
  {
    label: 'tests-with-db total 51',
    pattern: /\bTests\s+51 passed \(51\)/,
    correct: WITH_DB.tests,
  },
  {
    label: 'files-without-db total 5',
    pattern: /Test Files\s+4 passed \| 1 skipped \(5\)/,
    correct: WITHOUT_DB.files,
  },
  {
    label: 'tests-without-db total 51',
    pattern: /\bTests\s+46 passed \| 5 skipped \(51\)/,
    correct: WITHOUT_DB.tests,
  },
  {
    label: 'bare "4 passed | 1 skipped (5)"',
    pattern: /\b4 passed \| 1 skipped \(5\)/,
    correct: WITHOUT_DB.files,
  },
  {
    label: 'bare "46 passed | 5 skipped (51)"',
    pattern: /\b46 passed \| 5 skipped \(51\)/,
    correct: WITHOUT_DB.tests,
  },
  {
    label: 'any file total of (5) in a Test Files summary',
    pattern: /Test Files[^()\n]{0,40}\(5\)/,
    correct: WITH_DB.files,
  },
  {
    label: 'any test total of (51) in a Tests summary',
    pattern: /\bTests[^()\n]{0,40}\(51\)/,
    correct: WITH_DB.tests,
  },
];

/** Claims that the OBSOLETE leak warning made, which must be gone. */
const STALE_LEAK_TEXT = [
  {
    label: 'says the suite does not clean up after itself',
    pattern: /does not clean (?:them|it) up/i,
  },
  {
    label: 'names webhook.test.ts as the file that leaks',
    pattern: /this is the one that leaks/i,
  },
  {
    label: 'says only one of the two test files leaks',
    pattern: /only one of (?:them|the two) leaks/i,
  },
  { label: 'quotes the old "and no cleanup" tail', pattern: /\band no cleanup\b/i },
  { label: 'tells the reader to treat the database as single-use', pattern: /single-use/i },
  {
    label: 'quotes the old before/after row delta {"subscriptions":5',
    pattern: /"subscriptions"\s*:\s*5/,
  },
  { label: 'quotes the old after delta {"subscriptions":7', pattern: /"subscriptions"\s*:\s*7/ },
  {
    // The stale form is a present-tense pointer telling the reader that
    // checklist item 3 carries a leak warning they must heed. The sentence the
    // CORRECTED manual keeps — "If you find a row-leak warning in another copy
    // of this manual … that warning is obsolete" — is history, not an
    // instruction, so this pattern requires the imperative tail to match. A
    // broader /row-leak warning/ test would fail the corrected manual, which is
    // the one place in this file where the phrase is legitimately retained.
    label: 'still points the reader at a present-tense row-leak warning',
    pattern: /row-leak warning you must not skip/i,
  },
];

// ---------------------------------------------------------------------------
// CHECK 1.5 — the manual exists at the expected path (recorded for the summary).
// ---------------------------------------------------------------------------
record(
  'manual-exists',
  statSync(MANUAL_PATH).isFile(),
  `rule: the manual under test must exist; read ${MANUAL_PATH} (${MANUAL.length} bytes, ${LINES.length} lines)`
);

// ---------------------------------------------------------------------------
// CHECK 1 — test-counts-with-database
// ---------------------------------------------------------------------------
{
  const problems = [];
  const filesLine = firstLine(/6 passed \(6\)/);
  const testsLine = firstLine(/58 passed \(58\)/);

  if (!FLAT.includes(WITH_DB.files) && !/Test Files\s+6 passed \(6\)/.test(FLAT)) {
    problems.push(`the manual never states \`${WITH_DB.files}\``);
  }
  if (!/Tests\s+58 passed \(58\)/.test(FLAT)) {
    problems.push(`the manual never states \`${WITH_DB.tests}\``);
  }

  record(
    'test-counts-with-database',
    problems.length === 0,
    problems.length === 0
      ? `rule: with DATABASE_URL set the manual must state \`${WITH_DB.files}\` and \`${WITH_DB.tests}\`; found at line ${filesLine.n} and line ${testsLine.n}`
      : `${problems.join('; ')} (expected: ${WITH_DB.files} / ${WITH_DB.tests})`
  );
  if (problems.length > 0) {
    for (const { n, line } of allLines(/passed \(/).slice(0, 6)) {
      console.log(`  stale-claim line ${n}: ${line.slice(0, 200)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// CHECK 2 — test-counts-without-database
// ---------------------------------------------------------------------------
{
  const problems = [];
  const filesLine = firstLine(/5 passed \| 1 skipped \(6\)/);
  const testsLine = firstLine(/53 passed \| 5 skipped \(58\)/);

  if (!/Test Files\s+5 passed \| 1 skipped \(6\)/.test(FLAT)) {
    problems.push(`the manual never states \`${WITHOUT_DB.files}\``);
  }
  if (!/Tests\s+53 passed \| 5 skipped \(58\)/.test(FLAT)) {
    problems.push(`the manual never states \`${WITHOUT_DB.tests}\``);
  }

  record(
    'test-counts-without-database',
    problems.length === 0,
    problems.length === 0
      ? `rule: with DATABASE_URL unset the manual must state \`${WITHOUT_DB.files}\` and \`${WITHOUT_DB.tests}\`; found at line ${filesLine.n} and line ${testsLine.n}`
      : `${problems.join('; ')} (expected: ${WITHOUT_DB.files} / ${WITHOUT_DB.tests})`
  );
}

// ---------------------------------------------------------------------------
// CHECK 3 — no-stale-test-counts
// ---------------------------------------------------------------------------
{
  const hits = [];
  for (const stale of STALE) {
    for (const { n, line } of allLines(stale.pattern)) {
      hits.push(`line ${n} carries the stale ${stale.label}: "${line.slice(0, 160)}"`);
    }
  }

  record(
    'no-stale-test-counts',
    hits.length === 0,
    hits.length === 0
      ? `rule: the ${STALE.length} superseded count forms must appear nowhere in the manual (5 passed (5) / 51 passed (51) / 4 passed | 1 skipped (5) / 46 passed | 5 skipped (51) and any other (5) or (51) total), in either language`
      : `${hits.length} stale count(s): ${hits.slice(0, 4).join(' | ')}`
  );
  if (hits.length > 0) for (const hit of hits.slice(0, 8)) console.log(`  ${hit}`);
}

// ---------------------------------------------------------------------------
// CHECK 4 — test-files-in-tree-are-six
//
// The claim is grounded, not asserted: the count in the manual is checked against
// the files that actually exist in server/tests.
// ---------------------------------------------------------------------------
{
  const problems = [];
  let files = [];
  try {
    files = readdirSync(TESTS_DIR)
      .filter((name) => name.endsWith('.test.ts'))
      .sort();
  } catch {
    problems.push(`server/tests does not exist at ${TESTS_DIR}`);
  }

  if (files.length !== 6) {
    problems.push(`server/tests holds ${files.length} test file(s), not the six the claim needs`);
  }
  if (!/\bsix test files\b/i.test(FLAT)) {
    problems.push('the manual does not state that the suite is six test files');
  }
  if (/\bfive test files\b/i.test(FLAT)) {
    problems.push('the manual still states "five test files"');
  }
  if (/contains FIVE test files/i.test(FLAT)) {
    problems.push('the manual still states that server/tests contains five test files');
  }

  record(
    'test-files-in-tree-are-six',
    problems.length === 0,
    problems.length === 0
      ? `rule: the manual must state six test files and the tree must hold six; found ${files.length} in server/tests (${files.join(', ')})`
      : problems.join('; ')
  );
  if (problems.length > 0) {
    for (const { n, line } of allLines(/five test files|contains FIVE/i)) {
      console.log(`  stale-claim line ${n}: ${line.slice(0, 200)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// CHECK 5 — row-cleanup-stated
//
// The behaviour is fixed, so the manual must say the suite removes what it
// created and that repeated runs against one database leave nothing behind. A
// manual that is silently missing this statement fails here.
// ---------------------------------------------------------------------------
{
  const problems = [];
  const cleanupLine = firstLine(/deletes (?:exactly )?the rows (?:it|that run)/i);
  const countsLine = firstLine(/billing_event_ledger`\s*0/);

  if (!/deletes (?:exactly )?the rows (?:it|that run)/i.test(FLAT)) {
    problems.push('the manual does not state that the suite deletes the rows it created');
  }
  if (!/three consecutive/i.test(FLAT)) {
    problems.push('the manual does not state that three consecutive runs were observed');
  }
  if (
    !/`subscriptions` 0 and\s*`billing_event_ledger` 0/i.test(FLAT) &&
    !/`subscriptions`\s*0.{0,40}`billing_event_ledger`\s*0/i.test(FLAT)
  ) {
    problems.push(
      'the manual does not state that the row counts after the runs were `subscriptions` 0 and `billing_event_ledger` 0'
    );
  }
  if (!/repeatable/i.test(FLAT)) {
    problems.push('the manual does not state that the suite is repeatable against one database');
  }

  record(
    'row-cleanup-stated',
    problems.length === 0,
    problems.length === 0
      ? `rule: the manual must state that the suite deletes the rows it creates, that three consecutive runs against one database leave nothing behind (subscriptions 0 / billing_event_ledger 0) and that the suite is repeatable; cleanup stated at line ${cleanupLine.n}, zero counts at line ${countsLine.n}`
      : problems.join('; ')
  );
}

// ---------------------------------------------------------------------------
// CHECK 6 — obsolete-row-leak-warning-absent
// ---------------------------------------------------------------------------
{
  const hits = [];
  for (const stale of STALE_LEAK_TEXT) {
    for (const { n, line } of allLines(stale.pattern)) {
      hits.push(`line ${n} ${stale.label}: "${line.slice(0, 160)}"`);
    }
  }

  record(
    'obsolete-row-leak-warning-absent',
    hits.length === 0,
    hits.length === 0
      ? `rule: none of the ${STALE_LEAK_TEXT.length} obsolete leak-warning forms may remain (the suite no longer leaks, so a warning that reads as if it still does is a false claim); checked "does not clean them up", "this is the one that leaks", "and no cleanup", "single-use", the before/after {"subscriptions":5 -> {"subscriptions":7 delta and the "row-leak warning" pointer`
      : `${hits.length} obsolete leak claim(s): ${hits.slice(0, 3).join(' | ')}`
  );
  if (hits.length > 0) for (const hit of hits.slice(0, 8)) console.log(`  ${hit}`);
}

// ---------------------------------------------------------------------------
// CHECK 7 — obsolete-warning-history-kept
//
// The warning is gone from THIS manual, but a reader may meet it in an older
// copy. So the manual must keep the history: an earlier version left rows, the
// re-run used to fail with the fixed-event-id dedupe, and the old warning is now
// obsolete.
// ---------------------------------------------------------------------------
{
  const problems = [];
  const historyLine = firstLine(/earlier version|An earlier version/i);
  const obsoleteLine = firstLine(/obsolete/i);

  if (!/earlier version of/i.test(FLAT)) {
    problems.push('the manual does not say an earlier version of the suite behaved differently');
  }
  if (!/never reached .{0,20}|used to \*\*fail\*\*|used to fail/i.test(FLAT)) {
    problems.push('the manual does not say that re-running the old suite used to fail');
  }
  if (!/AssertionError: expected 'active' to be 'cancelled'/.test(MANUAL)) {
    problems.push('the manual does not quote the old failure (AssertionError: expected \'active\' to be \'cancelled\')');
  }
  if (!/primary key/i.test(FLAT)) {
    problems.push('the manual does not explain the cause (the ledger event_id is a primary key)');
  }
  if (!/obsolete/i.test(FLAT)) {
    problems.push('the manual does not say the old row-leak warning is obsolete');
  }

  record(
    'obsolete-warning-history-kept',
    problems.length === 0,
    problems.length === 0
      ? `rule: the manual must keep the honest history of the obsolete leak warning — an earlier version left rows, re-running used to fail (AssertionError quoted verbatim), the cause is the fixed event ids against the ledger's primary key, and the old warning is called obsolete; history at line ${historyLine.n}, obsolete statement at line ${obsoleteLine.n}`
      : problems.join('; ')
  );
}

// ---------------------------------------------------------------------------
// CHECK 8 — stop-command-netstat-taskkill
// ---------------------------------------------------------------------------
{
  const problems = [];
  const hasNetstat = /netstat -ano \| grep :3003/.test(FLAT);
  const hasTaskkill = /cmd\.exe \/c "taskkill \/F \/PID <pid>"/.test(FLAT);
  const hasFreeCheck = /netstat -ano \| grep LISTENING \| grep :3003/.test(FLAT);
  const warnsWrapper = /killing the `npm run start` wrapper is \*\*not\*\* enough|wrapper is \*\*not\*\* enough|outlived their wrapper/i.test(
    FLAT
  );
  const namesShell = /Git-Bash/i.test(FLAT);

  if (!hasNetstat) problems.push('the manual does not give `netstat -ano | grep :3003`');
  if (!hasTaskkill) problems.push('the manual does not give `cmd.exe /c "taskkill /F /PID <pid>"`');
  if (!hasFreeCheck) {
    problems.push('the manual does not give the check that proves the port is free (`grep LISTENING | grep :3003`)');
  }
  if (!warnsWrapper) {
    problems.push('the manual does not state that killing the wrapper alone leaves the child listening');
  }
  if (!namesShell) problems.push('the manual does not say which shell the stop command was verified in');

  record(
    'stop-command-netstat-taskkill',
    problems.length === 0,
    problems.length === 0
      ? `rule: §7 must give the netstat-then-taskkill pair, state that killing the \`npm run start\` wrapper alone leaves the \`tsx\` child listening, give the grep-LISTENING check that proves the port is free, and name the shell it was verified in (Git-Bash); all five present`
      : problems.join('; ')
  );
  if (problems.length > 0) {
    for (const { n, line } of allLines(/netstat|taskkill/i)) {
      console.log(`  stop-command line ${n}: ${line.slice(0, 200)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// CHECK 9 — rollback-copy-taken-at-delivery
// ---------------------------------------------------------------------------
{
  const problems = [];
  const timingLine = firstLine(/must be taken at delivery time|taken at delivery time/i);

  if (!/multi-tenant-ai\.previous/.test(FLAT)) {
    problems.push('the manual does not name the multi-tenant-ai.previous copy the rollback swaps back to');
  }
  if (!/taken at delivery time/i.test(FLAT)) {
    problems.push('the manual does not say WHEN the copy must be taken (at delivery time, before any change)');
  }
  if (!/does not ship with this\s+delivery|contains no such folder/i.test(FLAT)) {
    problems.push('the manual does not state plainly that the delivery contains no such folder');
  }
  if (!/If you did not take that copy/i.test(FLAT)) {
    problems.push('the manual does not say what a reader who took no copy can do instead');
  }
  if (!/exit\s*\**\s*128|\b128\b/.test(FLAT)) {
    problems.push('the manual does not state that git is unavailable in this delivery (exit 128)');
  }
  if (!/not a git repository/.test(FLAT)) {
    problems.push('the manual does not quote the git error that proves git is unavailable');
  }

  record(
    'rollback-copy-taken-at-delivery',
    problems.length === 0,
    problems.length === 0
      ? `rule: §7 must say the \`multi-tenant-ai.previous\` copy must be taken at delivery time before any change, that the delivery contains no such folder, what a reader who took none can do instead, and must keep the verified no-git statement (\`fatal: not a git repository\`, exit 128); timing stated at line ${timingLine.n}`
      : problems.join('; ')
  );
  if (problems.length > 0) {
    for (const { n, line } of allLines(/previous|128/i)) {
      console.log(`  rollback line ${n}: ${line.slice(0, 200)}`);
    }
  }
}

// --------------------------------------------------------------------- summary --
const failed = results.filter((result) => !result.passed);
console.log(
  `SUMMARY claims=${results.length} passed=${results.length - failed.length} failed=${failed.length} manual=${MANUAL_PATH}` +
    (failed.length > 0 ? ` failed_names=[${failed.map((f) => f.name).join(',')}]` : '')
);
if (failed.length > 0) process.exit(1);
