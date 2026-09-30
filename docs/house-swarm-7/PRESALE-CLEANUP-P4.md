# MT01 pre-sale cleanup — lane P4: an empty database must be PENDING, not a false connection failure

> INTERNAL — NOT DELIVERED.
> This is the vendor's own working record (repair log / lane report). It is kept in the
> repository because the delivered documents cite it as evidence, but it is **not part of
> what a buyer receives**. The delivered set is declared in `DELIVERY-MANIFEST.md` at the
> repository root, and the gate `server/scripts/proofs/wu5/delivery-manifest-check.mjs`
> enforces that classification.

**Lane:** `MT01-PRESALE-P4-EMPTY-DB-PENDING` (correlation `house-swarm-7-mt01-presale-p4-20260929`)
**Task:** `HOUSE-SWARM-7-MT01-PRESALE-CLEANUP` (Owner direct, 2026-09-29)
**Branch:** `codex/mt01-presale-cleanup-20260929` · base `f03c48d` · worktree `…/worktrees/mt01-presale-cleanup`
**Status:** substantive work **done and verified by the controller's own gates** · report written by the controller (§6) · not committed, not merged

---

## 1. The finding

Review `reports/REVIEW-SWARM-7-MT01-FINAL-852DFB1-CLAUDE-2026-09-29.md`, ISSUE 4 (LOW-3):

> `setup.sh` บน DB เปล่าพิมพ์ `CHECK connection FAIL relation "plans" does not exist` ต่อจาก
> `CHECK connection PASS` (ฉลากซ้ำ/ชวนสับสน) ทั้งที่สคริปต์สรุป PENDING ถูกต้อง — ผลสุดท้ายถูก
> แค่ข้อความ diagnostic ของ `db-check.mjs`

Reproduced by the controller at `f03c48d` on the genuinely empty database
`mt01_presale_empty`:

```
CHECK database-url-present PASS ...
CHECK connection PASS connected to the database in DATABASE_URL
CHECK migration-tables FAIL missing: ... ; start the server once so the migrations run
CHECK connection FAIL relation "plans" does not exist      <- FALSE
db-check: 2 of 4 checks FAILED
```

The connection had **succeeded** — the line above says so. `db-check.mjs` ran its seed-plan
query (`SELECT id FROM plans WHERE id IN ($1, $2)`) after the migration-tables check, that
query failed because the `plans` table does not exist yet, and the file's single `catch`
reported **every** post-connect failure under the name `connection`. `setup.sh` then worked
around the misattribution by testing `CHECK migration-tables FAIL` *before*
`CHECK connection FAIL` — an ordering hack whose own comment admitted the two lines were
misattributed. The verdict (PENDING, exit 0) was correct; it was correct on top of a wrong
diagnostic.

## 2. What was fixed

### 2.1 `scripts/house-swarm-7/db-check.mjs` — report the truth, name nothing falsely

Observed on the same empty database **after** the fix:

```
CHECK database-url-present PASS DATABASE_URL is set in the process environment, value not printed
CHECK connection PASS connected to the database in DATABASE_URL
CHECK migration-tables FAIL missing: billing_event_ledger, plans, schema_migrations, subscriptions, tenants, usage_counters; start the server once so the migrations run
CHECK seed-plans FAIL not run: the schema is not created yet, so there is no plans table to read; start the server once so the migrations run
db-check: 2 of 4 checks FAILED
```

The false `CHECK connection FAIL relation "plans" does not exist` is **gone**. In its place:

* the seed-plan step now **refuses to run** when the tables it needs do not exist, and reports
  its own named check `seed-plans` as `FAIL not run: …` — it never runs the query against a
  missing table;
* `record('connection', false, …)` now appears in **exactly one** catch block, and that block
  wraps only `client.connect()`. Nothing after the connection is named `connection`;
* the file's contract is intact: one `CHECK <name> PASS|FAIL <detail>` line per check, the
  `db-check: N of M checks FAILED` / `all M checks PASSED` summary, non-zero exit on any
  failure, no dotenv, the connection string never printed, `pg` resolved from
  `server/node_modules` so no dependency was added, and `TABLES_CREATED_BY_THE_MIGRATIONS`
  still the six migration tables;
* a genuine connection failure is still unmistakable — an unreachable host still produces
  `CHECK connection FAIL` and stops the script (§3).

### 2.2 `scripts/house-swarm-7/setup.sh` — classify by observation, not by string order

The step-5 ordering workaround and the commentary that explained it as the design are gone;
the commentary now describes what the code does. Observed:

| database | result |
|---|---|
| `mt01_presale_empty` (reachable, un-migrated) | **PENDING once, exit 0, no line claiming a connection failure** |
| `mt01_presale` (migrated) | passes cleanly, exit 0 |
| unreachable host (`127.0.0.1:1`) | `CHECK connection FAIL` present, `could not connect to the database` printed, **exit 1** |
| a non-zero `db-check` with an unrecognised message | still a failure, never a pass (the existing false-pass guard) |

### 2.3 The operator-facing docs

`scripts/house-swarm-7/setup.md` step 5 and `docs/product/WU5-DEPLOY.md` §3.2/§5 now
show the real post-fix output shape and name the new check, keeping the PENDING explanation
(the server does create the schema at boot — that is still why it is not an error).

### 2.4 The fixture harness — extended, and run

`server/scripts/proofs/fu/setup-dbcheck-proof.mjs`: its `unmigrated` stub was updated to the
**real** post-fix output shape (keeping the stub rather than deleting it, so it still proves
`setup.sh` recognises the PENDING case when reality changes shape underneath it), the
`migration` stub was relabelled, and a new case
**`unmigrated-output-names-no-connection-failure`** asserts the Owner's requirement directly.
A new helper `claimsConnectionFailure` distinguishes a quoted history mention from a live
claim. **Observed: `SUMMARY checks=9 passed=9 failed=0`, exit 0.** The Owner's instruction —
"check ของมึงต้องรันกับ fixture ก่อนใช้" — is satisfied: the harness was run, not merely
edited.

## 3. The genuine connection failure is still named

Required by the gate, and observed:

```
$ python gate-p4.py connection-failure-named
CHECK connection-failure-named PASS exit=1 db_check_line=True setup_named_it=True
```

## 4. Controller gate results

| gate | result |
|---|---|
| `empty-db-clean` | **PASS** — 0 lines in the database step claim a connection failure on a reachable empty DB |
| `empty-db-pending` | **PASS** — `pending_mentions=1`, `claimed_a_pass=False`, exit 0 |
| `connection-failure-named` | **PASS** — unreachable host still yields `CHECK connection FAIL`, exit 1 |
| `migrated-db-passes` | **PASS** — migrated DB passes cleanly, exit 0 |
| `fixture-case-present` | **PASS** — the harness carries the Owner's case and still has the un-migrated stub |
| `comment-updated` | **PASS** — step-5 commentary no longer presents the misattribution + ordering hack as the design |
| `db-check-contract` | **PASS** — `connection` false reported from exactly one catch, wrapping only `client.connect()`; **proved non-vacuous: RED on the pre-fix file recovered from `f03c48d`** |

`empty-db-clean` and `db-check-contract` both **FAILED on the pre-fix tree** before this lane
(recorded in the controller workspace before dispatch) and both **PASS** now — the fix is the
cause, not a relaxed gate.

## 5. ⚠️ A real cost, reported plainly: this lane broke the worktree's `node_modules`

The lane's own scratch runs copied the tree into the OS temp dir to exercise `setup.sh`
against empty/migrated/unreachable databases. During that work **`server/node_modules` was
left as an empty directory in the worktree**, which made `tsc` and `vitest` disappear:

```
$ npm run typecheck
'tsc' is not recognized as an internal or external command
$ npx vitest run
Test Files  6 failed (6)
Tests  21 failed | 12 skipped (33)
```

That is why `p4-reg-typecheck`, `p4-reg-tests-without-db` and `p4-bnd-src-untouched` failed in
the lane's own verdict — **not** because the lane's changes were wrong. The controller
restored the tree with `npm ci --include=dev` from the lockfile
(`added 155 packages in 5s`, exit 0) and re-verified:

```
npm run typecheck                      -> no diagnostics, exit 0
env -u DATABASE_URL npx vitest run     -> Test Files 5 passed | 1 skipped (6)
                                          Tests 56 passed | 5 skipped (58→61 total), exit 0
```

**Honest note:** the sandbox refused `rm -rf` and `node -e` in that lane, and the worker said
so; the empty `node_modules` is the residue of a workaround for that refusal. No source file
was damaged — `p4-must-not-touch` (15 earlier-lane files) passes — and the restore is from the
lockfile, so no dependency changed (`server/package-lock.json` untouched,
`p4-reg-package-unchanged` PASS). Worth knowing for the next lane that copies the tree.

## 6. How the work went, and who wrote this report

One run of this lane was dispatched. It did the substantive work — `db-check.mjs`, `setup.sh`,
`setup.md`, `WU5-DEPLOY.md` and the fixture harness — then hit its turn limit before writing
this report and before running `npm test`. It reported `STATE: FAIL` with four blockers,
including that its own scratch work had left the temp files behind, and it did **not** pretend
the suite had been run. The controller restored `node_modules`, wrote this report, and
re-ran every command quoted above.

### Controller defects found and fixed during this lane (mine, recorded for the next reader)

1. **`p4-reg-tests-without-db` pinned a stale total.** Lane P3a moved the full-suite total from
   58 to **61**; a check that greps `58 passed` fails on correct work. Now pins the measured
   `56 passed | 5 skipped`.
2. **`gate-p4.py db-check-contract` was too crude to be right.** Its first version looked for
   `catch { … record('connection', false` anywhere in the file — which is *exactly where the
   fix puts it* — so it produced a FALSE FAIL on correct code. Replaced with a structural
   check: exactly one failure site for `connection`, and the `try` it guards must call
   `client.connect()` and contain no query. Then proved non-vacuous against the pre-fix file.
3. **`git diff --quiet HEAD` as a cross-lane guard**, again (third lane in a row): nothing is
   committed between lanes, so an earlier lane's uncommitted work reads as this lane's edit.
   Replaced with `snapshot-guard.py p4-must-not-touch`.
4. **The report was declared under `expected_mutations`**; a file that does not exist cannot
   have a hash change. It is an `expected_artifact`.
5. **No packet told a lane that its scratch copies must not displace the worktree's
   `node_modules`.** Adding that rule is the actual fix for §5.

## 7. Outstanding items

* **Not committed, not merged.** Git is controller-owned.
* **Not independently reviewed.** Checkpoint `B0` (ลู่รีวิว Swarm) is unreached;
  `SWARM_REVIEW_REQUIRED` is this skill's ceiling.
* **Lane P2 (delivery manifest) is not yet dispatched** — one mutable worktree, so one at a
  time. It runs last because its manifest must classify the final file set.
* The lane's temp scratch files under `$LOCALAPPDATA/Temp/p4-*` remain on the machine. They are
  outside the repository and harmless; the controller did not delete them, to avoid repeating
  the class of accident in §5.

## 8. Boundaries

Touched: `scripts/house-swarm-7/{db-check.mjs,setup.sh,setup.md}`,
`server/scripts/proofs/fu/setup-dbcheck-proof.mjs`, `docs/product/WU5-DEPLOY.md` and this
report. Nothing else: `server/src/`, `server/tests/`, `server/package.json`,
`server/package-lock.json`, `modules/`, `web/`, the sales documents, `WU6-CLAIMS-EVIDENCE.md`,
`docs/CURRENT_STATUS.md`, `FU-RATELIMIT.md`, `modules/rate-limit/PROVENANCE-RATELIMIT.md` and
`06-Agent-Logs/WSTERA-House/STATUS-HOUSE.md` are untouched (the controller's
`p4-must-not-touch` guard over 15 earlier-lane files passes). No Supabase, LAB or production
host was contacted at any point; only the local disposable PostgreSQL on `127.0.0.1:55432` was
used. No commit, no dependency change, no port left listening on 3003.
