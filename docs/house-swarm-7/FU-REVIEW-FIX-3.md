# FU-REVIEW-FIX-3 — the review's hygiene findings: hermetic e2e, the `index.ts` export note, and the internal-path sweep

> INTERNAL — NOT DELIVERED.
> This is the vendor's own working record (repair log / lane report). It is kept in the
> repository because the delivered documents cite it as evidence, but it is **not part of
> what a buyer receives**. The delivered set is declared in `DELIVERY-MANIFEST.md` at the
> repository root, and the gate `server/scripts/proofs/wu5/delivery-manifest-check.mjs`
> enforces that classification.

**Work units:** `H7-REVIEW-FIX-HYGIENE` and its continuation `H7-REVIEW-FIX-REPAIR`
· **Correlation id:** `house-swarm-7-review-fix-report-20260929`
**Report revision:** `d37173f54ac42dce0abe189be6af7913b80b8761` · **Date:** 2026-09-29
· **Branch:** `codex/house-swarm-7-followup-ratelimit-20260928`

This report is an **evidence record**, prepared from the two lanes' own stdout, verbatim:
`house-swarm-7/fu-review-fix/input-hygiene-lane-stdout.txt` (the first hygiene lane) and
`house-swarm-7/fu-review-fix/input-repair-lane-stdout.txt` (the repair lane). **Nothing in this
file was verified by this work unit.** No gate was re-run, the tree was not re-read, and no other
file was edited. Where an input gives a fact, it is reported as given; where an input states
something as inferred rather than observed, this report says so; where the two inputs cannot be
reconciled, that is recorded rather than smoothed over. This file is not an approval of anything.

Files the two lanes changed (from their own ARTIFACTS sections):

- `server/scripts/proofs/wu4/e2e-web.mjs` — modified (hygiene lane; Finding on ISSUE 6)
- `server/src/index.ts` — comment only, no code change (`npx tsc --noEmit` exit 0)
- `server/scripts/proofs/fu/index-import-safety.mjs` — NEW (hygiene lane)
- `docs/house-swarm-7/WU6-CLAIMS-EVIDENCE.md` — legend rewritten, §8 constraints 5 and 6 added
  (hygiene lane), §9 appended and constraint 6 reworded (repair lane)
- `STAGE3_EVIDENCE_REPORT.md` — line 10 de-pathed (repair lane)
- `modules/rate-limit/PROVENANCE-RATELIMIT.md` — staging path de-pathed (repair lane)
- `modules/subscription/PROVENANCE-WU2.md` — staging path de-pathed (repair lane)
- `modules/subscription/PROVENANCE-WU3.md` — staging path de-pathed (repair lane)
- `docs/CURRENT_STATUS.md` — §2 item 8 added (repair lane)
- `docs/house-swarm-7/FU-REVIEW-FIX-3.md` — this file (this work unit)

No commit, no push, no deploy; no dependency added; no price, licence, currency or purchase-link
text anywhere in either lane or in this file; scratch files stayed under
`C:/Users/Win11/AppData/Local/Temp/`; nothing was left listening on port 3003.

---

## 1. Findings covered

The three items come from review
`06-Agent-Logs/WSTERA-House/reports/REVIEW-SWARM-7-MT01-WU2-WU6-CLAUDE-2026-09-28.md`.

### 1.1 ISSUE 5 (LOW · wu6) — `WU6-CLAIMS-EVIDENCE.md` cites an internal machine path

**What the review said** (line 34, verbatim):

```
5. **[LOW · wu6] `WU6-CLAIMS-EVIDENCE.md` อ้าง path เครื่องภายใน** (`D:/AI-Workspace/runtime/worktrees/...`) ในไฟล์ที่ผู้ซื้อจะได้ — ถ้าจะส่งมอบควรตัดหรือระบุว่าเป็นหลักฐานภายใน
```

(“`WU6-CLAIMS-EVIDENCE.md` cites an internal machine path (`D:/AI-Workspace/runtime/worktrees/...`)
in a file the buyer will receive — if it is to be delivered, cut it or mark it as internal
evidence.”)

**What changed:**

- `docs/house-swarm-7/WU6-CLAIMS-EVIDENCE.md` legend rewritten: `WT` / `CG(n)` / `RPT(n)` /
  `WU6-RUN` are now vendor-internal, the `D:/AI-Workspace/…` prefixes are dropped, and
  `06-Agent-Logs/WSTERA-House/reports/…` is used where a path was needed. §8 constraint 5 (the
  `index.ts` export note) and constraint 6 (no internal machine path) were added. No claim row, no
  Supabase wording and no other line of the ledger was touched (hygiene lane).
- `STAGE3_EVIDENCE_REPORT.md` line 10, the three provenance records, `docs/CURRENT_STATUS.md` §2
  item 8 and the ledger §9 were de-pathed / written by the repair lane (§5 below).
- `docs/CURRENT_STATUS.md` §2 item 8 was appended after item 7; items 1–7 and the
  “Correction, kept visible” paragraph are byte-identical (`manual-claims-proof.mjs` CHECKs
  10/11/12 pass, exit 0; item 4's FU-1 text unchanged).

**Raw command and exit code that show it** (repair lane):

```
python <docgates> --tree <WT> fu3-no-internal-path
  baseline  -> exit 1  FAIL  ['docs/house-swarm-7/WU6-CLAIMS-EVIDENCE.md: AI-Workspace',
                             'STAGE3_EVIDENCE_REPORT.md', 'PROVENANCE-RATELIMIT.md',
                             'PROVENANCE-WU2.md', 'PROVENANCE-WU3.md']
python .../docgates.py --tree ... fu3-no-internal-path
  final     -> exit 0  CHECK fu3-no-internal-path PASS 12 delivered documents carry no vendor machine path
grep -qE 'AI-Workspace|Users.Win11|wachiraya' STAGE3_EVIDENCE_REPORT.md                    -> exit 1 (clean)
grep -qE ... modules/{rate-limit/PROVENANCE-RATELIMIT,subscription/PROVENANCE-WU2,
            subscription/PROVENANCE-WU3}.md                                                -> exit 1 (clean)
grep -qE ... docs/house-swarm-7/WU6-CLAIMS-EVIDENCE.md                                     -> exit 1 (clean)
```

### 1.2 ISSUE 6 (LOW · both sets) — the e2e harness was not hermetic

**What the review said** (line 35, verbatim, and the footnote at line 19):

```
6. **[LOW · ทั้งชุด] e2e harness ไม่ hermetic** เมื่อมี provider key ใน env (ดู * ด้านบน)
```

(“the e2e harness is not hermetic when a provider key is in the environment”)

```
* **e2e ขึ้นกับ env**: ถ้า shell มี `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/`GEMINI_API_KEY` อยู่ harness เข้า branch provider-configured → เรียก provider จริง → check `ai-use-consumes-one-quota-unit` FAIL (8/9) เพราะ provider ตอบ error → handler ปล่อยโควตาคืน (counter_after=0) แต่ response ยังส่ง `usage:1` (ค่าก่อนปล่อย) — กูเจอเองเพราะ env กูมี OPENAI_API_KEY (และโดนเรียก provider จริง 1 ครั้ง) · **unset key ทั้งสามแล้วรัน = 9/9** · ไม่ใช่บั๊กของ branch แต่ harness ไม่ hermetic และ `usage` ใน response หลัง release เพี้ยน (พฤติกรรมเดิมของ WU-3)
```

(“e2e depends on env: if the shell has any of the three keys the harness enters the
provider-configured branch and calls a real provider, so `ai-use-consumes-one-quota-unit` FAILs
(8/9) … unset all three keys and it is 9/9 … not a bug of the branch, but the harness is not
hermetic, and `usage` in the response after release is off (pre-existing WU-3 behaviour).”)

**What changed:** `server/scripts/proofs/wu4/e2e-web.mjs` is now hermetic **by default** — it
removes `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` and `GEMINI_API_KEY` from its own process
environment before the AI branch is decided, so the branch is deterministic on every machine; the
provider branch is reachable only deliberately, by opt-in `WU4_E2E_PROVIDER_BRANCH=1`. It reports
what it did in an `INFO` line. See §2 for the mechanism and §7 for the verbatim runs. Nothing else
in the harness moved: the nine check names, the saved-HTML `SAVED` lines (10 files), the loopback
guard and the `NODE_ENV=production` refusal are untouched.

**Raw commands and exit codes that show it** (hygiene lane):

```
node --check server/scripts/proofs/wu4/e2e-web.mjs                              -> 0
cd server && OPENAI_API_KEY=proof-fixture-key node scripts/proofs/wu4/e2e-web.mjs -> 0
cd server && OPENAI_API_KEY=proof-fixture-key ANTHROPIC_API_KEY=proof-fixture-key GEMINI_API_KEY=proof-fixture-key node scripts/proofs/wu4/e2e-web.mjs -> 0
cd server && OPENAI_API_KEY=proof-fixture-key npm run test:web:e2e               -> 0
```

All three runs report `SUMMARY checks=9 passed=9 failed=0`; **no FAIL line in any run**.

### 1.3 The `index.ts` check-list note (review “จุดตรวจตามใบสั่ง”, line 22)

**What the review said** (verbatim):

```
- **`index.ts` diff** — อ่านแล้ว เก็บถูก: base ไม่มี `runMigrations`/`initSubscriptionRepositories` ใน `server/src` เลย → ถ้า revert คู่มือที่บอกว่า migration รันตอนบูตจะผิด · entry-point guard ป้องกัน import ไป bind พอร์ต · **แต่ลบ `export { app }` เดิมออก** (grep ไม่เจอใครใช้ ทดสอบผ่าน) — ควรอยู่ในโน้ต
```

(“the `index.ts` diff was read and is kept correctly … the entry-point guard prevents an import
from binding the port · **but the old `export { app }` was deleted** (grep found nobody using it,
tests pass) — this should be in a note.”)

**What changed:** the deletion is **kept** and is now recorded where the review asked — a comment
in `server/src/index.ts` naming what the base did, why the module-scope `app` is gone and the
evidence — plus `docs/house-swarm-7/WU6-CLAIMS-EVIDENCE.md` §8 constraint 5 and
`docs/CURRENT_STATUS.md` §2 item 8. Because it was a recorded decision, a runnable proof was added
(`server/scripts/proofs/fu/index-import-safety.mjs`, 5 checks). See §3.

**Raw commands and exit codes that show it** (hygiene lane, plus the repair lane's gate and
re-run):

```
git grep -nIE "src/index"                                                      -> 0
git rev-list --all | while read r; do git grep -nIE "['\"][^'\"]*src/index['\"]" "$r"; done -> 1 (no matches, all revisions)
git grep -nIE "^\s*(import|export)[^;]*from ['\"][^'\"]*index"                 -> 0 (no src/index importer)
cd server && npx tsc --noEmit                                                  -> 0
cd server && npx tsx scripts/proofs/fu/index-import-safety.mjs                  -> 0   (5/5, both lanes)
python .../docgates.py --tree ... fu3-index-export
  -> exit 0  CHECK fu3-index-export PASS index.ts keeps the guard, exports createApp+main, and records the `app` decision
```

The `index.ts` comment is comment-only: `npx tsc --noEmit` exit 0.

---

## 2. The hermetic change (ISSUE 6)

**Mechanism.** The harness removes `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` and `GEMINI_API_KEY`
from **its own process environment** before the AI branch is decided. From that point the branch
is deterministic on every machine: `branch=no-provider-configured`.

**Opt-in.** The provider branch is reachable only deliberately, by setting
`WU4_E2E_PROVIDER_BRANCH=1`.

**The `INFO` line it prints** (hygiene lane, verbatim, one key set):

```
INFO provider-key-hygiene hermetic default: removed OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY from this process's environment before the AI branch was decided (the caller's environment had: OPENAI_API_KEY); no key value was read or printed. The branch is therefore deterministic on every machine: branch=no-provider-configured. The provider branch is reachable only deliberately, by opt-in WU4_E2E_PROVIDER_BRANCH=1
INFO ai-provider configured=false branch=no-provider-configured (… opt-in is WU4_E2E_PROVIDER_BRANCH=1)
CHECK ai-use-consumes-one-quota-unit PASS branch=no-provider-configured (hermetic default: …) gate_allowed_then_handler_503_observed=true handler_status=503 … unit_released=true gate_refusal_on_same_route_observed=true refusal_status=429 refusal_code=QUOTA_EXCEEDED
SUMMARY checks=9 passed=9 failed=0
```

**The three measured runs** — each 9 PASS / 0 FAIL, each exit 0:

| run | command | INFO “the caller's environment had” | result | exit |
|---|---|---|---|---|
| one key | `cd server && OPENAI_API_KEY=proof-fixture-key node scripts/proofs/wu4/e2e-web.mjs` | `OPENAI_API_KEY` | `SUMMARY checks=9 passed=9 failed=0` | 0 |
| all three keys | `cd server && OPENAI_API_KEY=proof-fixture-key ANTHROPIC_API_KEY=proof-fixture-key GEMINI_API_KEY=proof-fixture-key node scripts/proofs/wu4/e2e-web.mjs` | `OPENAI_API_KEY,ANTHROPIC_API_KEY,GEMINI_API_KEY` | `SUMMARY checks=9 passed=9 failed=0` | 0 |
| package script | `cd server && OPENAI_API_KEY=proof-fixture-key npm run test:web:e2e` | (same as the key the shell carried) | `SUMMARY checks=9 passed=9 failed=0` | 0 |

The first key set is quoted verbatim above. The all-three-keys run is “identical” per the hygiene
lane's own summary, with the caller's-environment list
`OPENAI_API_KEY,ANTHROPIC_API_KEY,GEMINI_API_KEY`, `SUMMARY checks=9 passed=9 failed=0`, exit 0,
and “No FAIL line in any run. `npm run test:web:e2e` with a key in the shell: same, exit 0.”

**Honest boundary of the change:** the harness was made hermetic; the `usage`-after-release
behaviour the review's footnote mentions (response says `usage:1` after the unit was released) was
**not** changed by either lane, and the review itself recorded it as pre-existing WU-3 behaviour.
This report does not claim it was fixed.

---

## 3. The `index.ts` decision

**The importer search and its result.** No code file imports `server/src/index.ts`, in any
revision:

- `git grep -nIE "src/index"` (exit 0) returned only (a) prose in `docs/`, `scripts/` and
  `server/ROUND*_HANDOFF.md`, and (b) `server/package.json:7,8` —
  `"dev": "tsx watch src/index.ts"`, `"start": "tsx src/index.ts"` — i.e. the file is **run as an
  entry point, which is not an import**.
- The all-revisions specifier search
  (`git rev-list --all | while read r; do git grep -nIE "['\"][^'\"]*src/index['\"]" "$r"; done`)
  returned **exit 1 — no matches across every revision**.
- The import-statement search
  (`git grep -nIE "^\s*(import|export)[^;]*from ['\"][^'\"]*index"`) returned exit 0 with **no
  `src/index` importer**.
- The base revision `601033249d2b1ab005d1ca83dfbe33f66af6e356:server/src/index.ts` (exit 0) has
  `const app = createApp();` / `app.listen(port,…)` / `export { app, createApp };` **at module
  scope** — that is the shape the entry-point guard replaced.
- `git show 09730e2:server/src/index.ts` exit 0 (the wu6 branch revision the review read).

**What was deliberately NOT done, and why:**

- **No module-scope `app` was recreated.** With zero importers in every revision, no caller needs
  the export; recreating it would restore import-time `app.listen`.
- **No accessor was invented.** No getter, no lazy singleton, no `getApp()` was added to work
  around the missing export — inventing an API nobody calls would be a change without a caller.

So `export { createApp, main };` stays, the entry-point guard stays, and a comment in
`server/src/index.ts` records what the base did, why the module-scope `app` is gone and the
evidence. `npx tsc --noEmit` exit 0 with the comment in place.

**The new proof's five checks** — `server/scripts/proofs/fu/index-import-safety.mjs`, run
`cd server && npx tsx scripts/proofs/fu/index-import-safety.mjs` (hygiene lane, verbatim; the
repair lane re-ran it on the delivered revision: `SUMMARY checks=5 passed=5 failed=0`, exit 0):

```
CHECK index-import-binds-no-listening-port PASS … observed listen_calls child_A=[] child_B=[], tcp_server_wraps child_A=0 child_B=0, both exit 0
CHECK index-import-starts-no-database-work PASS … boot lines child_A=[] child_B=[]
CHECK index-exports-createApp-and-main-without-app PASS … observed exports child_A=["createApp","main"] child_B=["createApp","main"]
CHECK module-scope-app-removed-and-entry-guard-present PASS … guard_present=true module_scope_app=false createApp_reads_demo_auth=true
CHECK nothing-imports-server-index PASS … scanned 149 code file(s), found 0 importers
SUMMARY checks=5 passed=5 failed=0
```

How the proof works, as the lane describes it: child A is given `DATABASE_URL` on a dead loopback
port and child B has `DATABASE_URL` removed; both import `server/src/index.ts` via
`node --import tsx` with `net.Server.prototype.listen` and the module's console output captured.

---

## 4. The mutant results — against the DELIVERED harness revision

The first lane ran two mutants against a harness revision that **predated** the `codeOnly()`
comment-stripping helper it later added, and recorded the caveat itself: *“those two mutant runs
were made against the harness revision BEFORE I added the `codeOnly()` comment-stripping helper;
the final 5/5 run is after it. I did not re-run the mutants against the final revision.”* It named
re-taking those runs as the first thing it would do if resumed.

**The repair lane re-ran both mutants against the delivered `index-import-safety.mjs` revision.**
These are the runs the first lane had declared it owed. Both exit 1:

```
cd server && INDEX_IMPORT_SAFETY_INDEX=<TEMP>/m1-base-module-scope.mts npx tsx scripts/proofs/fu/index-import-safety.mjs
  SUMMARY checks=5 passed=2 failed=3
  failed_names=[index-import-binds-no-listening-port,
                index-exports-createApp-and-main-without-app,
                module-scope-app-removed-and-entry-guard-present]                        -> exit 1

cd server && INDEX_IMPORT_SAFETY_INDEX=<TEMP>/m2-guard-forced.mts npx tsx scripts/proofs/fu/index-import-safety.mjs
  SUMMARY checks=5 passed=1 failed=4
  failed_names=[index-import-binds-no-listening-port,
                index-import-starts-no-database-work,
                index-exports-createApp-and-main-without-app,
                module-scope-app-removed-and-entry-guard-present]                        -> exit 1
```

What the mutants are, and what was observed:

- **m1** — the base `6010332:server/src/index.ts` (module-scope `app` + `listen`), with only the
  import specifier made absolute so it loads from temp. Observed:
  `net.Server#listen was called with ["3003|…"]`, `the module exports "app"`,
  `the module-scope const app = createApp(); is back`.
- **m2** — the delivered `index.ts` with the guard removed, rebuilt from the delivered file at
  generation time. Observed: child A `Migration/seed failed: connect ECONNREFUSED 127.0.0.1:9`,
  child B `Subscription repositories ready: persistent=false`, listener on 3003.

Two honesty notes recorded by that lane, kept here rather than dropped: (a) a first m2 attempt as
`.ts` in temp was loaded as CJS and died on
`Top-level await is currently not supported with the "cjs" output format` before any behaviour —
both mutants were regenerated as `.mts` and the results above are the ESM run; (b) m1's children
hit the harness's 120 s timeout (SIGTERM) because the base revision's live listener keeps the child
alive — **the failures are observed, not inferred**. Port check, before and after the mutant runs:
`netstat -ano | grep LISTENING | grep ':3003 '` → nothing listening on 3003.

For the record, the **earlier** (pre-`codeOnly()`) runs, as the first lane reported them: against
the base revision verbatim the harness exited 1 with `index-import-binds-no-listening-port`,
`index-exports-…-without-app` and `module-scope-app-removed…` red; with the delivered file's guard
forced on it exited 1 with four checks red. The delivered revision's numbers are the ones in the
table above.

---

## 5. The path work

### 5.1 Each line changed, old → new, byte for byte

**`STAGE3_EVIDENCE_REPORT.md` line 10** — only that line changed:

```
old: Repo: `D:\AI-Workspace\projects\saas-product-hub\products\multi-tenant-ai`
new: Repo: `saas-product-hub/products/multi-tenant-ai`
```

**`modules/rate-limit/PROVENANCE-RATELIMIT.md` lines 13–16** — identity kept:

```
old: staged read-only reference: / D:/AI-Workspace/runtime/hermes-native/workspace/house-swarm-7/fu-ratelimit/hub-ratelimit/rate-limit/ / (the commit SHA above is recorded in .../hub-ratelimit/SOURCE_COMMIT.txt)
new: staged read-only reference: / vendor-internal staging copy, not part of the delivered folder / — a vendor-local READ-ONLY copy of `source_repo` at the `source_commit` above (the commit SHA above is recorded in the staging copy's SOURCE_COMMIT.txt)
```

**`modules/subscription/PROVENANCE-WU2.md` lines 11–12:**

```
old: source_path: modules/subscription (read-only staging: D:/AI-Workspace/runtime/hermes-native/workspace/house-swarm-7/wu2/hub84)
new: source_path: modules/subscription (read-only staging: vendor-internal / staging copy, not part of the delivered folder)
```

**`modules/subscription/PROVENANCE-WU3.md` lines 12–13:**

```
old: upstream_readonly_copy: D:/AI-Workspace/runtime/hermes-native/workspace/ house-swarm-7/wu2/hub84 (WU-2 staging copy)
new: upstream_readonly_copy: vendor-internal staging copy, not part of the delivered folder (WU-2 staging copy)
```

**`docs/house-swarm-7/WU6-CLAIMS-EVIDENCE.md` §8 constraint 6** — reworded by the repair lane
(the old text contained the very token the rule bans, which is why the gate flagged the ledger):

```
old: `D:/AI-Workspace/…`, `D:\AI-Workspace\…`, `C:\Users\Win11\…`
new: "a `D:`-rooted vendor path, a `C:`-rooted user path"
```

**`docs/house-swarm-7/WU6-CLAIMS-EVIDENCE.md` lines 15, 17, 18 (the legend)** — changed by the
**hygiene lane**. Note on the evidence: neither input records this change byte for byte; the
hygiene lane records only its effect — `WT` / `CG(n)` / `RPT(n)` / `WU6-RUN` are now
vendor-internal, the `D:/AI-Workspace/…` prefixes are dropped, and
`06-Agent-Logs/WSTERA-House/reports/…` is used where a path was needed. The byte-for-byte old text
of those three lines is therefore **not available from these inputs** and is not reconstructed
here.

**Preserved and re-verified by grep** after the de-pathing: `modules-hub`,
`cd88c570ab57f6976d15f85d09973d0cfbf0cd63`, `84ebb0d9a0734a6b91a2c78e8f66759736393efa`,
`copied_at: 2026-09-28 (UTC)`, and “`modules-hub` was never modified”. The
`fu3-provenance-identity` gate passed:
`CHECK fu3-provenance-identity PASS all three provenance records keep the modules-hub identity and
commit SHA` → exit 0 (it also passed at baseline, exit 0).

### 5.2 The residual, in two groups

**Group 9a — the seven vendored upstream documents.** Left alone deliberately: editing them would
falsify the provenance records. Recorded in the ledger's §9 (9a) with hit lines and the reason:

| file | hit lines |
|---|---|
| `modules/auth-supabase/.agy-design-prompt.txt` | 4 |
| `modules/auth-supabase/DESIGN.md` | 533 |
| `modules/payment/.agy-prompt.md` | 6 |
| `modules/payment/DESIGN.md` | 631 |
| `modules/rate-limit/DESIGN.md` | 522 |
| `modules/tenant-context/agy-prompt.md` | 6, 11, 39 |
| `modules/webhook-receiver/DESIGN.md` | 567 |

**The distinction that must not be flattened** (the reason the ledger's §9 records measured
honesty instead of the word “byte-identical” for all seven):

- **The module records assert a copy-time identity.** That identity was verified with `diff -q`
  against the staging copy **when the copy was made** — all SAME. That is what the provenance
  records claim, and that claim is what editing the vendored files would falsify.
- **A fresh `diff -q` against today's `modules-hub` checkout is not all-SAME.** Per the repair
  lane: SAME only for `modules/rate-limit/DESIGN.md` and `modules/tenant-context/agy-prompt.md`,
  and DIFFER for the rest (that lane's per-file detail: “SAME for `rate-limit/DESIGN.md` and
  `tenant-context/agy-prompt.md`, DIFFER for four others, ABSENT for the two `.agy*` prompt
  files”).
- **Consequence:** today's diff does **not** falsify the copy-time claim — the copy-time identity
  and today's checkout state are two different measurements — and “byte-identical” is exactly true
  today only for the modules whose records assert it. This report does not call all seven
  “byte-identical”.
- **Unreconciled detail, recorded rather than resolved:** the repair lane's per-file split
  (2 SAME + 4 DIFFER + 2 ABSENT = 8) does not add up to a seven-file list. The exact per-file
  SAME/DIFFER/ABSENT assignment for the five remaining files cannot be recovered from these two
  inputs, which is why §5.2 states the split exactly as the input states it and does not compute a
  reconciliation.

**Group 9b — the two files where the path is an illustrative example of a Windows path trap, not
a location.** Recorded and **left to the controller's decision**; neither file was edited:

| file | hit lines | as recorded |
|---|---|---|
| `scripts/house-swarm-7/setup.sh` | 211, 213 | `/d/AI-Workspace/...` |
| `server/scripts/proofs/fu/setup-dbcheck-proof.mjs` | 28, 30 | `D:\d\AI-Workspace\...\db-check.mjs` |

Both lanes state the same position: these are not in the work unit's named document list, they
carry the path as an illustrative example rather than as a location, and whether they count as
“documents shipped in the delivery” for the internal-path rule is a controller/owner decision, not
the lane's. The repair lane put this plainly in §9 (9b) — “states plainly the decision belongs to
the controller/owner. Neither file was edited.”

### 5.3 The sweeps, as recorded

- **Hygiene lane**, at the start of its session,
  `git grep -nIE 'AI-Workspace|Users.Win11|wachiraya'` → exit 0, **13 lines**; the ledger's own
  three lines (15, 17, 18) were then fixed.
- **Repair lane**, baseline before any edit,
  `git grep -nIE 'AI-Workspace|Users.Win11|wachiraya' -- .` → exit 0, **19 hits**.
- The repair lane did **not** re-run the final full sweep verbatim after its last §9 edit and says
  so: “I am reporting this as inferred from measured per-file checks, not as an observed final
  `git grep`, because I ran out of turns before re-running it.” The remaining tracked hits it
  reports are therefore the composition of (i) the five files de-pathed (each individually clean,
  `grep` exit 1 each, and `fu3-no-internal-path` passing over all 12 documents) and (ii) the §9
  residual groups 9a and 9b listed above. **This report repeats that as the lane's reported
  composition, not as an observed final sweep.**
- The difference between the two baseline counts (13 lines vs 19 hits) is **not explained by
  either input** — different scopes/commands are recorded as written, and no reconciliation is
  attempted here.

---

## 6. What is still open

1. **The two §9b files are the controller's open decision.**
   `scripts/house-swarm-7/setup.sh` (~211, 213) and
   `server/scripts/proofs/fu/setup-dbcheck-proof.mjs` (~28, 30) carry the path as an illustrative
   example of a Windows path trap. Neither lane decided whether they count as “an internal machine
   path” for the rule; neither file was edited. The decision is the controller's (and, for
   delivery questions, the owner's).
2. **The ledger's C49 / C52 / C59 rows and §8 constraints are FU-2's verified deliverable.** This
   lane added only **§9** (append-only) plus the **§8 constraint 6 rewording** (the old constraint
   text quoted the banned token, which is why the gate flagged the ledger). It did not rewrite any
   claim row. `ledger-rows-gate.py` records the rows as untouched:
   `CHECK ledger-rows-unchanged PASS rows=64 sha=ef6d2b651e853b8e expected=ef6d2b651e853b8e` →
   exit 0, and constraint 4 (the local test database is never presented as the buyer's
   configuration) is untouched.
3. **One open finding recorded in §9, not decided** (repair lane): the ledger's own §9/§8 prose
   cannot both discuss the banned path patterns and stay free of them, so both now *describe* the
   tokens instead of quoting them. If the controller wants the literal sweep command inside the
   delivered ledger, that requirement must be relaxed or the command moved out of the delivered
   set.
4. **The first lane's unfinished acceptance evidence set is accounted for.** It listed
   `claims-check.mjs`, `manual-claims-proof.mjs`, the supabase fixture harness, the final
   `git grep` sweep and a no-key `e2e-web.mjs` run as incomplete for the finished unit. The repair
   lane ran the first three green — `manual-claims-proof.mjs` `SUMMARY claims=13 passed=13 failed=0`
   exit 0, `claims-check.mjs` `SUMMARY checks=8 passed=8 failed=0` exit 0,
   `supabase-claims-fixtures.mjs` `SUMMARY cases=9 passed=9 failed=0` exit 0 — and the §5.3 sweep
   position applies to the fourth. A bare no-key run of `e2e-web.mjs` (no provider variable at all)
   **is not recorded in either input**; the three measured runs in §2 all carry at least one key,
   including the package script. This report marks that as **not observed**, not as passing.
5. **Not claimed:** nothing here asserts that the review's findings are closed, that the tree is
   delivered, or that FU-2's work is complete. This is an evidence record at revision
   `d37173f54ac42dce0abe189be6af7913b80b8761`.

---

## 7. Commands and exit codes, verbatim from the inputs

**Hygiene lane** (as recorded, exact, with exit codes as observed):

```
git show 09730e2:server/src/index.ts                                -> 0
git show 601033249d2b1ab005d1ca83dfbe33f66af6e356:server/src/index.ts -> 0
  (base = `const app = createApp();` / `app.listen(port,…)` / `export { app, createApp };` at module scope)
git grep -nIE "src/index"                                           -> 0
  (prose in docs/, scripts/, server/ROUND*_HANDOFF.md + server/package.json
   "dev"/"start": "tsx src/index.ts" only — no import)
git rev-list --all | while read r; do git grep -nIE "['\"][^'\"]*src/index['\"]" "$r"; done -> 1 (no matches, all revisions)
git grep -nIE "^\s*(import|export)[^;]*from ['\"][^'\"]*index"      -> 0 (no src/index importer)
node --check server/scripts/proofs/wu4/e2e-web.mjs                  -> 0
cd server && OPENAI_API_KEY=proof-fixture-key node scripts/proofs/wu4/e2e-web.mjs                    -> 0
cd server && OPENAI_API_KEY=proof-fixture-key ANTHROPIC_API_KEY=proof-fixture-key GEMINI_API_KEY=proof-fixture-key node scripts/proofs/wu4/e2e-web.mjs -> 0
cd server && OPENAI_API_KEY=proof-fixture-key npm run test:web:e2e  -> 0
cd server && npx tsx scripts/proofs/fu/index-import-safety.mjs      -> 0
cd server && npx tsc --noEmit                                       -> 0
INDEX_IMPORT_SAFETY_INDEX=<temp>/mutant1-base-module-scope.ts npx tsx scripts/proofs/fu/index-import-safety.mjs -> 1
INDEX_IMPORT_SAFETY_INDEX=<temp>/mutant2-guard-forced.mts     npx tsx scripts/proofs/fu/index-import-safety.mjs -> 1
node "C:/Users/Win11/AppData/Local/Temp/h7fu3-probe-env.mjs"        -> 0 (local cluster 127.0.0.1:55432, mt01_dev + mt01_fu3 migrated)
```

Hygiene lane, `git grep -nIE 'AI-Workspace|Users.Win11|wachiraya'` at the start of its session:
exit 0, 13 lines (the ledger's lines 15, 17, 18 among them).

**Repair lane** (as recorded; `<docgates>`, `<WT>`, `<TEMP>` are the lane's own placeholders):

```
Baseline, before any edit:
    python <docgates> --tree <WT> fu3-no-internal-path   -> exit 1  FAIL  ['docs/house-swarm-7/WU6-CLAIMS-EVIDENCE.md: AI-Workspace', 'STAGE3_EVIDENCE_REPORT.md', 'PROVENANCE-RATELIMIT.md', 'PROVENANCE-WU2.md', 'PROVENANCE-WU3.md']
    python <docgates> --tree <WT> fu3-index-export       -> exit 0  PASS
    python <docgates> --tree <WT> fu3-provenance-identity -> exit 0 PASS
    git grep -nIE 'AI-Workspace|Users.Win11|wachiraya' -- .   -> exit 0, 19 hits

Final gate run (after all edits):
    python D:/AI-Workspace/runtime/hermes-native/workspace/house-swarm-7/fu-review-fix/docgates.py --tree D:/AI-Workspace/runtime/worktrees/house-swarm-7-fu-ratelimit fu3-no-internal-path
      CHECK fu3-no-internal-path PASS 12 delivered documents carry no vendor machine path        -> exit 0
    python .../docgates.py --tree ... fu3-index-export
      CHECK fu3-index-export PASS index.ts keeps the guard, exports createApp+main, and records the `app` decision -> exit 0
    python .../docgates.py --tree ... fu3-provenance-identity
      CHECK fu3-provenance-identity PASS all three provenance records keep the modules-hub identity and commit SHA -> exit 0

Guard checks:
    python .../ledger-rows-gate.py
      CHECK ledger-rows-unchanged PASS rows=64 sha=ef6d2b651e853b8e expected=ef6d2b651e853b8e  -> exit 0
    python .../snapshot-tools.py verify .../guard-fu3-verified.manifest
      UNCHANGED 7/7                                                                               -> exit 0
    grep -qE 'AI-Workspace|Users.Win11|wachiraya' STAGE3_EVIDENCE_REPORT.md            -> exit 1 (clean)
    grep -qE ... modules/{rate-limit/PROVENANCE-RATELIMIT,subscription/PROVENANCE-WU2,subscription/PROVENANCE-WU3}.md -> exit 1 (clean)
    grep -qE ... docs/house-swarm-7/WU6-CLAIMS-EVIDENCE.md                             -> exit 1 (clean)

Delivered proof, re-run:
    cd server && npx tsx scripts/proofs/fu/index-import-safety.mjs
      SUMMARY checks=5 passed=5 failed=0                                                          -> exit 0

Mutant runs against the DELIVERED harness revision (step 5):
    cd server && INDEX_IMPORT_SAFETY_INDEX=<TEMP>/m1-base-module-scope.mts npx tsx scripts/proofs/fu/index-import-safety.mjs
      SUMMARY checks=5 passed=2 failed=3 failed_names=[index-import-binds-no-listening-port,index-exports-createApp-and-main-without-app,module-scope-app-removed-and-entry-guard-present]  -> exit 1
    cd server && INDEX_IMPORT_SAFETY_INDEX=<TEMP>/m2-guard-forced.mts npx tsx scripts/proofs/fu/index-import-safety.mjs
      SUMMARY checks=5 passed=1 failed=4 failed_names=[index-import-binds-no-listening-port,index-import-starts-no-database-work,index-exports-createApp-and-main-without-app,module-scope-app-removed-and-entry-guard-present]  -> exit 1

Regression harnesses (all still green, so the fenced documents did not move):
    cd server && node scripts/proofs/fu/manual-claims-proof.mjs   -> exit 0, SUMMARY claims=13 passed=13 failed=0
    cd server && node scripts/proofs/wu6/claims-check.mjs         -> exit 0, SUMMARY checks=8 passed=8 failed=0
    cd server && node scripts/proofs/fu/supabase-claims-fixtures.mjs -> exit 0, SUMMARY cases=9 passed=9 failed=0

Port:
    netstat -ano | grep LISTENING | grep ':3003 '   -> nothing listening on 3003 (checked before and after the mutant runs)
```

Both lanes end their own stdout with `STATE: FAIL` — incomplete, not blocked: the hygiene lane ran
out of turns with Finding 3 only partly applied, and the repair lane finished steps 1–5 but never
wrote `docs/house-swarm-7/FU-REVIEW-FIX-3.md` (this file), so it did not claim PASS. Neither lane
claimed its work was closed, and this report repeats that.

---

## Thai summary — สรุปภาษาไทย

รายงานนี้เป็น **บันทึกหลักฐาน** ของงาน hygiene ในรีวิว
`REVIEW-SWARM-7-MT01-WU2-WU6-CLAUDE-2026-09-28.md` เขียนขึ้นจาก stdout ของสองเลน (เลน hygiene
แรก และเลน repair) แบบคำต่อคำ **งานหน่วยนี้ไม่ได้ตรวจสอบอะไรเองเลย** ไม่ได้รัน gate ซ้ำ ไม่ได้อ่าน
worktree ซ้ำ และไม่ได้แก้ไฟล์อื่นเลยนอกจากไฟล์นี้

1. **ISSUE 5 (LOW · wu6)** — `WU6-CLAIMS-EVIDENCE.md` อ้าง path เครื่องภายใน: แก้โดยเขียนตำนาน
   ของ ledger ใหม่ (`WT` / `CG(n)` / `RPT(n)` / `WU6-RUN` เป็น vendor-internal, ตัด prefix
   `D:/AI-Workspace/…`) เพิ่ม §8 ข้อ 5 และข้อ 6 และ de-path `STAGE3_EVIDENCE_REPORT.md` บรรทัด 10,
   provenance 3 ไฟล์, เพิ่ม `docs/CURRENT_STATUS.md` ข้อ 8 · หลักฐาน: gate `fu3-no-internal-path`
   จาก exit 1 (FAIL) เป็น exit 0 PASS “12 delivered documents carry no vendor machine path” และ
   `grep -qE` ต่อไฟล์ได้ exit 1 (สะอาด)
2. **ISSUE 6 (LOW · ทั้งชุด)** — e2e harness ไม่ hermetic: ตอนนี้ harness **ลบ
   `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` ออกจาก environment ของตัวเองก่อนตัดสินใจ
   เข้า branch AI** ทำให้ผลเหมือนกันทุกเครื่อง และ branch provider เข้าได้เฉพาะเมื่อสั่งเองด้วย
   `WU4_E2E_PROVIDER_BRANCH=1` พร้อมพิมพ์บรรทัด `INFO` บอกสิ่งที่ทำ · วัดสามรอบ (มีคีย์เดียว,
   มีครบสามคีย์, และ `npm run test:web:e2e`) ได้ **9 PASS / 0 FAIL ทุกรอบ** exit 0
3. **โน้ต `index.ts`** — ไม่มีไฟล์โค้ดไหน import `server/src/index.ts` ในทุก revision
   (`git grep -nIE "src/index"` exit 0 เจอแต่ prose กับ `server/package.json` ที่รันเป็น entry point
   ซึ่งไม่ใช่ import; ค้นทุก revision exit 1 ไม่เจอเลย) จึง **ไม่คืน module-scope `app` และไม่
   ประดิษฐ์ accessor ขึ้นมา** เพราะไม่มีผู้เรียก · เพิ่ม proof ใหม่
   `index-import-safety.mjs` 5 checks ผ่าน 5/5 exit 0
4. **mutant** — ทั้งสองตัวรันใหม่ **เทียบกับ revision ที่ส่งมอบจริง** ของ
   `index-import-safety.mjs` แล้ว exit 1 ทั้งคู่ (m1: 2 ผ่าน 3 ตก, m2: 1 ผ่าน 4 ตก พร้อมชื่อ check
   ที่ตก) รอบเก่าเป็นการรันก่อนมี `codeOnly()` และเลนแรกประกาศเองว่ายังค้าง — การรันชุดนี้คือชุดที่
   เลนแรกบอกว่าติดค้างและต้องรันซ้ำ
5. **งานเรื่อง path** — แสดงบรรทัดที่แก้แบบเก่า → ใหม่ ทีละบรรทัด · ส่วนที่เหลือแบ่งเป็น 9a เอกสาร
   vendored 7 ไฟล์ (ปล่อยไว้ เพราะแก้แล้วจะทำให้บันทึก provenance เป็นเท็จ) และ 9b สองไฟล์ที่ path
   เป็นเพียงตัวอย่างของกับดัก path บน Windows (`scripts/house-swarm-7/setup.sh` ~211/213,
   `server/scripts/proofs/fu/setup-dbcheck-proof.mjs` ~28/30) — บันทึกไว้และ **ยกให้ controller
   ตัดสิน** · จุดสำคัญที่ห้ามสับสน: บันทึกของโมดูลอ้าง **ตัวตน ณ เวลาคัดลอก** (ตรวจด้วย `diff -q`
   กับ staging copy ตอนคัดลอก ได้ SAME ทั้งหมด) ส่วน `diff -q` กับ `modules-hub` วันนี้ได้ SAME
   เฉพาะ `modules/rate-limit/DESIGN.md` และ `modules/tenant-context/agy-prompt.md` ที่เหลือ
   DIFFER — ดังนั้นข้ออ้าง ณ เวลาคัดลอกไม่ถูกหักล้างด้วย diff วันนี้ และรายงานนี้ไม่เรียบทั้งเจ็ดไฟล์
   ว่า “byte-identical”
6. **สิ่งที่ยังเปิดอยู่** — สองไฟล์ใน §9b (ให้ controller ตัดสิน) · แถว C49/C52/C59 กับ §8 constraint
   ใน ledger เป็นงานที่ FU-2 ตรวจแล้ว ส่วนเลนนี้เพิ่มเฉพาะ §9 และแก้ถ้อยคำ §8 ข้อ 6 เท่านั้น ·
   และการรัน `e2e-web.mjs` แบบ **ไม่มีคีย์เลย** ไม่ปรากฏในอินพุตทั้งสอง จึงบันทึกเป็น “ยังไม่ได้
   สังเกต” ไม่ใช่ผ่าน
7. **คำสั่งและ exit code** — คัดลอกมาจากอินพุตทั้งสองแบบคำต่อคำ

ทั้งสองเลนจบด้วย `STATE: FAIL` (งานไม่ครบ ไม่ได้ถูกบล็อก) และ **ไม่ได้ประกาศ PASS** รายงานนี้จึง
ไม่ใช่การอนุมัติงานใด ๆ ทั้งสิ้น
