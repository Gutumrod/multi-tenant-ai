# MT01 pre-sale cleanup — lane P1: the sales documents' test numbers, and a numeric gate in `claims-check`

> INTERNAL — NOT DELIVERED.
> This is the vendor's own working record (repair log / lane report). It is kept in the
> repository because the delivered documents cite it as evidence, but it is **not part of
> what a buyer receives**. The delivered set is declared in `DELIVERY-MANIFEST.md` at the
> repository root, and the gate `server/scripts/proofs/wu5/delivery-manifest-check.mjs`
> enforces that classification.

**Lane:** `MT01-PRESALE-P1-SALES-NUMBERS` (correlation `house-swarm-7-mt01-presale-p1-20260929`)
**Task:** `HOUSE-SWARM-7-MT01-PRESALE-CLEANUP` (Owner direct, 2026-09-29, "[MT01 เก็บก่อนขาย]")
**Branch:** `codex/mt01-presale-cleanup-20260929` · base `f03c48d` (master after PR #3)
**Worktree:** `D:/AI-Workspace/runtime/worktrees/mt01-presale-cleanup`
**Status:** substantive work **done and verified by the controller's own gates** · report written by the controller (see §8) · **not committed** (git is controller-owned)

---

## 1. What was wrong

The independent review of the merged revision recorded one MEDIUM
(`reports/REVIEW-SWARM-7-MT01-FINAL-852DFB1-CLAUDE-2026-09-29.md`, ISSUE 1):

> **[MEDIUM · เอกสารขาย EN+TH]** `WU6-SALES-EN.md` (V4 … and the "not repeatable" paragraph)
> และ `WU6-SALES-TH.md` **ยังระบุเลขเก่า** `46 passed | 5 skipped (51)` / `51 passed (51)` และ
> **บอกว่า `npm test` รันซ้ำบน DB เดิมแล้วล้ม `1 failed | 50 passed (51)`** — ความจริงตอนนี้
> **58/58 (53+5 เมื่อไม่มี DB) และรันซ้ำผ่าน** · ขัดกับ `WU6-CLAIMS-EVIDENCE.md` C38–C40 และ
> `WU5-DEPLOY.md` (58) · `claims-check` ไม่ตรวจตัวเลขจึงผ่าน · เป็นข้อความเท็จเชิงข้อเท็จจริง
> ในเอกสารที่ผู้ซื้อจะอ่าน (L-06)

Two distinct defects, both buyer-facing: **(a)** stale test counts, and **(b)** a present-tense
claim that the suite is not repeatable, which had been fixed in the code and in the ledger but
not in the sales copy.

## 2. The measured truth

Controller-measured at the base revision, on the local disposable PostgreSQL 16 at
`127.0.0.1:55432`; the two with-database runs were on the **same** database, which is the
point of the finding.

| command | observed | exit |
|---|---|---|
| `cd server && DATABASE_URL='postgres://postgres@127.0.0.1:55432/mt01_presale' npx vitest run` (run 1) | `Test Files 6 passed (6)` / `Tests 58 passed (58)` | 0 |
| … same command, **same database**, run 2 | `Test Files 6 passed (6)` / `Tests 58 passed (58)` | 0 |
| `cd server && env -u DATABASE_URL npx vitest run` | `Test Files 5 passed \| 1 skipped (6)` / `Tests 53 passed \| 5 skipped (58)` | 0 |

The five skipped tests are `tests/postgres-persistence.test.ts`'s, which skips itself with no
database. **Two consecutive runs against one database both passed 58/58** — so `58` is the
figure to state, and "the suite is not repeatable" is false. No Supabase, LAB or production
host was contacted for any of this.

## 3. The document change, old and new

`git diff --stat` over the change set:

```
docs/house-swarm-7/WU6-CLAIMS-EVIDENCE.md  |   2 +-
docs/house-swarm-7/WU6-SALES-EN.md         | 119 ++++---
docs/house-swarm-7/WU6-SALES-TH.md         |  87 +++--
server/scripts/proofs/wu6/claims-check.mjs | 488 ++++++++++++++++++++++++++++-
4 files changed, 611 insertions(+), 85 deletions(-)
```

### 3.1 V4 — the test-count claim

**Old** (`WU6-SALES-EN.md`): three cases, `Test Files 4 passed | 1 skipped (5)` /
`Tests 46 passed | 5 skipped (51)`; `Test Files 5 passed (5)` / `Tests 51 passed (51)`;
and a third case stating the suite **exits 1** with `1 failed | 50 passed (51)` on a database
it has already run against, concluding the full-suite pass "needs a database that has not been
used before". The Thai document carried the same three cases plus an English counterpart.

**New** (both languages): two cases, the ones actually measured — with `DATABASE_URL` **unset**
→ exit 0, `Test Files 5 passed | 1 skipped (6)` / `Tests 53 passed | 5 skipped (58)`; with
`DATABASE_URL` **set** → exit 0, `Test Files 6 passed (6)` / `Tests 58 passed (58)`. The third
case is **deleted**, not relabelled, because it is no longer true. The useful conditional
sentence survives (the full-suite figure holds only when `DATABASE_URL` is set) and the
single-use conclusion is replaced with **repeatability**.

### 3.2 Section 6 — the "two warnings" paragraph

**Old:** (a) `npm test` "does **not** clean them up", with the row counts going from
5 subscriptions and 3 ledger rows to 7 and 3; (b) "**It is also not repeatable against the same
database.**", failing with `1 failed | 50 passed (51)` because the ledger refuses to re-apply a
seen event.

**New:** the suite "**deletes exactly the rows it created again before it exits**", three
consecutive runs each `Test Files 6 passed (6)` / `Tests 58 passed (58)`, row counts after all
three `subscriptions` 0 and `billing_event_ledger` 0, and the suite is **repeatable** — the
same position `docs/house-swarm-7/WU5-DEPLOY.md` §6.1 already stated. A **History** paragraph
is kept, so an older copy cannot mislead: an earlier version of `server/tests/webhook.test.ts`
deleted nothing, re-running used to fail at `tests/webhook.test.ts:101` with
`AssertionError: expected 'active' to be 'cancelled'` because the file's fixed event ids
(`evt_apply_1`, `evt_replay_1`) collide with the ledger's `event_id` primary key, and the old
warning is called **superseded and no longer true**.

### 3.3 The Thai V4 wording defect that the new gate exposed

`WU6-SALES-TH.md`'s V4 English counterpart rendered the set-database case as a bare
`` `5 passed (5)` `` / `` `51 passed (51)` `` with **no `Test Files`/`Tests` label**
(confirmed at `f03c48d`: "with `DATABASE_URL` set against a **fresh** database → exit 0,
`5 passed (5)` and `51 passed (51)`"). An unlabelled `N passed (N)` is ambiguous — it was read
as a `tests` total, producing a spurious `tests(6)` after the rewrite. The new text states both
figures fully labelled, and the extractor now requires the `Test Files … (N)` / `Tests … (M)`
phrasing.

## 4. The new gate — the durable part of the fix

`server/scripts/proofs/wu6/claims-check.mjs` now runs **nine** checks. The ninth is
`sales-numbers-agree-with-ledger`: it collects the test-count figures the two sales documents
state as their V4 live claim and the figures the ledger's C38/C39/C40 rows state, and fails when
a figure one side states as a **live** claim is absent from the other side, or when a sales
document still asserts the suite is not repeatable.

Observed green on the delivered documents:

```
SUMMARY checks=9 passed=9 failed=0 docs_dir=…/docs/house-swarm-7   (exit 0)
```

## 5. Non-vacuity — the Owner's own requirement

> "เพิ่ม check ใน claims-check ที่เทียบตัวเลขในเอกสารขายกับ ledger (**ต้อง fail บนเอกสารเก่า**)"

Proved red **two independent ways**.

### 5.1 The pre-change documents, recovered from git, through the real checker

`git show f03c48d:docs/house-swarm-7/<file>` into a temp directory, then the real checker with
`CLAIMS_DOCS_DIR` pointed at it:

```
SUMMARY checks=9 passed=8 failed=1 failed_names=[sales-numbers-agree-with-ledger]   (exit 1)
```

and the raw red line (first clauses; the full line is 4× longer):

```
CHECK sales-numbers-agree-with-ledger FAIL a sales document states the live figure files(5)
(WU6-SALES-EN.md and WU6-SALES-TH.md) that the ledger's C38/C39/C40 rows state only as history
or not at all; a sales document states the live figure tests(51) …; the ledger's C38/C39/C40
rows state the live figure files(6) … that the sales documents state only as history or not at
all; … the figure files(5) stands as a live claim in WU6-SALES-EN.md and WU6-SALES-TH.md while
the ledger's C38/C39/C40 rows have retired it as superseded history (C39, C40); … WU6-SALES-EN.md
line 348 still asserts the suite is not repeatable (not repeatable): "**It is also not
repeatable against the same database.** The webhook test reuses a"; WU6-SALES-TH.md line 282
still asserts the suite is not repeatable (รันซ้ำ…ไม่ได้) …
```

### 5.2 The fixture harness — four cases

`server/scripts/proofs/fu/claims-check-numeric-fixtures.mjs` (new), modelled on
`supabase-claims-fixtures.mjs`: copy the documents to a temp dir, mutate one figure, run the
real checker as a child process, assert the line went red and the process exited non-zero. It
never mutates the repository.

| case | mutation | expected | observed |
|---|---|---|---|
| `a-sales-document-figure-reverted-to-the-old-51-file-total` | `WU6-SALES-EN.md` V4 set-database file total → `Test Files 5 passed (5)`, ledger still `files(6)` | fail | exit 1, `FAIL` |
| `b-sales-document-figure-reverted-to-the-old-46-file-total` | `WU6-SALES-TH.md` V4 set-database file total → `Test Files 5 passed (5)` | fail | exit 1, `FAIL` |
| `c-ledger-live-figure-changed-documents-untouched` | `WU6-CLAIMS-EVIDENCE.md` C39 claim cell → `Tests 57 passed (57)` | fail | exit 1, `FAIL` |
| `d-delivered-documents-are-pass` | none (unmutated copy) | pass | exit 0, `PASS` |

```
SUMMARY cases=4 passed=4 failed=0   (exit 0)
```

Case `d` is what keeps the other three honest: the rule must be green on correct documents, so
the mutations are demonstrably the cause of the reds.

## 6. The bug inside the new gate, recorded honestly

The first version of the ninth rule compared whole figure **sets** — every figure either side
states — and therefore went **red on correct documents**:

```
SUMMARY checks=9 passed=8 failed=1 failed_names=[sales-numbers-agree-with-ledger]
  the sales documents state the figure files(6) … that the ledger's C38/C39/C40 rows do not;
  ... the ledger keeps the superseded figure files(5) as history (rows C39, C40);
  ... the ledger keeps the superseded figure tests(51) as history …;
  ... the ledger keeps the superseded figure failures(1) as history (rows C40)
```

That rule cannot be satisfied, because both sides legitimately **quote superseded figures as
history** so an older copy cannot mislead a reader:

* C39/C40 carry the older `files(5)` / `tests(51)` figures in their evidence cells, labelled
  superseded; C40 carries the old failed run's `failures(1)`.
* `server/scripts/proofs/fu/manual-claims-proof.mjs` **CHECK 12 requires C40 to keep that
  history** and requires C64 not to assert the obsolete leak. Those rows were correct as they
  stood and were **not** edited to satisfy the new check.

The replacement rule compares **matching claims**: a figure quoted as superseded history on one
side may appear as superseded history on the other, or not at all. The vocabulary comes from
`manual-claims-proof.mjs` (`isQuotedHistory`, its `SUPERSEDED_IN_LEDGER` list) rather than a new
invention. Fixing this also removed the spurious `failures(1)` drift report.

A useful side effect: this check now catches the **reverse** drift too — a corrected sales
document that stops quoting the old figure while the ledger still keeps it as history is also
reported, so neither side can quietly diverge.

## 7. Every "eight" reference, and the ones deliberately left alone

The harness prints nine `CHECK` lines now, so every statement of its count had to move:

| location | old → new |
|---|---|
| `claims-check.mjs` header comment (line 19) | "The eight check names" → "The nine check names" + `sales-numbers-agree-with-ledger (added in MT01-PRESALE-P1)` |
| `claims-check.mjs` row-probe comment | "the eight checks" → "the nine checks" |
| `WU6-SALES-EN.md` V10 | `eight` → `nine`, naming the ninth |
| `WU6-SALES-TH.md` V10 | แปด → เก้า, both languages |
| `WU6-CLAIMS-EVIDENCE.md` C46 | "prints eight … The eight names are …" → "prints nine … The nine names are … and `sales-numbers-agree-with-ledger`" |

**Left alone on purpose** — these count a *different* harness, verified before leaving them:
`WU6-SALES-EN.md`/`WU6-SALES-TH.md` V8 (`i18n-parity` eight, `e2e-web` nine), the ledger's C44,
and `WU3-PAID-ROUTE-INVENTORY.md`'s "all eight routes" (a different subject entirely). The
controller's `count-consistent` gate reads the count from the checker's own `EXPECTED_NAMES` and
judges only claims-check's count, precisely so these cannot be confused.

## 8. How the work went, and who wrote this report

Three runs of this lane were dispatched. Recorded plainly:

1. **Run 1** (worker, `max_turns=45`) rewrote V4 and section 6 in both languages, updated C46,
   and added the ninth check — then hit its turn limit. It reported `STATE: FAIL` with four
   blockers and did **not** convert any FAIL into a PASS. **Four of the six controller checks
   that failed were the controller's fault, not the worker's** (below).
2. **Run 2** (worker, continuation) repaired the ninth rule, created the fixture harness, and
   proved it red on the pre-change documents and on all four fixture mutations. It hit its turn
   limit before writing this report and self-reported `STATE: FAIL`.
3. **Run 3** (worker, report only) also hit its turn limit without writing the file.

After three attempts the controller stopped delegating this file — per this job's own
three-attempt rule — and wrote it from **its own measurements**, re-running every command quoted
above. Every number and line in this report is a controller observation, not a worker
self-report. The worker's `STATE:` lines remain self-reports, as the skill requires.

### Controller defects found and fixed during this lane (mine, recorded for the next reader)

1. **`:300[0-9]` port gate** matched an unrelated `node` listener on **3001** that started at
   06:58, before this job — a false FAIL. Narrowed to `:3003`.
2. **`e2e-web.mjs` needs `DATABASE_URL`**; the declared check ran it without one, failing with
   `CHECK harness FAIL DATABASE_URL is not set`. The check now passes it.
3. **The first packet did not state that the ledger's superseded figures are REQUIRED history**
   (`manual-claims-proof` CHECK 12 enforces it), so the worker's set-based rule went red on
   correct documents. The continuation packet states the rule.
4. **The first packet did not flag the Thai V4 unlabelled-figure defect** that fed the spurious
   `tests(6)` reading.
5. **The first packet declared the report and the new fixture under `expected_mutations`**; a
   file that does not exist cannot have a hash change, so the observer reported
   `MUTATION_TARGET_ABSENT_BEFORE_LANE` — a packet-authoring error. Moved to
   `expected_artifacts`.
6. **`gate-p2.py check-can-fail` used `git worktree add HEAD`**, which cannot see a lane's
   *uncommitted* work; it now copies the working tree.

## 9. Outstanding items

* **The report is the last artifact; nothing in the lane's scope remains unwritten.** The C46
  row's citation of `docs/house-swarm-7/PRESALE-CLEANUP-P1.md` now resolves.
* **Not committed.** Git for this job is controller-owned; the change set stays uncommitted in
  the worktree until the controller commits the branch.
* **Not merged**, per the Owner's instruction.
* **Lane P1 is not yet independently reviewed.** The skill's ceiling here is
  `SWARM_REVIEW_REQUIRED`; the declared checkpoint `B0` (ลู่รีวิว Swarm) has not been reached.
* **Lanes P2 / P3a / P3b / P4 have not been dispatched** — they share this one mutable
  worktree, so they run one at a time after P1.

## 10. Boundaries

Nothing under `server/src/`, `server/tests/`, `modules/`, `web/`, `scripts/`,
`server/package.json`, `server/package-lock.json`, `docs/CURRENT_STATUS.md`,
`docs/house-swarm-7/WU5-DEPLOY.md`, `docs/house-swarm-7/FU-*.md` or
`06-Agent-Logs/WSTERA-House/STATUS-HOUSE.md` was modified — the controller's
`p1-bnd-code-not-touched`, `p1-bnd-current-status-not-touched`, `p1-bnd-hub-not-modified` and
`p1-reg-package-unchanged` checks pass. No commit was made. No process was left running and no
port is listening on 3003.

## 11. Controller gate results on the delivered tree

| gate | result |
|---|---|
| `gate-p1.py sales-truth` | PASS |
| `gate-p1.py repeatable-stated` | PASS |
| `gate-p1.py count-consistent` | PASS |
| `gate-p1.py old-docs-red` | **PASS** — exit 1, `CHECK sales-numbers-agree-with-ledger FAIL …` on the pre-change documents |
| `gate-p1.py report-complete` | PASS |
| `p1-claims-check-passes` (9/9) | PASS |
| `p1-numeric-check-can-fail-fixture` (4/4) | PASS |
| `p1-reg-manual-claims-proof` (13/13) | PASS |
| `p1-reg-supabase-fixtures` (9/9) | PASS |
| `p1-reg-typecheck` | PASS |
| `p1-reg-tests-without-db` (53 passed) | PASS |
| `p1-reg-tests-with-db` (58 passed) | PASS |
| `p1-reg-deploy-preflight` (7/7) | PASS |
| `p1-reg-i18n` (8/8) | PASS |
| `p1-reg-e2e` (9/9, with `DATABASE_URL`) | PASS |
| `p1-reg-package-unchanged` | PASS |
| `p1-bnd-*` (port / hub / code / current-status) | PASS |
