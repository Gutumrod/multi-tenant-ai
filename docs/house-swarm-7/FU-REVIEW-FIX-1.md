# FU-REVIEW-FIX-1 — the unproven Supabase capability claim, removed from the buyer-facing documents

> INTERNAL — NOT DELIVERED.
> This is the vendor's own working record (repair log / lane report). It is kept in the
> repository because the delivered documents cite it as evidence, but it is **not part of
> what a buyer receives**. The delivered set is declared in `DELIVERY-MANIFEST.md` at the
> repository root, and the gate `server/scripts/proofs/wu5/delivery-manifest-check.mjs`
> enforces that classification.

**Work unit:** H7-REVIEW-FIX-DOCS · **Correlation id:** `house-swarm-7-review-fix-docs-20260929`
**Date:** 2026-09-29 · **Branch:** `codex/house-swarm-7-followup-ratelimit-20260928` · **Base:** `d37173f`

## Finding closed

Review `WSTERA-House/reports/REVIEW-SWARM-7-MT01-WU2-WU6-CLAUDE-2026-09-28.md`:

- **ISSUE 1 (MEDIUM, wu6)** — `WU6-SALES-EN.md` N4 and `WU6-SALES-TH.md` N4 asserted that a
  buyer's own Supabase Postgres connection string **works**, one sentence after stating that no
  part of the kit had ever been tested with a Supabase project. The positive assertion had no
  evidence: the WU-6 evidence rows behind it (C49, C52, C59) reason "because it is PostgreSQL",
  which is inference, not a test. **Closed** — the assertion is gone from both documents, and the
  owner's replacement text (tested with PostgreSQL 16 / not tested with Supabase / Supabase
  testing scheduled before sale) is in place in both languages.
- **ISSUE 2 (LOW, wu6)** — the Thai N4 carried a transliteration of "repository" that
  nobody writes (the nine codepoints U+0E40 U+0E23 U+0E14 U+0E34 U+0E2A U+0E17 U+0E2D U+0E23 U+0E35,
  written as codepoints on purpose so this report does not itself become a hit for the
  repository-wide sweep)
  and ran two clauses together with no punctuation. **Closed** — the rewritten Thai N4 carries
  neither; the word for the repository is not used in that item at all, and each clause is
  punctuated (see `ที่เก็บโค้ดนี้` / `รีโปนี้` were available and not needed, there is no Thai
  sentence that needs the word).

## What was changed

### 1. `docs/house-swarm-7/WU6-SALES-EN.md`

**N4** (label form kept, so `claims-check.mjs` still reads it):

```
- **N4 — Supabase has not been tested.** This kit has been tested with PostgreSQL
  16 and has **not** been tested with Supabase; testing against a real Supabase
  project is scheduled before the kit goes on sale. Supabase auth is untested: it
  has never been verified against a real project. The persistence layer is not
  Supabase-backed: it talks to PostgreSQL through the `pg` driver.
  / **N4 — Supabase ยังไม่ถูกทดสอบ** คิทนี้ทดสอบกับ PostgreSQL 16 แล้ว
  แต่ยังไม่ทดสอบกับ Supabase โดยกำหนดทดสอบกับโปรเจกต์ Supabase จริงก่อนเปิดขาย
  การยืนยันตัวตน Supabase ยังไม่เคยถูกตรวจกับโปรเจกต์จริง ชั้น persistence
  ไม่ใช่ Supabase-backed: มันคุยกับ PostgreSQL ผ่านไดรเวอร์ `pg`
```

**Q3** — the requirement no longer offers a Supabase connection string as a supported input:

```
- **Q3 — A PostgreSQL 16 or newer database.** PostgreSQL is the server's only
  external service, and PostgreSQL 16 is what this kit has been tested with. A
  Supabase Postgres URL speaks the same protocol on the wire, but it is untested
  here (see N4). / **Q3 — ฐานข้อมูล PostgreSQL 16 ขึ้นไป** PostgreSQL เป็นบริการ
  ภายนอกเดียวของเซิร์ฟเวอร์ และ PostgreSQL 16 คือเวอร์ชันที่คิทนี้ทดสอบแล้ว
  — ส่วน URL ของ Supabase Postgres ยังไม่ถูกทดสอบที่นี่ แม้จะพูดโปรโตคอลเดียวกัน (ดู N4)
```

**S1** — same for what the buyer supplies:

```
- **S1 — Your own PostgreSQL database, PostgreSQL 16 or newer.** There is no
  default, no bundled instance and no fallback address in the code. A Supabase
  Postgres URL is the same protocol on the wire, but it is untested here (see N4).
  / **S1 — ฐานข้อมูล PostgreSQL ของคุณเอง เวอร์ชัน 16 ขึ้นไป** ไม่มีค่าเริ่มต้น
  ไม่มีอินสแตนซ์แถมมา และไม่มีที่อยู่สำรองในโค้ด
  — ส่วน URL ของ Supabase Postgres ยังไม่ถูกทดสอบที่นี่ แม้จะพูดโปรโตคอลเดียวกัน (ดู N4)
```

### 2. `docs/house-swarm-7/WU6-SALES-TH.md`

The same three items, in the Thai-first order this document uses:

```
- **N4 — Supabase ยังไม่ถูกทดสอบ** คิทนี้ทดสอบกับ PostgreSQL 16 แล้ว
  แต่ยังไม่ทดสอบกับ Supabase โดยกำหนดจะทดสอบกับโปรเจกต์ Supabase จริงก่อนเปิดขาย
  การยืนยันตัวตน Supabase ยังไม่เคยถูกตรวจกับโปรเจกต์จริง ชั้น persistence ไม่ใช่
  Supabase-backed: มันคุยกับ PostgreSQL ผ่านไดรเวอร์ `pg` / **Supabase has not been
  tested.** This kit has been tested with PostgreSQL 16 and has **not** been tested
  with Supabase; testing against a real Supabase project is scheduled before the kit
  goes on sale. Supabase auth is untested: it has never been verified against a real
  project. The persistence layer is not Supabase-backed: it talks to PostgreSQL
  through the `pg` driver.
```

```
- **Q3 — ฐานข้อมูล PostgreSQL 16 ขึ้นไป** PostgreSQL เป็นบริการภายนอกเดียวของเซิร์ฟเวอร์
  และ PostgreSQL 16 คือเวอร์ชันที่คิทนี้ทดสอบแล้ว
  — ส่วน URL ของ Supabase Postgres ยังไม่ถูกทดสอบที่นี่ แม้จะพูดโปรโตคอลเดียวกัน (ดู N4)
  / **A PostgreSQL 16 or newer database.** PostgreSQL is the server's only external
  service, and PostgreSQL 16 is what this kit has been tested with. A Supabase
  Postgres URL speaks the same protocol but is untested here (see N4).
```

```
- **S1 — ฐานข้อมูล PostgreSQL ของคุณเอง เวอร์ชัน 16 ขึ้นไป** ไม่มีค่าเริ่มต้น
  ไม่มีอินสแตนซ์แถมมา และไม่มีที่อยู่สำรองในโค้ด
  — ส่วน URL ของ Supabase Postgres ยังไม่ถูกทดสอบที่นี่ แม้จะพูดโปรโตคอลเดียวกัน (ดู N4)
  / **Your own PostgreSQL database, PostgreSQL 16 or newer.** There is no default, no
  bundled instance and no fallback address in the code. A Supabase Postgres URL is the
  same protocol on the wire, but it is untested here (see N4).
```

### 3. `docs/house-swarm-7/WU5-DEPLOY.md` §4.2 — one honest sentence, both languages

Added at the end of the subsection, after the existing TLS/`sslmode` facts (nothing else in
§4.2 was touched):

```
Using this section does not mean the kit has been tested with Supabase: it has not
(see `docs/CURRENT_STATUS.md` item 4).

การใช้ข้อนี้ไม่ได้หมายความว่าคิทนี้เคยถูกทดสอบกับ Supabase — ยังไม่เคย
(ดู `docs/CURRENT_STATUS.md` ข้อ 4)
```

### 4. `docs/CURRENT_STATUS.md` item 4 — replaced

```
4. **No real Supabase testing.** This kit has been tested with PostgreSQL 16 and has **not** been tested with Supabase; testing against a real Supabase project is scheduled before the kit goes on sale. The auth path exists in code but has never been exercised against a real Supabase project, and the persistence layer is not Supabase-backed (it uses `pg`).
```

Item 5 (the rate limit) and items 1, 2, 3, 6, 7 are unchanged, as are §§3–6.

## What was deliberately left alone

- **`docs/house-swarm-7/WU6-CLAIMS-EVIDENCE.md`** — not touched. It is the ledger and work unit
  FU-2's deliverable, and this lane does not run it. **Residual, reported rather than fixed:** the
  C49 / C52 / C59 rows still reason that a buyer's Supabase Postgres connection string works
  "because it is PostgreSQL". That inference is the root of the finding, and the ledger rows now
  describe a claim the sales documents no longer make. FU-2 owns rewriting them (along with the
  `no-supabase-tested-claim` rule whose required-statement list still names the old "works"
  statement — see the claims-check output below).
- **`server/scripts/proofs/**`** — not touched, in either the FU or the WU-6 harness. The
  `no-supabase-tested-claim` CHECK passed with the corrected documents as written; the rule was
  not bent, and no pattern was edited.
- **Every other N-item** (N1, N2, N3, N5, N6, N7), every level-2 section heading, the R/B/V/Q/S
  labels, the price/licence/commercial-terms text, the deployment statements and the UI/screenshot
  statements — unchanged. `claims-check.mjs` CHECK 1 (headings) and CHECK 2 (no price or licence)
  confirm the heading set and the commercial posture survived.
- **The same transliteration elsewhere** — it also survived at TH lines 66, 166, 271 and 304. The
  work unit named it as a defect of the **N4 item** only, and those four uses are in other items
  its instructions said to leave alone, so this lane reported them as the residual of ISSUE 2
  instead of fixing them outside the authorised places.
- **Update, after this report was written** — the controller ruled on 2026-09-29 that the
  transliteration must be fixed in *every* delivered file, not only N4. That work was done in the
  lane recorded by `FU-REVIEW-FIX-4.md`: 45 occurrences across 11 files, and the repository-wide
  sweep is now empty. The paragraph above is kept as the state this lane left behind, not as the
  current state.

## Evidence

Commands and observed results are in the work-unit return; the raw `CHECK`/`SUMMARY` lines are
reproduced below.

```
cd server && node scripts/proofs/fu/manual-claims-proof.mjs     -> exit 0, passed=13 failed=0
cd server && node scripts/proofs/wu6/claims-check.mjs           -> exit 0, passed=8 failed=0
cd server && npx tsc --noEmit                                   -> exit 0, no output
cd server && npm run typecheck                                  -> exit 0, no output
```

Note on the claims-check expectation in the work unit: it was expected to FAIL
`no-supabase-tested-claim` until FU-2 rewrites the rule. With the wording the owner specified —
which keeps `A Supabase Postgres URL … is untested here` — the check passes as-is, because the
harness's own per-line rule exempts a Supabase line that carries a negation (`untested`), and
`/supabase postgres/i` still matches the text. Nothing was bent: the rule file was not edited.
The check's summary text still *describes* the old permitted statement ("a buyer's own Supabase
Postgres connection string works"), so the description and the documents now disagree in wording
even though the mechanical test passes; that description is FU-2's to correct.
