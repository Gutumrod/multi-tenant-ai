# TASK — MT01-PHASE-B-SEC-REMEDIATION-001

> INTERNAL — NOT DELIVERED.

**Task ID:** MT01-PHASE-B-SEC-REMEDIATION-001
**Date:** 2026-10-03
**Workflow:** WF-DEV-01 v1.4.0 / STANDARD
**Originating gate:** WF-COUNCIL-01 / SECURITY-ASSURANCE
**Repository:** Gutumrod/multi-tenant-ai
**Branch:** work/mt01-phase-b-remediation-20261003
**Worktree:** D:\AI-Workspace\runtime\worktrees\mt01-phase-b-remediation-20261003
**Accepted implementation base:** 9a7205189fa6ef98bd06a6fb9615e4ce34f9b3a6
**Current checkpoint:** CP-B-03 OWNER_AUTHORIZED_EMERGENCY_REMEDIATION
**Current worker:** Sol / coordinator direct bounded execution (Owner-authorized deviation)
**Latest dispatch:** docs/house-swarm-7/DISPATCH-MT01-PHASE-B-R1-SOL-EMERGENCY-2026-10-03.md
**Release state:** HOLD — STOP SALE
**Production readiness:** EVIDENCE_ONLY; no readiness transition authorized.

## Problem

Phase B adversarial review found two High-severity release blockers:

- B-HIGH-001: protected tenant-scoped routes authenticate a principal but do not bind the requested tenant to the trusted authenticated tenant.
- B-HIGH-002: a normal authenticated tenant can request a paid plan and activate paid entitlement without a trusted billing/admin transition.

Both violate Phase B security invariants and block sale.

## User / Outcome

A buyer of MT01 must receive a starter kit whose tenant, entitlement, quota and billing boundaries fail closed. An authenticated principal must not be able to act as another tenant or grant itself paid entitlement.

## Locked Scope

Primary implementation round closes B-HIGH-001 and B-HIGH-002 with executable negative controls.

Allowed supporting hardening: explicit Authorization/Bearer input validation when needed to make the auth boundary deterministic.

Full Phase B B4-B8 adversarial expansion remains later work after R1 review; Phase C is not authorized.

## Architecture / Security Contract

1. Trusted authentication context is authoritative.
2. x-tenant-id is only a requested selector, never sufficient authority.
3. Protected tenant routes must authorize requested tenant membership before business logic.
4. Business handlers must not perform side effects for a tenant that failed authorization.
5. Normal authenticated users cannot activate a paid plan from caller-controlled planId alone.
6. Paid entitlement requires a trusted billing/admin transition; if that path is not implemented, fail closed and document it.
7. Production DEMO_AUTH remains refused.
8. Do not weaken existing webhook/quota/claims/delivery protections.

## Acceptance Criteria

### B-HIGH-001
A trusted Tenant-A principal requesting Tenant-B receives 403 TENANT_ACCESS_DENIED for:
- GET /me
- GET /subscription/status
- POST /subscription/subscribe
- POST /ai/demo
- POST /payment/demo-charge

Negative controls also prove:
- Tenant-B quota unchanged;
- Tenant-B subscription unchanged;
- AI provider not called;
- payment provider not called;
- concurrent mismatched requests cannot cross tenant boundaries.

### B-HIGH-002
- normal authenticated member cannot directly activate paid plan pro;
- user-controlled planId cannot establish paid entitlement;
- free/non-paid self-service behavior may remain only if consistent with existing product contract;
- paid activation requires trusted billing/admin authority, or fails closed if not implemented.

### Regression
- typecheck passes;
- complete server test suite passes;
- relevant module tests pass;
- git diff --check passes;
- no new secret/private path is introduced.

## Prohibited

- no Phase C / REAL-SUPABASE work;
- no deploy/release/merge;
- no pricing/product-positioning redesign;
- no weakening tests to make implementation pass;
- no broad refactor unrelated to the two High findings;
- no builder self-approval.

## Stop

Stop after implementation + required evidence at READY FOR REVIEW R1. A separate independent reviewer must review the exact commit before Phase B can advance.

## Execution History

- Attempt 1 — OpenCode / deepseek-v4.1-flash:cloud: **BLOCKED_EXECUTOR_UNAVAILABLE** before implementation; no source changes. Evidence: docs/house-swarm-7/EVIDENCE-MT01-PHASE-B-OPENCODE-BLOCKED-2026-10-03.md.
- Claude senior-remediation round — **BLOCKED_EXECUTOR_UNAVAILABLE** because OAuth expired before execution; no source changes.`n- Qwen/Ollama fallback probe — **BLOCKED_EXECUTOR_UNAVAILABLE** because Ollama Cloud also stalled; no source changes.`n- Current authorized round — Sol coordinator direct bounded execution under explicit Owner instruction; independent review remains mandatory.
