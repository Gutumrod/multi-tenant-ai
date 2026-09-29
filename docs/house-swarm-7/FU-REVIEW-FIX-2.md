# H7-REVIEW-FIX-2 — the Supabase claim gate was vacuous; it now forbids what it used to require

Work unit: `H7-REVIEW-FIX-CHECK` (correlation id
`house-swarm-7-review-fix-check-20260929`). Finding closed: review
`REVIEW-SWARM-7-MT01-WU2-WU6-CLAUDE-2026-09-28.md`, **ISSUE 1 (MEDIUM)**.
Revised revision: `d37173f54ac42dce0abe189be6af7913b80b8761`.
Files changed by this work unit:

- `server/scripts/proofs/wu6/claims-check.mjs` — CHECK 3 rewritten (lines 212–530;
  lines 1–211 and 531-end are untouched, so the other seven checks did not move)
- `server/scripts/proofs/fu/supabase-claims-fixtures.mjs` — NEW
- `docs/house-swarm-7/WU6-CLAIMS-EVIDENCE.md` — C49, C52, C59, §8 constraint 1, X2
- this file

---

## 1. The finding, reproduced

The old CHECK 3 (`no-supabase-tested-claim`) ran backwards. Its REQUIRE half
demanded that each sales document carry the sentence "a buyer's own Supabase
Postgres connection string works", and its BAN half could not flag that same
sentence as affirmative:

- the EN patterns needed a test verb (`tested|verified|exercised|validated|`
  `checked|proven|ran|run|works?|working`) within 60 characters **before**
  `with|against|on|using` and then `supabase` — the review's sentence has the
  verb `works` **after** the object, so no EN pattern reached it;
- the Thai affirmative list was `ทดสอบ|ตรวจสอบ|ใช้งานได้|รองรับ|เข้ากันได้|พิสูจน์`
  and did **not** contain `ใช้ได้`, which is the verb the ledger's own C59 row
  used in Thai ("connection string ของผู้ซื้อใช้ได้").

Reproduced before the rewrite, on a temp copy of the delivered documents
(`CLAIMS_DOCS_DIR` pointed at the copy, the worktree untouched):

```
EN N4 title line: "- **N4 — Supabase has not been tested.**" -> "... has not been tested. A buyer's own Supabase Postgres connection string works with Supabase."
  observed: exit 0, CHECK no-supabase-tested-claim PASS
affirmative on its own line ("  A buyer's own Supabase Postgres connection string works with Supabase.")
  observed: exit 1, CHECK no-supabase-tested-claim FAIL   <- only because the line carried no "not"
TH own line "ใช้งานได้กับ Supabase"
  observed: exit 1 (the Thai form the old list DID have)
TH own line "ใช้กับ Supabase ได้"
  observed: exit 0, CHECK no-supabase-tested-claim PASS   <- the ใช้ได้ gap, measured
```

So the gate passed the exact claim it existed to kill, and the ledger's own C59
row (`connection string ของผู้ซื้อใช้ได้`) was the claim it passed.

## 2. The rule, before and after

**BEFORE** — two affirmative lists plus a Thai list:

```
const AFFIRMATIVE_RESULT = [
  /\b(?:tested|verified|exercised|validated|checked|proven|ran|run|works?|working)\b[^.]{0,60}\b(?:with|against|on|using)\b[^.]{0,40}supabase/i,
  /supabase[^.]{0,60}\b(?:is|are|was|were|has been|have been)\b[^.]{0,40}\b(?:tested|verified|exercised|validated|checked|proven|supported)\b/i,
];
const AFFIRMATIVE_BACKED = [
  /\b(?:is|are|was|were|being)\s+(?:fully\s+|entirely\s+)?supabase[- ]backed/i,
  /supabase[- ]backed\s+(?:persistence|layer|database|storage|repositories?)/i,
];
const THAI_AFFIRMATIVE = /(?:ทดสอบ|ตรวจสอบ|ใช้งานได้|รองรับ|เข้ากันได้|พิสูจน์)/;   // no ใช้ได้
...
REQUIRE: /supabase postgres/i  AND  "Supabase auth ... untested"  AND  "not Supabase-backed"
```

**AFTER** — BAN and REQUIRE, both printed in the check's own PASS detail so the
printed rule and the executed rule cannot drift (the detail is built from the
arrays, not written beside them). The exact pattern text:

```
const BAN = [
  { label: 'EN works? + with|against|on|using + supabase', en: true,
    pattern: /\bworks?\b[^.]{0,60}\b(?:with|against|on|using)\b[^.]{0,40}supabase/i },
  { label: 'EN working + with|against|on|using + supabase', en: true,
    pattern: /\bworking\b[^.]{0,60}\b(?:with|against|on|using)\b[^.]{0,40}supabase/i },
  { label: 'EN supabase + works? + with|against|on|using (either order)', en: true,
    pattern: /supabase[^.]{0,60}\bworks?\b[^.]{0,40}\b(?:with|against|on|using)\b/i },
  { label: 'EN supabase + works? + is|are|was|were + compatible', en: true,
    pattern: /supabase[^.]{0,80}\bworks?\b[^.]{0,80}\b(?:is|are|was|were)\b[^.]{0,40}\bcompatible\b/i },
  { label: 'EN supabase + is|are|was|were|has been + tested|verified|exercised|validated|checked|proven|supported|compatible', en: true,
    pattern: /supabase[^.]{0,60}\b(?:is|are|was|were|has been|have been|been)\b[^.]{0,40}\b(?:tested|verified|exercised|validated|checked|proven|supported|compatible)\b/i },
  { label: 'EN tested|verified|exercised|validated|checked|proven|supported + with|against|on|using + supabase', en: true,
    pattern: /\b(?:tested|verified|exercised|validated|checked|proven|supported)\b[^.]{0,60}\b(?:with|against|on|using)\b[^.]{0,40}supabase/i },
  { label: 'EN hedge should|will|would|expected to + work + near supabase', en: true,
    pattern: /\b(?:should|will|would|expected to)\b[^.]{0,60}\bwork(?:s|ing)?\b[^.]{0,60}supabase/i },
  { label: 'EN supabase ... should|will|would|expected to + work', en: true,
    pattern: /supabase[^.]{0,60}\b(?:should|will|would|expected to)\b[^.]{0,60}\bwork(?:s|ing)?\b/i },
  { label: 'EN is|are|was|were + supabase[- ]backed (positive)', en: true,
    pattern: /\b(?:is|are|was|were|being)\s+(?:fully\s+|entirely\s+)?supabase[- ]backed/i },
  { label: 'EN supabase[- ]backed + persistence|layer|database|storage|repositories', en: true,
    pattern: /supabase[- ]backed\s+(?:persistence|layer|database|storage|repositories?)/i },
  { label: 'TH ใช้ได้ / ใช้งานได้ attached to Supabase', en: false,
    pattern: /ใช้(?:งาน)?ได้\s*(?:กับ|บน|ใน|จาก)?\s*[`*]*\s*supabase/i },
  { label: 'TH ใช้ ... Supabase ... ได้ (split form)', en: false,
    pattern: /ใช้[^\s]{0,6}\s*supabase\s*[^\s]{0,6}\s*ได้/i },
  { label: 'TH รองรับ + Supabase', en: false,
    pattern: /รองรับ.{0,12}supabase/i },
  { label: 'TH เข้ากันได้ + Supabase', en: false,
    pattern: /เข้ากันได้.{0,12}supabase/i },
  { label: 'TH Supabase + รองรับ|เข้ากันได้', en: false,
    pattern: /supabase.{0,12}(?:รองรับ|เข้ากันได้)/i },
  { label: 'TH Supabase + ใช้ได้', en: false,
    pattern: /supabase.{0,12}ใช้(?:งาน)?ได้/i },
  { label: 'TH ทดสอบ + Supabase (affirmative)', en: false,
    pattern: /ทดสอบ.{0,12}supabase/i },
  { label: 'TH Supabase + ทดสอบ', en: false,
    pattern: /supabase.{0,12}ทดสอบ/i },
  { label: 'TH ตรวจสอบ + Supabase', en: false,
    pattern: /ตรวจสอบ.{0,12}supabase/i },
  { label: 'TH พิสูจน์ + Supabase', en: false,
    pattern: /พิสูจน์.{0,12}supabase/i },
];

const REQUIRED = [
  { id: 'the kit has been tested with PostgreSQL 16', pattern: /PostgreSQL 16/ },
  { id: 'it has NOT been tested with Supabase (EN sentence)', pattern: /not\**\s*been tested with Supabase/i },
  { id: 'ยังไม่ทดสอบกับ Supabase (TH sentence)', pattern: /ยังไม่ทดสอบกับ Supabase/ },
  { id: 'the pre-sale testing commitment (EN sentence)', pattern: /scheduled before the kit is offered for sale|before the kit goes on sale/ },
  { id: 'the pre-sale testing commitment (TH sentence)', pattern: /กำหนด(?:จะ)?ทดสอบกับโปรเจกต์ Supabase จริงก่อนเปิดขาย/ },
  { id: 'Supabase auth is untested (EN sentence)', pattern: /Supabase auth[^.]{0,80}untested/i },
  { id: 'การยืนยันตัวตน Supabase (TH sentence)', pattern: /การยืนยันตัวตน\s*Supabase/ },
  { id: 'the persistence denial (EN sentence)', pattern: /not\s+supabase[- ]backed/i },
  { id: 'the persistence denial (TH sentence)', pattern: /ไม่ใช่\s*supabase[- ]backed/i },
];
```

Judgement: per line, a BAN match is a violation **unless that same line carries a
negation / disclaimer marker** (`not / never / no / none / neither / nor /
without / untested / unverified / unsupported / ไม่`). The escape is kept because
the REQUIRED honest statements are themselves denials and share lines with
affirmatives all the time. The check name, the other seven checks, the SUMMARY
lines, `CLAIMS_DOCS_DIR`, `CLAIMS_ROW_PROBE` and the exit-code contract are
unchanged; the PASS/FAIL detail now describes the rule the check enforces, built
from `BAN` and `REQUIRED`.

## 3. Evidence

```
cd server && node scripts/proofs/wu6/claims-check.mjs
  -> 8 CHECK lines, all PASS; SUMMARY checks=8 passed=8 failed=0; exit 0

cd server && node scripts/proofs/fu/supabase-claims-fixtures.mjs
  -> 9 cases, all behaving; SUMMARY cases=9 passed=9 failed=0; exit 0

cd server && node scripts/proofs/fu/manual-claims-proof.mjs
  -> SUMMARY claims=13 passed=13 failed=0; exit 0
```

The fixture harness (`supabase-claims-fixtures.mjs`) copies the three delivered
documents into a temp directory per case, applies exactly one mutation, runs the
REAL `claims-check.mjs` as a child with `CLAIMS_DOCS_DIR` pointed at the copy, and
judges both the child's exit code and its `CHECK no-supabase-tested-claim` line.
Nothing inside the worktree is written; the temp directory is removed afterwards.
Cases and observed results:

| case | mutation | expected | observed exit | observed check |
|---|---|---|---|---|
| a | none — delivered documents, unmutated | pass | 0 | PASS |
| b | EN N4 title line gains "A buyer's own Supabase Postgres connection string works with Supabase." (the review's measurement) | fail | 1 | FAIL |
| c | TH gains "ใช้งานได้กับ Supabase" | fail | 1 | FAIL |
| d | TH gains "ใช้กับ Supabase ได้" (the ใช้ได้ gap) | fail | 1 | FAIL |
| e | "has **not** been tested with Supabase" → "has been tested with Supabase" | fail | 1 | FAIL |
| f | "The persistence layer is not Supabase-backed" → "…is Supabase-backed" | fail | 1 | FAIL |
| g | every `supabase` token deleted from EN (27 occurrences) | fail | 1 | FAIL |
| h | the required TH pre-sale commitment deleted | fail | 1 | FAIL |
| h2 | the affirmative **appended to the N4 line that already carries "not"** | pass (recorded limitation) | 0 | PASS |

An adversarial battery of 25 further affirmative sentences (EN `works/working/is
working/compatible/tested/has been tested/was validated/is supported/should work/
will work/expected to work/Supabase-backed`, TH `ใช้งานได้กับ`, `ใช้กับ … ได้`,
`รองรับ`, `เข้ากันได้`, `ทดสอบกับ`, `Supabase ใช้ได้`, `ตรวจสอบกับ`, `พิสูจน์กับ`)
was run the same way: **25/25 caught** (exit 1) as their own line. Two of them —
`Supabase ใช้ได้` and the split `ใช้ … Supabase … ได้` — only went red after the
first draft of the Thai patterns was corrected; both are in the BAN list above and
both are pinned by fixture cases c and d.

## 4. Case h2 — the one shape I could not make fail, stated plainly

An affirmative **welded onto a line that already carries a negation marker** is
not caught:

```
- **N4 — Supabase has not been tested.** A buyer's own Supabase Postgres connection string works with Supabase.
  -> exit 0, CHECK no-supabase-tested-claim PASS
```

This is the review's own mutated sentence, on the review's own line, and the
rewritten rule still passes it — because the per-line judgement cannot tell a
denial from an affirmative that `not` also happens to protect, and the work unit
required the per-line judgement and the negation escape to be kept. The same
sentence **on its own line** is caught (fixture case b, exit 1), and the deleted
require-half case is caught (case e). Fixture case h2 makes this limitation
visible — it is a PASS expectation, and its record string says so — rather than
leaving a fixture list that only contains cases that pass.

A window-based rule could close this one shape, but it would reopen the shape the
escape exists for: a denial whose marker falls outside the window becomes an
affirmative, which is exactly how the old rule failed. Closing it properly means
judging clauses, not lines, and that is a redesign of the harness beyond this work
unit's scope. The commander should treat this as a known residual, not a fix.

## 5. Two places where the delivered documents did not match the work unit's literal spec

Both are reported rather than silently resolved in either direction; neither was
fixed by editing a document (the sales documents and `WU5-DEPLOY.md` are FU-1's
deliverable and were not touched by this work unit):

1. **`/not been tested with Supabase/i` does not match the delivered EN text.**
   EN N4 line 288 reads `16 and has **not** been tested with Supabase;` — the
   negation is in markdown bold, so the literal pattern fails. The check uses
   `/not\**\s*been tested with Supabase/i`, which matches the plain form too, so
   nothing the literal caught is now allowed through. It is a formatting
   tolerance, not a relaxation.
2. **`/กำหนดทดสอบกับโปรเจกต์ Supabase จริงก่อนเปิดขาย/` does not match the
   delivered TH sentence.** TH N4 line 240 reads
   `โดยกำหนดจะทดสอบกับโปรเจกต์ Supabase จริงก่อนเปิดขาย` — there is an extra `จะ`
   after `กำหนด`. The check uses `กำหนด(?:จะ)?ทดสอบกับ…`, so the exact literal and
   the delivered sentence both pass. Fixture case h proves the requirement has
   teeth: deleting the delivered sentence makes the check fail.

## 6. The ledger

`docs/house-swarm-7/WU6-CLAIMS-EVIDENCE.md`:

- **C49 (Q3)** — was "PostgreSQL 16 or newer, **or your own Supabase Postgres
  connection string**"; now: a PostgreSQL 16 database, PostgreSQL 16 tested,
  Supabase **untested** with testing scheduled before sale. Evidence cell names
  the rewritten check and the new fixture harness.
- **C52 (S1)** — was "your own PostgreSQL database **or your own Supabase Postgres
  connection string**"; now: your own SQL-standard PostgreSQL database, no default
  / no bundled instance / no fallback address, and a Supabase Postgres URL is the
  same protocol but **untested** here, testing scheduled before sale.
- **C59 (N4)** — was "…**a buyer's Supabase Postgres connection string works**… /
  connection string ของผู้ซื้อ**ใช้ได้**" (the very wording the old rule mandated
  and could not flag); now: Supabase is untested, PostgreSQL 16 tested, testing
  scheduled before sale, auth never verified, persistence not Supabase-backed.
  The cell records that the earlier wording is **superseded** by this work unit.
- **§8 constraint 1** — was "the permitted statements are exactly: a buyer's own
  Supabase Postgres connection string works …"; now states the untested position,
  names the rewritten rule, and names the fixture harness as its enforcement.
- **X2** — carries a "superseded positive wording" note: that this ledger's own
  C49/C52/C59 rows and §8 constraint 1 used to call the buyer's Supabase Postgres
  connection string something that "works" (in Thai, "ใช้ได้"), that the wording is
  superseded, and that an older copy of the ledger *or of the check* is stale —
  because the check that was supposed to catch it was vacuous.

No rows were added or renumbered: the table still holds exactly `C1`..`C64`, every
row still names an evidence location, and §8 constraint 4 (the local test database
is never presented as the buyer's configuration) is untouched.

## 7. Not done, and why

`docs/house-swarm-7/WU5-DEPLOY.md` and `docs/house-swarm-7/WU6-SALES-*.md` are
FU-1's deliverable and were not edited. The new rule passes on the wording as
FU-1 left it, so no sentence had to be reported back — the two mismatches in §5
are in the work unit's own pattern literals, not in the delivered text. This file
is not an approval of anything.
