# MT01 Phase B — R1 GREEN Evidence

> INTERNAL — NOT DELIVERED.

**Date:** 2026-10-03
**Task:** MT01-PHASE-B-SEC-REMEDIATION-001
**Branch:** work/mt01-phase-b-remediation-20261003
**Implementation candidate:** 8dee92033e1923eb831fe1697c093274fb10b793
**Scope:** B-HIGH-001 + B-HIGH-002 and explicit Bearer input hardening
**State:** READY FOR REVIEW R1 — not Phase B PASS

## 1. RED-before-fix proof

Pre-fix revision: af8cfb5b3f3274113864f4a633c3affe21e1f52d

Command:

`npx vitest run tests/phase-b-high-security.test.ts`

Result:

- 1 test file failed
- 7 failed / 1 passed / 8 total

Confirmed before remediation:

- cross-tenant /me returned 200;
- cross-tenant subscription status returned 200;
- cross-tenant subscription write returned 201 and mutated Tenant B;
- cross-tenant AI returned 200, consumed Tenant-B quota and called provider;
- cross-tenant payment returned 200, consumed Tenant-B quota and called payment provider;
- 8 concurrent cross-tenant AI requests all returned 200 and consumed Tenant-B usage to 8;
- authenticated planId=pro self-activation returned 201 with active Pro subscription.

Detailed output is recorded in EVIDENCE-MT01-PHASE-B-HIGH-RED-2026-10-03.md.

## 2. Remediation

### B-HIGH-001

Added a shared post-authentication tenant authorization boundary:

- `server/src/middleware/tenant-authorization.ts`
- protected route order is now tenant selector -> authentication -> tenant authorization -> handler;
- authorization uses the existing trusted `requireTenantMembership()` guard;
- the caller-controlled `x-tenant-id` remains only a selector;
- mismatch returns `403 TENANT_ACCESS_DENIED` before business side effects.

Protected routes wired through the boundary:

- GET /me
- GET /subscription/status
- POST /subscription/subscribe
- POST /ai/demo
- POST /payment/demo-charge

### B-HIGH-002

The public authenticated subscription route now resolves the requested plan before creation and rejects any plan with `priceMinorUnits > 0` using:

`403 PAID_PLAN_REQUIRES_BILLING`

The generic subscription core remains a server-side primitive. The current starter kit does not invent a paid activation path: if trusted billing/admin activation is not implemented, public paid activation fails closed.

### Authentication input hardening

`server/src/middleware/auth.ts` now accepts only an explicit single-token Bearer authorization value. Missing, malformed, empty, wrong-scheme or extra-token forms fail closed with `AUTHORIZATION_HEADER_INVALID` when auth is configured.

## 3. Targeted GREEN proof

Command:

`npx vitest run tests/phase-b-high-security.test.ts tests/auth-input-boundary.test.ts`

Result:

- 2 files passed
- 18/18 tests passed

The same Phase B security test that produced RED now proves:

- all five Tenant-A -> Tenant-B protected-route cases deny with 403;
- Tenant-B subscription remains unchanged on denied write;
- Tenant-B AI/payment quota remains unchanged;
- AI/payment providers are not resolved/called on denied request;
- eight concurrent mismatched AI requests all deny and leave usage at 0;
- direct Pro self-activation denies with PAID_PLAN_REQUIRES_BILLING and creates no subscription;
- same-tenant Free self-service remains 201;
- 10 Bearer parser boundary cases pass.

## 4. Regression / module evidence

Server typecheck:

- `npm run typecheck` — PASS.

Full server suite:

- Test Files: 7 passed / 1 skipped
- Tests: 75 passed / 5 PostgreSQL tests skipped
- elapsed ~17 s
- webhook forged-flood, valid-delivery and backstop tests remained green.

Auth Supabase module:

- `npm test` — 32/32 PASS
- `npm run typecheck` — PASS
- includes trusted-vs-user-metadata security suite.

Subscription module:

- `npm test` — 39/39 PASS
- `npm run typecheck` — PASS.

Delivery manifest:

- 9/9 checks PASS
- 255 delivered files / 21 internal not-delivered working papers at the implementation candidate.

Buyer package secret scan:

- 255 delivered files scanned
- 0 findings.

Deploy preflight:

- 7/7 checks PASS.

Dependency audit:

The repository aggregate Node proof harness currently fails on this Windows executor because its `spawnSync('npm.cmd', ...)` calls return no JSON. This is a Windows proof-harness execution limitation, not a vulnerability result.

The same audits were therefore run directly via the package manager for all nine package roots, both all-dependency and production-only:

- 9 roots
- 18 audit checks
- 18/18 PASS
- total vulnerabilities = 0 for every check.

The aggregate harness itself was not modified in this High-remediation round because that would expand scope.

## 5. Environment-limited proof

Current worktree environment has no `DATABASE_URL`.

Consequences:

- the 5 PostgreSQL tests are skipped by the full server suite;
- WU-4 HTTP/database E2E stops with `DATABASE_URL is not set`.

The non-DB WU-4 portions did run:

- demo-auth 21/21 PASS;
- i18n parity 8/8 PASS.

Phase A previously proved PostgreSQL on an isolated local PostgreSQL 16.4 environment, but that historical result is not being presented as a current-revision DB proof.

Current R1 therefore records DB-backed rerun as an explicit limitation for the independent reviewer / later Phase B matrix. It does not invent PASS.

## 6. Worktree / diff integrity

- `git diff --check` — PASS before implementation commit.
- no production deployment;
- no main merge;
- no Phase C work;
- buyer manifest updated to include the new shipped source/tests and exclude vendor-internal evidence/dispatch files.

## 7. Required next action

Independent reviewer must inspect exact revision and the RED/GREEN evidence.

The implementation author/coordinator does not approve this remediation and does not declare Phase B PASS.

Expected next checkpoint:

`INDEPENDENT REVIEW R1`
