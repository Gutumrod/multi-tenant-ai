# MT01 Pre-Sale Phase B — Security Remediation Plan

> INTERNAL — NOT DELIVERED.
> Bounded remediation plan for findings produced by the Phase B adversarial Security Assurance gate.

**Date:** 2026-10-03  
**Project:** MT01 — Multi-Tenant AI Starter Kit  
**Task ID:** `MT01-PHASE-B-SECURITY-REMEDIATION-20261003`  
**Repository:** `Gutumrod/multi-tenant-ai`  
**Accepted baseline:** `0b849eefa23ed7c6d47abf494e84a8f711575a8d`  
**Working branch:** `task/MT01-PHASE-B-security-remediation-20261003`  
**Originating gate:** `WF-COUNCIL-01 v1.0.0` / `SECURITY-ASSURANCE`  
**Execution workflow:** `WF-DEV-01 v1.4.0`  
**Execution mode:** `STANDARD`  
**Entry conditions:** `PASS`  
**Current gate state:** `SECURITY-ASSURANCE = HOLD / STOP SALE`

## 1. Source of truth

This remediation is bound to:

1. `docs/house-swarm-7/PRESALE-RELEASE-MASTER-PLAN-2026-10-02.md`
2. Phase B adversarial report `MT01-PHASE-B-SECURITY-ASSURANCE-2026-10-03.md`
3. exact baseline `0b849eefa23ed7c6d47abf494e84a8f711575a8d`
4. current repository runtime/source at that revision
5. WSTERA `WF-DEV-01 v1.4.0 / STANDARD`

No implementation assumption may override repository evidence.

## 2. Problem

Phase B identified two High-severity release blockers:

- `B-HIGH-001`: caller-controlled `x-tenant-id` is not bound to the trusted authenticated principal before tenant-scoped protected handlers execute.
- `B-HIGH-002`: an authenticated tenant can call `POST /subscription/subscribe` with a paid plan id and immediately obtain active paid entitlement without a trusted billing/admin transition.

Both are STOP SALE findings under the release master plan.

## 3. Security invariants to restore

### INV-B1 — Trusted tenant binding

```text
requested tenant selector
  + authenticated principal
  -> authorization check
  -> trusted/effective tenant
  -> protected business handler
```

A raw header-derived tenant id must never be used as the effective account id by a protected paid/business handler unless membership has first been verified against trusted auth context.

For the current single-tenant-per-user auth contract:

```text
authContext.tenantId == requested tenantId
```

is mandatory.

### INV-B2 — No self-granted paid entitlement

A normal authenticated user cannot establish a paid subscription by choosing a paid `planId` in a request body.

Self-service direct activation may only create a plan that is explicitly free (`priceMinorUnits === 0`). Any plan whose price is positive, absent, malformed, or otherwise not explicitly free must fail closed and require the trusted billing/admin path.

### INV-B3 — Downstream side effects happen only after authorization

A tenant mismatch must occur before:

- subscription read/write;
- quota consumption;
- AI provider call;
- payment provider call;
- outbound tenant metadata propagation.

## 4. Scope

### In scope

- protected-route tenant authorization composition;
- trusted/effective tenant propagation to handlers;
- direct subscription activation boundary;
- executable adversarial negative controls;
- regression evidence for affected server/module/database/security paths;
- Phase B remediation evidence and exact revision handoff.

### Out of scope

- real Supabase project verification (Phase C / `REAL-SUPABASE`);
- new multi-membership model;
- new organization/member tables;
- payment product redesign;
- storefront/fulfillment/legal work;
- final release seal;
- unrelated feature work.

If remediation proves that any out-of-scope architectural change is required, STOP and return to Council/Owner rather than widening scope silently.

## 5. Locked remediation decisions

### D-B1 — Effective tenant is derived only after trusted membership check

Add a protected-route authorization middleware that:

1. requires both `req.authContext` and requested `req.tenantContext`;
2. calls the existing `requireTenantMembership()` guard;
3. on success, records an effective/trusted tenant id on the request;
4. on mismatch, returns `403` with `TENANT_ACCESS_DENIED` and does not call downstream handlers.

Protected handlers must use the effective tenant id, not the raw header-derived tenant id.

### D-B2 — Keep the tenant header only as a selector

The existing `x-tenant-id` resolver can remain for the current reference-server UX, but it is not an authorization source. It is only a requested tenant selector until D-B1 succeeds.

### D-B3 — Direct self-service subscription creation is free-only

`POST /subscription/subscribe` may directly establish only a plan whose repository record explicitly has `priceMinorUnits === 0`.

Paid or non-explicitly-free plans return a denial and must be activated by the trusted billing/admin path. The request body alone is never sufficient billing evidence.

No new admin endpoint is added in this work unit.

## 6. Work units

### R-B1 — Red tests for cross-tenant access

Create executable negative controls that prove the baseline defect before the fix and then become permanent regression tests.

Required cases with trusted Tenant-A identity + requested Tenant-B:

- `GET /me` -> `403 TENANT_ACCESS_DENIED`
- `GET /subscription/status` -> `403 TENANT_ACCESS_DENIED`
- `POST /subscription/subscribe` -> `403 TENANT_ACCESS_DENIED`
- `POST /ai/demo` -> `403 TENANT_ACCESS_DENIED`
- `POST /payment/demo-charge` -> `403 TENANT_ACCESS_DENIED`

Required side-effect assertions:

- Tenant-B subscription unchanged;
- Tenant-B AI/payment usage unchanged;
- AI provider not called;
- payment provider not called;
- concurrent mismatched requests remain denied.

Checkpoint: test must demonstrate red behavior against the unremediated composition or otherwise prove that the negative control is capable of detecting the defect.

### R-B2 — Trusted tenant authorization middleware

Implement the smallest reusable middleware that binds requested tenant to trusted auth context using the existing auth-supabase guard.

Requirements:

- fail closed if auth context is unexpectedly absent;
- fail closed if requested tenant context is absent;
- preserve `AuthError` status/code contract;
- set `req.effectiveTenantId` only after membership PASS;
- never trust user metadata as an authorization source.

### R-B3 — Move protected handlers to effective tenant

Update protected business handlers to use `req.effectiveTenantId`:

- AI demo;
- subscription create/status;
- payment demo charge.

Do not use raw `req.tenantContext.tenantId` for protected business account selection after this change.

### R-B4 — Close paid entitlement self-activation

Before direct subscription creation:

1. resolve the requested plan from the same plan repository used by the subscription engine;
2. return existing `PLAN_NOT_FOUND` semantics when absent;
3. allow direct creation only when `priceMinorUnits === 0`;
4. deny all other plans with a stable machine-readable error code indicating trusted billing/admin activation is required;
5. prove denial creates no subscription and no paid entitlement.

### R-B5 — Focused verification

Required focused checks:

- tenant mismatch negative-control suite;
- paid-plan direct activation denial;
- free-plan direct subscription still works;
- matching trusted tenant path still works;
- DEMO_AUTH production refusal remains unchanged;
- quota/payment/provider side-effect assertions remain true.

### R-B6 — Full regression and evidence

Run, as applicable on the remediation revision:

- `npm run typecheck`
- full server test suite
- PostgreSQL-backed persistence/quota tests and proofs
- all module typechecks/tests
- dependency security gate
- buyer secret/package scan
- delivery gate + negative-control self-test
- claims gate + fixtures
- setup/deploy preflight proofs
- webhook/rate-limit proofs
- new Phase B adversarial tests

No evidence = no completion claim.

## 7. Failure cases

The remediation must explicitly handle:

- valid auth with wrong tenant selector -> 403;
- valid auth with no trusted tenant claim -> 403;
- missing auth context reaching tenant authorization middleware -> fail closed;
- free-plan lookup failure -> existing not-found behavior;
- paid plan chosen by normal user -> denied without state transition;
- database/provider errors -> no cross-tenant fallback;
- concurrent mismatched requests -> no cross-tenant side effect.

## 8. Acceptance criteria

### B-HIGH-001 closure

- no protected route executes with mismatched trusted/requested tenant;
- all protected business handlers consume only effective tenant id;
- required cross-tenant negative controls pass;
- side-effect assertions prove Tenant B remains unchanged;
- matching-tenant normal behavior remains green.

### B-HIGH-002 closure

- normal authenticated user cannot directly activate `pro` or any non-explicitly-free plan;
- direct free-plan activation remains available if otherwise valid;
- paid transition requires an already-declared trusted billing/admin path;
- negative control proves request-body plan selection alone creates no paid entitlement.

### Remediation completion

- affected focused tests PASS;
- full required regression PASS;
- exact implementation commit SHA recorded;
- no Critical/High finding is claimed closed without executable evidence;
- remediation author does not approve own substantive changes.

## 9. Review checkpoint

After R-B1 through R-B6 are complete:

```text
STOP — READY FOR INDEPENDENT PHASE B REVIEW
```

Return to `WF-COUNCIL-01 / SECURITY-ASSURANCE` with:

- Base Commit;
- Review Commit;
- branch;
- changed-file inventory;
- negative-control evidence;
- regression evidence;
- closure mapping for `B-HIGH-001` and `B-HIGH-002`;
- remaining Phase B open-test candidates.

A fresh reviewer must verify the exact commit. Remediation completion does not itself equal `SECURITY-ASSURANCE PASS`.

## 10. Task checkpoint

```text
Task: MT01-PHASE-B-SECURITY-REMEDIATION-20261003
Workflow: WF-DEV-01 v1.4.0 / STANDARD
Base: 0b849eefa23ed7c6d47abf494e84a8f711575a8d
Branch: task/MT01-PHASE-B-security-remediation-20261003
Current checkpoint: REMEDIATION IMPLEMENTATION COMPLETE / READY FOR INDEPENDENT REVIEW
Implementation commit: 64b7fb3580e7fd3ae30575427e3914140ab862ca
Originating gate: SECURITY-ASSURANCE HOLD / STOP SALE
Next checkpoint: independent reviewer verification on the evidence-bound review revision
Stop condition: reviewer verdict returned to WF-COUNCIL-01 / SECURITY-ASSURANCE
```
