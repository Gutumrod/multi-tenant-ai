#!/usr/bin/env node
/**
 * HOUSE-SWARM-7 WU-4 i18n parity harness (standalone Node ESM).
 *
 * Proves three things about the sample UI's bilingual mechanism:
 *
 *   1. `web/assets/i18n.js` defines exactly the same key set for `th` and `en`
 *      (and defines no key twice inside one locale, which an object literal
 *      would silently swallow).
 *   2. Every visible string in `web/*.html` resolves through the dictionary:
 *      a page file may carry only `data-i18n*` attribute keys, `[key]`
 *      placeholders and markup — no free-standing text at all. Visible-text
 *      attributes (placeholder/title/aria-label/alt/value) are checked the same
 *      way, and every key a page references must exist in both locales.
 *   3. `web/assets/app.js` (the behaviour script) assembles every user-facing
 *      string from the dictionary or from server-provided data. String literals
 *      that look like prose are matched against a small, explicit allowlist (HTTP
 *      paths, header names, MIME types, error codes, CSS class names); anything
 *      that matches nothing is reported as an out-of-dictionary literal.
 *      Note: this is a checker, not a parser of JavaScript.
 *
 * Extra assertions kept because they are cheap and factual: no external URL of
 * any kind (CDN, font, stock photo) appears in the UI files, and the
 * not-implemented capability list is present on the landing page in both locales.
 *
 * Prints one machine-readable line per check:
 *
 *   CHECK <name> PASS|FAIL <detail>
 *
 * Exits non-zero if any check fails. Prints no credential.
 *
 * Usage:  node scripts/proofs/wu4/i18n-parity.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = join(HERE, '../../..');
const REPO_DIR = join(SERVER_DIR, '..');
const WEB_DIR = join(REPO_DIR, 'web');

const PAGE_FILES = ['index.html', 'signup.html', 'login.html', 'plans.html', 'app.html'];
const SCRIPT_FILE = join(WEB_DIR, 'assets/app.js');
const DICTIONARY_FILE = join(WEB_DIR, 'assets/i18n.js');

const results = [];

function record(name, passed, detail) {
  results.push({ name, passed });
  console.log(`CHECK ${name} ${passed ? 'PASS' : 'FAIL'} ${detail}`);
}

function info(line) {
  console.log(`INFO ${line}`);
}

const { DICT, LOCALES, DEFAULT_LOCALE } = await import(pathToFileURL(DICTIONARY_FILE).href);
const dictionarySource = readFileSync(DICTIONARY_FILE, 'utf8');

// ---------------------------------------------------------------- key parity --

const keySets = {};
for (const locale of LOCALES) {
  keySets[locale] = Object.keys(DICT[locale]).sort();
}

const keySetSignature = (keys) => keys.join('\n');
const signatures = new Set(LOCALES.map((locale) => keySetSignature(keySets[locale])));
const missingFromEn = keySets.th.filter((key) => !keySets.en.includes(key));
const missingFromTh = keySets.en.filter((key) => !keySets.th.includes(key));

record(
  'dictionary-key-sets-identical',
  signatures.size === 1,
  `locales=${LOCALES.join(',')} keys_per_locale=${LOCALES.map((l) => `${l}:${keySets[l].length}`).join(
    ' '
  )} identical_sets=${signatures.size === 1} missing_from_en=[${missingFromEn.join(',')}] ` +
    `missing_from_th=[${missingFromTh.join(',')}]`
);

/**
 * Counts duplicate key literals inside one locale's object block, which an object
 * literal would silently collapse (making the two locales look identical while
 * one string was dropped).
 */
function duplicateKeysInLocale(locale) {
  const lines = dictionarySource.split(/\r?\n/);
  const startPattern = new RegExp(`^  ${locale}: \\{$`);
  const start = lines.findIndex((line) => startPattern.test(line));
  if (start === -1) return { locale, found: false, duplicates: [] };

  const seen = new Map();
  const duplicates = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^  \},?$/.test(line)) break;
    const match = line.match(/^\s{4}'([^']+)':/);
    if (!match) continue;
    const key = match[1];
    if (seen.has(key)) duplicates.push(key);
    seen.set(key, index);
  }
  return { locale, found: true, duplicates, count: seen.size };
}

const duplicateReports = LOCALES.map(duplicateKeysInLocale);
const allDuplicates = duplicateReports.flatMap((report) => report.duplicates);

record(
  'dictionary-has-no-duplicate-keys',
  duplicateReports.every((report) => report.found) && allDuplicates.length === 0,
  duplicateReports
    .map((report) => `${report.locale}: blocks_found=${report.found} distinct_keys=${report.count} duplicates=[${report.duplicates.join(',')}]`)
    .join(' ')
);

// -------------------------------------------------- out-of-dictionary literals --

/** Placeholder form a page file uses for a dictionary string. */
const PLACEHOLDER = /\[([A-Za-z0-9._-]+)\]/g;

function stripPlaceholders(text) {
  return text.replace(PLACEHOLDER, '');
}

function collapse(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/** Every text node of a page file, without comments or inline script/style. */
function textNodes(html) {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, ' ');
  const withoutBlocks = withoutComments
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');

  const nodes = [];
  const leading = withoutBlocks.slice(0, withoutBlocks.indexOf('<'));
  if (leading) nodes.push(leading);

  const re = />([^<]*)</g;
  let match;
  while ((match = re.exec(withoutBlocks)) !== null) {
    nodes.push(match[1]);
  }

  const lastClose = withoutBlocks.lastIndexOf('>');
  if (lastClose !== -1) nodes.push(withoutBlocks.slice(lastClose + 1));
  return nodes;
}

/** All attribute name/value pairs of a page file. */
function attributes(html) {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, ' ');
  const found = [];
  const re = /\s([a-zA-Z][a-zA-Z0-9-]*)="([^"]*)"/g;
  let match;
  while ((match = re.exec(withoutComments)) !== null) {
    found.push({ name: match[1], value: match[2] });
  }
  return found;
}

const pageReports = PAGE_FILES.map((file) => {
  const html = readFileSync(join(WEB_DIR, file), 'utf8');
  const freeText = textNodes(html)
    .map(stripPlaceholders)
    .map(collapse)
    .filter((text) => text.length > 0);

  const visibleAttributes = ['placeholder', 'title', 'aria-label', 'alt', 'value'];
  const attributeLiterals = attributes(html)
    .filter((attribute) => visibleAttributes.includes(attribute.name))
    .map((attribute) => ({ ...attribute, residue: collapse(stripPlaceholders(attribute.value)) }))
    .filter((attribute) => attribute.residue.length > 0);

  const referencedKeys = [...html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)].map(
    (match) => match[1]
  );
  const unknownKeys = [...new Set(referencedKeys)].filter(
    (key) => !LOCALES.every((locale) => Object.prototype.hasOwnProperty.call(DICT[locale], key))
  );

  const placeholderKeys = [...html.matchAll(PLACEHOLDER)].map((match) => match[1]);
  const unknownPlaceholderKeys = [...new Set(placeholderKeys)].filter(
    (key) => !LOCALES.every((locale) => Object.prototype.hasOwnProperty.call(DICT[locale], key))
  );

  return {
    file,
    freeText,
    attributeLiterals,
    referencedKeys: [...new Set(referencedKeys)],
    unknownKeys,
    unknownPlaceholderKeys,
    html,
  };
});

const freeTextTotal = pageReports.reduce((sum, report) => sum + report.freeText.length, 0);
record(
  'pages-have-no-text-outside-dictionary',
  freeTextTotal === 0,
  `pages_checked=${PAGE_FILES.length} free_standing_text_nodes=${freeTextTotal}` +
    (freeTextTotal > 0
      ? ` violations=${JSON.stringify(
          pageReports
            .filter((report) => report.freeText.length > 0)
            .map((report) => ({ file: report.file, text: report.freeText }))
        )}`
      : '')
);

const attributeTotal = pageReports.reduce((sum, report) => sum + report.attributeLiterals.length, 0);
record(
  'visible-attributes-come-from-dictionary',
  attributeTotal === 0,
  `attributes_checked=placeholder,title,aria-label,alt,value literal_values=${attributeTotal}` +
    (attributeTotal > 0
      ? ` violations=${JSON.stringify(
          pageReports
            .filter((report) => report.attributeLiterals.length > 0)
            .map((report) => ({
              file: report.file,
              values: report.attributeLiterals.map((a) => `${a.name}=${a.residue}`),
            }))
        )}`
      : '')
);

const unknownKeyTotal = pageReports.reduce(
  (sum, report) => sum + report.unknownKeys.length + report.unknownPlaceholderKeys.length,
  0
);
record(
  'every-referenced-key-exists-in-both-locales',
  unknownKeyTotal === 0,
  `keys_referenced=${pageReports.reduce((sum, report) => sum + report.referencedKeys.length, 0)} ` +
    `unknown_keys=${unknownKeyTotal}` +
    (unknownKeyTotal > 0
      ? ` violations=${JSON.stringify(
          pageReports
            .filter((report) => report.unknownKeys.length + report.unknownPlaceholderKeys.length > 0)
            .map((report) => ({
              file: report.file,
              data_i18n: report.unknownKeys,
              placeholders: report.unknownPlaceholderKeys,
            }))
        )}`
      : '')
);

// ------------------------------------------------------- behaviour script scan --

/**
 * Literal allowlist for web/assets/app.js. Every entry is an identifier the UI
 * exchanges with the server or the DOM — never a sentence. A literal matching
 * none of these is reported as an out-of-dictionary literal.
 *
 * The prose test is deliberately about WORD COUNT, not about character class:
 * every legitimate literal here is a single token, so an unrecognised literal
 * containing a space is the signal that human text may have crept in.
 * Hyphenated technical values (`x-tenant-id`, `x-demo-account`, `aria-label`,
 * `application/json`) are named explicitly rather than allowed by a broad hyphen
 * rule, because such a rule would let `Sign up`-style prose through.
 */
const ALLOWED_EXACT_LITERALS = new Set([
  'GET',
  'POST',
  '/',
  '/me',
  '/ai/demo',
  '/subscription/status',
  '/subscription/subscribe',
  '/ui/plans.json',
  'index.html',
  'signup.html',
  'login.html',
  'plans.html',
  'app.html',
  'ai_requests_per_month',
  'payments_per_month',
  'free',
  'pro',
  '',
]);

const ALLOWED_LITERAL_PATTERNS = [
  /^(GET|POST|PUT|PATCH|DELETE) \/[A-Za-z0-9/_.:{}-]*$/, // HTTP method + path
  /^\/[A-Za-z0-9/_.-]*$/, // path or route fragment
  /^(content-type|application\/json|x-tenant-id|x-demo-account)$/, // header names / MIME type
  /^[A-Z][A-Z0-9_]{2,}$/, // error codes such as QUOTA_EXCEEDED
  /^[a-z][a-zA-Z0-9_.-]*$/, // bare identifiers: keys, ids, css class names, selectors
  /**
   * A CSS selector list — `[data-nav-app], [data-nav-plans], [data-nav-login]`
   * is the value `document.querySelectorAll()` consumes, not visible prose.
   *
   * This is a GRAMMAR match, not "any string that starts with a bracket": a
   * selector list is made only of selectors, commas and whitespace, and every
   * selector is an optional type name followed by at most one `.class` and at
   * most one `[attr=value]` / `#id` / `:pseudo` part. A prose sentence that
   * merely opens with `[` fails the whole-string match below, because its words
   * contain no selector punctuation to hang off.
   */
  /^(?:[A-Za-z][A-Za-z0-9-]*)?(?:\.[A-Za-z0-9_-]+)*(?:#[A-Za-z0-9_-]+)?(?:\[[A-Za-z0-9_="' -]+\])?(?::[a-z-]+(?:\([^)]*\))?)?(?:\s*,\s*(?:[A-Za-z][A-Za-z0-9-]*)?(?:\.[A-Za-z0-9_-]+)*(?:#[A-Za-z0-9_-]+)?(?:\[[A-Za-z0-9_="' -]+\])?(?::[a-z-]+(?:\([^)]*\))?)?)+$/,
  /^[.#][a-zA-Z0-9_.\-\[\]="'>*:() ]+$/, // a single CSS selector / class-name token starting with . or #
  /**
   * A CSS class-name list (`btn btn--small`) is markup plumbing — the value of
   * `className` — not visible prose, so it must not be counted as a literal that
   * needs translating.
   *
   * The guard is what keeps this from swallowing prose:
   *   - every token must be class-name shaped, lowercase-start, no punctuation;
   *   - the lookahead requires at least one `-`/`_` somewhere in the literal, so
   *     a plain two-word sentence (`hello world`) is NOT a class list and is
   *     still reported;
   *   - a capitalised first word (`Sign up`) cannot match at all.
   * `btn btn--small` passes on all three; `Sign up` and `hello world` do not.
   */
  /^(?=[a-z0-9_\s-]*[_-])[a-z][a-z0-9_-]*(?:\s+[a-z][a-z0-9_-]*)+$/,
  /^[0-9a-zA-Z._@-]*$/, // id prefixes and opaque tokens
  /^(true|false|null|undefined)$/,
];

function stripTemplateExpressions(literal) {
  return literal.replace(/\$\{[^}]*\}/g, '');
}

/** A literal is prose-like when its residue holds two or more words. */
function looksLikeProse(literal) {
  if (/[\u0E00-\u0E7F]/.test(literal)) return true; // Thai characters
  const residue = stripTemplateExpressions(literal);
  // A template literal whose whole body was a `${...}` expression has no text of
  // its own: there is nothing visible to translate, so it cannot be prose.
  if (residue.replace(/\s+/g, '') === '') return false;
  const words = residue.split(/\s+/).filter((word) => /[A-Za-z]{2,}/.test(word));
  return words.length >= 2;
}

function isAllowedLiteral(literal) {
  const value = literal.value;
  if (value.trim() === '') return true;
  if (ALLOWED_EXACT_LITERALS.has(value) || ALLOWED_EXACT_LITERALS.has(value.trim())) return true;
  if (ALLOWED_LITERAL_PATTERNS.some((pattern) => pattern.test(value.trim()))) return true;
  return ALLOWED_LITERAL_PATTERNS.some((pattern) => pattern.test(stripTemplateExpressions(value).trim()));
}

/**
 * The behaviour script source, with block comments removed, so the scan reads
 * code only. Line (`//`) comments are NOT stripped here — that is the
 * tokenizer's job below, because a naive line-comment strip would also cut
 * inside string literals that contain `//` (every URL path).
 */
const scriptSource = readFileSync(SCRIPT_FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');

/**
 * Every quoted literal of the behaviour script, including template literals.
 *
 * This is a small single-pass tokenizer rather than a regex, because a regex over
 * quoted text desynchronises: an apostrophe in an English comment (`the server's
 * own`) reads as the start of a string literal and makes the scanner swallow code
 * up to the next quote (observed as multi-line "violations" during development).
 * The tokenizer walks the source once, skipping `/* *\/` and `//` comments, and
 * collects `'...'`, `"..."` and `` `...` `` literals with their escapes decoded.
 *
 * Limitation: a `${...}` placeholder inside a template literal is kept as text
 * (its own nested quotes are not tokenised separately). Every template literal in
 * this file uses plain identifiers inside `${}`, and the caller strips the
 * placeholders before classifying a literal, so this is sufficient here — it is
 * stated rather than hidden.
 */
function scriptLiterals(source) {
  const literals = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];

    if (char === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }

    if (char === '/' && source[index + 1] === '/') {
      const end = source.indexOf('\n', index + 2);
      index = end === -1 ? source.length : end + 1;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      const quote = char;
      let cursor = index + 1;
      let value = '';
      while (cursor < source.length) {
        const inner = source[cursor];
        if (inner === '\\') {
          value += source[cursor + 1] ?? '';
          cursor += 2;
          continue;
        }
        if (inner === quote) {
          cursor += 1;
          break;
        }
        value += inner;
        cursor += 1;
      }
      literals.push({ raw: source.slice(index, cursor), value });
      index = cursor;
      continue;
    }

    index += 1;
  }

  return literals;
}

const proseLike = scriptLiterals(scriptSource)
  .map((literal) => ({ ...literal, stripped: stripTemplateExpressions(literal.value) }))
  .filter((literal) => looksLikeProse(literal.value))
  .filter((literal) => !isAllowedLiteral(literal));

record(
  'behaviour-script-literals-are-identifiers-only',
  proseLike.length === 0,
  `literals_scanned=${scriptLiterals(scriptSource).length} prose_like_outside_dictionary=${proseLike.length}` +
    (proseLike.length > 0 ? ` violations=${JSON.stringify(proseLike.map((l) => l.value))}` : '')
);

// -------------------------------------------------------- external references --

/**
 * External-resource references only.
 *
 * A hit must be a REAL reference to a foreign resource. The JavaScript URL
 * constructor (`new URL(page, location.href)`) is NOT one: it resolves a
 * same-origin path against the current document and fetches nothing external, so
 * matching it fails this check on correct code. Only three shapes are matched,
 * each anchored on an actual loading context:
 *
 *   1. `href=` / `src=` / `srcset=` / `poster=` whose value is an absolute
 *      `http(s)://host` URL, a protocol-relative `//host.tld` URL, or a bare
 *      external host WITH A PATH (`cdn.example.com/logo.png`).
 *   2. A CSS `url(...)` whose target is one of those three shapes.
 *   3. A bare absolute or protocol-relative URL anywhere in the file, which
 *      catches an `import`/`fetch`/redirect that reaches out without an
 *      href/src keyword.
 *
 * The discriminators that keep this non-vacuous yet free of the round-1 false
 * positives:
 *   - the host must carry a dot followed by a TLD-shaped label, so a relative
 *     in-repo path (`assets/app.css`, `signup.html`) never matches;
 *   - a bare host only counts WITH A PATH (`/`), so a dotted identifier such as
 *     `location.href` (inside `URL(location.href)`) never matches;
 *   - relative `url(assets/font.woff2)` is deliberately NOT external.
 *
 * Deliberately NOT matched: the `URL` constructor, `location.href` used as a
 * base, `@import` without a URL, `<img>` with a relative in-repo asset, and the
 * bare words `cdn`/`CDN` in prose or a comment (a CDN host is caught by the URL
 * shapes above, not by the word).
 */
const ABSOLUTE_OR_PROTOCOL_RELATIVE = String.raw`(?:https?:)?//(?:[a-z0-9-]+\.)+[a-z]{2,}`;
/** A bare external host: dot-separated labels, a TLD-shaped last label, then a path. */
const BARE_EXTERNAL_HOST_WITH_PATH = String.raw`[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/[^\s"')>]*`;

const EXTERNAL_URL_VALUE = String.raw`(?:"|')?(?:${ABSOLUTE_OR_PROTOCOL_RELATIVE}|${BARE_EXTERNAL_HOST_WITH_PATH})`;

const EXTERNAL_PATTERNS = [
  // 1. An href/src/srcset/poster attribute pointing at a foreign resource.
  new RegExp(String.raw`\b(?:href|src|srcset|data-src|poster)\s*=\s*${EXTERNAL_URL_VALUE}`, 'i'),
  // 2. A CSS url(...) whose target is a foreign resource. Case-insensitive for
  //    CSS's own `URL(...)`, which is why the VALUE test must be strict: the JS
  //    `URL(location.href)` call has no scheme, no protocol-relative host and no
  //    host-with-path, so it cannot match here.
  new RegExp(String.raw`\burl\(\s*${EXTERNAL_URL_VALUE}`, 'i'),
  // 3. A bare absolute or protocol-relative URL (import, fetch, redirect, ...).
  new RegExp(ABSOLUTE_OR_PROTOCOL_RELATIVE, 'i'),
];

const uiFiles = [
  ...PAGE_FILES.map((file) => join(WEB_DIR, file)),
  join(WEB_DIR, 'assets/app.css'),
  join(WEB_DIR, 'assets/app.js'),
  join(WEB_DIR, 'assets/i18n.js'),
];

const externalHits = [];
for (const file of uiFiles) {
  const content = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  for (const pattern of EXTERNAL_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      externalHits.push({
        file: file.slice(REPO_DIR.length + 1),
        pattern: pattern.source,
        hit: match[0],
      });
    }
  }
}

record(
  'no-external-or-stock-photo-references',
  externalHits.length === 0,
  `files_checked=${uiFiles.length} external_hits=${externalHits.length}` +
    (externalHits.length > 0 ? ` violations=${JSON.stringify(externalHits)}` : '')
);

// --------------------------------------------------- not-implemented list check --

/**
 * The not-implemented capability list, as an explicit id -> dictionary key map.
 * The mapping is written out rather than derived from the id, because a derived
 * key (`opentelemetry` -> `landing.notimpl.opentelemetry`) silently produced a
 * false negative when checked against these very keys — a checker that guesses
 * keys cannot be trusted to report on them.
 */
const NOT_IMPLEMENTED_ENTRIES = [
  { id: 'opentelemetry-exporter', key: 'landing.notimpl.otel' },
  { id: 'line-webhook-verifier', key: 'landing.notimpl.line' },
  { id: 'github-webhook-verifier', key: 'landing.notimpl.github' },
  { id: 'real-supabase-auth', key: 'landing.notimpl.supabase' },
  { id: 'production-deployment', key: 'landing.notimpl.deploy' },
  { id: 'demo-identity-is-not-authentication', key: 'landing.notimpl.demo' },
];

const landingReport = pageReports.find((report) => report.file === 'index.html');
const listStart = landingReport.html.indexOf('data-role="not-implemented-list"');
const landingList = landingReport.html.slice(listStart, landingReport.html.indexOf('</ul>', listStart));

const missingIds = NOT_IMPLEMENTED_ENTRIES.filter(
  (entry) => !landingList.includes(`data-not-implemented="${entry.id}"`)
).map((entry) => entry.id);

const missingKeys = NOT_IMPLEMENTED_ENTRIES.filter(
  (entry) =>
    !landingList.includes(`data-i18n="${entry.key}"`) ||
    LOCALES.some((locale) => !Object.prototype.hasOwnProperty.call(DICT[locale], entry.key))
).map((entry) => entry.key);

record(
  'not-implemented-list-present-on-landing',
  missingIds.length === 0 && missingKeys.length === 0,
  `entries=${NOT_IMPLEMENTED_ENTRIES.length} listed_on_landing=${
    NOT_IMPLEMENTED_ENTRIES.length - missingIds.length
  }/${NOT_IMPLEMENTED_ENTRIES.length} missing_ids=[${missingIds.join(',')}] ` +
    `missing_or_unreferenced_dictionary_keys=[${missingKeys.join(',')}] locales_covered=${LOCALES.join(',')}`
);

// ------------------------------------------------------------------------ info --

const usedKeys = new Set();
for (const report of pageReports) {
  for (const key of report.referencedKeys) usedKeys.add(key);
  for (const match of report.html.matchAll(PLACEHOLDER)) usedKeys.add(match[1]);
}
for (const match of scriptSource.matchAll(/\b(?:tr|t|tFormat)\('([A-Za-z0-9._-]+)'/g)) {
  usedKeys.add(match[1]);
}
const dynamicKeyPrefixes = ['plan.free.display', 'plan.pro.display'];
for (const key of dynamicKeyPrefixes) usedKeys.add(key);

const unusedKeys = keySets.en.filter((key) => !usedKeys.has(key));
info(
  `dictionary keys=${keySets.en.length} referenced_by_pages_or_script=${usedKeys.size} ` +
    `not_referenced_statically=[${unusedKeys.join(',')}] (informational only: these are keys the ` +
    `server shell or a future screen may use; the checker does not fail on them)`
);

// --------------------------------------------------------------------- summary --

const failures = results.filter((result) => !result.passed);
console.log(
  `SUMMARY checks=${results.length} passed=${results.length - failures.length} failed=${failures.length} ` +
    `default_locale=${DEFAULT_LOCALE} locales=${LOCALES.join(',')}` +
    (failures.length > 0 ? ` failed_names=[${failures.map((f) => f.name).join(',')}]` : '')
);

if (failures.length > 0) process.exitCode = 1;
