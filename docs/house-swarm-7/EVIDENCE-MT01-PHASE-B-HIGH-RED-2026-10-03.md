# MT01 Phase B — RED Evidence for B-HIGH-001 / B-HIGH-002

> INTERNAL — NOT DELIVERED.

**Date:** 2026-10-03
**Task:** MT01-PHASE-B-SEC-REMEDIATION-001
**Branch:** work/mt01-phase-b-remediation-20261003
**Pre-fix source revision:** af8cfb5b3f3274113864f4a633c3affe21e1f52d
**Negative-control file:** server/tests/phase-b-high-security.test.ts
**Command:** npx vitest run tests/phase-b-high-security.test.ts
**Result:** 1 file failed; 7 failed / 1 passed / 8 total

## Confirmed B-HIGH-001 exploit behavior

With a trusted mocked principal for Tenant A and x-tenant-id selecting Tenant B:

- GET /me returned 200 instead of 403.
- GET /subscription/status returned 200 instead of 403.
- POST /subscription/subscribe returned 201 and created an active free subscription for Tenant B.
- POST /ai/demo returned 200, consumed Tenant-B AI usage from 0 to 1, resolved the provider once, and called it once.
- POST /payment/demo-charge returned 200, consumed Tenant-B payment usage from 0 to 1, resolved the payment core once, and called it once.
- Eight concurrent cross-tenant AI requests all returned 200, consumed Tenant-B AI usage to 8, resolved the provider 8 times, and called it 8 times.

This is executable proof of cross-tenant read/write/entitlement/quota/provider escape on the locked pre-fix branch.

## Confirmed B-HIGH-002 exploit behavior

For a same-tenant authenticated principal:

- POST /subscription/subscribe with planId=pro returned 201.
- The resulting subscription was stored as planId=pro with status=active.
- No trusted payment/admin decision was required.

The free-plan self-service control passed, confirming the negative suite is not simply rejecting all subscription creation.

## Required GREEN state

The same test file must pass unchanged after remediation:
- mismatched tenant requests return 403 TENANT_ACCESS_DENIED before side effects;
- concurrent mismatch leaves usage at 0 and providers uncalled;
- direct pro activation returns 403 PAID_PLAN_REQUIRES_BILLING with no subscription created;
- same-tenant free activation remains 201.
