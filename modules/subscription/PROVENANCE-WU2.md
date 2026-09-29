# PROVENANCE — modules/subscription (WU-2)

Copy provenance for the Module Reuse Check performed by HOUSE-SWARM-7 WU-2
(brief `BRIEF-HOUSE-SWARM-7-MT01-FINISH-2026-09-26.md`, WU-2; report
`reports/REPORT-HOUSE-SWARM-7-2026-09-27.md` §3b/§4).

    module:         subscription
    source_repo:    modules-hub
    source_version: 0.1.0 (MT01 copy) / 0.1.0 (upstream)
    source_commit:  84ebb0d9a0734a6b91a2c78e8f66759736393efa
    source_path:    modules/subscription   (read-only staging: vendor-internal
                    staging copy, not part of the delivered folder)
    copied_at:      2026-09-28 (UTC)
    evidence:       reports/evidence/house-swarm-7-wu2-provenance.txt
    base revision:  601033249d2b1ab005d1ca83dfbe33f66af6e356

No file from `modules-hub` is imported across repositories at runtime: the files
below are copies inside MT01 and `modules-hub` was never modified.

## Files adopted from the upstream commit

These six files were replaced with byte-identical copies of
`modules-hub @ 84ebb0d` `modules/subscription/<path>`
(verified with `diff -q` after writing — all SAME):

| local file | upstream file at 84ebb0d |
|---|---|
| `core/repository.ts` | `core/repository.ts` |
| `core/types.ts` | `core/types.ts` |
| `core/engine.ts` | `core/engine.ts` |
| `core/service.ts` | `core/service.ts` |
| `adapters/mock-repository.ts` | `adapters/mock-repository.ts` |
| `tests/unit/subscription.test.ts` | `tests/unit/subscription.test.ts` |

Adopted upstream capabilities:

- `saveForBillingEvent(subscription: Subscription, eventId: string): Promise<boolean>`
  on `SubscriptionRepository` — the durable billing-event idempotency boundary.
- `Subscription.gracePeriodEnd?: Date` on the `Subscription` type.
- `handleBillingEvent` now applies `subscription.payment_failed` as
  `status = 'grace_period'` with `gracePeriodEnd = now + gracePeriodDays`
  (default 3, `SubscriptionCoreConfig.gracePeriodDays`), and persists through
  `saveForBillingEvent` when the event carries an `eventId` (otherwise `save`).
- Entitlement engine fails closed for `past_due`/`expired`/`cancelled` and for
  `grace_period` whose deadline is missing, invalid, or elapsed.
- Billing period end is derived from the plan's `billingInterval` (`month` |
  `year`) with UTC calendar arithmetic (month-end clamping), instead of a fixed
  30-day interval.
- `createMockSubscriptionRepository` claims event ids in an in-memory
  `Set<string>` so the hermetic unit suite keeps covering dedup, and returns
  copies from `getByAccountId`/`save`.

## Local changes made on top of the copy (MT01 side)

1. `modules/subscription/PROVENANCE-WU2.md` — this file (new, MT01-only).
2. No other edit to the copied module sources: every file listed in the table
   above is byte-identical to upstream at `84ebb0d`.
3. MT01-only files that upstream does not carry stay as they were (they are the
   MT01 package scaffolding, not upstream content): `core/error.ts`,
   `examples/`, `package.json`, `package-lock.json`, `tsconfig.json`.
4. `tests/unit/subscription.test.ts` **was** re-copied from upstream: the MT01
   copy at the `6010332` baseline asserted the older `past_due` outcome and had
   no Phase-0 regression block, so it contradicted the objective's own
   instruction to adopt upstream `grace_period`. The upstream test file is now
   in place verbatim (verified by `diff -q`: SAME) and is the suite that covers
   `grace_period` + `gracePeriodEnd` and `saveForBillingEvent` dedup, including
   replayed-after-another-event and concurrent-delivery cases.
5. The Postgres persistence layer added by WU-2 lives in the host reference
   server (`server/src/lib/persistence/`, `server/migrations/`) — it implements
   the copied `SubscriptionRepository` / `PlanRepository` contracts and is not
   part of the module copy.

## Notes / limits

- `MODULE.md` and `DESIGN.md` were **not** re-copied in WU-2 (they are upstream
  documentation at `84ebb0d`, which changed only docs); the local MT01 copies
  keep their wording from the earlier `57ab2742` baseline. Any doc update is a
  separate scope decision, not part of WU-2.
- `modules-hub` was not modified, not fetched from, and not imported across the
  repository boundary (policy §6.5; brief §16).
