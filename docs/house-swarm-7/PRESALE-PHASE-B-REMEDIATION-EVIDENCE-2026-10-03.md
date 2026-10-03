# MT01 Pre-Sale Phase B — Remediation Evidence

> INTERNAL — NOT DELIVERED.
> Evidence for the bounded remediation of the two High findings discovered by the first Phase B adversarial pass.

**Date:** 2026-10-03
**Project:** MT01 — Multi-Tenant AI Starter Kit
**Workflow:** `WF-DEV-01 v1.4.0 / STANDARD`
**Originating gate:** `WF-COUNCIL-01 / SECURITY-ASSURANCE`
**Base commit:** `0b849eefa23ed7c6d47abf494e84a8f711575a8d`
**Plan commit:** `f866ab151ad29a1462f051da4a87223156aab98c`
**Implementation commit:** `64b7fb3580e7fd3ae30575427e3914140ab862ca`
**Branch:** `task/MT01-PHASE-B-security-remediation-20261003`
**Gate state:** `HOLD / STOP SALE` pending independent Phase B review

## 1. Findings remediated in this change

### B-HIGH-001 — Cross-tenant authorization bypass

Baseline behavior separated the two inputs:

- `x-tenant-id` selected `req.tenantContext.tenantId`;
- Supabase authentication established `req.authContext`;
- protected handlers used the header-selected tenant without enforcing membership against the trusted auth principal.

The existing `requireTenantMembership()` guard existed in the auth module but was not composed into the reference-server protected-route chain.

### B-HIGH-002 — Paid entitlement self-activation

Baseline `POST /subscription/subscribe` accepted caller-selected `planId` and created an active subscription. A normal authenticated caller could therefore select `pro` without a trusted billing/admin transition.

## 2. Red negative-control evidence against the unremediated baseline

Before implementation, the Phase B security test was introduced and run against the unremediated composition.

Observed result:

```text
8 tests total
7 failed
1 passed
```

The failures demonstrated:

- Tenant-A principal selecting Tenant-B on `GET /me` returned 200 instead of 403;
- cross-tenant subscription read returned 200;
- cross-tenant subscription write returned 201;
- cross-tenant AI request reached the protected path;
- cross-tenant payment request reached the protected path;
- concurrent mismatched requests remained allowed;
- direct `pro` activation returned 201.

The one passing control was direct activation of the explicitly free plan.

This red run is the defect-detection proof. The suite was not written only after the implementation was known to pass.

## 3. Runtime remediation

### 3.1 Trusted effective tenant boundary

Added `server/src/middleware/tenant-authorization.ts`.

The middleware:

1. requires authenticated context;
2. requires a requested tenant selector;
3. calls the existing `requireTenantMembership(authContext, requestedTenantId)`;
4. sets `req.effectiveTenantId` only after membership passes;
5. preserves `AuthError` status/code;
6. fails closed on an absent trusted tenant or unexpected authorization failure.

`server/src/app.ts` composes protected routes as:

```text
tenant selector
  -> authentication
  -> tenant authorization
  -> protected handler
```

Protected AI, subscription, and demo-payment handlers now use `req.effectiveTenantId`; payment metadata also uses the effective tenant rather than the raw selector.

### 3.2 Paid self-activation boundary

`POST /subscription/subscribe` now resolves the plan through the same plan repository used by the subscription system and permits direct self-service creation only when:

```text
plan.priceMinorUnits === 0
```

A non-explicitly-free plan fails closed with:

```text
HTTP 403
code = PAID_PLAN_REQUIRES_TRUSTED_ACTIVATION
```

No new admin endpoint or billing architecture was invented in this bounded remediation. Paid activation remains the responsibility of a trusted billing/admin integration.

## 4. Green focused security evidence

After remediation:

```text
server/tests/security-phase-b-tenant-entitlement.test.ts
Test Files 1 passed (1)
Tests 9 passed (9)
```

The permanent negative controls cover:

- cross-tenant `/me` denial;
- trusted principal with missing tenant claim denial;
- cross-tenant subscription read denial;
- cross-tenant subscription write denial with no Tenant-B state change;
- cross-tenant AI denial before quota/provider side effects;
- cross-tenant payment denial before quota/provider side effects;
- concurrent mismatched requests remain denied;
- direct `pro` activation denied and creates no subscription;
- explicitly free plan activation remains functional.

## 5. Server regression

### Typecheck

```text
npm run typecheck
PASS
```

### No database configured

Canonical `npm test` with `DATABASE_URL` unset:

```text
Test Files 6 passed | 1 skipped (7)
Tests 66 passed | 5 skipped (71)
exit 0
```

The five skipped tests are the PostgreSQL integration tests by their existing contract.

### PostgreSQL 16.4 configured

Against an isolated loopback-only PostgreSQL 16.4 database:

```text
Test Files 7 passed (7)
Tests 71 passed (71)
exit 0
```

Repeatability was re-proved after the final focused test was added:

```text
RUN-1: 7/7 files, 71/71 tests, exit 0
RUN-2: 7/7 files, 71/71 tests, exit 0
RUN-3: 7/7 files, 71/71 tests, exit 0
subscriptions=0
billing_event_ledger=0
```

## 6. WU4 reference UI/database proof

The proof was updated to match the security contract instead of preserving the insecure prior behavior.

Observed:

- demo-auth gate: 21/21 PASS;
- i18n parity: 8/8 PASS;
- HTTP/database E2E: 9/9 PASS.

The plan-selection proof now explicitly observes:

```text
pro direct activation -> 403 PAID_PLAN_REQUIRES_TRUSTED_ACTIVATION
rows_after_paid_attempt = 0
free direct activation -> 201
database plan_id = free
repeat free activation -> 409 SUBSCRIPTION_ALREADY_EXISTS
```

## 7. Delivery, claims, dependency and package gates

### Delivery

```text
delivery gate: 9/9 PASS
delivery negative-control self-test: 7/7 PASS
delivered files classified: 254
not delivered working papers before this evidence file: 14
```

### Claims

```text
claims gate: 10/10 PASS
numeric claims negative controls: 7/7 PASS
Supabase claims fixtures: 9/9 PASS
```

Buyer-facing test-count claims were updated to the current 7-file / 71-test tree and the numeric checker still proves that stale/reverted figures make the gate red.

### Dependency / buyer package security

`npm run test:security` passed:

- dependency-audit self-tests 3/3;
- server + eight module roots, all-dependency and production-only scopes: zero vulnerabilities;
- secret-scan self-tests 5/5;
- buyer-delivered secret scan: 254 text files, 0 findings;
- production demo-auth gate 21/21;
- deploy preflight 7/7.

The evidence file itself is internal and is added to the NOT DELIVERED classification after it is created.

## 8. Database / quota evidence

Migration runner on the already-migrated isolated database:

- three runs skipped the two already-applied migrations;
- schema migration rows = 2;
- expected six tables present;
- persistent wiring selected PostgreSQL repositories;
- `migration_runner_idempotent=true`.

WU-2 DB proof:

```text
5/5 PASS
```

WU-3 quota proof initially exposed a proof-harness contract drift after tenant authorization was added: direct handler invocations did not set the new post-authorization `effectiveTenantId`, so two HTTP-handler checks stopped at 403. The runtime middleware was not weakened. The harness was corrected to model a request after successful tenant authorization; cross-tenant denial remains covered by the HTTP Phase B negative-control suite.

Corrected quota proof:

```text
6/6 PASS
```

including:

- over-quota denied before provider;
- in-quota atomic increment;
- failed provider call releases usage;
- reconnect durability;
- 16 concurrent increments -> final 16;
- single-statement atomic SQL contract.

## 9. Webhook / rate-limit evidence

```text
tests/webhook-rate-limit.test.ts: 11/11 PASS
ratelimit-flood-proof.mjs: 11/11 PASS
```

Observed behavior still includes:

- forged traffic refused after allowance;
- valid signed delivery survives forged flood;
- valid signed delivery survives backstop exhaustion;
- per-source buckets remain independent;
- limiter remains armed after valid deliveries.

The documented single-process/multi-instance limitation remains unchanged.

## 10. Module regression

All module typechecks passed.

| Module | Tests |
|---|---:|
| ai-provider | 8/8 |
| auth-supabase | 32/32 |
| enterprise-features | 16/16 |
| payment | 21/21 |
| rate-limit | 36/36 |
| subscription | 39/39 |
| tenant-context | 14/14 |
| webhook-receiver | 136/136 |

The auth-supabase suite includes the existing user-metadata authorization negative controls.

## 11. Evidence hygiene notes

One attempted repeatability command added a Vitest reporter named `basic`. Vitest 5 treated that as a missing custom reporter and rejected the run before tests started. Those attempts are explicitly **not counted as evidence**. The repeatability proof above was rerun using the canonical `npm test` command three times, each with exit 0 and 71/71 tests.

Similarly, the first quota-proof run after the runtime change reported 4/6 because the harness still modeled the pre-authorization handler request shape. That red result was treated as a regression in the proof contract, not hidden. The harness was corrected without weakening runtime authorization and rerun to 6/6.

## 12. Closure mapping

### B-HIGH-001

**Remediation evidence ready for independent verification.**

- trusted principal/tenant mismatch -> 403;
- missing trusted tenant claim -> 403;
- protected handlers use only effective tenant id;
- Tenant-B state/quota/provider side effects remain untouched;
- concurrent mismatch remains denied.

### B-HIGH-002

**Remediation evidence ready for independent verification.**

- direct paid-plan activation -> 403;
- no subscription row is created;
- request-body plan selection alone cannot establish paid entitlement;
- explicitly-free plan behavior remains functional.

## 13. What this does NOT claim

This document does **not** declare `SECURITY-ASSURANCE PASS`.

Still required:

- an independent reviewer that did not author the remediation must review the exact revision;
- the reviewer must inspect the broader Phase B attack surface and required negative-control coverage, not only these two findings;
- real Supabase verification remains Phase C;
- buyer clean install/deployment, commercial/legal, fulfillment, and final release seal remain open;
- the single-process webhook limiter limitation remains documented.

## 14. Handoff state

```text
B-HIGH-001: REMEDIATED — AWAITING INDEPENDENT VERIFICATION
B-HIGH-002: REMEDIATED — AWAITING INDEPENDENT VERIFICATION
SECURITY-ASSURANCE: HOLD / STOP SALE
NEXT: INDEPENDENT PHASE B REVIEW
```

The independent reviewer must bind its verdict to the exact review revision supplied in the dispatch packet.
