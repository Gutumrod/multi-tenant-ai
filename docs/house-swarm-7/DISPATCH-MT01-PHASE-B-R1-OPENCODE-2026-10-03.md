# AGENT DISPATCH — MT01-PHASE-B-SEC-REMEDIATION-001

Template Version: 1.2.0  
Policy: wstera-workflows origin/main @ c8f41ac2b51445af2e7095995be17132d103064a / policies/AGENT-DISPATCH-POLICY.md v1.4.1  
Dispatch Status: READY

**Role:** OpenCode / PRIMARY_GENERAL_IMPLEMENTATION_WORKER  
**Task ID:** MT01-PHASE-B-SEC-REMEDIATION-001  
**Workflow:** WF-DEV-01 v1.4.0  
**Execution Mode:** STANDARD  
**Runtime Procedure:** N/A  
**Repository:** Gutumrod/multi-tenant-ai  
**Workspace:** D:\AI-Workspace\runtime\worktrees\mt01-phase-b-remediation-20261003  
**Branch / Worktree:** work/mt01-phase-b-remediation-20261003 / path above  
**Base / Expected Revision:** 9a7205189fa6ef98bd06a6fb9615e4ce34f9b3a6  
**Context Mode:** BUILD  
**Current Checkpoint:** CP-B-01 PRIMARY_IMPLEMENTATION_READY  
**Stage ID:** PHASE-B-REMEDIATION  
**Work Unit ID:** R-B1-R-B4-HIGH-CLOSURE  
**Review Batch ID:** R1  
**Run Manifest:** N/A — STANDARD bounded remediation  
**Issue Fingerprint:** B-HIGH-001+B-HIGH-002  
**Attempt / Cycle:** primary implementation / attempt 1  
**Expected Stop:** READY FOR REVIEW R1  
**Production Readiness Applicability:** EVIDENCE_ONLY  
**Current Readiness State:** BUILD_PASS baseline only; NOT PRODUCTION_READY  
**Requested Readiness Transition:** NONE  
**Production Readiness Standard:** wstera-workflows origin/main @ c8f41ac2b51445af2e7095995be17132d103064a / policies/PRODUCTION-READINESS-STANDARD.md v1.0.0  
**Production Readiness Record:** N/A — this round does not request a readiness transition.

## Source of Truth

Order of precedence:

1. docs/house-swarm-7/TASK-MT01-PHASE-B-SEC-REMEDIATION-001.md
2. docs/house-swarm-7/PRESALE-PHASE-B-REMEDIATION-PLAN-2026-10-03.md
3. docs/house-swarm-7/PRESALE-RELEASE-MASTER-PLAN-2026-10-02.md
4. Phase B review report supplied by coordinator: MT01-PHASE-B-SECURITY-ASSURANCE-2026-10-03.md
5. existing repository source/tests on the exact branch.

Do not infer requirements from chat history.

## Objective

Close B-HIGH-001 and B-HIGH-002 on this branch with RED-before-fix executable negative controls, minimal production changes, and regression evidence. Stop at READY FOR REVIEW R1.

## Allowed Scope

- server authentication/tenant middleware and composition;
- protected route authorization wiring;
- subscription self-service boundary necessary to block direct paid entitlement;
- tests/fixtures/helpers required to prove the two High findings;
- explicit Bearer-header validation if required for deterministic fail-closed auth behavior;
- bounded documentation/evidence for this round.

## Required Sequence

1. Inspect exact source and existing tests first.
2. Add executable negative controls for B-HIGH-001 and B-HIGH-002.
3. Run them against pre-fix behavior and record RED evidence.
4. Implement the smallest coherent fix.
5. Re-run targeted controls to GREEN.
6. Run relevant regression/typecheck/full server suite.
7. Commit implementation + evidence on this branch.
8. Return the exact commit SHA and stop at READY FOR REVIEW R1.

## Prohibited

- do not touch main;
- do not merge, release or deploy;
- do not enter Phase C;
- do not redesign subscription/billing beyond the minimum trusted-boundary fix;
- do not bypass tenant checks inside tests;
- do not weaken assertion semantics or convert denial tests into status-only tests;
- do not use user_metadata as trusted authorization data;
- do not make x-tenant-id authoritative;
- do not claim Phase B PASS or PRODUCTION_READY;
- do not self-review/approve.

## Required Verification

At minimum:

- new cross-tenant negative controls for all five protected routes;
- no-side-effect assertions for quota/subscription/provider/payment where applicable;
- direct paid-plan activation denial test;
- production DEMO_AUTH refusal remains green;
- malformed/missing Authorization behavior relevant to touched boundary;
- npm run typecheck (or repository-native equivalent);
- complete server tests;
- relevant auth/subscription module tests;
- git diff --check;
- git status;
- exact commit SHA.

If PostgreSQL or another external dependency is unavailable, report it as a limitation; do not invent PASS.

## Required Return Contract

Return:
- exact commit SHA;
- branch/worktree;
- changed files;
- RED-before-fix evidence;
- GREEN targeted evidence;
- regression/typecheck results;
- evidence paths;
- blockers/limitations;
- git/worktree status;
- deviations from dispatch;
- actual stop checkpoint.

## Stop Condition

Stop at: READY FOR REVIEW R1

This is not approval. A fresh independent reviewer must inspect the exact revision before any Phase B promotion.
