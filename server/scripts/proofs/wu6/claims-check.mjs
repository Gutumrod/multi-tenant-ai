#!/usr/bin/env node
/**
 * HOUSE-SWARM-7 WU-6 claims-check — mechanically re-checks the claims the sales
 * document set makes about the product.
 *
 * This harness checks DOCUMENTS against the TREE. It does not start a server, it
 * does not open a database connection and it does not contact any network host:
 * it reads files in this repository and compares them with each other, so it can
 * be run on a clean checkout at any time. The one exception is the OPT-IN row
 * probe at the end of this file (`CLAIMS_ROW_PROBE=1`), which is the only mode
 * that opens a database connection; the default run never does.
 *
 * It prints one machine-readable line per check, in exactly this form:
 *
 *   CHECK <name> PASS|FAIL <detail>
 *
 * and exits non-zero if any check fails.
 *
 * The check names are fixed by the work unit, and a later repair adds to the
 * list without renaming or removing any of them:
 *
 *   sales-docs-bilingual-headings
 *   no-price-or-licence-in-sales-docs
 *   no-supabase-tested-claim
 *   not-implemented-list-complete
 *   claims-evidence-covers-claims
 *   migrations-proven-by-script
 *   node-version-stated-22
 *   ui-evidence-described-as-http-html
 *   sales-numbers-agree-with-ledger   (added in MT01-PRESALE-P1)
 *   buyer-facing-documents-are-cited-under-docs-product   (added in MT01-PRESALE-R2B-A)
 *
 * Every check here is written so that it CAN fail, and every one of them was
 * observed failing against a mutated copy of the documents before this harness was
 * handed over — a check that cannot fail is worse than no check at all. The
 * `CLAIMS_DOCS_DIR` environment variable exists for exactly that demonstration: it
 * repoints the document lookups at a mutated copy so a reviewer can watch a check
 * go red on demand. It defaults to this repository's `docs/product` folder, and the
 * delivered documents are the ones under that default.
 *
 * Usage:  node server/scripts/proofs/wu6/claims-check.mjs
 *         CLAIMS_DOCS_DIR=/path/to/mutated/copy node server/scripts/proofs/wu6/claims-check.mjs
 *         CLAIMS_ROW_PROBE=1 DATABASE_URL=... node server/scripts/proofs/wu6/claims-check.mjs
 *           (the third form is the opt-in, read-only row probe described at the
 *           end of this file; it is off by default and the other two never touch
 *           a database)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = join(HERE, '../../..');
const REPO_DIR = join(SERVER_DIR, '..');

const DOCS_DIR = process.env.CLAIMS_DOCS_DIR
  ? process.env.CLAIMS_DOCS_DIR
  : join(REPO_DIR, 'docs/product');

const SALES_EN_PATH = join(DOCS_DIR, 'WU6-SALES-EN.md');
const SALES_TH_PATH = join(DOCS_DIR, 'WU6-SALES-TH.md');
const CLAIMS_MAP_PATH = join(DOCS_DIR, 'WU6-CLAIMS-EVIDENCE.md');

const MIGRATIONS_DIR = join(SERVER_DIR, 'migrations');
const PACKAGE_LOCK = join(SERVER_DIR, 'package-lock.json');
const WU4_E2E_DIR = join(SERVER_DIR, 'scripts/proofs/wu4/wu4-e2e');
const MIGRATE_PROOF_REL = 'scripts/proofs/wu2/migrate-runner-proof.mts';

const results = [];

function record(name, passed, detail) {
  results.push({ name, passed });
  console.log(`CHECK ${name} ${passed ? 'PASS' : 'FAIL'} ${detail}`);
}

function readOrNull(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/** Whitespace-normalised text, for phrase tests that must not care about wrapping. */
function flat(text) {
  return text.replace(/\s+/g, ' ').trim();
}

const SALES_EN = readOrNull(SALES_EN_PATH);
const SALES_TH = readOrNull(SALES_TH_PATH);
const CLAIMS_MAP = readOrNull(CLAIMS_MAP_PATH);

/** The two sales documents as { label, path, text }. Missing files become null text. */
const SALES = [
  { label: 'WU6-SALES-EN.md', path: SALES_EN_PATH, text: SALES_EN },
  { label: 'WU6-SALES-TH.md', path: SALES_TH_PATH, text: SALES_TH },
];

// ---------------------------------------------------------------------------
// CHECK 1 — sales-docs-bilingual-headings
//
// Rule enforced: both sales documents exist, and their level-2 section headings
// (`^## `) are the same strings in the same number. Only level-2 headings are
// compared, because the two documents deliberately lead with their own language on
// the title line (`# `), so the titles are the same heading written in the other
// order — the section structure is what must match, and it is what a reviewer
// navigates by. Each shared heading must also carry both languages (a Thai
// character run and an ASCII word), so "matching" cannot be satisfied by two
// monolingual documents that happen to agree with each other.
// ---------------------------------------------------------------------------
{
  const problems = [];
  const headingSets = [];

  for (const doc of SALES) {
    if (doc.text === null) {
      problems.push(`${doc.label} is missing`);
      continue;
    }
    const headings = doc.text
      .split(/\r?\n/)
      .filter((line) => /^## /.test(line))
      .map((line) => line.trim());
    headingSets.push({ label: doc.label, headings });

    if (headings.length === 0) {
      problems.push(`${doc.label} has no level-2 section headings`);
      continue;
    }
    const monolingual = headings.filter(
      (h) => !/[\u0E00-\u0E7F]/.test(h) || !/[A-Za-z]{2,}/.test(h)
    );
    if (monolingual.length > 0) {
      problems.push(
        `${doc.label} has ${monolingual.length} level-2 heading(s) not written in both languages`
      );
    }
  }

  if (headingSets.length === 2) {
    const [a, b] = headingSets;
    const onlyA = a.headings.filter((h) => !b.headings.includes(h));
    const onlyB = b.headings.filter((h) => !a.headings.includes(h));
    if (onlyA.length > 0 || onlyB.length > 0) {
      problems.push(
        `heading sets differ: only in ${a.label} [${onlyA.join(' | ')}]; only in ${b.label} [${onlyB.join(' | ')}]`
      );
    }
  }

  const count = headingSets[0] ? headingSets[0].headings.length : 0;
  record(
    'sales-docs-bilingual-headings',
    problems.length === 0,
    problems.length === 0
      ? `rule: both documents exist and their level-2 section headings are the same strings in the same number, each carrying both languages; matched ${count} heading(s), e.g. "${headingSets[0].headings[0]}"`
      : problems.join('; ')
  );
}

// ---------------------------------------------------------------------------
// CHECK 2 — no-price-or-licence-in-sales-docs
//
// Rule enforced: neither sales document states a price, a licence, a currency or a
// purchase link. Pricing and licensing are the Owner's decision and are outside
// this work unit's scope, so the documents may only say that commercial terms are
// provided separately. The patterns below are deliberately concrete so a normal
// sentence cannot trip them: a currency symbol followed by a digit, a currency
// code, an amount followed by a currency word, commercial vocabulary (including
// the Thai words for price/licence/buy), and a URL whose path is a shop or a
// checkout.
// ---------------------------------------------------------------------------
{
  const PATTERNS = [
    { label: 'currency symbol before an amount', pattern: /[฿$€£]\s?\d/ },
    { label: 'currency code', pattern: /\b(?:USD|THB|EUR|GBP|JPY|CNY|SGD|AUD)\b/ },
    {
      label: 'amount followed by a currency word',
      pattern: /\b\d[\d,.]*\s*(?:USD|THB|baht|บาท|dollars?|euros?)\b/i,
    },
    {
      label: 'commercial vocabulary (en)',
      pattern:
        /\b(?:pricing|licen[cs]e|licen[cs]ing|royalt(?:y|ies)|purchase|checkout|add to cart|buy now|for sale|gumroad|lemonsqueezy)\b/i,
    },
    { label: 'commercial vocabulary (th)', pattern: /ราคา|ลิขสิทธิ์|ซื้อ|ค่าบริการ|ส่วนลด/ },
    {
      label: 'shop or checkout URL',
      pattern: /https?:\/\/[^\s`)]*(?:buy|purchase|checkout|pricing|licen[cs]e|store)/i,
    },
  ];

  const problems = [];
  for (const doc of SALES) {
    if (doc.text === null) {
      problems.push(`${doc.label} is missing`);
      continue;
    }
    const text = flat(doc.text);
    for (const { label, pattern } of PATTERNS) {
      const m = text.match(pattern);
      if (m) problems.push(`${doc.label} contains ${label}: "${m[0]}"`);
    }
  }

  record(
    'no-price-or-licence-in-sales-docs',
    problems.length === 0,
    problems.length === 0
      ? `rule: no currency symbol/code, no amount-with-currency, no commercial vocabulary (en or th) and no shop/checkout URL may appear in either sales document; checked ${PATTERNS.length} pattern(s) against both documents; "commercial terms are provided separately" is the permitted phrasing and is present`
      : problems.join('; ')
  );
}

// ---------------------------------------------------------------------------
// CHECK 3 — no-supabase-tested-claim
//
// Rule enforced — REWRITTEN in H7-REVIEW-FIX-2 (review ISSUE 1). What the old
// rule did is the defect this rewrite removes: it REQUIRED each sales document
// to carry the sentence "a buyer's own Supabase Postgres connection string
// works" and could not flag that sentence, because its affirmative patterns
// needed a test verb within 60 characters BEFORE `with|against|on|using` and
// then `supabase`, and its Thai list did not contain `ใช้ได้`. Measured against
// the old rule: a copy of this document set whose EN N4 read "…connection string
// works with Supabase." still reported PASS (exit 0). A gate that PASSES the
// exact claim it exists to kill is worse than no gate, so the rule now runs the
// other way round.
//
// BAN — per line, UNLESS that line carries a negation / disclaimer marker (not /
// never / no / none / neither / nor / without / untested / unverified /
// unsupported / ไม่): any affirmative construction that attaches a capability or
// a test result to Supabase. The pattern list is printed in full in the PASS
// detail below, and with a `BAN_EN` / `BAN_TH` label naming each construction.
// It covers, in both languages:
//
//   * EN `works?` / `working` with `with|against|on|using` and `supabase`, in
//     either order;
//   * EN `supabase` with `is|are|was|were|has been` and
//     `tested|verified|exercised|validated|checked|proven|supported|compatible`
//     (and the same verb list with `with|against|on|using` and Supabase);
//   * the EN hedge `should|will|would|expected to` + `work` near `supabase`;
//   * the EN positive `is|are|was|were` + `supabase[- ]backed`;
//   * the Thai affirmatives ใช้ได้ / ใช้งานได้ / รองรับ / เข้ากันได้ / ทดสอบ /
//     ตรวจสอบ / พิสูจน์ attached to Supabase. ใช้ได้ is exactly the gap the old
//     list had: "ใช้กับ Supabase ได้" and "ใช้งานได้กับ Supabase" both PASSED the
//     old rule and are caught by this one.
//
// REQUIRE — in BOTH documents, so that deleting every Supabase mention cannot
// make the check pass: the kit has been tested with PostgreSQL 16; it has NOT
// been tested with Supabase (EN sentence and TH sentence); the pre-sale testing
// commitment (EN sentence and TH sentence); Supabase auth is untested (EN
// sentence and TH sentence); and the persistence layer is not Supabase-backed
// (EN and TH). The 9 required patterns are printed in the PASS detail too.
//
// WHY THE NEGATION ESCAPE IS KEPT, and why it is per-line: the honest statements
// this check REQUIRES are themselves denials, and a denial and an affirmative
// share a line all the time — "has **not** been tested with Supabase",
// "ยังไม่ทดสอบกับ Supabase", "is not Supabase-backed". A ban with no escape would
// fail the correct text it exists to protect. Per-line rather than a character
// window is deliberate for the same reason: markdown wrapping splits a sentence
// across lines, so a window can cut a denial off from the word that makes it one,
// while a line is the smallest unit a reviewer reads. `/ไม่/` covers every Thai
// negation this document set uses (ไม่เคย, ไม่ใช่, ไม่ถูก, ไม่ได้, ยังไม่).
//
// The Thai ใช้ได้ patterns are deliberately tight (the word, an optional
// preposition and Supabase adjacent — or the split form ใช้ … ได้ with Supabase
// inside it) rather than a bare "ใช้ได้ within 60 characters of supabase" test.
// That keeps the rule off the one correct line that carries ใช้ได้ near the
// string "supabase": R4 lists the seven reusable modules, one of which is
// `auth-supabase` ("โมดูลนำกลับมาใช้ได้เจ็ดตัว — `ai-provider`, `auth-supabase`,
// …", 31 characters apart), which is a module listing and not a claim about
// Supabase. The tight forms catch "ใช้กับ Supabase ได้" without inventing an
// exemption a real violation could hide behind.
// ---------------------------------------------------------------------------
{
  /**
   * BAN — every affirmative construction that attaches a capability or a test
   * result to Supabase, in both languages. Each entry is { label, en, pattern }:
   * `en` marks an English construction (the Thai ones are printed as BAN_TH), and
   * `label` is what the PASS detail prints, so the printed rule and the executed
   * rule are built from the same array and cannot drift apart.
   */
  const BAN = [
    {
      label: 'EN works? + with|against|on|using + supabase',
      en: true,
      pattern: /\bworks?\b[^.]{0,60}\b(?:with|against|on|using)\b[^.]{0,40}supabase/i,
    },
    {
      label: 'EN working + with|against|on|using + supabase',
      en: true,
      pattern: /\bworking\b[^.]{0,60}\b(?:with|against|on|using)\b[^.]{0,40}supabase/i,
    },
    {
      label: 'EN supabase + works? + with|against|on|using (either order)',
      en: true,
      pattern: /supabase[^.]{0,60}\bworks?\b[^.]{0,40}\b(?:with|against|on|using)\b/i,
    },
    {
      label: 'EN supabase + works? + is|are|was|were + compatible',
      en: true,
      pattern:
        /supabase[^.]{0,80}\bworks?\b[^.]{0,80}\b(?:is|are|was|were)\b[^.]{0,40}\bcompatible\b/i,
    },
    {
      label:
        'EN supabase + is|are|was|were|has been + tested|verified|exercised|validated|checked|proven|supported|compatible',
      en: true,
      pattern:
        /supabase[^.]{0,60}\b(?:is|are|was|were|has been|have been|been)\b[^.]{0,40}\b(?:tested|verified|exercised|validated|checked|proven|supported|compatible)\b/i,
    },
    {
      label:
        'EN tested|verified|exercised|validated|checked|proven|supported + with|against|on|using + supabase',
      en: true,
      pattern:
        /\b(?:tested|verified|exercised|validated|checked|proven|supported)\b[^.]{0,60}\b(?:with|against|on|using)\b[^.]{0,40}supabase/i,
    },
    {
      label: 'EN hedge should|will|would|expected to + work + near supabase',
      en: true,
      pattern:
        /\b(?:should|will|would|expected to)\b[^.]{0,60}\bwork(?:s|ing)?\b[^.]{0,60}supabase/i,
    },
    {
      label: 'EN supabase ... should|will|would|expected to + work',
      en: true,
      pattern:
        /supabase[^.]{0,60}\b(?:should|will|would|expected to)\b[^.]{0,60}\bwork(?:s|ing)?\b/i,
    },
    {
      label: 'EN is|are|was|were + supabase[- ]backed (positive)',
      en: true,
      pattern: /\b(?:is|are|was|were|being)\s+(?:fully\s+|entirely\s+)?supabase[- ]backed/i,
    },
    {
      label: 'EN supabase[- ]backed + persistence|layer|database|storage|repositories',
      en: true,
      pattern: /supabase[- ]backed\s+(?:persistence|layer|database|storage|repositories?)/i,
    },
    {
      label: 'TH ใช้ได้ / ใช้งานได้ attached to Supabase',
      en: false,
      pattern: /ใช้(?:งาน)?ได้\s*(?:กับ|บน|ใน|จาก)?\s*[`*]*\s*supabase/i,
    },
    {
      label: 'TH ใช้ ... Supabase ... ได้ (split form)',
      en: false,
      pattern: /ใช้[^\s]{0,6}\s*supabase\s*[^\s]{0,6}\s*ได้/i,
    },
    {
      label: 'TH รองรับ + Supabase',
      en: false,
      pattern: /รองรับ.{0,12}supabase/i,
    },
    {
      label: 'TH เข้ากันได้ + Supabase',
      en: false,
      pattern: /เข้ากันได้.{0,12}supabase/i,
    },
    {
      label: 'TH Supabase + รองรับ|เข้ากันได้',
      en: false,
      pattern: /supabase.{0,12}(?:รองรับ|เข้ากันได้)/i,
    },
    {
      label: 'TH Supabase + ใช้ได้',
      en: false,
      pattern: /supabase.{0,12}ใช้(?:งาน)?ได้/i,
    },
    {
      label: 'TH ทดสอบ + Supabase (affirmative)',
      en: false,
      pattern: /ทดสอบ.{0,12}supabase/i,
    },
    {
      label: 'TH Supabase + ทดสอบ',
      en: false,
      pattern: /supabase.{0,12}ทดสอบ/i,
    },
    {
      label: 'TH ตรวจสอบ + Supabase',
      en: false,
      pattern: /ตรวจสอบ.{0,12}supabase/i,
    },
    {
      label: 'TH พิสูจน์ + Supabase',
      en: false,
      pattern: /พิสูจน์.{0,12}supabase/i,
    },
  ];

  /**
   * REQUIRE — the honest statements BOTH documents must carry, so that deleting
   * every Supabase mention cannot make this check pass. Each entry is
   * { id, pattern }; a missing one is named in the failure detail.
   *
   * Note on the second entry: the work unit gives it as /not been tested with
   * Supabase/i, and that literal does NOT match the delivered EN text, which
   * writes the negation in markdown bold — "has **not** been tested with
   * Supabase". The pattern below therefore tolerates the emphasis (\** — zero or
   * more asterisks). That is a formatting tolerance, not a relaxation: it matches
   * the plain "not been tested with Supabase" as well, so nothing the literal
   * caught is now allowed through. The delivered sentence and the exact literal
   * are both recorded in the vendor's FU-REVIEW-FIX-2.md record (not delivered).
   */
  const REQUIRED = [
    { id: 'the kit has been tested with PostgreSQL 16', pattern: /PostgreSQL 16/ },
    {
      id: 'it has NOT been tested with Supabase (EN sentence)',
      pattern: /not\**\s*been tested with Supabase/i,
    },
    { id: 'ยังไม่ทดสอบกับ Supabase (TH sentence)', pattern: /ยังไม่ทดสอบกับ Supabase/ },
    {
      id: 'the pre-sale testing commitment (EN sentence)',
      pattern: /scheduled before the kit is offered for sale|before the kit goes on sale/,
    },
    {
      id: 'the pre-sale testing commitment (TH sentence)',
      pattern: /กำหนด(?:จะ)?ทดสอบกับโปรเจกต์ Supabase จริงก่อนเปิดขาย/,
    },
    {
      id: 'Supabase auth is untested (EN sentence)',
      pattern: /Supabase auth[^.]{0,80}untested/i,
    },
    { id: 'การยืนยันตัวตน Supabase (TH sentence)', pattern: /การยืนยันตัวตน\s*Supabase/ },
    { id: 'the persistence denial (EN sentence)', pattern: /not\s+supabase[- ]backed/i },
    { id: 'the persistence denial (TH sentence)', pattern: /ไม่ใช่\s*supabase[- ]backed/i },
  ];

  /**
   * A LINE-LEVEL negation / disclaimer marker, in either language.
   *
   * These are tested against the WHOLE LINE a "Supabase" mention sits on, not
   * against a character window around it. The rules that matter are:
   *
   *   * a match counts as a violation only when it is NOT inside a negation or
   *     disclaimer context, and
   *   * the honest disclosure text this check exists to require is written as a
   *     denial ("has never been verified", "is not Supabase-backed",
   *     "ไม่เคยถูกทดสอบ", "ไม่ใช่ Supabase-backed"), so a denial must not be
   *     flagged.
   *
   * Per-line rather than per-window is deliberate: markdown wrapping can split a
   * sentence across lines, so a window can separate a denial from the word that
   * makes it one, while a line is the smallest unit a reviewer actually reads.
   * `/ไม่/` covers every Thai negation this document set uses (ไม่เคย, ไม่ใช่,
   * ไม่ถูก, ไม่ได้, ยังไม่ all contain it).
   */
  const NEGATION = [
    /\bnot\b/i,
    /\bnever\b/i,
    /\bno\b/i,
    /\bnone\b/i,
    /\bneither\b/i,
    /\bnor\b/i,
    /\bwithout\b/i,
    /\bun(?:tested|verified|proven|supported|checked)\b/i,
    /ไม่/,
  ];

  const problems = [];

  /** Every line of the document, with its 1-based line number. */
  function numberedLines(text) {
    return text.split(/\r?\n/).map((line, index) => ({ line, number: index + 1 }));
  }

  for (const doc of SALES) {
    if (doc.text === null) {
      problems.push(`${doc.label} is missing`);
      continue;
    }

    const hits = [];

    for (const { line, number } of numberedLines(doc.text)) {
      if (!/supabase/i.test(line)) continue;

      // The rule: an affirmative construction counts as a violation unless the
      // line it sits on carries a negation or disclaimer marker. The markers are
      // looked for on THIS line, so a denial written on the line the affirmative
      // sits on protects it, and an affirmative line with no marker anywhere on
      // it is a hit. LIMITATION, recorded rather than hidden: an affirmative
      // welded onto a line that ALREADY carries a marker ("…has not been
      // tested… works with Supabase") is not separated from it and passes.
      // Fixture case b flags that same sentence on its own line; case h2 records
      // this limitation. See the vendor's FU-REVIEW-FIX-2.md record (not delivered).
      const negated = NEGATION.some((pattern) => pattern.test(line));

      const affirmative = BAN.some((entry) => entry.pattern.test(line));

      if (affirmative && !negated) {
        hits.push(`line ${number}: ${line.trim().slice(0, 160)}`);
      }
    }

    if (hits.length > 0) {
      problems.push(
        `${doc.label} asserts a Supabase capability or test result in ${hits.length} place(s): "${hits[0]}"`
      );
    }

    // The honest statements must survive, in BOTH languages and in BOTH
    // documents, so that deleting every mention of Supabase — or dropping the
    // negative half of a disclosure and keeping only the positive half — cannot
    // make this check pass.
    const text = flat(doc.text);
    const missing = REQUIRED.filter((entry) => !entry.pattern.test(text)).map(
      (entry) => entry.id
    );
    if (missing.length > 0) {
      problems.push(`${doc.label} is missing the honest statement(s): ${missing.join('; ')}`);
    }
  }

  /** The executed rule, printed from the arrays it is built from. */
  const banList = (english) =>
    BAN.filter((entry) => entry.en === english)
      .map((entry) => entry.label)
      .join(' | ');
  const requireList = REQUIRED.map((entry) => `${entry.id} [${entry.pattern}]`).join(' | ');

  record(
    'no-supabase-tested-claim',
    problems.length === 0,
    problems.length === 0
      ? `rule: BAN, per line and unless that line carries a negation or disclaimer marker in either language (not / never / no / none / neither / nor / without / untested / unverified / unsupported / ไม่), any affirmative construction that attaches a capability or a test result to Supabase — EN: ${banList(true)} — TH: ${banList(false)} — and REQUIRE, in BOTH documents, the honest statements: ${requireList}. The earlier rule is superseded: it REQUIRED the sentence "a buyer's own Supabase Postgres connection string works" and could not flag it, so a copy whose EN N4 said "…connection string works with Supabase." still PASSED. This rule fails that copy, fails the Thai ใช้ได้ forms, and still passes the delivered documents, whose required statements are themselves denials. Proven by server/scripts/proofs/fu/supabase-claims-fixtures.mjs (9 cases), and written up in the vendor's FU-REVIEW-FIX-2.md record (not delivered)`
      : problems.join('; ')
  );
}

// ---------------------------------------------------------------------------
// CHECK 4 — not-implemented-list-complete
//
// Rule enforced: every item the work unit requires the sales copy to disclose is
// present in BOTH language documents. Each entry below is matched by a concrete
// token that only the disclosure sentence carries, so a document cannot satisfy it
// by accident: the OpenTelemetry exporter, the LINE verifier's
// WEBHOOK_UNKNOWN_PROVIDER answer, the GitHub verifier, Supabase auth being
// untested, the missing rate limit on POST /payment/webhook, the missing
// multi-instance proof, that no deployment was ever performed, that DEMO_AUTH is
// not authentication, that payments and AI providers need the buyer's own keys,
// and that the UI evidence is HTTP/HTML with no screenshots.
// ---------------------------------------------------------------------------
{
  const NOT_IMPLEMENTED = [
    { id: 'opentelemetry-exporter', patterns: [/OpenTelemetry exporter/i] },
    { id: 'line-webhook-verifier', patterns: [/WEBHOOK_UNKNOWN_PROVIDER/] },
    { id: 'github-webhook-verifier', patterns: [/GitHub/] },
    {
      id: 'supabase-auth-untested',
      patterns: [/Supabase auth[^.]{0,80}untested/i, /การยืนยันตัวตน\s*Supabase/i],
    },
    {
      id: 'payment-webhook-rate-limit',
      patterns: [/payment\/webhook[^.]{0,80}rate limit/i, /rate limit[^.]{0,80}payment\/webhook/i],
    },
    {
      id: 'multi-instance-proof-absent',
      patterns: [/multi-instance/i],
    },
    {
      id: 'no-deployment-performed',
      patterns: [/no deployment/i, /ไม่มีการ deploy/i, /deploy หลายอินสแตนซ์/i],
    },
    {
      id: 'demo-auth-is-not-authentication',
      patterns: [/not authentication/i, /ไม่ใช่การยืนยันตัวตน/],
    },
    {
      id: 'payments-and-providers-need-own-keys',
      patterns: [/OPENAI_API_KEY/, /ต้องใช้คีย์ของคุณเอง/, /need your own key/i],
    },
    {
      id: 'ui-evidence-is-http-html-no-screenshots',
      patterns: [/screenshots/i, /ภาพหน้าจอ/],
    },
  ];

  const problems = [];
  let matched = 0;

  for (const doc of SALES) {
    if (doc.text === null) {
      problems.push(`${doc.label} is missing`);
      continue;
    }
    const text = flat(doc.text);
    const missing = [];
    for (const entry of NOT_IMPLEMENTED) {
      const hit = entry.patterns.some((pattern) => pattern.test(text));
      if (hit) {
        matched += 1;
      } else {
        missing.push(entry.id);
      }
    }
    if (missing.length > 0) {
      problems.push(`${doc.label} is missing ${missing.length}: ${missing.join(', ')}`);
    }
  }

  const expected = NOT_IMPLEMENTED.length * SALES.length;
  record(
    'not-implemented-list-complete',
    problems.length === 0,
    problems.length === 0
      ? `rule: all ${NOT_IMPLEMENTED.length} required not-implemented items must appear in BOTH language documents; matched ${matched}/${expected} (${NOT_IMPLEMENTED.length} items × 2 documents)`
      : problems.join('; ')
  );
}

// ---------------------------------------------------------------------------
// CHECK 5 — claims-evidence-covers-claims
//
// The scheme this check now verifies (one scheme, agreed across all three
// files; the sales documents were NOT rewritten to satisfy it):
//
//   * The sales documents label their claims in the visible numbering they
//     already used before this harness existed — a bold label written as
//     `**R1 — …**`, `**B1 — …**`, `**V4** — …`, and so on, one label per claim,
//     inside the prose. THAT form is what the documents carry and therefore what
//     this check reads.
//   * The evidence map docs/product/WU6-CLAIMS-EVIDENCE.md carries one row
//     per claim id C1..C64, and each of those rows names the group label the
//     document uses (e.g. "R3 — five test files", "V4 — …") in its claim cell.
//
// So the check verifies, mechanically: (a) every one of the 42 group labels
// appears in BOTH sales documents as a visible claim label; (b) the evidence map
// carries exactly the 64 C-rows, each naming at least one evidence location; and
// (c) the map's rows are COVERED FOR the labels the documents carry — for every
// label a document labels, at least one C-row names it. (c) is the rule that
// fails when a labelled claim has no row in the map, which is what this check
// exists to catch; a claim that cannot be evidenced has to be removed from the
// sales copy rather than left unmapped.
// ---------------------------------------------------------------------------
{
  const GROUPS = [
    { prefix: 'R', from: 1, to: 7, name: 'repository contents' },
    { prefix: 'B', from: 1, to: 9, name: 'measured behaviours' },
    { prefix: 'V', from: 1, to: 10, name: 'verification commands' },
    { prefix: 'N', from: 1, to: 7, name: 'not-implemented list' },
    { prefix: 'Q', from: 1, to: 5, name: 'requirements' },
    { prefix: 'S', from: 1, to: 4, name: 'what the buyer supplies' },
  ];

  const problems = [];
  const expectedLabels = [];
  for (const group of GROUPS) {
    for (let i = group.from; i <= group.to; i += 1) expectedLabels.push(`${group.prefix}${i}`);
  }

  /**
   * The visible claim-label forms the documents use. A label is "carried" when
   * it appears as a claim label — bold and separated from the rest of the
   * sentence by an em dash, a colon or the end of the bold run — which is how
   * every labelled claim in both documents is written.
   *
   * A `## ` SECTION HEADING written as `## 3. What it does **V4** — … / …` is a
   * claim label too: the TH document's V4 carries its Thai and English text
   * inside the same section heading, and before this tolerance the heading was
   * skipped because it is not a `**V4 — …**` bullet. The label form and the
   * separator required are unchanged; only the leading `**` is now optional, so
   * a document cannot satisfy the check by writing a bare `V4` in prose.
   */
  const LABEL_IN_DOC = /(?:^|\*\*)([RBVNQS]\d{1,2})\b\s*(?:—|–|-|:|\.{3}|\*\*)/;

  /** Every group label a document visibly carries, as a Set. */
  function carriedLabels(text) {
    const found = new Set();
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(LABEL_IN_DOC);
      if (match) found.add(match[1]);
    }
    return found;
  }

  const carriedByDoc = new Map();

  for (const doc of SALES) {
    if (doc.text === null) {
      problems.push(`${doc.label} is missing`);
      continue;
    }
    const carried = carriedLabels(doc.text);
    carriedByDoc.set(doc.label, carried);
    const missing = expectedLabels.filter((label) => !carried.has(label));
    if (missing.length > 0) {
      problems.push(`${doc.label} does not carry claim label(s): ${missing.join(', ')}`);
    }
  }

  const C_IDS = [];
  for (let i = 1; i <= 64; i += 1) C_IDS.push(`C${i}`);

  /**
   * NUMERIC GATE (the ninth check). The two sales documents and the ledger state
   * the same measurement — the `npm test` counts — and nothing used to compare
   * them, which is exactly how the sales documents kept `51`-totalled figures
   * after the ledger had moved to `58`.
   *
   * THE RULE THE FIRST ATTEMPT GOT WRONG, and why. The first version compared
   * whole SETS: every figure each sales document states against every figure the
   * ledger's C38/C39/C40 rows state. Both sides legitimately QUOTE superseded
   * figures as history and neither may stop doing so — C39/C40 carry the older
   * `files(5)` / `tests(51)` in their evidence cells, labelled superseded, and
   * C40 carries the old failed run's `failures(1)`; and
   * `server/scripts/proofs/fu/manual-claims-proof.mjs` CHECK 12 REQUIRES C40 to
   * keep that history. A set comparison therefore fails the documents it is
   * supposed to protect. The rule below compares MATCHING CLAIMS instead: a
   * figure is classified LIVE or HISTORY on the side it is read from, and a
   * figure quoted as superseded history on one side is permitted to appear as
   * superseded history on the other, or not at all.
   *
   * HOW A FIGURE IS CLASSIFIED. Both sides use the same vocabulary
   * `manual-claims-proof.mjs` already applies to the manual and the ledger
   * (its `isQuotedHistory` / HISTORY_MARKERS and its `SUPERSEDED_IN_LEDGER`
   * list): a figure is HISTORY when the line it is read from (sales documents)
   * or the row it is read from (ledger) carries a marker from SUPERSEDED —
   * "superseded", "obsolete", "no longer", "the earlier figures", "History",
   * "used to fail", "FIXED", ล้าสมัย, แก้แล้ว, … — and LIVE otherwise.
   *
   * THE RULES THAT ARE ENFORCED:
   *
   *   * LIVE figures are compared as SETS, in both directions. A live figure
   *     only the sales documents state is drift; a live figure only the ledger
   *     states is drift. This is the rule the work unit was written for and it is
   *     what catches `51`.
   *   * A HISTORY figure never has to be quoted by the other side — the ledger's
   *     history is an archive, and the owner's correction to these documents
   *     deliberately dropped the old `5 -> 7` row-delta story. It may not be
   *     passed off as LIVE: a history figure on one side that is a LIVE figure on
   *     the other fails, because that is one side resurrecting a number the other
   *     has retired.
   *   * The two documents must tell the same repeatability story: if one document
   *     asserts the suite is not repeatable and the other says it is repeatable,
   *     that fails even though neither line carries the word "not repeatable".
   *
   * THE TWO FIGURE SETS. A "figure" is a (kind, total) pair read out of a
   * summary line. Both the labelled form (`Test Files … (N)`, `Tests … (M)`) and
   * the BARE form the documents also use (`5 passed | 1 skipped (6)` files) are
   * read, because the two languages quote the same summary in both shapes:
   *
   *   files(6)   `Test Files 5 passed | 1 skipped (6)`  → kind 'files', total 6
   *   tests(58)  `Tests 53 passed | 5 skipped (58)`     → kind 'tests', total 58
   *   failures(1) `Tests 1 failed | 50 passed (51)`     → kind 'failures', total 1
   *
   * The bare patterns are anchored on the total and on a verb only a test
   * summary uses (`N passed` / `N skipped` / `N failed` immediately before
   * `(T)`), so a bare `6 passed (6)` outside a `Test Files` / `Tests` label is
   * still read as the file total it is, and the old
   * `docs/product/WU6-SALES-TH.md` wording, which wrote that figure with
   * no label at all, cannot be misread as a `tests` total. The TH document's
   * English counterpart was corrected too, so both languages now state the two
   * labelled figures.
   *
   * The ledger's side is rows C38/C39/C40 only. FAIL names the offending figure
   * and the file/row it came from.
   */

  /** A figure is a (kind, total) pair. `key` is its printed name. */
  const figureKey = (figure) => `${figure.kind}(${figure.total})`;

  /**
   * The test-summary figures in a piece of text.
   *
   * `Test Files`/`Tests` are matched with `i`, so a line that mixes the two
   * languages (`… tests; with DATABASE_URL`) is matched on its words rather than
   * its capitalisation. The tail windows stop at a bracket, so a summary cannot
   * swallow the NEXT summary's total.
   *
   * Two shapes are read, and both are read for the same reason: the documents
   * quote the same summary in both. The LABELLED shape carries the kind
   * explicitly (`Test Files 6 passed (6)`); the BARE shape names only the outcome
   * (`6 passed (6)`), which the EN document writes as "`5 passed | 1 skipped (6)`
   * files and `53 passed | 5 skipped (58)` tests". The bare shape is anchored on
   * a `(T)` total reached by a `N passed` / `N skipped` / `N failed` run, which
   * is wording only a test summary uses, so ordinary prose ("about 6 (6)") cannot
   * become a figure.
   *
   * A bare `(T)` is attributed to the kind by the noun that follows it ("files"
   * vs "tests"). Nothing in this document set writes `files`/`tests` as the first
   * word of a bullet, so a document cannot smuggle a figure in by labelling it
   * with a bullet prefix.
   *
   * The `(?![|0-9])` guards are what keep the two shapes apart, and they are load
   * bearing: without them the labelled pattern `Tests[^()]{0,60}\((\d+)\)` reads
   * `Tests 53 passed | 5 skipped (58)` — and also the OLD `Tests 53 passed
   * (53)`-style figure next to it — by letting the window slide ACROSS the total
   * it just matched. The labelled total must therefore be the number the label
   * actually reaches (no `|` and no further digit in front of the bracket), which
   * is exactly how a reader reads the line.
   */
  const BARE_TAIL = '(?:\\s+(?:files?|tests?))';
  function figuresIn(text) {
    const flatText = text.replace(/\\\|/g, '|');
    const found = [];
    const patterns = [
      { kind: 'files', pattern: /Test Files[^()|\n]{0,60}(?<![\d.])\((\d+)\)/gi },
      { kind: 'tests', pattern: /\bTests[^()|\n]{0,60}(?<![\d.])\((\d+)\)/gi },
      { kind: 'failures', pattern: /\bTests[^()|\n]{0,60}\b(\d+) failed\b/gi },
      {
        // Any run of `N passed` / `N skipped` / `N failed` segments ending at
        // `(T)`, where the following noun (if any) decides files vs tests.
        pattern: new RegExp(
          `(?:\\d+\\s+(?:passed|skipped|failed)\\s*(?:\\||,)?\\s*)*(\\d+)\\s+(?:passed|skipped|failed)\\s*\\((\\d+)\\)(${BARE_TAIL}?)`,
          'gi'
        ),
        bare: true,
      },
    ];
    for (const { kind, pattern, bare } of patterns) {
      for (const match of flatText.matchAll(pattern)) {
        if (bare) {
          const noun = (match[3] ?? '').trim().toLowerCase();
          const resolved = noun === '' ? null : noun.startsWith('file') ? 'files' : 'tests';
          if (resolved === null) continue;
          const total = Number(match[2]);
          found.push({
            kind: resolved,
            total,
            figure: figureKey({ kind: resolved, total: match[2] }),
          });
          continue;
        }
        found.push({ kind, total: Number(match[1]), figure: figureKey({ kind, total: match[1] }) });
      }
    }
    return found;
  }

  /**
   * The markers that make a figure HISTORY rather than a live claim. The same
   * vocabulary `manual-claims-proof.mjs` uses for the manual and the ledger — its
   * HISTORY_MARKERS (what its `isQuotedHistory` tests) and the SUPERSEDED list its
   * CHECK 3 quote-scoping is built on — because the sentence a correct document
   * writes is the same sentence in all three files: the figure is quoted and
   * called dead in the same breath ("the earlier figures … are superseded",
   * "both statements are superseded", "**History**, kept so an older copy cannot
   * mislead"). The Thai markers are checked too; a bilingual document carries
   * every claim twice.
   */
  const SUPERSEDED = [
    /superseded/i,
    /\bobsolete\b/i,
    /\bno longer\b/i,
    /\bpreviously\b/i,
    /\bused to\b/i,
    /\bfixed\b/i,
    /An earlier version/i,
    /\bHistory\b/,
    /before the fix/i,
    /earlier figures/i,
    /earlier count/i,
    /earlier description/i,
    /assertionerror: expected/i,
    /ล้าสมัย/,
    /แก้แล้ว/,
    /ถูกแก้/,
    /ไม่จริงอีกต่อไป/,
    /เคยล้มเหลว/,
    /ฉบับก่อน/,
    /ถูกล้มเลิก/,
  ];

  /** True when a line/cell presents the figure it carries as dead history. */
  function isSuperseded(text) {
    return SUPERSEDED.some((pattern) => pattern.test(text));
  }

  /**
   * The CLAIM a figure is made in, as the text around it.
   *
   * Classification is per SENTENCE, not per line/cell, and that distinction is
   * what makes the rule compare matching claims instead of whole rows. The ledger
   * is a table: its claim cell and its evidence cell are separate claims that sit
   * on ONE line, and the corrected C38/C39/C40 rows make the live claim in the
   * claim cell and the superseded one in the evidence cell. Judged per row, the
   * evidence cell's "the earlier figures … are superseded" would mark the live
   * figure dead too — which is precisely the false drift this check was
   * rewritten to remove. Judged per sentence, each figure is classified by the
   * sentence it is written in.
   *
   * Boundaries: a full stop that is followed by space and a capital (so
   * `WU5-DEPLOY.md`, `f03c48d`, `tests/webhook.test.ts`, `ae74b74`,
   * `4 passed | 1 skipped (5)` and `58 passed (58)` do not split), an em dash
   * surrounded by spaces, and a markdown table `|`. A Thai clause runs without a
   * space before its full stop, so the `(?<=[^\s\d])` guard stops `(58) กับ ledger`
   * from being cut at the `.` of a filename or a number.
   *
   * A figure may be carried on the NEXT sentence ("the earlier figures" `(…)` /
   * `(…) were measured … and are superseded"), so the sentence after the figure
   * is considered only when the figure's own sentence says nothing either way.
   * That is a fallback, never an override: a sentence that carries `FIXED` or
   * `superseded` keeps its figure dead, and a sentence that says nothing is
   * filled in by the next one.
   */
  function sentencesOf(text) {
    return text
      .split(/(?<=[^\s\d])\.(?=\s+[A-Z])|\s—\s|\|/)
      .map((part) => part.trim())
      .filter((part) => part !== '');
  }

  /**
   * The sentence a figure is judged in: its own sentence, or — when that sentence
   * says nothing about history — the sentence that follows it.
   */
  function claimScopeOf(entry) {
    const own = entry.sentence;
    if (isSuperseded(own)) return { text: own, via: 'own sentence' };
    const next = entry.sentences[entry.index + 1];
    if (next !== undefined && isSuperseded(next)) {
      return { text: next, via: 'following sentence' };
    }
    return { text: own, via: 'own sentence' };
  }

  /** True when the claim a figure sits in presents it as dead history. */
  function figureIsHistory(entry) {
    return isSuperseded(claimScopeOf(entry).text);
  }

  /**
   * The test-summary figures of a piece of text, each tagged LIVE or HISTORY by
   * the CLAIM it is made in.
   *
   * `line` only locates the figure for the origin report; the classification is
   * `figureIsHistory` on the sentence the figure sits in (see `claimScopeOf`).
   */
  function figureClaimsIn(text) {
    const claims = [];
    for (const [index, line] of text.split(/\r?\n/).entries()) {
      const sentences = sentencesOf(line);
      sentences.forEach((sentence, position) => {
        for (const { kind, total } of figuresIn(sentence)) {
          const entry = { index: position, sentence, sentences };
          claims.push({
            kind,
            total,
            key: figureKey({ kind, total }),
            history: figureIsHistory(entry),
            via: claimScopeOf(entry).via,
            line: index + 1,
          });
        }
      });
    }
    return claims;
  }

  /** The (live, history) figure sets of a document, plus where each figure came from. */
  function figureSetsFrom(claims) {
    const live = new Set();
    const history = new Set();
    for (const claim of claims) {
      if (claim.history) history.add(claim.key);
      else live.add(claim.key);
    }
    return { live, history };
  }

  /**
   * The ledger's side. Rows C38/C39/C40 only, and — like the documents — every
   * figure is classified by the CLAIM it is made in, not by the row it sits on.
   *
   * The row is still the unit the check READS: only these three rows contribute
   * figures at all, so a figure quoted anywhere else in the map cannot make the
   * sets agree by accident. Inside the row, the claim cell and the evidence cell
   * are separate claims; C38/C39/C40 state the live figures in the claim cell and
   * quote the superseded ones in the evidence cell, and the sentence split is what
   * keeps those two apart.
   */
  function ledgerFigureSets(text) {
    const live = new Set();
    const history = new Set();
    const origins = [];
    const rows = [];
    for (const line of text.split(/\r?\n/)) {
      const idMatch = line.match(/^\|\s*(C\d+)\s*\|/);
      if (!idMatch) continue;
      if (!['C38', 'C39', 'C40'].includes(idMatch[1])) continue;
      const row = line.replace(/\\\|/g, '|');
      rows.push(idMatch[1]);
      for (const claim of figureClaimsIn(row)) {
        if (claim.history) history.add(claim.key);
        else live.add(claim.key);
        origins.push({ key: claim.key, row: idMatch[1], history: claim.history });
      }
    }
    return { live, history, origins, rows };
  }

  /**
   * A live assertion that the suite is not repeatable / cannot be re-run against
   * one database. Banned per line unless that line marks it dead; the Thai form is
   * checked too, because a bilingual document carries every claim twice.
   */
  const NOT_REPEATABLE = [
    { label: 'not repeatable', pattern: /\bnot\s+repeatable\b/i },
    { label: 'not repeatable (hyphenated)', pattern: /\bnon-?repeatable\b/i },
    { label: 'cannot be repeat(ed|able)|is not repeat(ed|able)', pattern: /\bcannot be repeat(?:ed|able)\b|\bis not repeat(?:ed|able)\b/i },
    { label: 'รันซ้ำ…ไม่ได้', pattern: /รันซ้ำ[^.\n]{0,40}ไม่ได้/ },
    { label: 'ไม่สามารถรันซ้ำ', pattern: /ไม่สามารถรันซ้ำ/ },
  ];

  /**
   * The positive half of the same claim: the document says the suite IS
   * repeatable against one database. Neither sales document is allowed to assert
   * the negative, and they are not allowed to disagree with each other either —
   * a document that silently drops the position while the other states it is the
   * same contradiction one level down, and it is the form a "correction" that
   * deleted the sentence would take.
   */
  const REPEATABLE = [
    { label: 'repeatable', pattern: /\brepeatable\b/i },
    { label: 'รันซ้ำได้', pattern: /รันซ้ำได้/ },
  ];

  {
    const problems = [];

    // ---- the two sales documents -------------------------------------------------
    const salesSets = [];
    const repeatabilityProblems = [];
    const repeatableDocs = [];

    for (const doc of SALES) {
      if (doc.text === null) {
        problems.push(`${doc.label} is missing, so its test-count figures cannot be compared with the ledger`);
        continue;
      }

      const docClaims = figureClaimsIn(doc.text);
      const { live, history } = figureSetsFrom(docClaims);
      salesSets.push({ label: doc.label, live, history, claims: docClaims });

      // A live assertion that the suite is NOT repeatable. The superseded
      // warning is allowed to be quoted as history (the same per-line
      // classification the figures get), but where it is quoted the line must
      // say it is dead.
      for (const [index, line] of doc.text.split(/\r?\n/).entries()) {
        if (!NOT_REPEATABLE.some((entry) => entry.pattern.test(line))) continue;
        if (isSuperseded(line)) continue;
        const which = NOT_REPEATABLE.find((entry) => entry.pattern.test(line)).label;
        repeatabilityProblems.push(
          `${doc.label} line ${index + 1} still asserts the suite is not repeatable (${which}): "${line.trim().slice(0, 160)}"`
        );
      }

      // The positive half. The owner's correction removed the claim that the
      // suite is NOT repeatable; a document that also deleted the statement that
      // the suite IS repeatable would leave a buyer with no position at all, and
      // a correction that silently dropped the sentence is exactly the mutation
      // this guards.
      const carriesRepeatable = REPEATABLE.some((entry) => entry.pattern.test(doc.text));
      repeatableDocs.push({ label: doc.label, carriesRepeatable });
      if (!carriesRepeatable) {
        problems.push(
          `${doc.label} never states that the suite is repeatable against one database`
        );
      }
    }

    // ---- the ledger's C38/C39/C40 rows -------------------------------------------
    let ledgerSets = null;
    if (CLAIMS_MAP === null) {
      problems.push('WU6-CLAIMS-EVIDENCE.md is missing, so the sales figures cannot be compared with it');
    } else {
      ledgerSets = ledgerFigureSets(CLAIMS_MAP);
      for (const row of ['C38', 'C39', 'C40']) {
        if (!ledgerSets.rows.includes(row)) {
          problems.push(`WU6-CLAIMS-EVIDENCE.md has no ${row} row, so the figure sets cannot agree`);
        }
      }
    }

    // ---- the gate ------------------------------------------------------------------
    //
    // MATCHING CLAIMS, not raw sets. Each figure is already classified LIVE or
    // HISTORY on the side it was read from. What follows compares live against
    // live and checks that history is not resurrected as live; a superseded figure
    // on one side never forces the other side to keep it.
    if (ledgerSets !== null && salesSets.length === 2) {
      const salesLive = new Set();
      for (const { live } of salesSets) for (const key of live) salesLive.add(key);
      const salesHistory = new Set();
      for (const { history } of salesSets) for (const key of history) salesHistory.add(key);

      const salesWhere = (key) =>
        salesSets
          .filter((set) => set.live.has(key))
          .map((set) => set.label)
          .join(' and ');
      const ledgerWhere = (key) =>
        ledgerSets.origins
          .filter((origin) => origin.key === key && origin.row)
          .map((origin) => origin.row)
          .join(', ');

      // 1. A LIVE figure only the sales documents state is drift.
      for (const key of salesLive) {
        if (!ledgerSets.live.has(key)) {
          problems.push(
            `a sales document states the live figure ${key} (${salesWhere(key)}) that the ledger's C38/C39/C40 rows state only as history or not at all`
          );
        }
      }
      // 2. A LIVE figure only the ledger states is drift.
      for (const key of ledgerSets.live) {
        if (!salesLive.has(key)) {
          problems.push(
            `the ledger's C38/C39/C40 rows state the live figure ${key} (${ledgerWhere(key)}) that the sales documents state only as history or not at all`
          );
        }
      }
      // 3. A figure one side has RETIRED as history may not be offered as live by
      //    the other: that is one document resurrecting a number the other one
      //    has already called dead. The guard is `!…live.has(key)`: a figure a
      //    side states live AND quotes as history is not retired — the corrected
      //    documents do exactly that ("the run that used to fail now passes with
      //    `Tests 58 passed (58)`"), and that is quoting, not resurrection.
      for (const key of salesLive) {
        if (ledgerSets.history.has(key) && !ledgerSets.live.has(key)) {
          problems.push(
            `the figure ${key} stands as a live claim in ${salesWhere(key)} while the ledger's C38/C39/C40 rows have retired it as superseded history (${ledgerWhere(key)})`
          );
        }
      }
      for (const key of ledgerSets.live) {
        if (salesHistory.has(key) && !salesLive.has(key)) {
          problems.push(
            `the ledger's C38/C39/C40 rows state ${key} as a live claim (${ledgerWhere(key)}) while the sales documents keep it only as superseded history`
          );
        }
      }
      // 4. The two documents must tell the same repeatability story.
      if (
        repeatableDocs.length === 2 &&
        repeatableDocs[0].carriesRepeatable !== repeatableDocs[1].carriesRepeatable
      ) {
        const without = repeatableDocs.find((entry) => !entry.carriesRepeatable).label;
        problems.push(
          `${without} does not state that the suite is repeatable against one database while the other sales document does, so the two documents disagree on repeatability`
        );
      }
    }

    for (const problem of repeatabilityProblems) problems.push(problem);

    const salesLiveText = salesSets
      .map((set) => `${set.label}: lived [${[...set.live].sort().join(', ')}], history [${[...set.history].sort().join(', ')}]`)
      .join('; ');
    const ledgerText =
      ledgerSets === null
        ? '(ledger unreadable)'
        : `C38/C39/C40 lived [${[...ledgerSets.live].sort().join(', ')}], history [${[...ledgerSets.history].sort().join(', ')}]`;

    record(
      'sales-numbers-agree-with-ledger',
      problems.length === 0,
      problems.length === 0
        ? `rule: the test-count figures the two sales documents state LIVE must be the SAME SET as the figures WU6-CLAIMS-EVIDENCE.md rows C38/C39/C40 state LIVE, in both directions (a live figure on one side and not the other is drift), and a figure either side has retired as superseded history may not stand as a live claim on the other; neither sales document may assert the suite is not repeatable, and both must state that it is repeatable — ${salesLiveText}; ledger ${ledgerText}. Live figures are compared as matching claims; a superseded figure quoted as history on one side is permitted to be quoted as history on the other, or not to appear at all, so the corrected documents and the ledger's kept history are not drift`
        : problems.join('; ')
    );
    if (problems.length > 0) for (const problem of problems.slice(0, 8)) console.log(`  ${problem}`);
  }

  if (CLAIMS_MAP === null) {
    problems.push('WU6-CLAIMS-EVIDENCE.md is missing');
  } else {
    const mapRows = CLAIMS_MAP.split(/\r?\n/).filter((line) => /^\|\s*C\d+\s*\|/.test(line));
    const rowIds = mapRows.map((line) => line.match(/^\|\s*(C\d+)\s*\|/)[1]);

    const missingRows = C_IDS.filter((id) => !rowIds.includes(id));
    if (missingRows.length > 0) {
      problems.push(
        `WU6-CLAIMS-EVIDENCE.md has no row with id(s): ${missingRows.join(', ')}`
      );
    }

    const rowsWithoutEvidence = mapRows.filter(
      (row) => !/WT|CG\(|RPT\(|WU6-RUN|editorial/.test(row)
    );
    if (rowsWithoutEvidence.length > 0) {
      problems.push(
        `row(s) name no evidence location: ${rowsWithoutEvidence
          .map((row) => row.match(/^\|\s*(C\d+)\s*\|/)[1])
          .join(', ')}`
      );
    }

    // The coverage rule: every label a document labels must be named by at
    // least one row of the map. A map row names a label by quoting it, e.g.
    // "R3 — five test files" or "V4 — `cd server && npm test` …".
    const uncovered = {};
    for (const doc of SALES) {
      const carried = carriedByDoc.get(doc.label);
      if (!carried) continue;
      const unmapped = [...carried].filter(
        (label) =>
          !mapRows.some((row) =>
            new RegExp('\\b' + label + '\\s*(?:—|–|-)').test(row)
          )
      );
      if (unmapped.length > 0) uncovered[doc.label] = unmapped.sort();
    }
    for (const [label, unmapped] of Object.entries(uncovered)) {
      problems.push(
        `${label} carries claim label(s) with no row in WU6-CLAIMS-EVIDENCE.md: ${unmapped.join(', ')}`
      );
    }
  }

  const totalCarried = [...carriedByDoc.values()].reduce((sum, set) => sum + set.size, 0);

  record(
    'claims-evidence-covers-claims',
    problems.length === 0,
    problems.length === 0
      ? `rule: the ${expectedLabels.length} visible claim labels (R1-7, B1-9, V1-10, N1-7, Q1-5, S1-4) must each appear in BOTH sales documents in the label form the documents use (\`**R1 — …**\` / \`**V4** — …\` / \`**N4 — …**\`, i.e. a bold label followed by an em dash, a colon or the end of the bold run — carried ${totalCarried}/${expectedLabels.length * 2} across the two documents), WU6-CLAIMS-EVIDENCE.md must carry one row for each of ${C_IDS.length} claim ids (C1-C64), each naming at least one evidence location (WT / CG(n) / RPT(n) / WU6-RUN / editorial), and every label a document labels must be named by at least one of those rows so no labelled claim is left unmapped`
      : problems.join('; ')
  );
}

// ---------------------------------------------------------------------------
// CHECK 6 — migrations-proven-by-script
//
// Rule enforced: the migration proof the documents claim exists really does exist
// and really does assert idempotency, and the documents name it and its
// observation. Three things are compared against reality: (a) the named harness
// server/scripts/proofs/wu2/migrate-runner-proof.mts exists in the tree and
// contains the `migration_runner_idempotent` observation it is said to print;
// (b) the migration files the documents name are exactly the ones that exist;
// (c) both documents name the script, the observation value and the six tables.
// ---------------------------------------------------------------------------
{
  const problems = [];

  const proof = readOrNull(join(SERVER_DIR, MIGRATE_PROOF_REL));
  if (proof === null) {
    problems.push(`the named proof harness ${MIGRATE_PROOF_REL} does not exist`);
  } else if (!proof.includes('migration_runner_idempotent')) {
    problems.push(
      `${MIGRATE_PROOF_REL} does not contain the "migration_runner_idempotent" observation the documents cite`
    );
  }

  let migrationFiles = [];
  try {
    migrationFiles = readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith('.sql'))
      .sort();
  } catch {
    problems.push('server/migrations is missing');
  }

  for (const doc of SALES) {
    if (doc.text === null) {
      problems.push(`${doc.label} is missing`);
      continue;
    }
    if (!doc.text.includes(MIGRATE_PROOF_REL)) {
      problems.push(`${doc.label} does not name ${MIGRATE_PROOF_REL} as how the proof was made`);
    }
    if (!doc.text.includes('migration_runner_idempotent=true')) {
      problems.push(`${doc.label} does not state the observed value migration_runner_idempotent=true`);
    }
    const unlisted = migrationFiles.filter((name) => !doc.text.includes(name));
    if (unlisted.length > 0) {
      problems.push(`${doc.label} does not name migration file(s): ${unlisted.join(', ')}`);
    }
    const SIX_TABLES = [
      'billing_event_ledger',
      'plans',
      'schema_migrations',
      'subscriptions',
      'tenants',
      'usage_counters',
    ];
    const missingTables = SIX_TABLES.filter((table) => !doc.text.includes(table));
    if (missingTables.length > 0) {
      problems.push(`${doc.label} does not name table(s): ${missingTables.join(', ')}`);
    }
  }

  record(
    'migrations-proven-by-script',
    problems.length === 0,
    problems.length === 0
      ? `rule: ${MIGRATE_PROOF_REL} must exist and contain the migration_runner_idempotent observation, both documents must name that script path and the value migration_runner_idempotent=true, must name all ${migrationFiles.length} migration files (${migrationFiles.join(', ')}) and all six migrated tables`
      : problems.join('; ')
  );
}

// ---------------------------------------------------------------------------
// CHECK 7 — node-version-stated-22
//
// Rule enforced: both documents state Node.js 22 as the floor, and the statement
// is grounded in the tree rather than asserted. The ground truth is read from the
// lockfile's entry for the installed @supabase/supabase-js: if that dependency's
// declared engines.node floor is not 22 or newer, the documents' claim would be
// unsupported and this check fails. A document that also states the old, wrong
// "Node.js 20" line fails.
// ---------------------------------------------------------------------------
{
  const problems = [];

  let lockFloor = null;
  const lockText = readOrNull(PACKAGE_LOCK);
  if (lockText === null) {
    problems.push('server/package-lock.json is missing, so the Node.js floor cannot be grounded');
  } else {
    let lock = null;
    try {
      lock = JSON.parse(lockText);
    } catch (error) {
      problems.push(`server/package-lock.json is not valid JSON: ${error.message}`);
    }
    if (lock && lock.packages) {
      for (const [key, value] of Object.entries(lock.packages)) {
        if (
          key.endsWith('node_modules/@supabase/supabase-js') &&
          value &&
          value.engines &&
          typeof value.engines.node === 'string'
        ) {
          lockFloor = value.engines.node;
        }
      }
    }
    if (lockFloor === null) {
      problems.push(
        'no engines.node is declared for @supabase/supabase-js in server/package-lock.json, so the Node.js 22 claim has no ground'
      );
    } else if (!/>=?\s*(2[2-9]|[3-9][0-9])/.test(lockFloor)) {
      problems.push(
        `the installed @supabase/supabase-js declares engines.node = "${lockFloor}", which does not make Node.js 22 the floor`
      );
    }
  }

  for (const doc of SALES) {
    if (doc.text === null) {
      problems.push(`${doc.label} is missing`);
      continue;
    }
    const text = flat(doc.text);
    if (!/Node\.js 22\b/.test(text)) {
      problems.push(`${doc.label} does not state "Node.js 22" as a requirement`);
    }
    if (!/engines\.node|>=22\.0\.0/.test(text)) {
      problems.push(`${doc.label} does not ground the Node.js 22 floor in the dependency's engines declaration`);
    }
    const wrong = text.match(/\bNode\.js (?:18|20|21)\b/);
    if (wrong) {
      problems.push(`${doc.label} states the superseded version "${wrong[0]}"`);
    }
  }

  record(
    'node-version-stated-22',
    problems.length === 0,
    problems.length === 0
      ? `rule: both documents must state Node.js 22 as the floor and ground it in the dependency's engines declaration, and must not state 18/20/21; ground truth read from server/package-lock.json: @supabase/supabase-js declares engines.node = "${lockFloor}"`
      : problems.join('; ')
  );
}

// ---------------------------------------------------------------------------
// CHECK 8 — ui-evidence-described-as-http-html
//
// Rule enforced: both documents describe the sample-UI evidence as HTTP-level and
// saved HTML and state plainly that there are no screenshots, and the evidence
// they describe really is in the tree: the ten saved HTML pages under
// server/scripts/proofs/wu4/wu4-e2e/ (five pages × two locales). If the saved HTML
// were removed, the documents would be describing evidence that does not exist,
// and this check fails.
// ---------------------------------------------------------------------------
{
  const problems = [];

  let savedPages = [];
  try {
    savedPages = readdirSync(WU4_E2E_DIR).filter((name) => {
      if (!name.endsWith('.html')) return false;
      try {
        return statSync(join(WU4_E2E_DIR, name)).isFile();
      } catch {
        return false;
      }
    });
  } catch {
    problems.push('server/scripts/proofs/wu4/wu4-e2e is missing, so the saved-HTML evidence does not exist');
  }

  if (savedPages.length !== 10) {
    problems.push(
      `expected the 10 saved HTML pages (5 screens × 2 locales) under wu4-e2e, found ${savedPages.length}`
    );
  }

  for (const doc of SALES) {
    if (doc.text === null) {
      problems.push(`${doc.label} is missing`);
      continue;
    }
    const text = flat(doc.text);
    const saysNoScreenshots = /no screenshots?/i.test(text) || /ไม่มีภาพหน้าจอ/.test(text);
    if (!saysNoScreenshots) {
      problems.push(`${doc.label} does not state plainly that there are no screenshots`);
    }
    if (!/HTTP/.test(text)) {
      problems.push(`${doc.label} does not describe the UI evidence as HTTP-level`);
    }
    if (!/HTML/.test(text)) {
      problems.push(`${doc.label} does not describe the UI evidence as saved HTML`);
    }
    if (!doc.text.includes('wu4-e2e')) {
      problems.push(`${doc.label} does not point at the wu4-e2e directory that holds the saved pages`);
    }
  }

  record(
    'ui-evidence-described-as-http-html',
    problems.length === 0,
    problems.length === 0
      ? `rule: both documents must describe the UI evidence as HTTP-level and saved HTML and state that there are no screenshots, and the evidence must exist in the tree; found ${savedPages.length} saved HTML page(s) under server/scripts/proofs/wu4/wu4-e2e`
      : problems.join('; ')
  );
}

// ---------------------------------------------------------------------------
// CHECK 10 — buyer-facing-documents-are-cited-under-docs-product
//        (added in MT01-PRESALE-R2B-A)
//
// Rule enforced: a line of any of the three buyer-facing documents that names
// one of the six buyer-facing document filenames must not locate it under a
// `docs/…` directory token other than `docs/product/`. A buyer-facing document
// must cite a buyer-facing document under `docs/product/`; naming the vendor's
// working-record folder as the location of a delivered document is the defect
// this check exists to catch. A line that names a document without any `docs/…`
// token at all is allowed — that is how the documents NAME the vendor's own
// papers without claiming to be located there.
//
// It reads only the three documents this harness already reads. The
// deliverable-set statement is printed verbatim, the way the other nine checks
// state their rule.
// ---------------------------------------------------------------------------
{
  const BUYER_FACING_DOCS = [
    'WU3-PAID-ROUTE-INVENTORY.md',
    'WU4-SAMPLE-UI.md',
    'WU5-DEPLOY.md',
    'WU6-CLAIMS-EVIDENCE.md',
    'WU6-SALES-EN.md',
    'WU6-SALES-TH.md',
  ];
  // A `docs/…` directory token: `docs/` plus one or more `segment/` parts. The
  // `/` after `docs` is escaped so this pattern is not itself a path token in
  // this file (the same self-reference reason the delivery gate assembles its
  // patterns from parts).
  const DOCS_DIRECTORY_TOKEN = /docs\/[A-Za-z0-9_.\-]+(?:\/[A-Za-z0-9_.\-]+)*\//g;
  const RULE_TEXT =
    'rule: a line that names one of the six buyer-facing document filenames ' +
    `(${BUYER_FACING_DOCS.join(', ')}) must not locate it under a docs/ directory token other than docs/product/; ` +
    'citing a buyer-facing document under the vendor working-record folder is forbidden, and a line that names a document with no docs/ token is allowed';

  const problems = [];
  for (const doc of [SALES[0], SALES[1], { label: 'WU6-CLAIMS-EVIDENCE.md', text: CLAIMS_MAP }]) {
    if (doc.text === null) {
      problems.push(`${doc.label} is missing`);
      continue;
    }
    const lines = doc.text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const named = BUYER_FACING_DOCS.filter((name) => line.includes(name));
      if (named.length === 0) continue;
      DOCS_DIRECTORY_TOKEN.lastIndex = 0;
      const tokens = [...line.matchAll(DOCS_DIRECTORY_TOKEN)].map((match) => match[0]);
      const wrong = tokens.filter((token) => token !== 'docs/product/');
      if (wrong.length > 0) {
        problems.push(
          `${doc.label}:${i + 1} names ${named.join(', ')} together with the docs/ directory token(s) ` +
            `${wrong.join(', ')}; a buyer-facing document is delivered under docs/product/`
        );
      }
    }
  }

  record(
    'buyer-facing-documents-are-cited-under-docs-product',
    problems.length === 0,
    problems.length === 0 ? `${RULE_TEXT}; checked 3 document(s), no buyer-facing document filename is located under a non-product docs/ token` : problems.join('; ')
  );
}

// --------------------------------------------------------------------- summary --
const failed = results.filter((result) => !result.passed);
console.log(
  `SUMMARY checks=${results.length} passed=${results.length - failed.length} failed=${failed.length} docs_dir=${DOCS_DIR}` +
    (failed.length > 0 ? ` failed_names=[${failed.map((f) => f.name).join(',')}]` : '')
);
if (failed.length > 0) process.exit(1);

const EXPECTED_NAMES = [
  'sales-docs-bilingual-headings',
  'no-price-or-licence-in-sales-docs',
  'no-supabase-tested-claim',
  'not-implemented-list-complete',
  'claims-evidence-covers-claims',
  'migrations-proven-by-script',
  'node-version-stated-22',
  'ui-evidence-described-as-http-html',
  'sales-numbers-agree-with-ledger',
  'buyer-facing-documents-are-cited-under-docs-product',
];
const missingNames = EXPECTED_NAMES.filter(
  (name) => !results.some((result) => result.name === name)
);
if (missingNames.length > 0) {
  console.error(`claims-check: required check(s) did not run: ${missingNames.join(', ')}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// OPT-IN row probe (moved here from the former wu6/_scratch.mjs).
//
// The scratch file was removed because no file whose name starts with `_scratch`
// may remain under server/scripts; its one useful function — inspecting the rows
// the test suite leaves behind, described in section 6.1 of WU5-DEPLOY.md — is
// kept here instead.
//
// It is OFF BY DEFAULT and never runs on a normal invocation: nothing above this
// point opens a database connection. Set CLAIMS_ROW_PROBE=1 together with
// DATABASE_URL to run it. It is READ-ONLY (SELECT only), it prints no connection
// string, and it does not affect the ten checks or the exit code above, which
// have already been decided by the time it runs.
// ---------------------------------------------------------------------------
if (process.env.CLAIMS_ROW_PROBE === '1') {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('claims-check row probe: CLAIMS_ROW_PROBE=1 but DATABASE_URL is not set');
    process.exitCode = 1;
  } else {
    const { createRequire } = await import('node:module');
    const require = createRequire(join(SERVER_DIR, 'package.json'));
    const pg = require('pg');
    const pool = new pg.Pool({ connectionString: url, max: 2 });
    try {
      const ledger = await pool.query('SELECT event_id, account_id FROM billing_event_ledger');
      console.log('LEDGER_ROWS', JSON.stringify(ledger.rows, null, 1));
      const subs = await pool.query(
        'SELECT account_id, plan_id, status FROM subscriptions ORDER BY account_id'
      );
      console.log('SUBSCRIPTION_ROWS', JSON.stringify(subs.rows, null, 1));
    } finally {
      await pool.end();
    }
  }
}
