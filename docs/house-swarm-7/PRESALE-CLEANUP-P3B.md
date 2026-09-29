# MT01 pre-sale cleanup — lane P3b: every document and gate that asserted the OLD limiter order

> INTERNAL — NOT DELIVERED.
> This is the vendor's own working record (repair log / lane report). It is kept in the
> repository because the delivered documents cite it as evidence, but it is **not part of
> what a buyer receives**. The delivered set is declared in `DELIVERY-MANIFEST.md` at the
> repository root, and the gate `server/scripts/proofs/wu5/delivery-manifest-check.mjs`
> enforces that classification.

**Lane:** `MT01-PRESALE-P3B-LIMITER-DOCS` (correlation `house-swarm-7-mt01-presale-p3b-20260929`)
**Task:** `HOUSE-SWARM-7-MT01-PRESALE-CLEANUP` (Owner direct, 2026-09-29)
**Branch:** `codex/mt01-presale-cleanup-20260929` · base `f03c48d` · worktree `…/worktrees/mt01-presale-cleanup`
**Status:** substantive work **done and verified by the controller's own gate** · report written by the controller (§6) · not committed, not merged

---

## 1. Why this lane exists

Lane P3a reversed the webhook limiter's order on purpose (review finding LOW-2): the limiter
now runs **after** `express.raw()` and verifies the delivery's signature itself, so only
**wrong-signature** requests are charged to a per-source bucket and a correctly-signed
delivery can never be refused because of an outsider's flood. The price is that a flood
**does** cost HMAC work, bounded coarsely by an every-request backstop.

That reversal made a set of delivered statements **false**. Every one of them claimed the
limiter was enforced *before* signature verification and that a flood therefore cost *no*
HMAC work. This lane makes them true again and adds a gate so the drift cannot recur.

## 2. What was corrected

| # | file | old (false) | new |
|---|---|---|---|
| 1 | `docs/CURRENT_STATUS.md` item 5 | "mounted **ahead of** `express.raw()` … refused **before** signature verification and before any HMAC work" | limiter now sits **after** `express.raw()` and verifies the signature before counting; a flood **does** cost HMAC work, bounded by the coarse backstop. The old assertion and the old ordering are both kept as **history** so an older copy cannot mislead |
| 2 | `docs/house-swarm-7/FU-RATELIMIT.md` §3/§4 | "it cannot run ahead of `express.raw()`" reversed the wrong way; the whole "a flood costs no HMAC" argument; the "one key is the right answer" conclusion | the limiter sits **after** `express.raw()`; new §4 keys reasoning (per-source + backstop); §4.1 states the residual |
| 3 | `docs/house-swarm-7/WU5-DEPLOY.md` (~976–1003, 1017–1018) | "ahead of `express.raw()` … **before** any HMAC work is done — a flood costs no HMAC" | the corrected text plus a paragraph naming the superseded wording |
| 4 | `WU6-CLAIMS-EVIDENCE.md` row **C60** (N5) | "mounts `webhookRateLimitMiddleware` first … ahead of `express.raw()`"; the 7-test / 5-check figures; "one key covers the endpoint" | the new mount order, per-source counting, the backstop, `10 passed (10)` and `ratelimit-flood-proof.mjs` 7/7 with `forged_requests_sent=6 accepted=3 refused=3`; the old order kept as an explicit **History** note |
| 5 | `WU6-SALES-EN.md` / `WU6-SALES-TH.md` **N5** | "mounted ahead of the signature check, so a flood is refused … without spending CPU on HMAC verification" | buyer-facing truth: per-source counting, signature verified before the tight count so only wrong-signature requests are charged, a coarse every-request backstop, **and** the honest cost — a flood does cost HMAC work, bounded only coarsely; an edge/proxy limit remains the real answer |
| 6 | `modules/rate-limit/PROVENANCE-RATELIMIT.md` | "mounts that middleware … ahead of `express.raw()` and the handler" | "**after** `express.raw()` and before the handler … the limiter needs the raw body because it verifies the signature itself" |
| 7 | `server/scripts/proofs/fu/manual-claims-proof.mjs` CHECK 3 | **required** the documents to state "mounted ahead of `express.raw()`" and "refused before signature verification" | requires the true property (a flood **does** cost HMAC work), still reads the limit/window defaults out of `server/src/lib/rate-limit.ts`, still requires the 429 / `RATE_LIMITED` / `Retry-After` shape and the per-instance caveat. `13 passed (13)` |
| 8 | `server/scripts/proofs/fu/ratelimit-proof.mjs` | the old harness, asserting the reversed order — `SUMMARY checks=5 passed=2 failed=3` | **retired**, see §3 |
| 9 | `server/.env.example` | missing the variable lane P3a added | documents `WEBHOOK_RATE_LIMIT_BACKSTOP_MAX` in the file's existing bilingual style; `deploy-preflight: all 7 checks PASSED` |

## 3. The old harness: retired deliberately, not deleted

`ratelimit-proof.mjs` proved the abandoned ordering by construction — requests of identical
shape answering 401 while the bucket had room and 429 once it did not, and not one post-limit
request carrying the signature-path code. Kept as-is it reported
`SUMMARY checks=5 passed=2 failed=3`, and two of its own check names say why:
`no-request-after-the-limit-reached-the-signature-path` is only true if the limiter runs
**before** verification.

**Decision: retire it with a stub that exits 0 and explains itself**, rather than delete it or
gut its assertions.

* A deleted file gives `Cannot find module` (node exit 1 / shell 127) with no explanation,
  which reads as a broken tree.
* Three delivered documents cite this path by name — `FU-RATELIMIT.md`,
  `WU6-CLAIMS-EVIDENCE.md` row C60, `FU-REVIEW-FIX-5.md` — so the path must keep resolving to
  something that explains the situation.

The stub prints one `SUPERSEDED:` line naming the reason and the replacement, then
`SUMMARY superseded=true replacement=server/scripts/proofs/fu/ratelimit-flood-proof.mjs
checks=0 passed=0 failed=0`, exit 0. Nothing is started, no port is bound, no database opened,
no host contacted, no credential read. **The current proof is
`server/scripts/proofs/fu/ratelimit-flood-proof.mjs` (7 checks, green)** — read it: it covers
the same route over the same real HTTP path and reports the observation the old harness could
no longer make.

## 4. The new gate — `gate-p3b.py`

```
python gate-p3b.py ordering-truthful    # no delivered file asserts the old property, except as history
python gate-p3b.py self-proof           # the gate can go RED (proved, not asserted)
python gate-p3b.py sales-v4-intact      # delegates to gate-p1's V4 rules
```

Design points worth knowing:

* **It reads the mount order from the code**, parsing the `app.post('/payment/webhook', …)`
  block in `server/src/app.ts` and requiring exactly
  `express.raw() → webhookRateLimitMiddleware → paymentWebhookHandler`. A future reordering
  therefore FAILS the gate instead of silently disagreeing with the prose.
* **Judged per prose unit**, where a unit ends at a blank line and at each new list item or
  bold opener — these documents carry bullet runs with no blank lines between items, so a
  claim must be judged inside its own item.
* **Superseded history is exempt**: a unit that says superseded / obsolete / no longer /
  previously / used to / earlier revision / reversed / replaced / corrected / ล้าสมัย / แก้แล้ว
  is history, and history is **required** — not a violation.
* **Non-vacuity proved**: `self-proof` copies the tree to a temp dir, plants the reconstructed
  old sentence ("mounted ahead of `express.raw()` … before any HMAC work … a flood costs no
  HMAC") in `WU5-DEPLOY.md`, re-loads the gate against that copy and requires it to go RED.
  Observed `CHECK self-proof PASS`. The probe never touches the repository.

Observed on the delivered tree:

```
CHECK ordering-truthful PASS no delivered file asserts the old ordering as a live claim
  (mount order: express.raw() -> webhookRateLimitMiddleware -> paymentWebhookHandler; 8 files checked)
CHECK self-proof PASS planting the old sentence in a temp copy turns the gate RED, so it is not vacuous
CHECK sales-v4-intact PASS (gate-p1 says-truth PASS)
```

## 5. How the work went, and who wrote this report

Two runs of this lane were dispatched; both hit their turn limit.

1. **Run 1** corrected `CURRENT_STATUS.md` and `FU-RATELIMIT.md`, then hit its turn limit. It
   reported five blockers honestly — including two against the controller — and **did not**
   pretend the lane was finished:
   * its own packet's `p3b-reg-deploy-preflight` could not pass from that lane's scope, because
     lane P3a added `WEBHOOK_RATE_LIMIT_BACKSTOP_MAX` and `server/.env.example` was **not** in
     P3b's allowed scope;
   * `p3b-reg-src-untouched` (`git diff --quiet HEAD -- server/tests server/src/app.ts`) is
     **stale by construction**, because lane P3a's uncommitted edits are attributed to P3b when
     nothing is committed between lanes;
   * `FU-RATELIMIT.md` was left internally inconsistent (§1–§6 corrected, §7 and Limitations
     stale), and it said the file must not be read as corrected until that was finished;
   * a `node` process was already listening on `127.0.0.1:3001` before it ran — verified to
     have started at 06:58, hours before this job, and deliberately left alone.
2. **Run 2** (with `.env.example` in scope and the stale checks replaced) corrected
   `WU5-DEPLOY.md`, `manual-claims-proof.mjs`, the N5 paragraphs' structure and `.env.example`
   — `deploy-preflight` went from red to `all 7 checks PASSED` — then hit its turn limit before
   the gate and the report.

The controller then finished the remaining items and wrote this report from **its own
measurements**. Every number and output line above is a controller observation.

### Controller defects found and fixed during this lane (mine, recorded for the next reader)

1. **`.env.example` was in no lane's scope.** Lane P3a added a variable the deployment
   preflight checks for, and lane P3b was not allowed to document it — so `deploy-preflight`
   was red by construction and *no lane could make it green*. Added to P3b's scope. This is the
   second time a cross-lane dependency was missed in the packet rather than in the code.
2. **`git diff --quiet HEAD -- <another lane's files>` as a cross-lane guard**, again: nothing
   is committed between lanes, so it reports the earlier lane's own uncommitted work as this
   lane's edit. `gate-p2.py` had the same class of bug via `git worktree add HEAD`, which
   cannot see uncommitted work at all. Both now use `snapshot-guard.py` (hash before / after)
   or a content check.
3. **A hash guard on the sales documents cannot work here**, because P3b legitimately edits the
   same files (the N5 paragraph). Replaced with a **content** guard: lane P1's own gates
   (`gate-p1.py sales-truth` / `repeatable-stated` / `count-consistent`), which assert the
   properties that must survive rather than the bytes.
4. **`:300[0-9]` port gate** matched the unrelated 3001 listener — a false FAIL. Narrowed to
   `:3003` (the port this project uses).
5. **A trailing `,,` from my own scripted patch** produced a `SyntaxError` in the run spec
   builder; caught by parsing the file before use.
6. **The report was declared under `expected_mutations`** in earlier packets; a file that does
   not exist cannot have a hash change. It is an `expected_artifact`.

## 6. Outstanding items

* **The old `ratelimit-proof.mjs` is now a stub** (§3). Nothing else invokes it except the
  three documents that cite it as history; `FU-RATELIMIT.md` and row C60 now say plainly that
  it is superseded.
* **Not committed, not merged.** Git is controller-owned.
* **Not independently reviewed.** The declared checkpoint `B0` (ลู่รีวิว Swarm) is unreached;
  `SWARM_REVIEW_REQUIRED` is this skill's ceiling.
* **Lanes P4 and P2 are not yet dispatched** — one mutable worktree, so one at a time.
* **`docs/house-swarm-7/FU-REVIEW-FIX-*.md` were deliberately not edited**: they are the
  historical repair log and the review instructed that the record be kept. They still quote
  the old ordering as what was true when written.

## 7. Boundaries

No source or test file was touched by this lane: the change set is documents,
`modules/rate-limit/PROVENANCE-RATELIMIT.md`, `server/scripts/proofs/fu/`, `server/.env.example`
and the stub. `server/src/`, `server/tests/`, `server/package.json`,
`server/package-lock.json`, `modules/rate-limit/core|adapters|index.ts|VERSION`, `web/`,
`scripts/` and `06-Agent-Logs/WSTERA-House/STATUS-HOUSE.md` are untouched — the controller's
`p3b-reg-module-core-untouched`, `p3b-guard-p3a-files-intact`, `p3b-reg-package-unchanged`
checks pass. No dependency changed, no commit was made, no port is left listening on 3003.

## 8. Controller gate results

| gate / check | result |
|---|---|
| `gate-p3b.py ordering-truthful` | **PASS** — 8 files checked, mount order read from `app.ts` |
| `gate-p3b.py self-proof` | **PASS** — goes RED on a planted old sentence |
| `gate-p3b.py sales-v4-intact` | PASS |
| `gate-p1.py sales-truth` / `repeatable-stated` / `count-consistent` / `old-docs-red` / `report-complete` | PASS (all five) |
| `p3b-manual-claims-proof-passes` (13/13) | PASS |
| `p3b-claims-check-passes` (9/9) | PASS |
| `p3b-reg-deploy-preflight` (7/7) | PASS |
| `p3b-reg-old-harness-green` (stub, exit 0) | PASS |
| `p3b-reg-flood-proof-still-green` (7/7) | PASS |
| `p3b-reg-tests-without-db` (56 passed \| 5 skipped (61)) | PASS |
| `p3b-reg-tests-with-db` (61 passed (61)) | PASS |
| `p3b-reg-typecheck` / `-i18n` / `-package-unchanged` | PASS |
| `p3b-reg-module-core-untouched` / `guard-p3a-files-intact` | PASS |
| `p3b-bnd-no-port-left-listening` / `-hub-not-modified` | PASS |
