# MT01 Phase B R4 — Quota Race and Trusted Tenant Closure Evidence

> INTERNAL — NOT DELIVERED.

**Date:** 2026-10-04  
**Branch:** `work/mt01-phase-b-remediation-20261003`  
**Code/test revision:** `5d96181674cde22d3f3e253a9082cc402e7babad`  
**Workflow:** `WF-DEV-01 v1.4.0` / STANDARD remediation  
**Gate:** `WF-COUNCIL-01 / SECURITY-ASSURANCE` remains **IN PROGRESS** pending fresh independent review.

## 1. Why R4 exists

The first independent-review attempt against revision `08e6a3236ddf15265bf052e8b35b9ac0bbf31193` identified a quota-concurrency concern and a trust-boundary hardening gap. That review was stopped without a verdict once remediation began, because any verdict would no longer describe the frozen code under review.

R4 therefore records new RED-before-fix evidence, the bounded remediation, and fresh regression results. It does not declare Phase B PASS.

## 2. Confirmed RED — finite quota race

The pre-R4 quota gate performed the finite-limit decision as separate operations:

1. read usage;
2. check `usage < limit`;
3. increment.

A PostgreSQL-backed negative control was added with a free-plan limit of 50, usage pre-seeded to 49, and 16 concurrent `assertAndConsumeQuota` calls.

Observed before the fix:

```text
expected allowed requests: 1
observed allowed requests: 16
```

The test failed with `expected ... length 1 but got 16`. This reproduced an actual over-consumption race rather than a theoretical code-reading concern.

## 3. Atomic finite-quota remediation

`UsageCounterRepository` now exposes `tryIncrementWithinLimit(...) -> number | null`.

The PostgreSQL implementation combines compare + consume in one `INSERT ... ON CONFLICT DO UPDATE ... WHERE ... RETURNING` statement. Conflicting updates serialize on the counter row. A caller receives `null` when its increment would exceed the finite limit.

`quotaGate.assertAndConsumeQuota()` uses that operation for finite quotas. Unlimited entitlements retain the normal atomic increment path. A refusal re-reads usage only for response reporting; the authorization decision is already atomic.

Post-fix negative control:

```text
concurrent requests: 16
remaining quota before race: 1
allowed: 1
refused: 15
final usage: 50
```

Result: **PASS**.

## 4. Trusted effective tenant remediation

The prior tenant-authorization middleware already verified requested tenant membership, but business handlers still read the header-derived `req.tenantContext.tenantId` after authorization.

R4 makes the trust boundary explicit:

- `tenantContext` remains the caller-requested tenant selector;
- after `requireTenantMembership`, middleware derives `authorizedTenantId` from trusted `req.authContext.tenantId`;
- protected business handlers consume only `req.authorizedTenantId` for subscription, AI quota/provider and payment operations/metadata;
- missing trusted tenant context fails closed with `TENANT_ACCESS_DENIED`.

Repository search after the change finds no protected route/lib use of `req.tenantContext?.tenantId` as the business account identifier.

## 5. Fresh executable evidence after R4

### Targeted security set

- `phase-b-quota-race.test.ts`: **1/1 PASS**
- `phase-b-db-security.test.ts`: **5/5 PASS**
- `quota-enforcement.test.ts`: **12/12 PASS**
- `phase-b-high-security.test.ts`: **8/8 PASS**
- targeted total: **26/26 PASS**
- server typecheck: **PASS**

### Full server with PostgreSQL 16.4

- **96/96 PASS** across 11 test files.
- Includes PostgreSQL persistence, DB adversarial tests, tenant isolation, quota race, auth boundary, webhook/rate-limit and HTTP/provider surface tests.

### Subscription/module contract

- subscription module: **39/39 PASS** + typecheck PASS.
- all repository modules rerun after the interface change: tests and typechecks **PASS**.

### Buyer/release-facing gates

- `test:web`: demo-auth **21/21**, i18n **8/8**, WU4 real-app/PostgreSQL E2E **9/9 PASS**.
- dependency audit self-tests: **3/3 PASS**.
- 9 package roots, all-dependency + production audits: **0 vulnerabilities**.
- buyer secret scan self-tests: **5/5 PASS**.
- buyer delivered secret scan after manifest update: **258 files, 0 findings**.
- delivery manifest: **9/9 PASS**.
- deploy preflight: **7/7 PASS**.
- `git diff --check`: **PASS**.

## 6. R4 code/test change set

Frozen implementation/test commit:

`5d96181674cde22d3f3e253a9082cc402e7babad` — `security(mt01): make quota consume and tenant authority atomic`

Material changes:

- atomic finite-quota repository contract and PostgreSQL implementation;
- matching in-memory implementation;
- quota gate switched from stale read/check/increment to atomic compare-and-consume;
- executable PostgreSQL concurrency negative control;
- trusted `authorizedTenantId` established after tenant membership authorization;
- tenant-scoped handlers use the trusted effective tenant;
- delivery manifest classifies the new buyer-delivered negative-control test.

## 7. Gate statement

```text
~~Phase A — SECURITY-DEPS~~      PASS / CLOSED
Phase B — SECURITY-ASSURANCE     IN PROGRESS — R4 implementation evidence GREEN
Fresh independent review         REQUIRED / NOT YET CLOSED
Phase C — REAL-SUPABASE          NOT AUTHORIZED YET
```

A new independent review must start from the final evidence revision after this record is committed and must not reuse the interrupted pre-R4 review as its verdict.
