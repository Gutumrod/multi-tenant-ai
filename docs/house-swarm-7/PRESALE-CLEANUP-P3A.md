# MT01 pre-sale cleanup — lane P3a: a forged-signature flood must not refuse a real webhook delivery

> INTERNAL — NOT DELIVERED.
> This is the vendor's own working record (repair log / lane report). It is kept in the
> repository because the delivered documents cite it as evidence, but it is **not part of
> what a buyer receives**. The delivered set is declared in `DELIVERY-MANIFEST.md` at the
> repository root, and the gate `server/scripts/proofs/wu5/delivery-manifest-check.mjs`
> enforces that classification.

**Lane:** `MT01-PRESALE-P3A-REPAIR` (correlation `house-swarm-7-mt01-presale-p3a-repair-20260929`)
**Task:** `HOUSE-SWARM-7-MT01-PRESALE-CLEANUP` (Owner direct, 2026-09-29)
**Branch:** `codex/mt01-presale-cleanup-20260929` · base `f03c48d` · worktree `…/worktrees/mt01-presale-cleanup`
**Status:** code + tests + new harness **done and verified by the controller's own gates** · report written by the controller (§7) · not committed, not merged

---

## 1. The finding

Review `reports/REVIEW-SWARM-7-MT01-FINAL-852DFB1-CLAUDE-2026-09-29.md` §2, LOW-2:

> key เป็น **ค่าคงที่ต่อ route** → ผู้โจมตีที่ไม่ต้อง auth ยิง ≥60 req/นาที ทำให้ Stripe ของจริง
> โดน 429 ต่อเนื่องได้ (DoS ของ webhook) · เอกสารบอก "ความล้มเหลว = ส่งช้า ไม่ใช่เหตุการณ์หาย" —
> จริงเฉพาะระยะสั้น: ถ้า flood ยาวกว่าช่วง retry ของ Stripe (~3 วัน) หรือ endpoint ถูกปิดจาก
> ความล้มเหลวสะสม เหตุการณ์จ่ายเงินหายได้

The old key was a single constant per route, `route:POST /payment/webhook`, so every caller
shared one bucket. An unauthenticated attacker filling that bucket refused **real Stripe
deliveries**, and "delayed delivery, not lost events" held only for a short flood.

## 2. The old design and the new one

### Old (mount order and comment, `server/src/app.ts`)

```
app.post(
  '/payment/webhook',
  webhookRateLimitMiddleware,     // FIRST — before express.raw() and the handler
  express.raw({ type: 'application/json' }),
  paymentWebhookHandler
);
```

> ORDERING (H7-FU-RATELIMIT): webhookRateLimitMiddleware runs FIRST, ahead of `express.raw()`
> and the handler, so a flood of requests is refused **without spending CPU on HMAC
> verification** … The limiter neither reads nor alters the body …

### New

```
app.post(
  '/payment/webhook',
  express.raw({ type: 'application/json' }),
  webhookRateLimitMiddleware,     // AFTER express.raw(), BEFORE the handler
  paymentWebhookHandler
);
```

The limiter now **verifies the delivery's signature itself**, so it can charge only the
requests whose signature is **wrong** to a per-source bucket. A correctly-signed delivery is
never counted into a bucket an attacker can fill, and therefore cannot be refused because of
one. It neither alters nor re-parses the body, so the raw buffer the handler's own verification
needs is unchanged.

Mechanism, in `server/src/lib/rate-limit.ts`:

1. **Per-source counting** — the old single constant key is replaced by a per-source key, so a
   flood from one source cannot consume another's allowance. Proven live: the harness reports
   `source_a_refusal_bucket="source:127.0.0.1"` and `source_b_refusal_bucket="source:::1"`,
   `buckets_differ=true`.
2. **Signature verified before the tight count**, only WRONG-signature requests charged to a
   source bucket.
3. **A coarse every-request backstop** so total work cannot be unbounded. Observed firing at its
   own limit, with the route-level bucket key `route:POST /payment/webhook`.

## 3. What the reorder costs — the residual, stated plainly

The previous order refused a flood **before** spending HMAC work. This one spends HMAC work on
whatever reaches the middleware, bounded only coarsely by the backstop. A sufficiently large
flood can still saturate that backstop, and an edge/proxy limit remains the real answer. This is
a deliberate trade — bounded real work in exchange for never refusing a real payment delivery —
and it is documented in both files:

* `server/src/app.ts`: *"What the reorder costs, stated plainly: … this one spends HMAC work on
  whatever reaches the middleware. That is bounded by a coarse every-request backstop …"*
* `server/src/lib/rate-limit.ts`: the design comment was rewritten to the per-source reasoning;
  the old "the key is a single constant per route" argument and the "a flood costs no HMAC"
  claim are gone.

**⚠️ This reorder makes a set of DELIVERED documents false.** They still assert the limit is
enforced *before* signature verification and that a flood costs *no* HMAC work:
`docs/CURRENT_STATUS.md` item 5 · `docs/house-swarm-7/FU-RATELIMIT.md` ·
`WU5-DEPLOY.md` (~976–1003, both languages) · `WU6-CLAIMS-EVIDENCE.md` C60 ·
`WU6-SALES-EN.md`/`WU6-SALES-TH.md` N5 · `modules/rate-limit/PROVENANCE-RATELIMIT.md` ·
and `manual-claims-proof.mjs` CHECK 3, which *requires* those sentences.
**Lane P3b exists to correct them** and must run before this branch is reviewed.

## 4. The tests: what changed, and what did not

The suite is now **10 scenarios**, all passing (`Tests 10 passed (10)`). **No scenario was
deleted** — all seven pre-existing names survive (controller gate `scenarios-preserved` PASS).

**Renamed/re-scoped, with the old form quoted** (two of the seven asserted the abandoned order):

| pre-change name | now | why |
|---|---|---|
| `webhook-refusal-happens-before-signature-verification` | `webhook-refusal-is-per-source-and-only-for-wrong-signatures` | the old scenario PROVED the limiter ran before signature verification; that property is now deliberately reversed, so the scenario asserts the new property — the refusal is per-source and only wrong-signature requests are charged |
| `webhook-refusal-carries-retry-after-header` | unchanged in name; its `details.key` assertion | the old assertion pinned `details.key === 'route:POST /payment/webhook'` for **every** refusal; the per-source refusal now carries a source key, so the assertion follows the code. The `Retry-After` behaviour, the `429`, `RATE_LIMITED` and `RATE_LIMIT_UNAVAILABLE` codes are all still asserted |

**Three new scenarios**, all required by the Owner's acceptance test:

* `webhook-forged-flood-does-not-refuse-a-signed-delivery` — flood with forged signatures, then
  the correctly-signed delivery must reach the handler.
* `webhook-per-source-allowance-is-independent` — a second source's allowance is untouched by
  the first source's flood.
* `webhook-backstop-bounds-total-work-even-for-valid-signatures` — the coarse backstop bounds
  total work even when every request is correctly signed, with a clock-alignment helper
  (`alignToWindowBoundary`) so a window rollover mid-burst cannot be mistaken for the bound.

## 5. The new standalone harness — `server/scripts/proofs/fu/ratelimit-flood-proof.mjs`

Observed output (controller-run, exit 0):

```
CHECK flood-with-wrong-signatures-is-refused-once-over-its-allowance PASS forged_requests_sent=6 accepted=3 refused=3 limit=3 statuses=[401,401,401,429,429,429] first_refusal_status=429 first_refusal_code=RATE_LIMITED retry_after="53"
CHECK correctly-signed-delivery-is-not-refused-after-the-flood PASS signed_delivery_status=200 (200 = the handler accepted it; 429 would be the limiter refusing a real delivery) code=(no code) refused_by_limiter=false retry_after=(absent)
CHECK signed-deliveries-keep-passing-not-a-one-shot-exemption PASS first_signed_status=200 second_signed_status=200 both_not_refused=true
CHECK forged-flood-is-still-refused-after-the-signed-deliveries PASS forged_after_good_status=429 code=RATE_LIMITED (429 = the limit is still armed, not disabled to make the delivery pass)
CHECK per-source-flood-does-not-consume-another-sources-allowance PASS source_b_forged_statuses=[401,401,401,429] source_b_refusal_bucket="source:::1" source_a_refusal_bucket="source:127.0.0.1" buckets_differ=true source_b_allowance_intact_for_first_3=true
CHECK signed-delivery-passes-from-either-source-after-both-floods PASS signed_from_source_a_status=200 signed_from_source_b_status=200 both_200=true
CHECK the-run-stayed-inside-one-window-so-the-counting-is-not-a-rollover-artefact PASS window_index_before=29844548 window_index_after=29844548 elapsedMs=8040 windowMs=60000 same_window=true
SUMMARY checks=7 passed=7 failed=0 limit=3 backstop=5000 windowMs=60000
```

This is the Owner's acceptance test, measured:

> ยิง flood ลายเซ็นผิด แล้ว webhook ลายเซ็นถูกยังผ่าน

— the forged flood was **refused** (3 accepted, then `429 RATE_LIMITED`), and the
correctly-signed delivery that followed was answered **200** by the handler, not refused by the
limiter. The fifth check proves the forged flood is refused *after* the signed deliveries too,
so the limiter was not merely disabled to make the test pass. The last check proves the whole
run stayed inside one window, so the counting is not a rollover artefact.

## 6. ⚠️ Not yet corrected: the OLD harness still asserts the abandoned order

`server/scripts/proofs/fu/ratelimit-proof.mjs` (lane H7-FU-RATELIMIT) asserts the old ordering
and now reports 3 FAILs. Observed:

```
CHECK next-request-is-refused-with-429-rate-limited FAIL http_status=401 code=WEBHOOK_MISSING_SIGNATURE
CHECK refusal-carries-retry-after-header FAIL retry_after_header=(absent)
CHECK no-request-after-the-limit-reached-the-signature-path FAIL post_limit_requests=4
  statuses=[401,429,429,429] codes=[...,RATE_LIMITED,RATE_LIMITED,RATE_LIMITED] reached_signature_path=1
SUMMARY checks=5 passed=2 failed=3
```

This is **not a code regression** — it is the old harness asserting a property this lane
deliberately reversed. Two of its own check names say so: *"no request after the limit reached
the signature path"* is only true if the limiter runs before verification, which it no longer
does. **It is left untouched on purpose**: lane P3a's scope forbids editing the harnesses that
document the old design, and lane **P3b** owns exactly this file. P3b must update it to the new
ordering (or retire it in favour of `ratelimit-flood-proof.mjs`, which supersedes it) and say
which it did. Recorded here so it cannot be lost.

## 7. How the work went, and who wrote this report

Two runs of this lane were dispatched. Both hit their turn limit; the first left one precise
defect.

1. **Run 1** (`max_turns=50`) did the substantive work: the reorder in `app.ts`, the per-source
   redesign in `rate-limit.ts`, and the new scenarios in the test file. It hit its turn limit
   with the tree mid-edit: `tests/webhook-rate-limit.test.ts(1039,31): error TS2304: Cannot find
   name 'alignToWindowBoundary'`, one failing scenario, no harness, no report.
2. **Run 2** (`max_turns=32`) defined the helper — typecheck clean, `Tests 10 passed (10)` — and
   wrote the flood harness, which passes 7/7. It hit its turn limit before the report.

The controller then wrote this report from **its own measurements**, re-running the typecheck,
the suite, both harnesses and the guards. Every number and output line above is a controller
observation, not a worker self-report.

### Controller defects found and fixed during this lane (mine, recorded for the next reader)

1. **`grep -qE '58 passed'` on the full suite** — P3a added three scenarios, so the total moved
   from 58 to **61**. The check was stale, not the code. Now pins `61`.
2. **`git diff --quiet HEAD -- <lane P1's files>`** as a cross-lane guard. Nothing is committed
   between lanes, so P1's own uncommitted work is reported as this lane's edit — a false FAIL on
   correct work. Replaced with `snapshot-guard.py`, which hashes the earlier lane's deliverables
   *before* the lane runs and re-hashes after (the same before/after approach the skill's own
   mutation observer uses, for the same reason).
3. **`gate-p3.py` read `/tmp/p3a-proof.log`** — MSYS `/tmp` is not a path native Windows Python
   can open. Now uses `$TEMP`.
4. **The report and the new harness were declared under `expected_mutations`** in lane P1's
   packet; a file that does not exist cannot have a hash change, so the observer reported
   `MUTATION_TARGET_ABSENT_BEFORE_LANE`. Fixed here: the report is an `expected_artifact`.

## 8. Outstanding items

* **The old `ratelimit-proof.mjs` is still red and belongs to lane P3b** (§6).
* **Every delivered document that asserts the old ordering is still false** until lane P3b runs
  (§3). Reviewing or merging this branch before P3b would merge a false claim.
* **Not committed, not merged.** Git is controller-owned for this job.
* **Not independently reviewed.** The declared checkpoint `B0` (ลู่รีวิว Swarm) is unreached;
  `SWARM_REVIEW_REQUIRED` is this skill's ceiling.
* **Lanes P3b / P4 / P2 not yet dispatched** — one mutable worktree, so they run one at a time.

## 9. Boundaries

`server/src/app.ts`, `server/src/lib/rate-limit.ts`, `server/tests/webhook-rate-limit.test.ts`
and the new `ratelimit-flood-proof.mjs` are the only code touched. Nothing under `modules/`,
`web/`, `scripts/`, `server/package.json`, `server/package-lock.json`,
`06-Agent-Logs/WSTERA-House/STATUS-HOUSE.md` or the vendored module core/adapters was modified;
no `docs/` file other than this report was touched (lane P1's files verified byte-identical by
`snapshot-guard.py`). No commit was made, no dependency changed, no port is left listening.

## 10. Controller gate results

| gate / check | result |
|---|---|
| `p3ar-typecheck` (`tsc --noEmit`) | PASS |
| `p3ar-rate-limit-suite` (`Tests 10 passed (10)`) | PASS |
| `p3ar-flood-proof-passes` (7/7, exit 0) | PASS |
| `p3ar-proof-signed-not-refused` | PASS |
| `p3ar-flood-itself-refused` | PASS |
| `p3ar-per-source` | PASS |
| `p3ar-required-scenario` | PASS |
| `p3ar-scenarios-preserved` (7/7 pre-existing names) | PASS |
| `p3ar-reg-tests-without-db` | PASS |
| `p3ar-reg-tests-with-db` (`61 passed`) | PASS |
| `p3ar-reg-package-unchanged` | PASS |
| `guard-p3a-p1-files` (6 earlier-lane files byte-identical) | PASS |
| `p3ar-reg-module-core-untouched` | PASS |
| `p3ar-bnd-no-port-left-listening` / `-hub-not-modified` | PASS |
| `ratelimit-proof.mjs` (old harness) | **FAIL by design — lane P3b's scope (§6)** |
