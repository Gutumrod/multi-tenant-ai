# AGENT DISPATCH — MT01-PHASE-B-SEC-REMEDIATION-001 / OWNER-AUTHORIZED EMERGENCY ROUND

> INTERNAL — NOT DELIVERED.

**Dispatch Status:** READY
**Authority:** explicit Owner instruction in the active task to proceed
**Executor:** Sol / coordinator direct bounded execution (documented one-round deviation)
**Task ID:** MT01-PHASE-B-SEC-REMEDIATION-001
**Workflow:** WF-DEV-01 v1.4.0 / STANDARD, with documented executor deviation only
**Repository:** Gutumrod/multi-tenant-ai
**Workspace:** D:\AI-Workspace\runtime\worktrees\mt01-phase-b-remediation-20261003
**Branch:** work/mt01-phase-b-remediation-20261003
**Implementation source base:** c33abfb23f8f74efac5d733b23969cab8e043516
**Issue fingerprint:** B-HIGH-001+B-HIGH-002
**Expected stop:** READY FOR REVIEW R1
**Production readiness:** EVIDENCE_ONLY; no readiness transition

## Basis for deviation

Read `EVIDENCE-MT01-PHASE-B-EXECUTOR-FALLBACK-2026-10-03.md`.

The ordinary OpenCode path, Qwen/Ollama fallback path, and Claude senior-remediation path are unavailable for runtime/auth reasons before implementation. The Owner has explicitly directed work to continue. This packet authorizes only one coordinator-authored bounded remediation round; it does not change WSTERA's canonical role registry.

## Source of truth

1. TASK-MT01-PHASE-B-SEC-REMEDIATION-001.md
2. PRESALE-PHASE-B-REMEDIATION-PLAN-2026-10-03.md
3. PRESALE-RELEASE-MASTER-PLAN-2026-10-02.md
4. Phase B adversarial report and executor fallback evidence
5. exact repository source/tests

## Objective

Close B-HIGH-001 and B-HIGH-002 using RED-before-fix tests, minimum coherent production changes, and exact regression evidence.

## Allowed

- add Phase B negative-control tests;
- add one shared tenant authorization boundary and wire it on protected routes;
- harden Bearer-header parsing if required;
- block self-service paid-plan activation at the public authenticated route boundary;
- preserve free self-service if compatible;
- write bounded evidence.

## Prohibited

- no merge/main write;
- no deploy/release;
- no Phase C;
- no broad refactor/redesign;
- no trusted authorization from user_metadata or x-tenant-id alone;
- no test weakening;
- no self-review or Phase B PASS claim.

## Required verification

- RED-before-fix targeted test output persisted;
- GREEN targeted security tests;
- full server test suite;
- typecheck;
- relevant auth/subscription module tests;
- git diff --check;
- exact SHA and clean/declared worktree state.

## Stop

Stop at READY FOR REVIEW R1 and hand exact revision to an independent reviewer.
