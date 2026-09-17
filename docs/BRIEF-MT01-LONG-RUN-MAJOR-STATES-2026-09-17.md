# BRIEF — MT01 LONG_RUN Major-State Execution

**Date:** 2026-09-17
**Product:** MT01 — Multi-Tenant AI SaaS Starter Kit
**Mode:** `LONG_RUN / BUILD-TO-SELL / TEST-READY ONLY`
**Execution branch:** `feature/mt01-market-parity-continuation`
**Planning baseline:** `da19376871c876f04b27f048b17295f4ca3e1a91`

## 1. Authority and relationship to existing Source of Truth

This brief does not replace the canonical product/build contract:

`docs/BRIEF-MT01-MARKET-PARITY-BUILD-TO-TEST-READY-2026-09-08.md`

It changes the **execution cadence only**: MT01 must run through meaningful integrated product states instead of stopping for Owner review after every MT-MP phase.

All existing product positioning, commercial decisions, architecture invariants, non-goals, TEST-READY boundary, support boundary, and evidence requirements remain authoritative unless the Owner explicitly changes them.

Before creating anything, use **existing-first reconciliation**:

`ALREADY EXISTS / PARTIAL-REUSE / STALE-DOC / ACTUALLY-MISSING`

Do not create duplicate modules, adapters, flows, or documentation when an existing implementation can be extended or reconciled.

## 2. Verified starting state

- `MT-MP-01` development gate is complete on the feature branch.
- HEAD `da19376` already contains substantial `MT-MP-02` persistence implementation: Supabase/PostgreSQL schema and migrations, repository adapters, tenancy helpers, persistent idempotency/webhook-event state, seed/rollback/security SQL, and focused tests.
- `MT-MP-02` must therefore begin with reconciliation and verification, not a rewrite.
- Several buyer/current-state documents still describe persistence as in-memory-only; treat those claims as stale until reconciled against current source.
- No final independent product acceptance has been run.
- Do not merge to `master`, publish, deploy production, cut a commercial release, or integrate MT01 sale checkout with WSTERA Billing under this run.

## 3. LONG_RUN operating model

Hermes holds the canonical brief, current state, dependency order, checkpoints, and dispatch history.

Implementation workers continue through dependent tasks without returning to the Owner after every small phase. Each bounded checkpoint still requires local self-checks, evidence, a clean staged diff, and a recoverable commit/push where appropriate.

Codex is reserved for **major state gates and high-risk independent review**, not routine micro-checks. Supply Codex a detailed evidence bundle so it can verify independently without rereading the entire repository by default.

If a new defect is straightforward, the active worker fixes and reruns. If the same issue persists through two credible attempts, or the remediation is architecture/security/billing-critical, escalate to Claude with the exact brief, evidence, diagnostics, attempted fixes, and current SHA.

Do not interrupt the Owner unless a defined stop condition in this brief is reached.

## 4. Major State A — Core SaaS Vertical Slice

Run continuously through:

`MT-MP-02 reconciliation/closure -> MT-MP-03 Auth/Org/Team/RBAC -> MT-MP-04 Billing/Entitlement/Reconciliation -> integrated vertical-slice verification`

The target is one coherent backend path, not three isolated phase checkmarks:

`Authentication -> Membership -> Verified TenantContext -> Persistence -> Subscription/Entitlement -> Stripe test-mode -> Signed Webhook -> Persistent Claim -> Provider Refetch -> Monotonic State Transition -> Reconciliation`

### A1 — Close the real MT-MP-02 state

Inventory the implementation already present at `da19376`; map every MT-MP-02 requirement to source/tests/migrations. Extend only genuine gaps. Reconcile stale buyer/current docs with implementation truth. Verify forward migration, rollback/recovery guidance, tenant ownership constraints, server-only secrets, restart-safe claims, and focused persistence tests.

Do not declare MP02 PASS from commit message or file presence alone. Leave explicit evidence showing which requirements were pre-existing, changed, tested, or still blocked.

### A2 — Build MT-MP-03 on top of the existing persistence contracts

Implement the real Supabase Auth -> membership -> verified organization -> `TenantContext` path, including organization creation, invitation lifecycle, owner/admin/member authorization, membership removal, tenant switching, expiry/rejection behavior, and fail-closed cross-tenant negatives.

### A3 — Build MT-MP-04 as a production-shaped buyer reference

Preserve the existing payment/subscription/webhook module boundaries. Add only missing reference integration needed for Stripe test-mode checkout/subscription, server-authoritative plan/price mapping, raw-body signature verification, persistent event claim/idempotency, provider refetch before accepting billing truth, monotonic/out-of-order protection, reconciliation independent of redirect, and entitlement persistence through explicit contracts.

No live-money movement is authorized.

### A4 — Integrated vertical-slice verification

Before Codex review, prove the composed path rather than only unit modules. Minimum evidence must include:

- successful identity-to-tenant-context resolution;
- organization/member role enforcement;
- cross-tenant access denial;
- persistence across process restart where the reference path requires it;
- plan/price tamper rejection;
- signed webhook acceptance plus duplicate/replay rejection;
- out-of-order subscription event handling;
- reconciliation recovery independent of browser redirect;
- entitlement result sourced from authoritative persisted state;
- root typecheck/test/build/lint or equivalent supported verification;
- secret/private-path hygiene and `git diff --check`.

Development evidence is not final product acceptance.

## 5. Major State A Codex gate

After A1-A4 are complete and pushed, prepare one detailed review bundle containing:

- branch and exact implementation SHA;
- requirement-to-evidence matrix for MP02/03/04;
- changed-file inventory grouped by capability;
- architecture/invariant summary and explicit non-goals;
- exact verification commands and observed results/counts;
- migration/security/tenant-isolation evidence;
- known limitations and unresolved decisions;
- diff/status/hygiene evidence;
- any worker self-review findings and remediation history.

Codex must behave as an independent reviewer: verify material claims directly against source/tests/evidence and challenge the report where needed. Do not ask Codex to approve from summary alone.

If Codex finds fixable defects, remediate and return to the same State A gate without involving the Owner. Use the two-attempt escalation rule for repeated/difficult findings.

### State A Owner checkpoint

Return control to the Owner only after Codex reaches a stable State A verdict, or earlier if a mandatory stop condition occurs. This is the first planned Owner review point for the run.

Do **not** stop merely because MP02, MP03, or MP04 individually completes.

## 6. Planned later major states

These are trajectory definitions, not authorization to bypass the State A Owner checkpoint.

### Major State B — Buyer-Usable Reference Product

After Owner review of State A, the next long run may cover:

`MT-MP-05 Reference App -> MT-MP-06 Deployment/Configuration -> MT-MP-07 Observability/Security/Failure Handling -> MT-MP-08 Email/Storage Adapters`

The State B gate should prove that a technical buyer can follow one clean reference application from login through tenant selection, AI use, plan/billing state, failure handling, and documented deployment/configuration using replaceable adapters rather than WSTERA-private infrastructure.

Codex reviews State B as one integrated buyer-reference state, not four micro-gates.

### Major State C — Buyer Delivery + TEST-READY Package

After Owner review of State B, the final build long run may cover:

`MT-MP-09 Setup/DX -> MT-MP-10 Agent-Friendly Repository -> MT-MP-11 Buyer Docs/Release Packaging -> required docs/test-readiness preparation`

The terminal build state is exactly:

`TEST-READY — FINAL ACCEPTANCE NOT YET RUN`

At that point stop. Do not run the separate final acceptance campaign, publish, deploy production, or declare sell-ready under this brief.

## 7. Mandatory early-stop conditions

Interrupt the LONG_RUN before its planned major-state gate only when one of these is true:

- an Owner-only product, pricing, licensing, or scope decision is required;
- continuing would change a locked architecture invariant or product positioning;
- a security/billing/data-integrity risk cannot be safely resolved inside the authorized brief;
- required external credentials/account access are unavailable and no test-safe substitute satisfies the requirement;
- the branch contains unexplained foreign changes or provenance becomes uncertain;
- the same blocker survives two credible remediation attempts and Claude cannot safely close it;
- continuing would require production deployment, live money movement, publication, merge to `master`, or final acceptance activity explicitly outside scope.

Routine implementation choices, ordinary defects, test failures, documentation drift, and expected refactors are not Owner-stop conditions when they can be resolved within the existing contract.

## 8. Git, evidence, and machine-migration rules

- Keep the working branch pushed frequently enough that switching Windows <-> Mac does not strand important work locally.
- Do not work on dirty `master`; use the feature continuation branch/worktree.
- Every meaningful checkpoint commit must be reviewable and must not mix unrelated local artifacts.
- Before push: inspect status/diff, run relevant verification, and confirm no secrets or machine-specific buyer paths entered the package.
- Hermes' state must reference Git SHA + canonical repository paths, not a machine-only scratch location.
- On machine switch: fetch, verify branch/HEAD/remote parity and clean/known status before resuming; do not reconstruct state from chat memory.

## 9. Immediate execution boundary

The next authorized implementation run begins from the feature-branch state that contains this brief and runs through **Major State A**. It may automatically traverse MP02/03/04 and remediation loops, but it must return at the stable Codex State A gate before entering State B.
