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
 *   * a DELIVERED file CITES a path that does not exist — either an explicit
 *     `docs/…` path token that is not a path in the tree, or a directory token
 *     immediately followed by a parenthesised list of bare filenames whose join
 *     is missing while a file with that basename lives elsewhere in the tree
 *     (see `no-citation-to-a-path-that-does-not-exist`). This is the semantic
 *     rule the earlier line-based checks missed, because these citations wrap
 *     across lines in the bilingual documents.
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
 * The vendor's working record, as a FOLDER — the rule this gate now enforces.
 *
 * It used to be a name prefix (`FU-`/`PRESALE-` under `docs/house-swarm-7/`),
 * with two feature papers declared delivered as exceptions. The independent
 * review of the merged revision recorded what that cost: the delivered set still
 * carried the vendor's feature logs, and a file added under that folder with a
 * name outside the prefix would have needed a new decision rather than being
 * covered by the rule. The rule is now the folder itself, so:
 *
 *   * a not-delivered entry is only accepted if it is under this folder;
 *   * a file under this folder may NOT be delivered (no exceptions);
 *   * a new file added under this folder is not delivered whatever it is called.
 *
 * A buyer-facing document lives under `docs/product/`, which is an ordinary
 * delivered path.
 */
const INTERNAL_FOLDER = 'docs/house-swarm-7/';
const isInternalRecord = (rel) => rel.startsWith(INTERNAL_FOLDER);

/**
 * Backwards-compatible name for the folder rule, kept because the CHECK text and
 * the older reports refer to it as "the family rule".
 */
const INTERNAL_FAMILY_RULE = /^docs\/house-swarm-7\//;

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
  // The residual group is OPTIONAL and, in the corrected manifest, absent: the
  // delivered set is path-clean, so there is nothing to declare. Its absence is
  // asserted below by `no-declared-path-residuals-remain` rather than assumed.
  if (groups.has(GROUP.residual) && (groups.get(GROUP.residual)?.size ?? 0) === 0) {
    missingGroups.push('## Delivered with a recorded path residual present but empty (drop the group)');
  }
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
      if (!isInternalRecord(rel)) {
        offenders.push(
          `not-delivered entry is not under the vendor's working-record folder (${INTERNAL_FOLDER}): ${rel}`
        );
      }
      if (delivered.has(rel)) {
        offenders.push(`listed in BOTH groups: ${rel}`);
      }
    }
    for (const rel of delivered) {
      // THE FOLDER RULE, ENFORCED ON THE DELIVERED SIDE TOO. A file under the
      // vendor's working-record folder may not be in the delivered set — that is
      // the whole point of making the rule the folder rather than a name prefix,
      // and it is what stops a feature paper being re-declared as an exception.
      if (isInternalRecord(rel)) {
        offenders.push(
          `delivered entry is under the vendor's working-record folder (${INTERNAL_FOLDER}) and must not be delivered: ${rel}`
        );
      }
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
// There are NO exceptions any more (review finding LOW-3): the vendored module
// documents that used to be declared as a "recorded path residual" were cleaned,
// so every delivered file is scanned and no list can exempt one. Check 4 asserts
// independently that no residual group exists and that nothing in the delivered
// set is path-dirty.
// ---------------------------------------------------------------------------
{
  const hits = [];
  let scanned = 0;

  if (!parsed) {
    record('delivered-files-carry-no-machine-path', false, 'the manifest could not be parsed (see delivery-manifest-parsed)');
  } else {
    // NOTHING is filtered out: the delivered set is scanned whole. The residual
    // filter is gone with the residual list.
    const toScan = [...delivered].sort();
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
        ? `no DELIVERED file carries an internal machine path; scanned ${scanned} delivered file(s) for ${MACHINE_PATTERNS.map(([l]) => l).join(', ')}; the ${notDelivered.size} not-delivered working papers are read from the classification and are allowed to carry them; no delivered file is exempt, and no residual list exists to exempt one`
        : `${hits.length} machine path(s) in the delivered set: ${hits.slice(0, 10).join('; ')}`
    );
  }
}

// ---------------------------------------------------------------------------
// CHECK 4 — no-declared-path-residuals-remain
//
// THE CORRECTION THIS CHECK NOW MAKES (review finding LOW-3). The previous
// revision DECLARED seven vendored module documents as a "recorded path
// residual" and asserted the declaration stayed live. The independent review
// recorded why that is not good enough: a declaration the gate enforces by
// finding the machine path it declares is indistinguishable, to a reader, from
// an exemption — and it let a delivered file keep the vendor's machine path as
// long as the manifest said so.
//
// So the declaration is gone and the property it stood for is checked directly:
// NO delivered file carries a machine path, and no residual group exists to
// exempt one. This check fails if the group comes back, or if any delivered file
// (including a vendored module document) carries a machine path that the
// machine-path check would otherwise have skipped.
// ---------------------------------------------------------------------------
{
  const problems = [];

  if (!parsed) {
    record('no-declared-path-residuals-remain', false, 'the manifest could not be parsed (see delivery-manifest-parsed)');
  } else {
    if (residual.size > 0) {
      problems.push(
        `${residual.size} file(s) are still declared as a "recorded path residual" (${[...residual]
          .sort()
          .slice(0, 10)
          .join(', ')}); the corrected manifest declares none — a machine path must be removed, not declared`
      );
    }

    // Independent of the group: scan the delivered set for the vendor's machine
    // paths, EXCLUDING NOTHING. If a file's path is in the delivered group, its
    // text must be clean; there is no residual list left to skip it.
    const dirty = [];
    for (const rel of [...delivered].sort()) {
      const text = readOrNull(join(REPO_DIR, rel));
      if (text === null) continue;
      for (const [label, pattern] of MACHINE_PATTERNS) {
        if (pattern.test(text)) dirty.push(`${rel} (${label})`);
      }
    }
    if (dirty.length > 0) {
      problems.push(`${dirty.length} delivered file(s) carry a machine path: ${dirty.slice(0, 10).join('; ')}`);
    }

    record(
      'no-declared-path-residuals-remain',
      problems.length === 0,
      problems.length === 0
        ? 'no delivered file is declared a path residual and none carries a machine path — the whole delivered set, vendored modules included, is path-clean and there is no exemption list'
        : `${problems.length} problem(s): ${problems.slice(0, 5).join('; ')}`
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
// CHECK 8 — no-working-paper-is-delivered
//
// The rule, stated as the property it is: a working paper is never part of what a
// buyer receives. It used to be written as "no paper is named as a delivered item
// AND the two exceptions are path-clean", which left the door open for a third
// paper to be declared an exception. With the folder rule there is no door: every
// delivered path is checked against the folder, and any file under it that appears
// in the delivered group is a failure. This also names the working papers that ARE
// delivered if any exist — which, after the correction, is none.
// ---------------------------------------------------------------------------
{
  const problems = [];

  if (!parsed) {
    record('no-working-paper-is-delivered', false, 'the manifest could not be parsed (see delivery-manifest-parsed)');
  } else {
    const deliveredPapers = [...delivered].filter((rel) => isInternalRecord(rel)).sort();

    // The buyer-facing documents must live under docs/product/, not in the
    // vendor's record folder — so a paper cannot be smuggled into the delivered
    // set by moving its row and leaving the file where it is.
    const expectedProductDocs = [
      'docs/product/WU3-PAID-ROUTE-INVENTORY.md',
      'docs/product/WU4-SAMPLE-UI.md',
      'docs/product/WU5-DEPLOY.md',
      'docs/product/WU6-CLAIMS-EVIDENCE.md',
      'docs/product/WU6-SALES-EN.md',
      'docs/product/WU6-SALES-TH.md',
    ];
    for (const rel of expectedProductDocs) {
      if (!delivered.has(rel)) {
        problems.push(`${rel} is not in the delivered set; the buyer-facing documents live under docs/product/`);
      }
    }

    for (const rel of deliveredPapers) {
      problems.push(`${rel} is a delivered working paper; the whole ${INTERNAL_FOLDER} folder is not delivered`);
    }

    record(
      'no-working-paper-is-delivered',
      problems.length === 0,
      problems.length === 0
        ? `no working paper is delivered: ${delivered.size} delivered paths, none of them under ${INTERNAL_FOLDER}, and all ${expectedProductDocs.length} buyer-facing documents are present under docs/product/`
        : `${problems.length} problem(s): ${problems.slice(0, 10).join('; ')}`
    );
  }
}

// ---------------------------------------------------------------------------
// CHECK 9 — no-citation-to-a-path-that-does-not-exist
//
// THE SEMANTIC RULE THE LINE-BASED CHECKS COULD NOT EXPRESS. The independent
// review of the round-2 revision recorded it (a LOW finding): a DELIVERED
// document named the vendor's working-record folder and then listed
// buyer-facing filenames that no longer live there, and a `docs/…/…md`-shaped
// citation was written outright. Check 7 above only fires on a not-delivered
// path quoted WHOLE; these citations write a directory token and a bare
// basename, or a path that is simply not in the tree, and the bilingual
// documents WRAP them across lines — so a per-line scan provably misses them
// (that is why the gate missed this in the first place).
//
// This check therefore works on a whitespace-flattened copy of each DELIVERED
// file, with a line map back to the original, and fails a file when either rule
// fires:
//
//   1. explicit-path rule — a token shaped `docs/<…>.<ext>` that is not a path
//      in the tree. This is what catches a written-out `docs/…/…md` citation.
//   2. directory-plus-filename rule — a directory token (one or more `name/`
//      segments, with or without backticks) IMMEDIATELY followed by a
//      parenthesised list of bare filenames, where joining the directory and a
//      listed filename does not exist in the tree AND a file with that basename
//      exists somewhere ELSE in the tree. The basename guard is what keeps
//      ordinary prose like "a file called `foo.md`" from firing.
//
// `../`-relative and `http(s)://` tokens are skipped: they are not repository
// paths. The scanned set is the DELIVERED classification — the same whole set
// check 3 scans, with no exemptions and no residual list. Each hit names the
// offending file, the line in the ORIGINAL, and both the cited and the real
// location.
// ---------------------------------------------------------------------------
{
  const hits = [];

  if (!parsed) {
    record('no-citation-to-a-path-that-does-not-exist', false, 'the manifest could not be parsed (see delivery-manifest-parsed)');
  } else {
    const treeSet = new Set(treeFiles);
    /** basename -> the repository-relative paths that carry it. */
    const basenameIndex = new Map();
    for (const rel of treeFiles) {
      const base = rel.split('/').pop();
      if (!basenameIndex.has(base)) basenameIndex.set(base, []);
      basenameIndex.get(base).push(rel);
    }

    /**
     * Whitespace-flattened text (each line break becomes one space) with a map
     * from every character index to the ORIGINAL line number it came from.
     */
    function flattenWithLineMap(text) {
      const lines = text.split(/\r?\n/);
      let flat = '';
      const map = [];
      for (let i = 0; i < lines.length; i += 1) {
        flat += lines[i];
        for (let c = 0; c < lines[i].length; c += 1) map.push(i + 1);
        flat += ' ';
        map.push(i + 1);
      }
      return { flat, map };
    }

    // Rule 1. The `/` in `docs/` is escaped in this source on purpose: written
    // literally, this regex would itself be a path token in THIS delivered file
    // and the check would fire on its own pattern — the same self-reference
    // reason MACHINE_PATTERNS is assembled from parts.
    const EXPLICIT_PATH = /docs\/[A-Za-z0-9_.\-]+(?:\/[A-Za-z0-9_.\-]+)*\.[A-Za-z0-9]+/g;
    // Rule 2. A directory token immediately followed by a parenthesised list.
    const DIR_THEN_LIST = /`?([A-Za-z0-9_.\-]+(?:\/[A-Za-z0-9_.\-]+)*\/)`?\s*\(([^)]*)\)/g;
    const BARE_FILENAME = /^[A-Za-z0-9_.\-]+\.[A-Za-z0-9]+$/;
    const notUrlOrRelative = (flat, index) => {
      const before = flat[index - 1];
      return before === undefined || !/[A-Za-z0-9_.\-\/]/.test(before);
    };

    for (const rel of [...delivered].sort()) {
      const text = readOrNull(join(REPO_DIR, rel));
      if (text === null) continue;
      const { flat, map } = flattenWithLineMap(text);
      const line = (index) => map[index] ?? 1;

      let m;

      // Rule 1 — an explicit docs path that is not in the tree.
      EXPLICIT_PATH.lastIndex = 0;
      while ((m = EXPLICIT_PATH.exec(flat)) !== null) {
        const token = m[0];
        if (!notUrlOrRelative(flat, m.index)) continue;
        if (treeSet.has(token)) continue;
        const base = token.split('/').pop();
        const real = basenameIndex.get(base) ?? [];
        hits.push(
          `${rel}:${line(m.index)} cites ${token}, which is not a path in the tree` +
            (real.length > 0
              ? `; a file with that name is at ${real.join(', ')}`
              : '; no file with that name exists anywhere in the tree')
        );
      }

      // Rule 2 — a directory token followed by a parenthesised list of bare
      // filenames whose join does not exist, while the basename lives elsewhere.
      DIR_THEN_LIST.lastIndex = 0;
      while ((m = DIR_THEN_LIST.exec(flat)) !== null) {
        const dir = m[1];
        if (dir.startsWith('../')) continue;
        if (flat.slice(Math.max(0, m.index - 8), m.index).includes('://')) continue;
        for (const rawName of m[2].split(',')) {
          const name = rawName.trim().replace(/`/g, '').trim().replace(/[.,;:]+$/, '');
          if (!BARE_FILENAME.test(name)) continue;
          const joined = dir + name;
          if (treeSet.has(joined)) continue;
          const real = basenameIndex.get(name) ?? [];
          if (real.length === 0) continue; // the guard: not a repository filename at all
          hits.push(
            `${rel}:${line(m.index)} cites ${dir} + ${name} but ${joined} does not exist; ` +
              `the file is at ${real.join(', ')}`
          );
        }
      }
    }

    record(
      'no-citation-to-a-path-that-does-not-exist',
      hits.length === 0,
      hits.length === 0
        ? `no DELIVERED file cites a path that does not exist: scanned ${delivered.size} delivered file(s) (the whole set, no exemptions) on a whitespace-flattened copy with a line map, for an explicit docs/ path token absent from the tree and for a directory token immediately followed by a parenthesised list of bare filenames whose join is missing while the basename lives elsewhere; ../-relative and http(s):// tokens are skipped`
        : `${hits.length} dangling semantic citation(s) in the delivered set: ${hits.slice(0, 10).join('; ')}`
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
      name: 'g-delivered-file-cites-a-directory-and-a-bare-filename-that-is-not-there',
      expectName: 'no-citation-to-a-path-that-does-not-exist',
      expectFail: true,
      mutation: `a DELIVERED file (${sampleDeliveredDoc}) is made to cite a wrong directory plus a parenthesised list of bare filenames — the directory + bare-filenames form the gate previously missed`,
      mutate: (copy) => {
        // Assembled from parts, like MACHINE_PATTERNS and fixture c: this case
        // EXISTS to write a dangling citation into a copy, so a literal path token
        // here would make THIS file fail its own new rule. The basename is a real
        // file in the tree (`${'WU4' + '-SAMPLE-UI.md'}` lives under `docs/product/`),
        // which is what makes the join into the wrong folder a citation the rule
        // must catch, and the folder token is a path that does not exist.
        const wrongDir = 'docs/' + 'house-swarm-7' + '/';
        const realBase = 'WU4' + '-SAMPLE-UI.md';
        appendFileSync(
          join(copy, sampleDeliveredDoc),
          `\nThe commands are under ${'`'}${wrongDir}${'`'} (${'`'}${realBase}${'`'}).\n`
        );
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
