> INTERNAL — NOT DELIVERED. This is the vendor's own lane report, not part of what a buyer
> receives. It cites internal machine paths by design. See `DELIVERY-MANIFEST.md`.

# MT01 pre-sale cleanup — lane P2: the internal working papers must not be part of what the buyer receives

**Lane:** `MT01-PRESALE-P2-DELIVERY-MANIFEST` (correlation `house-swarm-7-mt01-presale-p2-20260929`)
**Task:** `HOUSE-SWARM-7-MT01-PRESALE-CLEANUP` (Owner direct, 2026-09-29)
**Branch:** `codex/mt01-presale-cleanup-20260929` · base `f03c48d` · worktree `…/worktrees/mt01-presale-cleanup`
**Status:** decision + manifest + enforcing check **done and verified** · report written by the controller (§6) · not committed, not merged

---

## 1. The finding, and what the Owner asked for

Review `reports/REVIEW-SWARM-7-MT01-FINAL-852DFB1-CLAUDE-2026-09-29.md`, ISSUE 2 (LOW-1):

> `FU-REVIEW-FIX-3.md` (23) / `-4.md` (20) / `-5.md` (2) ใน `docs/house-swarm-7/` ยังมี path
> เครื่อง (`AI-Workspace`, `hermes-native`, `runtime/worktrees`) … ถ้าโฟลเดอร์
> `docs/house-swarm-7/` ถูกส่งมอบ ควรย้ายไฟล์ FU-REVIEW-FIX ออกจากชุดส่งมอบหรือตัด path

The Owner framed it more broadly: the folder is internal working material and the question is
what a buyer actually receives, with the method left to us —

> ทำให้ไม่อยู่ในของที่ผู้ซื้อได้ — เลือกวิธีที่ชัดที่สุด (เช่น ย้ายออกจาก repo ไป vault หรือ
> กำหนดรายการไฟล์ที่ส่งมอบ + check ว่าไม่มี path เครื่องในชุดส่งมอบ) เขียนเหตุผลในรายงาน

## 2. The decision — option **(B)**: a delivery manifest plus an enforcing check

**Chosen: B, not A.** The reason, in the terms the objective required:

1. **A cannot actually achieve its goal from inside this lane.** These files are in git
   history and on the remote. Removing them from the working tree in a new commit does not
   remove them from history, and the controller has forbidden history rewriting — so a buyer
   who clones still receives every earlier revision, including the machine paths. A move
   would change where the *current* tree looks clean while leaving the thing the finding is
   about intact and harder to see. B states and enforces the property that is actually
   achievable and actually matters: **what constitutes the delivered set, and that no
   delivered file carries a machine path.**
2. **Some of these documents are buyer-facing and must stay.** `WU5-DEPLOY.md`,
   `WU6-SALES-EN.md`/`-TH.md`, `WU6-CLAIMS-EVIDENCE.md`, `WU3-PAID-ROUTE-INVENTORY.md` and
   `WU4-SAMPLE-UI.md` are cited BY PATH from delivered code and from each other, and were
   written for the buyer. A blanket "move the folder out" would break those citations.
3. **The `FU-*.md` papers are the vendor's own repair log** — they cite machine paths,
   worktree names and lane ids *by design*, and the review's own instruction was to keep that
   record. A manifest is exactly the instrument that lets a dirty internal record coexist with
   a clean delivered set.
4. **A decision that is not enforced drifts.** Both options need a mechanism; B's mechanism is
   the one that fails loudly the moment a new internal file appears unclassified or a
   delivered file grows a machine path.

**Rejected: option (A)** — for reasons 1 and 2 above: it cannot reach the history, and it
would break delivered citations. It is also the option that hides the problem rather than
stating it.

## 3. The mechanism

### 3.1 `DELIVERY-MANIFEST.md` — the classification, machine-readable

At the repository root (a file a reader will actually look for). It carries three fenced,
one-path-per-line blocks under the headings **`## Delivered`**, **`## Not delivered`** and
**`## Delivered with a recorded path residual`**, so the check parses it without guessing —
a manifest whose groups are prose cannot be checked and will drift. Observed:

```
delivered=252   not_delivered=8   recorded_path_residuals=7
all 260 files the repository ships are classified
```

The classification rule for the internal family is declared in the manifest and in the check:
`docs/house-swarm-7/` files matching `/^(?:FU-|PRESALE-)[A-Za-z0-9._-]+\.md$/` are the vendor's
working record. `FU-RATELIMIT.md` and `FU-REVIEW-FIX-2.md` are the **exceptions that are
delivered**, because delivered files cite them by path as their reference
(`WU5-DEPLOY.md`'s environment-variable table and the rate-limit module's provenance record
cite the first; the delivered `claims-check.mjs` rule text and its fixtures cite the second).
Making the cited target delivered rather than destroying the citation is the resolution the
work unit itself allowed. Both are path-clean. **`FU-REVIEW-FIX-3.md`, the file the finding
named, is not delivered.**

The 7 recorded residuals are the upstream `modules/*/DESIGN.md` and `*.agy-prompt.md` files
that belong to the vendored Module Hub tree; they are named explicitly rather than exempted,
and the check asserts each still exists **and** still carries a path — so the declaration
cannot go quietly stale.

### 3.2 `server/scripts/proofs/wu5/delivery-manifest-check.mjs` — the enforcement

Run as **`npm run test:delivery`** (`server/package.json`'s `scripts` block only; both
dependency blocks and the lockfile are untouched). Eight checks:

| check | rule |
|---|---|
| `delivery-manifest-parsed` | the manifest exists and its groups parse, with a non-zero delivered count |
| `no-unclassified-file` | every one of the 260 shipped files is in exactly one group; a new file nobody classified fails |
| `delivered-files-carry-no-machine-path` | no DELIVERED file contains a machine path — 245 files scanned for six patterns |
| `recorded-path-residuals-are-live` | each declared residual exists, is under `modules/`, and still carries a path (a stale declaration fails) |
| `delivered-files-exist` | every delivered path resolves to a file |
| `not-delivered-are-marked` | each not-delivered paper exists and declares itself in its first 12 lines |
| `no-dangling-citation` | no DELIVERED file points at a not-delivered paper by path |
| `delivered-working-papers-are-path-clean` | a working paper declared delivered must be path-clean, or be reclassified — not exempted |

Observed: **`SUMMARY checks=8 passed=8 failed=0`**, exit 0.

### 3.3 Non-vacuity — the check is proved able to fail

`node scripts/proofs/wu5/delivery-manifest-check.mjs --self-test` runs seven cases on temp
copies. Observed:

```
SUMMARY cases=7 passed=7 failed=0
```

* `a-repository-as-it-is-is-pass` — the unmutated control (green, so the other six have a baseline)
* `b-new-working-paper-nobody-classified` — a new `docs/house-swarm-7/FU-REVIEW-FIX-9.md` appears → red
* `c-delivered-file-gains-a-machine-path` → red
* `d-not-delivered-file-loses-its-marker` → red
* `e-delivered-file-cites-a-not-delivered-paper-by-path` → red
* `f-not-delivered-paper-is-deleted-from-the-tree` → red
* `g-a-declared-path-residual-is-no-longer-dirty` → red

Case `a` is what keeps the other six honest.

## 4. Findings this lane's own check produced (and what was done)

The check was written well enough to catch three real defects — in the lane's own output.
Each is recorded, because they are the kind of thing that would otherwise have shipped.

1. **The manifest contradicted itself.** Its prose (correctly) said `FU-REVIEW-FIX-2.md` stays
   delivered because delivered files cite it by path, while its `## Not delivered` list named
   that same file — which `no-dangling-citation` then reported as six dangling references.
   **Resolved by following the prose**: the file is delivered, the citations stand, the
   list entry was removed, and the delivered list gained the path.
2. **A listed file did not exist.** `PRESALE-CLEANUP-P2.md` was listed as not delivered before
   this report existed. Removed from the classification until the file is real.
3. **The check failed its own rule.** Its probe fixtures intentionally WRITE machine paths into
   temp copies to prove the rule fires, and two of those fixtures carried the path as a
   **literal** in the checker's own source — so the checker flagged itself
   (`server/scripts/proofs/wu5/delivery-manifest-check.mjs:570,614,615`). The pattern table
   already assembled its patterns from parts for exactly this reason; the fixtures did not.
   Both fixtures now assemble theirs from parts too, with the reason in a comment.

**One more, and it is the controller's**: `--self-test` reported **0/7** on a correct harness.
Its `runChild` spawned the harness by a path relative to the *repository root* while setting
`cwd` to the copy's `server/`, so it looked for
`<copy>/server/server/scripts/proofs/wu5/delivery-manifest-check.mjs` and every case died with
`MODULE_NOT_FOUND`. Fixed by resolving the path against the copy root; `7/7` after. A
self-test that cannot run is indistinguishable from a harness that cannot fail — worth noting
that the *first* reading of that failure was "the harness is broken", not "the runner is".

## 5. Controller gate results

| gate / check | result |
|---|---|
| `p2-manifest-exists` | PASS |
| `p2-check-passes` (`npm run test:delivery`, 8/8) | PASS |
| `p2-check-can-fail` (`--self-test`, 7/7) | PASS |
| `p2-no-unclassified` (260 files classified) | PASS |
| `p2-delivered-clean` (no machine path in the delivered set) | PASS |
| `p2-dangling-refs` | PASS |
| `p2-reason-recorded` (option + reason + rejected alternative) | PASS |
| `p2-reg-deploy-preflight` (7/7) | PASS |
| `p2-reg-claims-check` (9/9) | PASS |
| `p2-reg-manual-claims-proof` (13/13) | PASS |
| `p2-reg-tests-without-db` (56 passed \| 5 skipped (61)) | PASS |
| `p2-reg-tests-with-db` (61 passed (61)) | PASS |
| `p2-reg-typecheck` | PASS |
| `p2-reg-deps-unchanged` (lockfile + both dependency blocks byte-identical) | PASS |
| `p2-guard-earlier-lanes-intact` (23 earlier-lane files) | PASS |
| `p2-bnd-no-port-left-listening` / `-hub-not-modified` / `-src-untouched` | PASS |

## 6. How the work went, and who wrote this report

One run of this lane was dispatched. It made the decision, wrote the manifest, wrote the
2900-line check with its seven-case self-test, and reported the three findings above — then
hit its turn limit before writing this report and before wiring `test:delivery`. The
controller fixed the four issues in §4, wired the npm script, wrote this report, and re-ran
every command quoted here.

### Controller defects found and fixed during this lane (mine, recorded for the next reader)

1. **`git diff --quiet HEAD` as a cross-lane guard — the fourth and last recurrence** of the
   same bug in this job. Nothing is committed between lanes, so an earlier lane's uncommitted
   work reads as this lane's edit, failing on correct work. Now `snapshot-guard.py p2-must-not-touch`
   (23 files hashed before the lane, re-hashed after).
2. **Editing `server/package.json` by string replacement produced invalid JSON** — a missing
   comma after `test:web:e2e`, which broke `npm` entirely (`JSON.parse Failed`). Caught
   immediately by parsing the file, then fixed. Any generated edit to a structured file must be
   parsed as that format before it is used, not after.
3. **The report was declared under `expected_mutations`** once more; a file that does not exist
   cannot have a hash change. It is an `expected_artifact`.
4. **The full-suite total is 61, and vitest wraps counts in ANSI escapes**; the check now matches
   the digits alone (`56 passed` / `5 skipped` / `61 passed`).

## 7. Outstanding items

* **Not committed, not merged.** Git is controller-owned for this job.
* **Not independently reviewed.** Checkpoint `B0` (ลู่รีวิว Swarm) is unreached;
  `SWARM_REVIEW_REQUIRED` is this skill's ceiling.
* **This is the last lane of the job.** All four Owner tasks are now implemented and verified
  by the controller's own gates.
* The manifest's classification must be **maintained** as files are added: that is the point of
  `no-unclassified-file`, which fails rather than guessing.

## 8. Boundaries

Touched: `DELIVERY-MANIFEST.md`, `server/scripts/proofs/wu5/delivery-manifest-check.mjs`,
`server/package.json`'s `scripts` block, and this report. Nothing else — the controller's
`p2-guard-earlier-lanes-intact` (23 earlier-lane files byte-identical) and
`p2-reg-deps-unchanged` both pass, and `server/src`, `server/tests`, `modules/`, `web/`,
`scripts/` were not modified. No Supabase, LAB or production host was contacted. No commit, no
dependency change, no port left listening on 3003.
