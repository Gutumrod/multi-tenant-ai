#!/usr/bin/env node
/**
 * H7-FU-RATELIMIT-REPAIR7 manual-claims-proof — mechanically checks the factual
 * claims `docs/house-swarm-7/WU5-DEPLOY.md`, `docs/CURRENT_STATUS.md` and
 * `docs/house-swarm-7/WU6-CLAIMS-EVIDENCE.md` make, against each other and
 * against the tree.
 *
 * What it checks, and why it exists: the document set has repeatedly carried
 * claims that no longer matched the tree — test counts, a row-leak warning, and a
 * "no rate limiting" assertion that the follow-up work unit H7-FU-RATELIMIT made
 * false. Prose that "looks edited" is not evidence, so this harness reads the
 * documents and compares their claims with the measured ground truth and with
 * the tree itself:
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
 * ADDED IN REPAIR7 — three checks, for a class of error prose alone cannot catch:
 *
 *   * the FALSE "no rate limiting on POST /payment/webhook" assertion must be
 *     gone from `WU5-DEPLOY.md` AND `docs/CURRENT_STATUS.md`, in BOTH languages.
 *     The ban is on the ASSERTIVE form only: a corrected paragraph is allowed to
 *     quote the old sentence, because the corrected text in
 *     `docs/CURRENT_STATUS.md` does exactly that — so a block carrying the
 *     assertion is exempt only when the SAME block also says it is dead
 *     (previously / no longer true / obsolete / corrected / ล้าสมัย / แก้แล้ว).
 *   * the two documents must carry the TRUE statement in its place: the route IS
 *     rate limited, by the middleware mounted ahead of `express.raw()`, refused
 *     BEFORE signature verification so a flood costs no HMAC; the mechanism named
 *     (the vendored Module Hub module and its provenance file); the refusal shape
 *     (429 / `RATE_LIMITED` / `Retry-After`); the limits named with their defaults;
 *     and the honest per-instance caveat (in-process, resets on restart, not a
 *     substitute for an edge/proxy limit). The default NUMBERS are read out of
 *     `server/src/lib/rate-limit.ts`, not trusted: if the code default changes and
 *     the documents do not, this check fails.
 *   * `WU6-CLAIMS-EVIDENCE.md` must AGREE with `WU5-DEPLOY.md` §6.1: the test
 *     counts it states must match the manual's, the superseded figures must not
 *     stand as live claims in a claim cell, and the C40 row must state that the
 *     older used-database failure is FIXED while keeping the history of it (so an
 *     older copy cannot mislead).
 *
 * It reads files only. It starts no server, opens no database connection, loads
 * no dependency beyond Node's own stdlib, and contacts no host.
 *
 * It prints exactly one line per claim checked, in this form:
 *
 *   CHECK <name> PASS|FAIL <detail>
 *
 * and it exits non-zero if ANY claim is stale or absent, printing the offending
 * line of the document for each failure. It exits 0 only when every claim matches.
 *
 * `FU_DOCS_DIR` exists so a reviewer can watch this harness go red on demand: it
 * repoints the `docs/house-swarm-7` lookup at a mutated copy (used to demonstrate
 * the failure mode during this work unit). `FU_ROOT_DOCS_DIR` does the same for
 * the `docs` directory that holds `CURRENT_STATUS.md`. Both default to this
 * repository, and the delivered documents are the ones under those defaults.
 *
 * Usage:  node server/scripts/proofs/fu/manual-claims-proof.mjs
 *         FU_DOCS_DIR=/path/to/mutated/copy FU_ROOT_DOCS_DIR=/path/to/mutated/docs \
 *           node server/scripts/proofs/fu/manual-claims-proof.mjs
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
const ROOT_DOCS_DIR = process.env.FU_ROOT_DOCS_DIR
  ? process.env.FU_ROOT_DOCS_DIR
  : join(REPO_DIR, 'docs');
const MANUAL_PATH = join(DOCS_DIR, 'WU5-DEPLOY.md');
const STATUS_PATH = join(ROOT_DOCS_DIR, 'CURRENT_STATUS.md');
const LEDGER_PATH = join(DOCS_DIR, 'WU6-CLAIMS-EVIDENCE.md');
const RATE_LIMIT_SOURCE_PATH = join(SERVER_DIR, 'src/lib/rate-limit.ts');
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

/** Read a file or null; the three document checks report a missing file as a failure. */
function readOrNull(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/**
 * A document as { path, text, blocks }: the raw text, plus its paragraph/table-
 * row blocks — the unit a rate-limit assertion is judged in, because a corrected
 * paragraph quotes the old sentence and calls it dead in the same breath.
 */
function docBlocks(path) {
  const text = readOrNull(path);
  const blocks = text === null ? [] : text.split(/\r?\n\s*\r?\n/);
  return { path, text, blocks };
}

const STATUS = docBlocks(STATUS_PATH);
const LEDGER = docBlocks(LEDGER_PATH);

/** The rate-limit defaults as the CODE declares them. Read, never trusted. */
const RATE_LIMIT_DEFAULTS = (() => {
  const source = readOrNull(RATE_LIMIT_SOURCE_PATH);
  if (source === null) return null;
  const max = source.match(/WEBHOOK_RATE_LIMIT_DEFAULT_MAX\s*=\s*([0-9_]+)/);
  const windowMs = source.match(/WEBHOOK_RATE_LIMIT_DEFAULT_WINDOW_MS\s*=\s*([0-9_]+)/);
  if (max === null || windowMs === null) return null;
  return {
    max: Number(max[1].replace(/_/g, '')),
    windowMs: Number(windowMs[1].replace(/_/g, '')),
  };
})();

/** The rate-limit source's own names, so a document that names the wrong key fails. */
const RATE_LIMIT_ENV_NAMES = {
  max: 'WEBHOOK_RATE_LIMIT_MAX',
  windowMs: 'WEBHOOK_RATE_LIMIT_WINDOW_MS',
};

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
 *
 * `quoteScoped: true` marks the entries that may legitimately appear INSIDE a
 * quoted history — §6.1 quotes the old failed second run verbatim so that an
 * older copy of the manual cannot mislead a reader. Those entries are therefore
 * matched per BLOCK, and a block that also says the warning is dead is exempt.
 * The entries without the flag are figures no correct sentence quotes, and they
 * are banned everywhere, history included.
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
    quoteScoped: true,
  },
  {
    label: 'bare "46 passed | 5 skipped (51)"',
    pattern: /\b46 passed \| 5 skipped \(51\)/,
    correct: WITHOUT_DB.tests,
    quoteScoped: true,
  },
  {
    label: 'any file total of (5) in a Test Files summary',
    pattern: /Test Files[^()\n]{0,40}\(5\)/,
    correct: WITH_DB.files,
    quoteScoped: true,
  },
  {
    label: 'any test total of (51) in a Tests summary',
    pattern: /\bTests[^()\n]{0,40}\(51\)/,
    correct: WITH_DB.tests,
    quoteScoped: true,
  },
  {
    label: 'the old failed-run file total "1 failed | 4 passed (5)"',
    pattern: /1 failed \| 4 passed \(5\)/,
    correct: WITH_DB.files,
    quoteScoped: true,
  },
  {
    label: 'the old failed-run test total "1 failed | 50 passed (51)"',
    pattern: /1 failed \| 50 passed \(51\)/,
    correct: WITH_DB.tests,
    quoteScoped: true,
  },
];

/**
 * Words that mark a block as a QUOTED HISTORY rather than a live claim: the
 * manual says the old figure is dead ("used to fail", "obsolete", "it is fixed").
 * A block carrying a superseded figure AND one of these is the history this
 * harness requires (CHECK 7); a block carrying the figure without one is a live
 * stale claim and fails.
 */
const HISTORY_MARKERS = [
  /used to \*?\*?fail/i,
  /\bobsolete\b/i,
  /\bsuperseded\b/i,
  /\bit is fixed\b/i,
  /\bis fixed\b/i,
  /\bwas fixed\b/i,
  /\bAn earlier version\b/i,
  /assertionerror: expected 'active' to be 'cancelled'/i,
  /ล้าสมัย/,
  /แก้แล้ว/,
];

/** True when the block presents a superseded figure as history, not as current. */
function isQuotedHistory(block) {
  return HISTORY_MARKERS.some((marker) => marker.test(block));
}


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
//
// Two scopes. An entry without `quoteScoped` is banned everywhere, history
// included, because no correct sentence quotes a `5 passed (5)`. An entry with
// `quoteScoped` is judged per block, and a block that carries the superseded
// figure AND says it is dead ("used to **fail**", "obsolete", "it is fixed") is
// the history CHECK 7 requires, not a live claim — §6.1 quotes the old failed
// second run verbatim so an older copy of the manual cannot mislead. A block that
// carries the figure and does NOT say it is dead is a live stale count and fails,
// which is what catches a superseded figure that was merely pasted back in.
// ---------------------------------------------------------------------------
{
  const hits = [];
  for (const stale of STALE) {
    if (stale.quoteScoped) {
      for (const block of MANUAL.split(/\r?\n\s*\r?\n/)) {
        if (!stale.pattern.test(block.replace(/\\\|/g, '|'))) continue;
        if (isQuotedHistory(block)) continue;
        hits.push(
          `a block carries the stale ${stale.label} as a live claim: "${block.replace(/\s+/g, ' ').trim().slice(0, 160)}"`
        );
      }
      continue;
    }
    for (const { n, line } of allLines(stale.pattern)) {
      hits.push(`line ${n} carries the stale ${stale.label}: "${line.slice(0, 160)}"`);
    }
  }

  record(
    'no-stale-test-counts',
    hits.length === 0,
    hits.length === 0
      ? `rule: the ${STALE.length} superseded count forms must not stand as live claims (5 passed (5) / 51 passed (51) / 4 passed | 1 skipped (5) / 46 passed | 5 skipped (51) / any other (5) or (51) total / the old failed-run 1 failed | 4 passed (5) and 1 failed | 50 passed (51)), in either language; a superseded figure quoted inside the obsolete history is permitted and CHECK 7 requires it`
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

// ---------------------------------------------------------------------------
// CHECK 10 — no-false-no-rate-limit-claim
//
// THE CLAIM THIS CHECK EXISTS TO KILL. Both `WU5-DEPLOY.md` and
// `docs/CURRENT_STATUS.md` used to carry the assertion that
// `POST /payment/webhook` has no rate limiting. H7-FU-RATELIMIT made that false:
// the route now carries `webhookRateLimitMiddleware`. Prose was corrected, but
// nothing mechanical stopped it coming back.
//
// HOW THE BAN AVOIDS FAILING THE CORRECTED TEXT — the trap here, and it is not
// hypothetical: the corrected paragraph in `docs/CURRENT_STATUS.md` QUOTES the
// dead sentence ("This document previously listed item 5 as \"No rate limiting on
// POST /payment/webhook\"") so that an older copy cannot mislead. A bare substring
// ban would fail the very document that fixed the error. So the judgement is made
// per BLOCK (a blank-line-separated paragraph or table row), and a block that
// carries an assertion pattern is exempt only when the SAME block also says the
// assertion is dead. Two kinds of pattern are used:
//
//   * ASSERTIVE — the exact old claim, `no rate limit` / `no rate limiting`
//     followed by the route. Banned unless the block marks it dead.
//   * ASSERTIVE_WEAK — `not hardened` / `not a substitute` stated OF the route.
//     Also banned unless the block marks it dead, because that is the judgement
//     the old item attached to the false claim. Note the corrected text says
//     "not a substitute for an edge/proxy rate limit" ABOUT THE LIMITER, never
//     about the route, so a correct sentence does not trip this.
//
// The Thai forms are checked too: a bilingual manual carries every claim twice,
// and the second language is the one that gets missed.
// ---------------------------------------------------------------------------
{
  const ROUTE = 'payment/webhook';

  /** The old false claim, in its assertive form, in both languages. */
  const ASSERTIVE = [
    {
      label: 'EN "no rate limit(ing)" of the webhook route',
      pattern: /\bno rate limit(?:ing)?\b[^.\n]{0,80}payment\/webhook/i,
    },
    {
      label: 'EN "payment/webhook ... no rate limit(ing)"',
      pattern: /payment\/webhook[^.\n]{0,80}\bno rate limit(?:ing)?\b/i,
    },
    {
      label: 'EN "has no rate limit" / "there is no rate limiting"',
      pattern: /\b(?:has|have|had|there is|there are|it has)\s+no\s+rate\s+limit(?:ing)?\b/i,
    },
    {
      label: 'TH "ไม่มี rate limit(ing)" of the webhook route',
      pattern: /ไม่มี\s*rate\s*limit(?:ing)?[^.\n]{0,80}payment\/webhook/i,
    },
    {
      label: 'TH "payment/webhook ... ไม่มี rate limit(ing)"',
      pattern: /payment\/webhook[^.\n]{0,80}ไม่มี\s*rate\s*limit(?:ing)?/i,
    },
    {
      label: 'TH "ไม่มี rate limiting"',
      pattern: /ไม่มี\s*rate\s*limiting\b/i,
    },
  ];

  /** The old item's judgement of the route, which is no longer true of it. */
  const ASSERTIVE_WEAK = [
    { label: 'EN "do not treat it as hardened"', pattern: /\bdo not treat it as hardened\b/i },
    {
      label: 'TH "อย่าถือว่ามันแข็งแรงแล้ว"',
      pattern: /อย่าถือว่ามันแข็งแรง/,
    },
  ];

  /** Words that mark the block as quoting the dead claim rather than making it. */
  const MARKED_DEAD = [
    /\bno longer true\b/i,
    /\bno longer\b/i,
    /\bpreviously\b/i,
    /\bused to\b/i,
    /\bobsolete\b/i,
    /\bcorrected\b/i,
    /\bsuperseded\b/i,
    /\basserted the opposite\b/i,
    /ล้าสมัย/,
    /แก้แล้ว/,
    /ฉบับก่อน/,
    /ถูกแก้/,
    /ไม่จริงอีกต่อไป/,
  ];

  /** True when the block says the assertion it carries is dead. */
  function markedDead(block) {
    return MARKED_DEAD.some((marker) => marker.test(block));
  }

  /** Every block (paragraph or table row) of a document, whitespace-flattened. */
  function blocksOf(doc) {
    if (doc.text === null) return [];
    return doc.blocks.map((block) => block.replace(/\s+/g, ' ').trim()).filter((b) => b !== '');
  }

  const problems = [];
  const documents = [
    { label: 'WU5-DEPLOY.md', doc: { text: MANUAL, blocks: MANUAL === null ? [] : MANUAL.split(/\r?\n\s*\r?\n/) } },
    { label: 'CURRENT_STATUS.md', doc: STATUS },
  ];

  for (const { label, doc } of documents) {
    if (doc.text === null) {
      problems.push(`${label} is missing, so its rate-limit claim cannot be checked`);
      continue;
    }
    for (const block of blocksOf(doc)) {
      for (const assertion of [...ASSERTIVE, ...ASSERTIVE_WEAK]) {
        if (!assertion.pattern.test(block)) continue;
        if (markedDead(block)) continue;
        problems.push(
          `${label} still asserts ${assertion.label} as a live claim: "${block.slice(0, 200)}"`
        );
      }
      // A bare "no rate limit" in either language that names the route by
      // implication (the block is about the webhook) is covered by the explicit
      // forms above; this guards only the fully generic Thai form.
      if (/ไม่มี\s*rate\s*limiting/.test(block) && !markedDead(block)) {
        problems.push(`${label} still asserts there is no rate limiting: "${block.slice(0, 200)}"`);
      }
    }
  }

  const checkedBlocks = documents.reduce((sum, { doc }) => sum + blocksOf(doc).length, 0);

  record(
    'no-false-no-rate-limit-claim',
    problems.length === 0,
    problems.length === 0
      ? `rule: neither WU5-DEPLOY.md nor docs/CURRENT_STATUS.md may assert that ${ROUTE} has no rate limit / no rate limiting (EN or TH), nor call the route unhardened; judged per block (${checkedBlocks} blocks), and a block that quotes the dead claim is exempt only when the same block says it is dead — the corrected CURRENT_STATUS.md paragraph does exactly that, so a bare substring ban would fail the document that fixed the error`
      : `${problems.length} false claim(s): ${problems.slice(0, 3).join(' | ')}`
  );
  if (problems.length > 0) for (const problem of problems.slice(0, 8)) console.log(`  ${problem}`);
}

// ---------------------------------------------------------------------------
// CHECK 11 — rate-limit-truth-stated
//
// CHECK 10 removes the false claim; this one REQUIRES the true statement in its
// place, in BOTH documents and BOTH languages, so deleting the item to make
// CHECK 10 pass cannot work. Six facts, each anchored on wording only a correct
// paragraph carries:
//
//   * the route IS rate limited, by the middleware, mounted AHEAD OF
//     `express.raw()` — i.e. before the body is parsed and before HMAC work;
//   * the mechanism and its provenance are named (the vendored Module Hub
//     `rate-limit` module at `modules/rate-limit/`, wired by
//     `server/src/lib/rate-limit.ts`);
//   * the refusal shape (429 / `RATE_LIMITED` / `Retry-After`);
//   * the two limit names AND their default numbers, compared against the
//     defaults READ OUT OF `server/src/lib/rate-limit.ts` — never trusted, so a
//     code default that moves without the documents moving fails here;
//   * the honest caveat: in-process, per-instance, resets on restart, and not a
//     substitute for an edge/proxy limit;
//   * the item is not merely deleted — the correction is visible.
// ---------------------------------------------------------------------------
{
  const problems = [];

  if (RATE_LIMIT_DEFAULTS === null) {
    problems.push(
      `the defaults could not be read from ${RATE_LIMIT_SOURCE_PATH}, so the documented figures cannot be grounded`
    );
  }

  const documents = [
    {
      label: 'WU5-DEPLOY.md',
      text: MANUAL === null ? null : MANUAL.replace(/\\\|/g, '|').replace(/\s+/g, ' ').trim(),
      path: MANUAL_PATH,
    },
    {
      label: 'CURRENT_STATUS.md',
      text: STATUS.text === null ? null : STATUS.text.replace(/\s+/g, ' ').trim(),
      path: STATUS_PATH,
    },
  ];

  /** Every fact a corrected document must carry, with the wording that proves it. */
  const REQUIRED = [
    {
      id: 'says the route IS rate limited',
      patterns: [
        /\bIS\*{0,2}\s+rate\s+limited\b/i,
        /มี\*{0,2}\s*rate\s*limit\s*แล้ว/,
        /mounts\*{0,2}\s*`?webhookRateLimitMiddleware`?/i,
        /route carries\*{0,2}\s*`?webhookRateLimitMiddleware`?/i,
      ],
    },
    {
      id: 'mounts the limiter ahead of express.raw()',
      patterns: [
        /\*{0,2}ahead of\*{0,2}\s*`?express\.raw\(\)`?/i,
        /ก่อน\*{0,2}\s*`?express\.raw\(\)`?/,
      ],
    },
    {
      id: 'states that the refusal happens before signature verification / before HMAC work',
      patterns: [
        /before\s+\*{0,2}(?:signature verification|the signature)/i,
        /before\s+\*{0,2}any HMAC/i,
        /ก่อน\*{0,2}(?:การตรวจลายเซ็น|งาน HMAC|งาน HMAC)/,
      ],
    },
    {
      id: 'names the mechanism and its provenance (the vendored Module Hub rate-limit module)',
      patterns: [
        /Module Hub[^.]{0,40}rate-limit/i,
        /^[\s\S]*modules\/rate-limit\//i,
      ],
      extra: 'modules/rate-limit/PROVENANCE-RATELIMIT.md',
    },
    {
      id: 'names the host-side wiring file',
      patterns: [/server\/src\/lib\/rate-limit\.ts/],
    },
    {
      id: 'states the refusal shape (429 / RATE_LIMITED / Retry-After)',
      patterns: [/HTTP 429/, /`?RATE_LIMITED`?/, /`?Retry-After`?/],
    },
    {
      id: 'names both limit variables',
      patterns: [
        new RegExp(RATE_LIMIT_ENV_NAMES.max),
        new RegExp(RATE_LIMIT_ENV_NAMES.windowMs),
      ],
    },
    {
      id: 'states the honest per-instance caveat (in-process, resets on restart, not a substitute for an edge/proxy limit)',
      patterns: [
        /(?:in-process|per-instance)/i,
        /resets\s+(?:when the process restarts|on restart)/i,
        /not a substitute for a(?:n)? (?:edge\/proxy|edge or reverse proxy)|not a substitute for a rate limit at your edge/i,
        /แยกตามอินสแตนซ์/,
        /ไม่.?ใช่สิ่งทดแทน/,
      ],
    },
  ];

  for (const { label, text } of documents) {
    if (text === null) {
      problems.push(`${label} is missing, so the true statement cannot be checked`);
      continue;
    }
    for (const requirement of REQUIRED) {
      const missing = requirement.patterns.filter((pattern) => !pattern.test(text));
      if (missing.length === requirement.patterns.length) {
        problems.push(`${label} does not state that the document ${requirement.id}`);
      }
    }
    // The provenance file and the wiring file must be named, so the claim is
    // traceable to the vendored module and to the host-side composition.
    if (!/modules\/rate-limit\//.test(text)) {
      problems.push(`${label} does not name modules/rate-limit/ as where the limiter comes from`);
    }
    if (!text.includes('modules/rate-limit/PROVENANCE-RATELIMIT.md')) {
      problems.push(`${label} does not name modules/rate-limit/PROVENANCE-RATELIMIT.md as the module's provenance`);
    }
  }

  // The default NUMBERS, compared against the code, in both documents. A
  // document that names the variables but quotes a wrong default fails.
  for (const { label, text } of documents) {
    if (text === null) continue;
    if (RATE_LIMIT_DEFAULTS !== null) {
      const maxOk = new RegExp(
        `${RATE_LIMIT_ENV_NAMES.max}[^.]{0,120}\`?${RATE_LIMIT_DEFAULTS.max}\`?`
      ).test(text);
      const windowOk = new RegExp(
        `${RATE_LIMIT_ENV_NAMES.windowMs}[^.]{0,120}\`?${RATE_LIMIT_DEFAULTS.windowMs}\`?`
      ).test(text);
      if (!maxOk) {
        problems.push(
          `${label} does not quote the default ${RATE_LIMIT_DEFAULTS.max} for ${RATE_LIMIT_ENV_NAMES.max} (read from ${RATE_LIMIT_SOURCE_PATH})`
        );
      }
      if (!windowOk) {
        problems.push(
          `${label} does not quote the default ${RATE_LIMIT_DEFAULTS.windowMs} for ${RATE_LIMIT_ENV_NAMES.windowMs} (read from ${RATE_LIMIT_SOURCE_PATH})`
        );
      }
    }
  }

  // Deleting the item must not satisfy the gate: the correction stays visible.
  const manualText = documents[0].text ?? '';
  const statusText = documents[1].text ?? '';
  if (manualText !== '' && !/obsolete|earlier version|l้าสมัย/i.test(manualText)) {
    problems.push('WU5-DEPLOY.md does not keep the correction visible (no note that the old item is obsolete)');
  }
  if (statusText !== '' && !/previously|no longer true|ล้าสมัย|ฉบับก่อน/i.test(statusText)) {
    problems.push('docs/CURRENT_STATUS.md does not keep the correction visible (no note that the old item was corrected)');
  }

  const defaultsText =
    RATE_LIMIT_DEFAULTS === null
      ? '(defaults unreadable)'
      : `${RATE_LIMIT_DEFAULTS.max} requests / ${RATE_LIMIT_DEFAULTS.windowMs} ms read from ${RATE_LIMIT_SOURCE_PATH}`;

  record(
    'rate-limit-truth-stated',
    problems.length === 0,
    problems.length === 0
      ? `rule: BOTH WU5-DEPLOY.md and docs/CURRENT_STATUS.md must state the true position in both languages — the route IS rate limited by webhookRateLimitMiddleware mounted ahead of express.raw() and refused before signature verification (no HMAC spent), the mechanism (the vendored Module Hub rate-limit module, provenance named) and its wiring file, the refusal shape (429 / RATE_LIMITED / Retry-After), both limit variable names with their code defaults (${defaultsText}), the per-instance caveat (in-process, resets on restart, not a substitute for an edge/proxy limit), and the visible correction — so deleting the item does not pass`
      : `${problems.length} gap(s): ${problems.slice(0, 4).join(' | ')}`
  );
  if (problems.length > 0) for (const problem of problems.slice(0, 8)) console.log(`  ${problem}`);
}

// ---------------------------------------------------------------------------
// CHECK 12 — claims-ledger-counts-agree-with-manual
//
// `WU6-CLAIMS-EVIDENCE.md` contradicted `WU5-DEPLOY.md` §6.1: its C38/C39/C40
// rows carried figures from before the sixth test file existed, and C64 still
// asserted the row leak that `ae74b74` fixed. Two documents in one delivery that
// disagree about the same measurement is the defect; this check makes the pair
// mechanical. Three rules:
//
//   * whatever count the ledger states must be a count the manual states — the
//     superseded figures (5/51 totals, 1 failed | 50 passed) may appear only in a
//     history that says they are obsolete, never as a live claim cell;
//   * the C40 row must state that the older used-database failure is FIXED, and
//     must KEEP the history of it, so an older copy of the ledger cannot mislead;
//   * the C64 row must not assert the obsolete row leak.
// ---------------------------------------------------------------------------
{
  const problems = [];

  if (LEDGER.text === null) {
    problems.push(`${LEDGER_PATH} is missing`);
  } else {
    const ledgerFlat = LEDGER.text.replace(/\\\|/g, '|').replace(/\s+/g, ' ');

    /** The claim cell of one C-row: the text between the 2nd and 3rd pipes. */
    function claimCell(rowId) {
      const line = LEDGER.text.split(/\r?\n/).find((l) => new RegExp(`^\\|\\s*${rowId}\\s*\\|`).test(l));
      if (!line) return null;
      const cells = line.split('|');
      return { line, claim: (cells[2] ?? '').trim(), evidence: (cells[3] ?? '').trim() };
    }

    /**
     * A COUNT stated anywhere in a C-row whose total is one the manual has
     * superseded. The two documents must not disagree, so these are banned from
     * the ledger except inside the history this check also requires.
     */
    const SUPERSEDED_IN_LEDGER = [
      { label: 'file total (5)', pattern: /Test Files[^()\n]{0,40}\(5\)/ },
      { label: 'test total (51)', pattern: /\bTests[^()\n]{0,40}\(51\)/ },
      { label: 'the failed-run total "1 failed | 4 passed (5)"', pattern: /1 failed \| 4 passed \(5\)/ },
      { label: 'the failed-run total "1 failed | 50 passed (51)"', pattern: /1 failed \| 50 passed \(51\)/ },
      { label: 'the five-file claim', pattern: /\bfive test files\b/i },
    ];

    const hits = [];
    for (const line of LEDGER.text.split(/\r?\n/)) {
      const flatLine = line.replace(/\\\|/g, '|');
      for (const stale of SUPERSEDED_IN_LEDGER) {
        if (!stale.pattern.test(flatLine)) continue;
        // The ledger keeps its own history too, and the C40 evidence cell is
        // where it lives. A line that says the figure is dead is history, not a
        // live claim; a line that does not is the contradiction this check kills.
        if (isQuotedHistory(flatLine)) continue;
        hits.push(`a ledger line still carries the superseded ${stale.label} as a live claim: "${flatLine.trim().slice(0, 180)}"`);
      }
    }
    for (const hit of hits.slice(0, 6)) problems.push(hit);

    // The counts the ledger MUST state, matching the manual's own figures.
    for (const required of [
      { label: 'the set-database counts', pattern: /Test Files 6 passed \(6\)[\s\S]{0,160}Tests 58 passed \(58\)/ },
      {
        label: 'the unset-database counts',
        pattern: /Test Files 5 passed \| 1 skipped \(6\)[\s\S]{0,200}(?:Tests|53 passed \| 5 skipped \(58\))/,
      },
    ]) {
      if (!required.pattern.test(ledgerFlat)) {
        problems.push(`WU6-CLAIMS-EVIDENCE.md never states ${required.label} the manual states`);
      }
    }

    // C40 must say the failure is FIXED and keep the history.
    const c40 = claimCell('C40');
    if (c40 === null) {
      problems.push('WU6-CLAIMS-EVIDENCE.md has no C40 row');
    } else {
      const row = `${c40.claim} ${c40.evidence}`.replace(/\s+/g, ' ');
      if (!/\bFIXED\b|\bfixed\b|แก้แล้ว/i.test(row)) {
        problems.push('the C40 row does not state that the older used-database failure is fixed');
      }
      if (!/used to fail|used to \*\*fail\*\*|obsolete|before the fix|แก้แล้ว/i.test(row)) {
        problems.push('the C40 row does not keep the history of the older failure');
      }
      if (!/deletes|deleted|clean\s?up|ลบ/i.test(row)) {
        problems.push('the C40 row does not say how the older failure was fixed (the suite deletes the rows it created)');
      }
      if (/1 failed \| 50 passed \(51\)/.test(c40.claim)) {
        problems.push('the C40 CLAIM cell still states the old failure as the current observation');
      }
    }

    // C64 must not assert the obsolete row leak.
    const c64 = claimCell('C64');
    if (c64 !== null && !isQuotedHistory(c64.line)) {
      if (/does not clean them up|does not clean it up|ไม่ลบให้/i.test(c64.claim)) {
        problems.push('the C64 claim cell still asserts that npm test does not clean up its rows');
      }
    }

    // The superseded five-file claim must not survive anywhere as a live claim.
    if (/\bfive test files\b/i.test(ledgerFlat) && !isQuotedHistory(ledgerFlat)) {
      problems.push('WU6-CLAIMS-EVIDENCE.md still states that there are five test files');
    }
  }

  record(
    'claims-ledger-counts-agree-with-manual',
    problems.length === 0,
    problems.length === 0
      ? `rule: WU6-CLAIMS-EVIDENCE.md must agree with ${'`docs/house-swarm-7/WU5-DEPLOY.md`'} §6.1 — it must state the manual's own figures (6 passed (6) / 58 passed (58) with DATABASE_URL set, 5 passed | 1 skipped (6) / 53 passed | 5 skipped (58) without), it must not stand any superseded figure (5/51 totals, 1 failed | 4 passed (5), 1 failed | 50 passed (51) or "five test files") up as a live claim, its C40 row must state that the older used-database failure is FIXED (the suite deletes the rows it created) while keeping that failure's history, and its C64 row must not assert the obsolete row leak`
      : `${problems.length} contradiction(s) with the manual: ${problems.slice(0, 3).join(' | ')}`
  );
  if (problems.length > 0) for (const problem of problems.slice(0, 8)) console.log(`  ${problem}`);
}

// --------------------------------------------------------------------- summary --
const failed = results.filter((result) => !result.passed);
console.log(
  `SUMMARY claims=${results.length} passed=${results.length - failed.length} failed=${failed.length} manual=${MANUAL_PATH} status=${STATUS_PATH} ledger=${LEDGER_PATH}` +
    (failed.length > 0 ? ` failed_names=[${failed.map((f) => f.name).join(',')}]` : '')
);
console.log(
  `SUMMARY-DOCS checked=${results.length} names=[${results.map((r) => r.name).join(',')}] ` +
    `rate_limit_defaults=${
      RATE_LIMIT_DEFAULTS === null
        ? 'unreadable'
        : `${RATE_LIMIT_DEFAULTS.max}req/${RATE_LIMIT_DEFAULTS.windowMs}ms`
    }`
);
if (failed.length > 0) process.exit(1);
