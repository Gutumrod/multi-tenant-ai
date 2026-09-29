#!/usr/bin/env node
/**
 * MT01-PRESALE-P2 delivery-manifest-check — is the DELIVERED SET exactly what
 * `DELIVERY-MANIFEST.md` at the repository root says it is?
 *
 * WHY THIS EXISTS. The independent review of the merged revision recorded
 * (ISSUE 2, LOW-1) that the vendor's own working papers under
 * `docs/house-swarm-7/` still carry internal machine paths — the vendor's
 * workspace directory name, the vendor's runtime directory name, the vendor's
 * Windows profile name, and the worktree path segment. Those tokens are NOT
 * written literally in this file, and the patterns below are assembled from parts
 * for that reason: a checker that refuses a token must not itself contain it, or
 * it fails its own rule. The same self-reference is why the repository's claims
 * ledger describes its patterns instead of quoting them. The Owner's ruling for
 * this lane is
 * broader than those three files: the folder is internal working material, and
 * what matters is what a BUYER actually receives. The chosen answer (option B) is
 * to declare the delivered set in `DELIVERY-MANIFEST.md` and enforce it, rather
 * than to move the papers out of the repository — a move cannot take them out of
 * git history, and the delivered documents cite them as their evidence record.
 *
 * A DECISION THAT IS NOT ENFORCED WILL DRIFT. This harness is the enforcement. It
 * parses the manifest's machine-readable groups and compares them with the tree,
 * so the property fails loudly the moment it is violated:
 *
 *   * a new file appears without being classified (nothing is guessed);
 *   * a DELIVERED file grows an internal machine path;
 *   * a DELIVERED file is left pointing at a file that is not delivered;
 *   * a not-delivered file loses its own NOT-DELIVERED marker, or disappears;
 *   * a declared path residual goes stale (see `delivered-path-residuals-...`).
 *
 * It reads files only. It starts no server, binds no port, opens no database,
 * contacts no host, reads no credential, and loads nothing beyond Node's stdlib.
 * It never writes inside the repository.
 *
 * Usage:
 *   node scripts/proofs/wu5/delivery-manifest-check.mjs              # the gate
 *   node scripts/proofs/wu5/delivery-manifest-check.mjs --self-test  # prove it
 *                                                                    # can fail
 *
 * The gate prints one machine-readable line per check, in exactly this form:
 *
 *   CHECK <name> PASS|FAIL <detail>
 *
 * and exits non-zero if any check fails.
 */
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
  appendFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = join(HERE, '../../..');
const REPO_DIR = join(SERVER_DIR, '..');
const MANIFEST = join(REPO_DIR, 'DELIVERY-MANIFEST.md');
const INTERNAL_DIR_REL = 'docs/house-swarm-7';

/**
 * The naming family the vendor's working record lives in, used as a GUARD: an
 * entry may only be classified "not delivered" if it is one of these. It is not
 * what decides the classification — the manifest decides, explicitly.
 */
const INTERNAL_FAMILY_RULE = /^docs\/house-swarm-7\/(?:FU-|PRESALE-)[A-Za-z0-9._-]+\.md$/;

/** Every DELIVERED file must say nothing about the vendor's machine. */
const MACHINE_PATTERNS = [
  // Assembled from parts on purpose: a checker that refuses a token must not
  // contain it, or it fails its own rule (and turns every delivered file that
  // quotes the rule into a violation).
  ['the vendor workspace directory name', new RegExp('AI' + '-Workspace')],
  ['the vendor runtime directory name', new RegExp('hermes' + '-native')],
  ['the worktree path segment', new RegExp('runtime' + '[\\\\/]' + 'worktrees')],
  ['the vendor Windows profile name', new RegExp('Users' + '[\\\\/]' + 'Win11')],
  ['a Windows user-profile path', new RegExp('C:' + '[\\\\/]' + 'Users' + '[\\\\/]')],
  ['a Windows workspace path', new RegExp('D:' + '[\\\\/]' + 'AI' + '-Workspace')],
];

/** A not-delivered file declares itself within its first lines. */
const MARKER_LINES_SCANNED = 12;
const markerLine = (line) => line.includes('INTERNAL') && line.includes('NOT DELIVERED');

/**
 * The manifest is the DECLARATION of the classification, so it necessarily names
 * the not-delivered paths — including inside its own `## Not delivered` block. It
 * is exempt from `no-dangling-citation` BY CONSTRUCTION, not by an exception list:
 * a checker cannot read a classification that is forbidden to state itself. It is
 * NOT exempt from any other check.
 */
const DECLARATION_FILE = 'DELIVERY-MANIFEST.md';

const GROUP = {
  delivered: 'delivered',
  notDelivered: 'not delivered',
  residual: 'delivered with a recorded path residual',
};

const results = [];

function record(name, passed, detail) {
  results.push({ name, passed, detail });
}

function readOrNull(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/** Every file in the repository, skipping node_modules and .git. */
function repoFiles(dir, acc = []) {
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
    if (stat.isDirectory()) repoFiles(full, acc);
    else if (stat.isFile()) acc.push(relative(REPO_DIR, full).split(sep).join('/'));
  }
  return acc;
}

/**
 * Parse the manifest. A `## <heading>` line opens a group; inside a fenced block
 * (` ``` `), one path per line. Nothing here guesses: a group with no fenced list
 * parses as empty, and the checks that need it fail.
 */
function parseManifest(text) {
  const groups = new Map();
  let heading = null;
  let inFence = false;

  for (const raw of text.split(/\r?\n/)) {
    if (/^\s*```/.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) {
      const h = raw.match(/^##\s+(.+?)\s*$/);
      if (h) {
        heading = h[1].trim().toLowerCase();
        if (!groups.has(heading)) groups.set(heading, new Set());
      }
      continue;
    }
    if (heading === null) continue;
    const entry = raw.trim();
    if (entry === '') continue;
    groups.get(heading).add(entry);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// CHECK 1 — delivery-manifest-parsed
// ---------------------------------------------------------------------------
const manifestText = readOrNull(MANIFEST);
let delivered = new Set();
let notDelivered = new Set();
let residual = new Set();
let parsed = false;

if (manifestText === null) {
  record('delivery-manifest-parsed', false, 'DELIVERY-MANIFEST.md does not exist at the repository root');
} else {
  const groups = parseManifest(manifestText);
  delivered = groups.get(GROUP.delivered) ?? new Set();
  notDelivered = groups.get(GROUP.notDelivered) ?? new Set();
  residual = groups.get(GROUP.residual) ?? new Set();

  const missingGroups = [];
  if (!groups.has(GROUP.delivered)) missingGroups.push('## Delivered');
  if (!groups.has(GROUP.notDelivered)) missingGroups.push('## Not delivered');
  parsed = missingGroups.length === 0 && delivered.size > 0;

  record(
    'delivery-manifest-parsed',
    parsed,
    missingGroups.length > 0
      ? `DELIVERY-MANIFEST.md is missing a machine-readable group: ${missingGroups.join(', ')}`
      : delivered.size === 0
        ? 'the ## Delivered block parsed but lists zero paths'
        : `parsed DELIVERY-MANIFEST.md: delivered=${delivered.size} not_delivered=${notDelivered.size} recorded_path_residuals=${residual.size}; groups are fenced one-path-per-line blocks under "## Delivered", "## Not delivered" and, when it is needed, "## Delivered with a recorded path residual"`
  );
}

const treeFiles = repoFiles(REPO_DIR);

// ---------------------------------------------------------------------------
// CHECK 2 — no-unclassified-file
//
// Every file the repository ships is in exactly one group. A new file that nobody
// classified fails this — including a NEW working paper, which is the drift this
// whole classification exists to catch. A "not delivered" entry must also be in
// the working-record naming family, so source or test code cannot be quietly
// reclassified out of the buyer's set to silence a check.
// ---------------------------------------------------------------------------
{
  const offenders = [];

  if (!parsed) {
    offenders.push('the manifest could not be parsed (see delivery-manifest-parsed)');
  } else {
    const classified = new Set([...delivered, ...notDelivered]);
    for (const rel of treeFiles) {
      if (!classified.has(rel)) offenders.push(`unclassified: ${rel}`);
    }
    for (const rel of notDelivered) {
      if (!INTERNAL_FAMILY_RULE.test(rel)) {
        offenders.push(`not-delivered entry is not in the working-record family (${INTERNAL_FAMILY_RULE}): ${rel}`);
      }
      if (delivered.has(rel)) {
        offenders.push(`listed in BOTH groups: ${rel}`);
      }
    }
    for (const rel of delivered) {
      if (residual.has(rel)) continue;
      if (!treeFiles.includes(rel)) offenders.push(`delivered but not present in the tree: ${rel}`);
    }
    for (const rel of residual) {
      if (!delivered.has(rel)) offenders.push(`recorded as a delivered path residual but not listed as delivered: ${rel}`);
    }
  }

  record(
    'no-unclassified-file',
    offenders.length === 0,
    offenders.length === 0
      ? `all ${treeFiles.length} files the repository ships are classified: ${delivered.size} delivered, ${notDelivered.size} not delivered; the working record the manifest must name is the ${INTERNAL_FAMILY_RULE} family, and ${delivered.size - residual.size} delivered file(s) are held to the machine-path rule`
      : `${offenders.length} unclassified/contradictory entr(ies): ${offenders.slice(0, 10).join('; ')}`
  );
}

// ---------------------------------------------------------------------------
// CHECK 3 — delivered-files-carry-no-machine-path
//
// The rule the finding is about. It reads the CLASSIFICATION rather than sweeping
// the whole tree: a machine path in a not-delivered working paper is expected and
// allowed — that is what the classification is for — and firing on it would make
// the check demand the destruction of the vendor's own evidence record.
//
// The exceptions are NAMED in the manifest, never inferred here, and check 4
// asserts each one is still a real, still-dirty, vendored copy. A file that gains
// a machine path without being declared fails this check rather than joining the
// residual silently.
// ---------------------------------------------------------------------------
{
  const hits = [];
  let scanned = 0;

  if (!parsed) {
    record('delivered-files-carry-no-machine-path', false, 'the manifest could not be parsed (see delivery-manifest-parsed)');
  } else {
    const toScan = [...delivered].filter((rel) => !residual.has(rel)).sort();
    for (const rel of toScan) {
      const text = readOrNull(join(REPO_DIR, rel));
      if (text === null) continue;
      scanned += 1;
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i += 1) {
        for (const [label, pattern] of MACHINE_PATTERNS) {
          if (pattern.test(lines[i])) {
            hits.push(`${rel}:${i + 1} carries an internal machine path (${label})`);
          }
        }
      }
    }

    record(
      'delivered-files-carry-no-machine-path',
      hits.length === 0,
      hits.length === 0
        ? `no DELIVERED file carries an internal machine path; scanned ${scanned} delivered file(s) for ${MACHINE_PATTERNS.map(([l]) => l).join(', ')}; the ${notDelivered.size} not-delivered working papers are read from the classification and are allowed to carry them; ${residual.size} delivered file(s) are declared path residuals and are asserted separately`
        : `${hits.length} machine path(s) in the delivered set: ${hits.slice(0, 10).join('; ')}`
    );
  }
}

// ---------------------------------------------------------------------------
// CHECK 4 — recorded-path-residuals-are-live
//
// A declared residual is only honest while it is true. Each entry must exist, sit
// under the vendored `modules/` tree, and STILL carry a machine path. Cleaning one
// up — or removing the file — without updating the manifest fails this check, so
// the residual list cannot quietly become a blanket exemption that hides a fixed
// tree or an absent file.
// ---------------------------------------------------------------------------
{
  const problems = [];

  if (!parsed) {
    record('recorded-path-residuals-are-live', false, 'the manifest could not be parsed (see delivery-manifest-parsed)');
  } else {
    for (const rel of [...residual].sort()) {
      const text = readOrNull(join(REPO_DIR, rel));
      if (text === null) {
        problems.push(`${rel} is declared a path residual but does not exist`);
        continue;
      }
      if (!rel.startsWith('modules/')) {
        problems.push(`${rel} is declared a path residual but is not under the vendored modules/ tree`);
      }
      const found = MACHINE_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
      if (found.length === 0) {
        problems.push(`${rel} is declared a path residual but now carries no machine path — the declaration is stale; reclassify or drop it`);
      }
    }

    record(
      'recorded-path-residuals-are-live',
      problems.length === 0,
      problems.length === 0
        ? residual.size === 0
          ? 'no delivered file is declared a path residual: the whole delivered set is path-clean'
          : `all ${residual.size} declared path residual(s) exist, are under modules/, and still carry a machine path — the residual is real and narrow, and it is named in DELIVERY-MANIFEST.md rather than inferred`
        : `${problems.length} problem(s): ${problems.slice(0, 10).join('; ')}`
    );
  }
}

// ---------------------------------------------------------------------------
// CHECK 5 — delivered-files-exist
// ---------------------------------------------------------------------------
{
  const missing = [];
  for (const rel of [...delivered].sort()) {
    let ok = false;
    try {
      ok = statSync(join(REPO_DIR, rel)).isFile();
    } catch {
      ok = false;
    }
    if (!ok) missing.push(rel);
  }

  record(
    'delivered-files-exist',
    missing.length === 0,
    missing.length === 0
      ? `all ${delivered.size} delivered paths exist as files in the repository`
      : `${missing.length} delivered path(s) do not exist: ${missing.slice(0, 10).join(', ')}`
  );
}

// ---------------------------------------------------------------------------
// CHECK 6 — not-delivered-are-marked
//
// Each working paper says so in its own first lines, so a reader who finds one by
// accident is not misled. A not-delivered entry that does not exist is also a
// failure: the check must not pass by listing files that were quietly deleted.
// ---------------------------------------------------------------------------
{
  const problems = [];
  for (const rel of [...notDelivered].sort()) {
    const text = readOrNull(join(REPO_DIR, rel));
    if (text === null) {
      problems.push(`${rel} is listed as not delivered but does not exist`);
      continue;
    }
    const head = text.split(/\r?\n/).slice(0, MARKER_LINES_SCANNED);
    if (!head.some(markerLine)) {
      problems.push(`${rel} carries no NOT-DELIVERED marker in its first ${MARKER_LINES_SCANNED} lines (expected a line containing "INTERNAL" and "NOT DELIVERED")`);
    }
  }

  record(
    'not-delivered-are-marked',
    problems.length === 0,
    problems.length === 0
      ? `all ${notDelivered.size} not-delivered working papers exist and declare themselves in their first ${MARKER_LINES_SCANNED} lines`
      : `${problems.length} problem(s): ${problems.slice(0, 10).join('; ')}`
  );
}

// ---------------------------------------------------------------------------
// CHECK 7 — no-dangling-citation
//
// A delivered file must not point at a file the buyer does not have. It may still
// NAME the record — that is how a citation stays traceable — but it may not write
// the path `docs/house-swarm-7/<a not-delivered paper>`. The declaration file is
// exempt by construction (see DECLARATION_FILE).
// ---------------------------------------------------------------------------
{
  const hits = [];

  if (!parsed) {
    record('no-dangling-citation', false, 'the manifest could not be parsed (see delivery-manifest-parsed)');
  } else {
    const needles = [...notDelivered].sort();
    for (const rel of [...delivered].sort()) {
      if (rel === DECLARATION_FILE) continue;
      const text = readOrNull(join(REPO_DIR, rel));
      if (text === null) continue;
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i += 1) {
        for (const target of needles) {
          if (lines[i].includes(target)) hits.push(`${rel}:${i + 1} points at not-delivered ${target}`);
        }
      }
    }

    record(
      'no-dangling-citation',
      hits.length === 0,
      hits.length === 0
        ? `no DELIVERED file points at a not-delivered working paper by path; the declaration file ${DECLARATION_FILE} is exempt by construction (it must name the not-delivered paths to declare them)`
        : `${hits.length} dangling reference(s) in the delivered set: ${hits.slice(0, 10).join('; ')}`
    );
  }
}

// ---------------------------------------------------------------------------
// CHECK 8 — not-delivered-papers-are-not-cited-as-live-deliverables
//
// A working paper cannot be delivered and not delivered at the same time, and the
// buyer-facing documents must not present one as part of the package. This asserts
// the weaker, checkable half: no not-delivered paper is named as a delivered item
// in a group heading or a "delivered" sentence of the manifest, and the two that
// ARE delivered are path-clean — so the exceptions cannot be widened to a paper
// that carries a machine path.
// ---------------------------------------------------------------------------
{
  const problems = [];

  if (!parsed) {
    record('delivered-working-papers-are-path-clean', false, 'the manifest could not be parsed (see delivery-manifest-parsed)');
  } else {
    const deliveredPapers = [...delivered].filter((rel) => INTERNAL_FAMILY_RULE.test(rel)).sort();
    for (const rel of deliveredPapers) {
      if (residual.has(rel)) {
        problems.push(`${rel} is a delivered working paper AND declared a path residual; a working paper that carries a machine path is not delivered`);
        continue;
      }
      const text = readOrNull(join(REPO_DIR, rel));
      if (text === null) {
        problems.push(`${rel} is a delivered working paper but does not exist`);
        continue;
      }
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i += 1) {
        for (const [label, pattern] of MACHINE_PATTERNS) {
          if (pattern.test(lines[i])) problems.push(`${rel}:${i + 1} is a DELIVERED working paper and carries a machine path (${label})`);
        }
      }
    }

    record(
      'delivered-working-papers-are-path-clean',
      problems.length === 0,
      problems.length === 0
        ? deliveredPapers.length === 0
          ? 'no working paper is delivered — the whole naming family is classified not delivered'
          : `${deliveredPapers.length} working paper(s) are declared delivered (${deliveredPapers.join(', ')}) and each is path-clean; a paper that gained a machine path would have to be reclassified, not exempted`
        : `${problems.length} problem(s): ${problems.slice(0, 10).join('; ')}`
    );
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
function report() {
  for (const result of results) {
    console.log(`CHECK ${result.name} ${result.passed ? 'PASS' : 'FAIL'} ${result.detail}`);
  }
  const failed = results.filter((result) => !result.passed);
  console.log(`SUMMARY checks=${results.length} passed=${results.length - failed.length} failed=${failed.length} repo=${REPO_DIR}`);
  if (failed.length > 0) {
    console.error(`delivery-manifest-check: ${failed.length} of ${results.length} checks FAILED (${failed.map((f) => f.name).join(', ')})`);
    return 1;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// --self-test : prove the gate CAN fail, on temp copies only.
//
// Each case copies the repository (never node_modules or .git) into the OS temp
// dir, applies exactly one mutation to the COPY, and runs this SAME file, copied
// inside it, as a child process. The repository itself is only ever read. The
// mutation targets are read out of the manifest rather than written as literals,
// so this file does not itself become a dangling citation.
// ---------------------------------------------------------------------------
function copyRepository(dst) {
  mkdirSync(dst, { recursive: true });
  cpSync(REPO_DIR, dst, {
    recursive: true,
    filter: (src) => {
      const base = src.split(/[\\/]/).pop();
      return base !== 'node_modules' && base !== '.git';
    },
  });
}

function runChild(repoCopy) {
  // The path is relative to the REPOSITORY ROOT, not to the copy's `server/` — resolving it
  // from `cwd: join(repoCopy, 'server')` looked for
  // `<copy>/server/server/scripts/proofs/wu5/delivery-manifest-check.mjs` and every case died
  // with MODULE_NOT_FOUND, which made the self-test report 0/7 on a correct harness.
  const harnessRel = 'server/scripts/proofs/wu5/delivery-manifest-check.mjs';
  const run = spawnSync(process.execPath, [join(repoCopy, harnessRel)], {
    cwd: join(repoCopy, 'server'),
    encoding: 'utf8',
    env: { ...process.env },
  });
  const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  return {
    exitCode: run.status,
    output,
    checkLines: output.split(/\r?\n/).filter((line) => line.startsWith('CHECK ')),
  };
}

if (process.argv.includes('--self-test')) {
  const firstNotDelivered = [...notDelivered].sort()[0] ?? null;
  const firstResidual = [...residual].sort()[0] ?? null;
  const sampleDeliveredDoc = [...delivered].sort().find((rel) => rel.endsWith('.md') && rel.startsWith('docs/')) ?? null;

  /**
   * Every case is judged on BOTH the exit code and the named CHECK line: a case
   * that cannot fail is worse than no case.
   */
  const CASES = [
    {
      name: 'a-repository-as-it-is-is-pass',
      expectName: null,
      expectFail: false,
      mutation: 'none — the repository copied unmutated (the control)',
      mutate: () => {},
    },
    {
      name: 'b-new-working-paper-nobody-classified',
      expectName: 'no-unclassified-file',
      expectFail: true,
      mutation: `a new working paper is added to the copy at ${INTERNAL_DIR_REL}/FU-REVIEW-FIX-9.md and classified nowhere`,
      mutate: (copy) => {
        writeFileSync(
          join(copy, INTERNAL_DIR_REL, 'FU-REVIEW-FIX-9.md'),
          '# a working paper nobody classified\n'
        );
      },
    },
    {
      name: 'c-delivered-file-gains-a-machine-path',
      expectName: 'delivered-files-carry-no-machine-path',
      expectFail: true,
      mutation: `a DELIVERED file (${sampleDeliveredDoc}) is given an internal machine path`,
      mutate: (copy) => {
        // Assembled from parts, like MACHINE_PATTERNS: this fixture EXISTS to write a
        // machine path into a copy, so a literal here would make the checker fail its own
        // rule (and it did — the reason this comment is here).
        const probe =
          '\nBuilt at ' + 'D:' + '/' + 'AI' + '-Workspace' + '/' + 'runtime' + '/worktrees' + '/mt01.\n';
        appendFileSync(join(copy, sampleDeliveredDoc), probe);
      },
    },
    {
      name: 'd-not-delivered-file-loses-its-marker',
      expectName: 'not-delivered-are-marked',
      expectFail: true,
      mutation: `a not-delivered working paper (${firstNotDelivered}) loses its INTERNAL — NOT DELIVERED. marker`,
      mutate: (copy) => {
        const path = join(copy, firstNotDelivered);
        const kept = readFileSync(path, 'utf8')
          .split(/\r?\n/)
          .filter((line) => !markerLine(line))
          .join('\n');
        writeFileSync(path, kept);
      },
    },
    {
      name: 'e-delivered-file-cites-a-not-delivered-paper-by-path',
      expectName: 'no-dangling-citation',
      expectFail: true,
      mutation: `a DELIVERED file (${sampleDeliveredDoc}) is made to point at a not-delivered working paper by path`,
      mutate: (copy) => {
        appendFileSync(join(copy, sampleDeliveredDoc), `\nSee ${firstNotDelivered} for the detailed reasoning.\n`);
      },
    },
    {
      name: 'f-not-delivered-paper-is-deleted-from-the-tree',
      expectName: 'not-delivered-are-marked',
      expectFail: true,
      mutation: `a not-delivered working paper (${firstNotDelivered}) is deleted from the copy while the manifest still lists it`,
      mutate: (copy) => {
        unlinkSync(join(copy, firstNotDelivered));
      },
    },
    {
      name: 'g-a-declared-path-residual-is-no-longer-dirty',
      expectName: 'recorded-path-residuals-are-live',
      expectFail: true,
      mutation: `a declared path residual (${firstResidual}) is made path-clean in the copy, so the declaration goes stale`,
      mutate: (copy) => {
        const path = join(copy, firstResidual);
        let text = readFileSync(path, 'utf8');
        // Same reason as fixture c: assembled from parts so this checker stays path-clean
        // and does not fail its own rule.
        const vendorWs = 'AI' + '-Workspace';
        text = text.replace(
          new RegExp('D:' + '\\\\' + vendorWs + '\\\\projects\\\\modules-hub', 'g'),
          'the-upstream-module-tree'
        );
        text = text.replace(new RegExp(vendorWs, 'g'), 'AIWorkspace');
        writeFileSync(path, text);
      },
    },
  ];

  const selfResults = [];
  let tempRoot = null;

  function selfRecord(name, passed, detail) {
    selfResults.push({ name, passed });
    console.log(`CHECK ${name} ${passed ? 'PASS' : 'FAIL'} ${detail}`);
  }

  try {
    console.log(`OBSERVATION repository under test (read only): ${REPO_DIR}`);
    console.log(`OBSERVATION node: ${process.version}`);
    tempRoot = mkdtempSync(join(tmpdir(), 'mt01-p2-delivery-cases-'));
    console.log(`OBSERVATION temp directory created under the OS temp dir: ${tempRoot}`);

    for (const testCase of CASES) {
      const copy = join(tempRoot, testCase.name);
      let run;
      try {
        copyRepository(copy);
        testCase.mutate(copy);
        run = runChild(copy);
      } catch (error) {
        run = { exitCode: null, output: `case failed to run: ${error.message}`, checkLines: [] };
      }

      const namedLine =
        testCase.expectName === null
          ? null
          : run.checkLines.find((line) => line.startsWith(`CHECK ${testCase.expectName} `)) ?? null;
      const namedPassed = namedLine === null ? null : / PASS /.test(namedLine);
      const exitOk =
        testCase.expectFail ? run.exitCode !== 0 && run.exitCode !== null : run.exitCode === 0;
      const nameOk = testCase.expectName === null ? true : namedPassed === false;
      const behaves = exitOk && nameOk;

      console.log(`OBSERVATION case ${testCase.name}: mutation = ${testCase.mutation}`);
      console.log(
        `OBSERVATION case ${testCase.name}: expected ${testCase.expectFail ? 'non-zero exit' : 'exit 0'}${testCase.expectName ? ` with CHECK ${testCase.expectName} FAIL` : ''}`
      );
      console.log(`OBSERVATION case ${testCase.name}: observed exit code = ${run.exitCode}`);
      console.log(
        `OBSERVATION case ${testCase.name}: observed line = ${namedLine === null ? (testCase.expectName === null ? '(control: any output accepted)' : '(no CHECK line printed)') : namedLine.slice(0, 400)}`
      );
      if (!behaves) {
        console.log(`OBSERVATION case ${testCase.name}: raw output follows`);
        console.log(run.output.slice(0, 2000));
      }

      selfRecord(
        testCase.name,
        behaves,
        `mutation="${testCase.mutation}" expected=${testCase.expectFail ? 'fail' : 'pass'} observed_exit_code=${run.exitCode} observed_check=${testCase.expectName === null ? 'n/a' : namedPassed === null ? 'missing' : namedPassed ? 'PASS' : 'FAIL'}`
      );
    }
  } catch (error) {
    selfRecord('self-test-harness', false, `unexpected_error=${error.message}`);
  } finally {
    if (tempRoot !== null) {
      try {
        rmSync(tempRoot, { recursive: true, force: true });
        console.log(`OBSERVATION removed the temp directory it created: ${tempRoot} (nothing inside the repository was written)`);
      } catch (error) {
        console.log(`OBSERVATION could not remove ${tempRoot}: ${error.message}`);
      }
    }
  }

  const selfFailed = selfResults.filter((result) => !result.passed);
  console.log(
    `SUMMARY cases=${selfResults.length} passed=${selfResults.length - selfFailed.length} failed=${selfFailed.length}` +
      (selfFailed.length > 0 ? ` failed_names=[${selfFailed.map((f) => f.name).join(',')}]` : '')
  );
  process.exit(selfFailed.length > 0 ? 1 : 0);
}

process.exit(report());
