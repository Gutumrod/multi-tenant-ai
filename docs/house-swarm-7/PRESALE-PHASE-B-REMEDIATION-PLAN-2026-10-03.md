# MT01 — Phase B Security Remediation Execution Plan

> INTERNAL — NOT DELIVERED.

**Date:** 2026-10-03  
**Project:** MT01 — Multi-Tenant AI Starter Kit  
**Repository:** `Gutumrod/multi-tenant-ai`  
**Originating gate:** `WF-COUNCIL-01 v1.0.0` / `SECURITY-ASSURANCE`  
**Execution workflow:** `WF-DEV-01 v1.4.0` / `STANDARD`  
**Locked remediation baseline:** `work/mt01-phase-a-security-20261002` @ `0b849eefa23ed7c6d47abf494e84a8f711575a8d`  
**Target branch:** `work/mt01-phase-b-remediation-20261003`  
**Current release state:** `HOLD — STOP SALE`

## 1. Purpose

Close the Phase B security blockers identified by the independent adversarial review without weakening tenant isolation, authentication, billing trust boundaries, quota accounting, or buyer-package security.

This plan is bounded remediation only. It does not authorize Phase C, commercial release, or final release sealing.

## 2. Source of truth

Execution must remain anchored to:

1. `docs/house-swarm-7/PRESALE-RELEASE-MASTER-PLAN-2026-10-02.md`
2. `MT01-PHASE-B-SECURITY-ASSURANCE-2026-10-03.md`
3. exact baseline commit `0b849eefa23ed7c6d47abf494e84a8f711575a8d`
4. current `WF-DEV-01 v1.4.0` rules for implementation/remediation
5. fresh independent `WF-COUNCIL-01` review after implementation

No implementation agent may redefine a Phase B invariant to make a test pass.

## 3. Hard security invariants

- authenticated principal is authoritative for tenant access;
- caller-controlled `x-tenant-id` is never authoritative by itself;
- Tenant A cannot read, write, charge quota, create payment metadata, or consume entitlement for Tenant B;
- normal authenticated users cannot activate paid entitlements directly;
- only an explicitly trusted server-side billing/admin path may establish paid entitlement;
- failed/forged billing evidence cannot establish entitlement;
- production demo authentication remains fail-closed;
- no live secret may enter buyer-delivered artifacts;
- no Critical or High security finding may remain open at Phase B exit.

## 4. Work units

### R-B1 — Add RED tenant-boundary negative controls first

Before changing production logic, add executable tests proving the current baseline fails the required invariant.

Required cases using a trusted Tenant-A principal with requested Tenant B:

- `GET /me` -> `403 TENANT_ACCESS_DENIED`
- `GET /subscription/status` -> `403 TENANT_ACCESS_DENIED`
- `POST /subscription/subscribe` -> `403 TENANT_ACCESS_DENIED`
- `POST /ai/demo` -> `403 TENANT_ACCESS_DENIED`
- `POST /payment/demo-charge` -> `403 TENANT_ACCESS_DENIED`

Side-effect assertions:

- Tenant-B quota unchanged;
- Tenant-B subscription unchanged;
- AI provider not called;
- payment provider not called;
- concurrent mismatched requests cannot cross tenant boundaries.

The new test set must demonstrate RED on the locked baseline before remediation is accepted.

### R-B2 — Bind requested tenant to trusted principal

Introduce a single authorization boundary after authentication and before every tenant-scoped protected handler.

Required behavior:

```text
trusted authenticated tenant == effective business tenant
```

Use the existing trusted auth context and existing membership guard where compatible. A raw header-derived tenant must never flow directly into business handlers after authentication without successful membership authorization.

Preferred model for current single-tenant-per-user semantics:

1. authenticate principal;
2. resolve requested tenant selector;
3. authorize membership;
4. construct/use effective trusted tenant context;
5. invoke business handler.

Do not duplicate authorization logic independently inside handlers if a shared middleware/boundary can enforce it consistently.

### R-B3 — Close paid-entitlement self escalation

`POST /subscription/subscribe` must not allow a normal authenticated user to obtain a paid plan merely by supplying `planId=pro`.

For the current starter-kit scope, use the safer boundary unless existing product contracts prove otherwise:

- self-service route may create/activate only non-paid/free entitlement;
- paid-plan state must require a trusted billing/admin transition;
- user-controlled request body alone cannot establish paid entitlement.

If the current billing implementation cannot yet create a paid subscription safely, fail closed and document paid upgrade integration as not implemented rather than simulating a trusted payment transition.

### R-B4 — Harden authentication input boundary

Add explicit negative controls for:

- missing `Authorization`;
- malformed scheme;
- empty bearer token;
- forged token;
- expired token;
- unknown user;
- valid principal with invalid/missing tenant context;
- production with missing auth configuration;
- `DEMO_AUTH=true` in production.

The server boundary should explicitly require the expected bearer format rather than depending on implicit client-library behavior.

Real-Supabase end-to-end proof remains Phase C, but Phase B must provide deterministic unit/integration negative controls for the application boundary.

### R-B5 — Complete adversarial persistence/payment/AI/HTTP matrix

#### Persistence
- SQL-injection-shaped values are parameterized or rejected;
- malformed bounds rejected safely;
- tenant-scoped repository operations cannot escape authorized scope;
- quota atomicity under concurrency;
- billing-event idempotency;
- provider failure usage behavior matches contract;
- database errors do not expose credentials/connection strings.

#### Payment/webhook
- forged/malformed signature denied;
- replay produces no duplicate state transition;
- stale timestamp denied where verifier contract supports it;
- malformed/raw body handled safely;
- oversized body bounded;
- wrong-signature flood cannot starve a valid signed delivery under declared limiter model;
- backstop exhaustion verified;
- in-process limiter restart/multi-instance limitation documented if not removed.

#### AI
- API keys never exposed to client responses;
- provider/internal failures return sanitized errors;
- cross-tenant quota use denied;
- failure does not create incorrect usage state;
- malformed provider response is untrusted data;
- timeout/failure path fail-safe;
- provider-cost/input-size boundary explicitly bounded and tested.

#### HTTP/application
- validation and explicit body limits;
- prototype-pollution-shaped payload coverage where relevant;
- CORS behavior documented/tested;
- security headers assessed;
- error details sanitized;
- debug/demo endpoints reviewed for production exposure;
- unsafe production defaults fail closed.

### R-B6 — Buyer-package security rerun

After remediation, rerun:

- no live secrets;
- no private filesystem paths;
- no internal credentials;
- no private WSTERA runtime dependency;
- no debug backdoor;
- no production demo identity;
- sample credentials are obvious placeholders only;
- package provenance matches reviewed commit/artifact.

## 5. Required execution order

1. Create remediation branch from exact baseline.
2. Add RED negative controls for B-HIGH-001 and B-HIGH-002.
3. Capture failing evidence.
4. Implement tenant-principal authorization boundary.
5. Make tenant-boundary tests GREEN.
6. Implement paid-entitlement trust boundary.
7. Make paid-entitlement negative controls GREEN.
8. Complete B1/B4/B5/B6/B7/B8 adversarial matrix.
9. Run full regression and package/security gates.
10. Freeze exact remediation revision.
11. Hand exact SHA and evidence to a fresh independent reviewer.
12. Return to `WF-COUNCIL-01 / SECURITY-ASSURANCE` for Phase B verdict.

Do not advance directly to Phase C from an implementation PASS.

## 6. Verification evidence

Use repository-native commands from the locked revision/package scripts. Evidence must include:

- dependency/install integrity;
- typecheck;
- complete server tests;
- complete module tests;
- PostgreSQL-backed persistence/migration result;
- new Phase B adversarial suite;
- secret/package scan;
- delivery/claims/setup proof where present;
- exact commit SHA used for every result.

If a required command does not exist, record a tooling gap and add the smallest reproducible check rather than inventing a PASS.

## 7. Severity and stop rules

- **Critical:** STOP SALE; must remediate.
- **High:** STOP SALE; must remediate.
- **Medium:** remediate before Phase B exit unless Owner explicitly accepts a narrow documented residual.
- **Low:** may carry only when remediation risk/cost is disproportionate and residual is documented.

Automatic stop conditions:

1. cross-tenant read/write;
2. authentication bypass;
3. privilege escalation to protected data/action;
4. live secret in delivered package;
5. webhook forgery causing unauthorized state transition;
6. exploitable Critical/High runtime dependency;
7. production demo/debug identity path;
8. artifact/provenance mismatch;
9. private WSTERA dependency.

If an automatic stop condition is reproduced, capture evidence, remediate it, and rerun affected negative controls before expanding scope.

## 8. Exit criteria before independent review

- B-HIGH-001 CLOSED with executable negative controls;
- B-HIGH-002 CLOSED with executable negative controls;
- zero open Critical/High findings;
- zero unreviewed tenant/auth/secret findings of any severity;
- required Phase B negative controls GREEN;
- typecheck/tests/database/security/package gates GREEN;
- exact remediation SHA frozen;
- evidence bundle references exact frozen SHA;
- implementation author is not the sole final reviewer.

Only the subsequent independent security gate may declare Phase B PASS.

## 9. Agent dispatch boundaries

### Builder
Implement only this remediation scope. Do not change product positioning, pricing, feature scope, Phase C behavior, or release claims.

### Tester / bounded verifier
Focus on negative controls, concurrency, regression, persistence and package proofs. Do not waive failing assertions.

### Independent reviewer
Review the frozen remediation SHA against the original Phase B report and master plan. Re-run or independently inspect security-critical proofs. Reviewer must not rely solely on builder-authored summaries.

### Owner
Retains final authority over any Medium residual acceptance and progression beyond Phase B.

## 10. Current checkpoint

```text
Phase A — SECURITY-DEPS        PASS
Phase B — SECURITY-ASSURANCE   HOLD / STOP SALE
Phase B remediation            AUTHORIZED TO START
Phase C — REAL-SUPABASE        NOT AUTHORIZED YET
Commercial release             NOT AUTHORIZED YET
```

The first implementation action is R-B1: add failing cross-tenant and paid-entitlement negative controls on the exact Phase A baseline.
