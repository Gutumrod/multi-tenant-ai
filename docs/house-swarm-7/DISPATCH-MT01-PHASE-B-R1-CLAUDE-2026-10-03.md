# AGENT DISPATCH — MT01-PHASE-B-SEC-REMEDIATION-001 / CLAUDE ROUND

Template Version: 1.2.0  
Policy: wstera-workflows origin/main @ c8f41ac2b51445af2e7095995be17132d103064a / policies/AGENT-DISPATCH-POLICY.md v1.4.1  
Dispatch Status: READY

**Role:** Claude / SENIOR_DIFFICULT_REMEDIATION_ENGINEER  
**Task ID:** MT01-PHASE-B-SEC-REMEDIATION-001  
**Workflow:** WF-DEV-01 v1.4.0  
**Execution Mode:** STANDARD  
**Runtime Procedure:** N/A  
**Repository:** Gutumrod/multi-tenant-ai  
**Workspace:** D:\AI-Workspace\runtime\worktrees\mt01-phase-b-remediation-20261003  
**Branch / Worktree:** work/mt01-phase-b-remediation-20261003 / path above  
**Implementation Source Base:** d3ccf171ab0e2eaf4c7616416094baa226da0076  
**Context Mode:** BUILD  
**Current Checkpoint:** CP-B-02 SENIOR_REMEDIATION_READY  
**Stage ID:** PHASE-B-REMEDIATION  
**Work Unit ID:** R-B1-R-B4-HIGH-CLOSURE  
**Review Batch ID:** R1  
**Run Manifest:** N/A — STANDARD bounded remediation  
**Issue Fingerprint:** B-HIGH-001+B-HIGH-002  
**Attempt / Cycle:** senior remediation round 1 after primary executor runtime blocker  
**Expected Stop:** READY FOR REVIEW R1  
**Production Readiness Applicability:** EVIDENCE_ONLY  
**Current Readiness State:** BUILD_PASS baseline only; NOT PRODUCTION_READY  
**Requested Readiness Transition:** NONE  
**Production Readiness Standard:** wstera-workflows origin/main @ c8f41ac2b51445af2e7095995be17132d103064a / policies/PRODUCTION-READINESS-STANDARD.md v1.0.0  
**Production Readiness Record:** N/A — no readiness transition in this round.

## Why Claude is selected

The primary OpenCode/Ollama Cloud execution was blocked before implementation; see:

`docs/house-swarm-7/EVIDENCE-MT01-PHASE-B-OPENCODE-BLOCKED-2026-10-03.md`

This task is a bounded High-severity security remediation, so Claude is selected only in the senior difficult remediation role. This dispatch does not redefine Claude as an ordinary/general builder.

## Source of Truth

1. `docs/house-swarm-7/TASK-MT01-PHASE-B-SEC-REMEDIATION-001.md`
2. `docs/house-swarm-7/PRESALE-PHASE-B-REMEDIATION-PLAN-2026-10-03.md`
3. `docs/house-swarm-7/PRESALE-RELEASE-MASTER-PLAN-2026-10-02.md`
4. `docs/house-swarm-7/EVIDENCE-MT01-PHASE-B-OPENCODE-BLOCKED-2026-10-03.md`
5. repository source/tests at the exact branch.

Do not infer requirements from chat history.

## Objective

Close B-HIGH-001 and B-HIGH-002 with RED-before-fix executable negative controls, minimal coherent production changes, and exact regression evidence. Stop at READY FOR REVIEW R1.

## Required implementation behavior

### Tenant boundary
- trusted authentication principal must authorize the requested tenant before protected business logic;
- caller-controlled `x-tenant-id` is not authority;
- mismatched Tenant-A principal / Tenant-B request returns `403 TENANT_ACCESS_DENIED`;
- all five protected routes are covered: `/me`, `/subscription/status`, `/subscription/subscribe`, `/ai/demo`, `/payment/demo-charge`;
- mismatched requests produce no quota/subscription/provider/payment side effects.

### Paid entitlement boundary
- normal authenticated caller cannot obtain paid `pro` entitlement by submitting `planId=pro`;
- user-controlled request body alone cannot establish paid entitlement;
- preserve free self-service behavior only if consistent with existing product contract;
- if trusted paid activation is not implemented, paid self-service must fail closed and documentation/tests must say so.

### Auth input boundary
- if touched, make Authorization parsing explicit and fail closed for missing/malformed/empty Bearer input;
- never use user_metadata as trusted authorization data;
- production DEMO_AUTH refusal must remain intact.

## Required sequence

1. Inspect source/tests and relevant package scripts.
2. Add negative tests first.
3. Execute targeted tests before production fix and capture RED evidence in a repository evidence file.
4. Implement minimum coherent fix.
5. Rerun targeted tests to GREEN.
6. Run typecheck, complete server tests, relevant auth/subscription module tests, and `git diff --check`.
7. Persist implementation evidence.
8. Commit all owned changes.
9. Return exact SHA and stop.

## Allowed Scope

- `server/src/middleware/**`
- `server/src/app.ts`
- protected route code only when required by the trusted-tenant boundary;
- subscription route/service boundary only as required to stop paid self-escalation;
- relevant tests/helpers/fixtures;
- bounded Phase B evidence/docs.

## Prohibited

- no main write/merge;
- no deploy/release;
- no Phase C;
- no broad architecture or commercial redesign;
- no weakening tests;
- no trusting `user_metadata` or raw tenant header;
- no hidden paid activation fallback;
- no Phase B PASS claim;
- no PRODUCTION_READY claim;
- no self-approval.

## Required Verification

- RED-before-fix evidence for both High findings;
- targeted GREEN controls;
- complete server tests;
- relevant auth/subscription module tests;
- typecheck;
- `git diff --check`;
- exact git status and commit SHA.

If PostgreSQL/external proof is unavailable, report limitation rather than inventing PASS.

## Required Return Contract

Return:
- exact commit SHA;
- branch/worktree;
- changed files;
- RED evidence;
- GREEN evidence;
- regression/typecheck results;
- evidence paths;
- blockers/limitations;
- deviations;
- final git status;
- stop state.

## Stop Condition

`READY FOR REVIEW R1`

Do not review or approve your own remediation.
