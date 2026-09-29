# PROVENANCE — modules/subscription changes made by WU-3

Copy/interop provenance and change record for the `modules/subscription` changes
introduced by HOUSE-SWARM-7 **WU-3** (brief
`BRIEF-HOUSE-SWARM-7-MT01-FINISH-2026-09-26.md` §WU-3; work order
`reports/REPORT-HOUSE-SWARM-7-2026-09-27.md` §4, WU-3).

    module:              subscription
    upstream_repo:       modules-hub
    upstream_ref:        origin/main @ 84ebb0d9a0734a6b91a2c78e8f66759736393efa
                         ("Merge pull request #14", 2026-09-26)
    upstream_readonly_copy: vendor-internal staging copy, not part of the
                         delivered folder   (WU-2 staging copy)
    local base revision: 601033249d2b1ab005d1ca83dfbe33f66af6e356
    WU-2 provenance:     modules/subscription/PROVENANCE-WU2.md
                         (the six files WU-2 adopted from 84ebb0d, verified
                         byte-identical with `diff -q` at WU-2 time)
    written by:          HOUSE-SWARM-7 WU-3 work unit (local MT01 change)

## The headline statement, explicitly

**The `UsageCounterRepository` contract, and every usage-counter repository
implementation (Postgres and in-memory mock), are a LOCAL MT01 addition made by
this WU-3 work unit. They are NOT part of upstream `modules-hub`.**

The upstream commit this module copy is layered on — and the commit that WU-2
copied its six files from — is:

    84ebb0d9a0734a6b91a2c78e8f66759736393efa

At that commit, upstream `modules/subscription` carries **no** usage counter
concept at all: there is no `UsageCounterRepository` interface, no
`getUsage`/`increment`/`decrement` method, no `usage_counters` table, and no
feature-key usage counting anywhere in the module. Everything below marked
"local" is therefore additive MT01 work sitting on top of `84ebb0d`, and a
reader comparing this tree against upstream must not expect to find it upstream.

`modules-hub` was not modified, not fetched from at WU-3 time, and is not
imported across the repository boundary (policy §6.5; brief §16). The files
below are copies inside MT01.

## Files touched by WU-3

### Local-only (new or appended) — NOT in upstream `84ebb0d`

| local file | what WU-3 did | upstream at `84ebb0d` |
|---|---|---|
| `core/repository.ts` | **appended** the `UsageCounterRepository` interface (18 -> 39 lines; `diff` vs upstream: +21, -0) | interface does not exist |
| `adapters/mock-repository.ts` | **appended** `createMockUsageCounterRepository` (52 -> 102 lines) and widened the existing `../core/index.js` import line to include `UsageCounterRepository` (`diff` vs upstream: +51, -1) | function and import do not exist |
| `PROVENANCE-WU3.md` | **new file**, this document | does not exist |

`diff` proof for those two source files (local vs the upstream staging copy at
`84ebb0d`) shows only additive hunks — no upstream line was changed or deleted:

    core/repository.ts          : 1 hunk, +21,-0  (appended UsageCounterRepository)
    adapters/mock-repository.ts : 2 hunks, +51,-1
                                  (the -1 is the import line, widened)

### Inherited from WU-2, untouched by WU-3 — byte-identical to upstream `84ebb0d`

Verified with `diff -q` against the same upstream staging copy during this WU-3
repair pass (all SAME):

| local file | vs upstream `84ebb0d` |
|---|---|
| `core/types.ts` | SAME |
| `core/engine.ts` | SAME |
| `core/service.ts` | SAME |
| `tests/unit/subscription.test.ts` | SAME |

WU-3 deliberately added **no** `UsageCounterRepository` test to
`tests/unit/subscription.test.ts`: that file is the copy of the upstream suite
from `84ebb0d`, and editing it would make the module's upstream-parity claim
unverifiable by `diff`. The usage-counter contract is exercised by
`server/tests/quota-enforcement.test.ts` and the
`server/scripts/proofs/wu3/quota-proof.mjs` harness, both of which live in the
host reference server, not in the module copy.

### MT01 package scaffolding — not upstream content

`core/error.ts`, `examples/`, `package.json`, `package-lock.json`,
`tsconfig.json`, `index.ts`, `core/index.ts` are MT01 package scaffolding that
upstream does not carry; they are unchanged by WU-3. `index.ts` and
`core/index.ts` re-export `./core/index.js` / `./repository.js`, so the new
`UsageCounterRepository` is reachable through the module's normal public surface
without editing an export list.

## Local-changes list (WU-3)

What WU-3 added, in contract terms:

1. **`UsageCounterRepository` interface** (`core/repository.ts`, local):
   - `getUsage(accountId, featureKey, periodStart): Promise<number>`
   - `increment(accountId, featureKey, periodStart, by?): Promise<number>`
   - `decrement(accountId, featureKey, periodStart, by?): Promise<number>`
   - Documented invariant: `increment`/`decrement` **MUST** be single atomic
     statements on a durable store (an upsert against the
     `(accountId, featureKey, periodStart)` key) and **MUST** return the counter
     value after the operation; implementations **MUST NOT** let the counter go
     below zero. Rationale recorded in the interface doc comment: quota
     enforcement reads the counter, and a read-then-write increment would lose
     writes under concurrency.
2. **`createMockUsageCounterRepository`** (`adapters/mock-repository.ts`, local):
   the in-memory implementation of that contract, keyed exactly like the
   database primary key, so the module's hermetic suite and any DB-less run keep
   working. It is the in-memory stand-in for the single-statement upsert, not a
   second algorithm.

Where the contract is implemented and consumed (all local MT01, outside the
module copy):

| file | role |
|---|---|
| `server/migrations/0002_usage.sql` | DDL for `usage_counters`; the `PRIMARY KEY (account_id, feature_key, period_start)` is the upsert conflict target that makes the increment a single atomic statement |
| `server/src/lib/persistence/pg-repositories.ts` | `PostgresUsageCounterRepository` implements the contract as one `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` per operation |
| `server/src/lib/quota.ts` | the paid-resource quota gate; consumes/releases through the contract |
| `server/src/lib/subscriptions.ts` | selects the Postgres implementation when `DATABASE_URL` is set, the mock otherwise |
| `server/tests/quota-enforcement.test.ts` | hermetic suite for the gate (in-memory implementation) |
| `server/scripts/proofs/wu3/quota-proof.mjs` | the WU-3 proof harness against a real database |

## Notes / limits

- This document records what is upstream and what is local **for the
  `modules/subscription` module copy**. It is not an approval, and it is not a
  claim that the local additions are ready for upstreaming: upstreaming the
  usage-counter contract into `modules-hub` would need its own work unit and
  would touch a repository this work unit is forbidden to modify.
- The local additions are additive: at `84ebb0d` an existing caller of the
  module sees the same `SubscriptionRepository` / `PlanRepository` /
  `EntitlementEngine` surface as before. The only widened file is
  `adapters/mock-repository.ts`, whose single changed upstream line is an
  `import` statement that gained `UsageCounterRepository` alongside the two
  names it already imported.
- `MODULE.md` and `DESIGN.md` still carry their earlier local wording and do
  **not** mention the usage counter. Updating module documentation is a separate
  scope decision (same note as `PROVENANCE-WU2.md`), not part of WU-3.
