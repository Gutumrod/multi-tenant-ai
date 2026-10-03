# MT01 Pre-Sale Release Master Plan — 2026-10-02

> INTERNAL — NOT DELIVERED.
> This is the vendor's current execution plan for sale readiness. It is intentionally
> excluded from the buyer package by `DELIVERY-MANIFEST.md`.

**Project:** MT01 — Multi-Tenant AI Starter Kit  
**Owner direction:** sell a secure, buyer-usable starter kit; security is part of the product, not a post-sale add-on.  
**Current working branch:** `work/mt01-phase-b-remediation-20261003`
**Plan authority:** this file is the single current execution plan for work from pre-sale hardening through the first immutable commercial release.

---

## 1. Why this plan exists

The project already has several valid but fragmented planning/evidence layers:

1. `BUILD-TO-SELL-EXECUTION-2026-09-06.md` on `origin/wip/windows-sync-20260925`
2. the completed pre-sale cleanup lane records `PRESALE-CLEANUP-P1` through `P4`
3. `docs/CURRENT_STATUS.md`, which records the remaining sale gates
4. buyer-facing deployment and claims documents under `docs/product/`
5. the dependency/security observations measured on the Mac continuation workspace on 2026-10-02

This plan does **not** restart productization. It reconciles those sources, closes items already
proved, carries forward only unresolved work, and adds the Owner's explicit requirement for a
standalone Security Assurance phase.

The earlier Build-to-Sell brief remains historical input. It is **superseded as the active
execution plan** by this file because its baseline is `master@92139cf`, several of its work
items are now complete, and it did not contain the security assurance gate now required by the
Owner.

---

## 2. Sell-ready destination

A technical buyer must be able to receive one immutable version and:

- understand exactly what is included, excluded, supported, and unproven;
- install it in a clean environment without WSTERA internal repositories, paths, secrets, or
  runtime tooling;
- configure the supported database/auth/provider path;
- run the documented tests and security checks;
- verify tenant, auth, quota, billing, webhook, and persistence boundaries;
- deploy the reference product using only delivered instructions;
- receive a package that has been scanned for secrets and release integrity;
- use a release whose material security findings have been remediated or explicitly rejected
  from release.

Security is part of the sell-ready definition. A release that functions but fails the
security gates is **not sell-ready**.

---

## 3. Reconciliation with the previous Build-to-Sell plan

| Old work item | Current disposition | Evidence / reason |
|---|---|---|
| MT-SR-01 Product/package contract reconciliation | **CLOSED for current scope** | Seven/eight-module/current composition drift, buyer claims, limitations, delivery classification, test-count drift, webhook-rate-limit truth, and setup diagnostics were handled by WU work plus the P1–P4 pre-sale cleanup. Current buyer claims are mechanically checked. |
| MT-SR-02 License + provenance + dependency package | **PARTIAL — carry forward** | Draft legal/provenance files exist on `wip/windows-sync-20260925`; final legal terms are not approved, final checksums are not release checksums, and dependency audit now has unresolved findings. |
| MT-SR-03 Clean-install buyer acceptance | **OPEN — carry forward** | Current status still requires a buyer-style clean install with no WSTERA internal dependencies. |
| MT-SR-04 Buyer documentation and release artifact | **PARTIAL — carry forward** | Buyer docs and delivery manifest exist and pass gates; immutable final artifact/tag/checksums are not yet produced. |
| MT-SR-05 Checkout/fulfillment/support readiness | **OPEN — carry forward** | Fulfillment platform/integration, purchase flow, delivery/re-delivery and support mechanics are not locked. |
| MT-SR-06 Internal dogfood proof | **DEFERRED TO PRE-BROAD-LAUNCH, not a blocker for first controlled sale** | Keep as a confidence/market-learning objective. Do not retrofit old WSTERA products merely to manufacture evidence. If completed before first sale, record it; otherwise it remains required before broad promotion. |

### Completed pre-sale cleanup that must not be re-opened without evidence

The following lanes are historical repair records, not new work:

- **P1:** buyer-facing test-count truth and numeric claim gate
- **P2:** delivered vs internal file classification and enforcing delivery gate
- **P3A/P3B:** webhook flood behavior, corrected limiter ordering, truthful documentation and proof
- **P4:** empty-database diagnostics and fail-closed setup classification

Future work may change these areas only when a new finding requires it. Existing negative-control
proofs must remain green.

---

## 4. Current verified baseline before new work

Measured on macOS in the existing project workspace on 2026-10-02:

- Node.js: `v22.22.3`
- `npm ci`: completed
- `npm run typecheck`: PASS
- `npm test`: PASS — 57 passed, 5 skipped, 62 total
- the 5 skipped tests are PostgreSQL persistence tests when `DATABASE_URL` is absent
- `npm run test:delivery`: PASS — 9/9
- delivery negative-control self-test: PASS — 7/7
- claims gate: PASS — 10/10
- claims numeric fixtures: PASS — 7/7
- working tree was clean after migration/synchronization

### Dependency audit observation

`npm audit` on 2026-10-02 reported:

- all dependencies: **8 vulnerabilities** — 6 moderate, 1 high, 1 critical
- production dependencies only: **3 moderate**, 0 high, 0 critical
- production chain currently identified: `express` / `body-parser` / `qs`
- high/critical findings are in the development/test stack including Vitest/Vite-related
  dependencies

~~This was a release blocker pending Phase A remediation.~~ Phase A is **PASS / CLOSED as of 2026-10-03**; see `PRESALE-PHASE-A-SECURITY-2026-10-02.md`. Do not use
`npm audit fix --force` as an uncontrolled shortcut.

---

# 5. Release sequence — five phases

The project now has **five execution phases** containing **seven hard sale gates**.

---

## ~~Phase A — Dependency & Runtime Security~~ — PASS / CLOSED 2026-10-03

### Objective

Remove known avoidable dependency/runtime security risk before performing broader adversarial
testing.

### Required work

1. Reproduce and save the current `npm audit` result.
2. Trace every vulnerability to:
   - direct vs transitive dependency;
   - production vs dev/test scope;
   - affected version/range;
   - available non-breaking fix;
   - available breaking fix;
   - whether the vulnerable feature is reachable in MT01.
3. Upgrade production dependencies conservatively first.
4. Upgrade test/dev dependencies in a controlled change set.
5. Do not use a forced major upgrade without reading the migration impact and rerunning the
   complete suite.
6. Run:
   - typecheck;
   - unit/integration tests;
   - database tests with `DATABASE_URL`;
   - delivery gate + negative controls;
   - claims gate + fixtures;
   - webhook/rate-limit proofs;
   - setup/deploy preflight proofs.
7. Scan tracked buyer-delivered files for:
   - secrets/tokens/credentials;
   - private keys;
   - environment files that should not ship;
   - WSTERA machine paths;
   - suspicious high-entropy credential-like values.
8. Verify production defaults remain fail-closed:
   - no production demo auth;
   - no implicit fallback credential;
   - no secret printed in errors/logs;
   - missing required config fails clearly.

### Exit criteria — SECURITY-DEPS PASS

Hard requirements:

- **0 unresolved Critical vulnerabilities** in shipped/runtime dependencies.
- **0 unresolved High vulnerabilities** in shipped/runtime dependencies.
- Any remaining Moderate/Low runtime finding has a written reachability/risk decision.
- Dev/test High/Critical findings are remediated where a supported fix exists; any exception
  must be documented with why it cannot reach a buyer production runtime.
- full regression and current proof gates are green.
- buyer-delivered tree contains no actual secret.

A failure here blocks Phase B promotion.

---

## Phase B — Full Security Assurance / Adversarial Review — IN PROGRESS 2026-10-03

### Objective

Test MT01 as an attacker would. Passing normal functionality tests is not sufficient.

This phase must contain executable negative controls and an independent review. Code reading
alone cannot produce PASS.

### B1. Authentication

Test at least:

- missing Authorization header;
- malformed bearer token;
- forged token;
- expired token;
- token for unknown user;
- valid user with missing/invalid tenant context;
- production behavior when auth configuration is absent;
- `DEMO_AUTH=true` under production configuration must refuse to create a demonstration
  identity.

### B2. Tenant isolation — zero-tolerance invariant

Prove both read and write isolation:

- Tenant A cannot read Tenant B data;
- Tenant A cannot write/update/delete Tenant B data;
- caller-controlled `tenantId` cannot override trusted identity context;
- quota counters cannot be charged to another tenant;
- billing/subscription state cannot be read or mutated cross-tenant;
- provider execution cannot consume another tenant's entitlement;
- concurrent requests do not create a cross-tenant race.

A reproducible cross-tenant read/write or entitlement escape is an automatic **STOP SALE**.

### B3. Authorization / privilege boundaries

Test:

- role escalation;
- trusted vs untrusted metadata;
- user-controlled metadata cannot grant privileged roles;
- privileged/admin path denial for normal users;
- missing authorization context;
- authorization decision after tenant resolution uses the trusted principal.

### B4. Database and persistence

Test:

- parameterized SQL / injection payloads;
- malformed identifiers and input bounds;
- tenant-scoped queries;
- migrations on empty DB;
- migrations repeated/idempotent;
- reconnect;
- process restart persistence;
- quota atomicity under concurrency;
- billing-event/idempotency behavior;
- failed provider calls do not consume quota;
- database failure produces safe errors without leaking connection credentials.

### B5. Payment and webhook

Test:

- forged signature;
- malformed signature;
- replay;
- duplicate event/idempotency;
- stale/timestamp behavior where supported;
- malformed/raw body behavior;
- oversized payload behavior;
- flood against wrong-signature traffic;
- a valid signed delivery during adversarial traffic;
- backstop exhaustion behavior;
- restart limitation of the in-process limiter is documented and not misrepresented.

### B6. AI provider boundary

Test:

- provider API keys do not appear in client responses;
- provider failure details do not leak secrets;
- no cross-tenant quota consumption;
- provider failure consumes no usage unit;
- malformed/untrusted provider response cannot become privileged server input;
- timeout/error path fails safely.

### B7. HTTP/application surface

Review and test:

- input validation;
- request/body size bounds;
- unsafe parser behavior;
- prototype pollution exposure where applicable;
- CORS policy;
- security headers appropriate to the reference deployment;
- error detail exposure;
- debug/dev endpoint exposure;
- denial-of-service-sensitive unauthenticated routes;
- unsafe default configuration.

### B8. Buyer package security

Test the actual delivered set, not only the source workspace:

- no secrets;
- no private WSTERA paths;
- no internal credentials;
- no dependency on Hermes, Module Hub checkout, runtime worktrees, or other private WSTERA
  repositories;
- no internal working logs in the buyer artifact;
- no production debug backdoor;
- demo auth fails closed in production;
- example credentials are unmistakably examples and cannot be mistaken for live secrets.

### Minimum adversarial negative controls

At minimum create executable proofs for:

- cross-tenant read attempt -> denied;
- cross-tenant write attempt -> denied;
- forged/expired token -> denied;
- privilege escalation attempt -> denied;
- forged webhook -> denied;
- replay/duplicate webhook -> no duplicate state transition;
- SQL-injection-shaped input -> treated as data / rejected, never executed;
- quota race -> no over-consumption beyond the defined invariant;
- production demo auth -> refused;
- buyer artifact secret scan -> zero actual secrets.

### Independent review rule

A fresh reviewer/agent that did not author the remediation must review:

- threat surface;
- negative-control coverage;
- findings and severity;
- claimed closures;
- buyer-package result.

### Severity policy

- **Critical:** STOP SALE.
- **High:** STOP SALE.
- **Medium:** remediate before release unless Owner explicitly accepts a narrowly documented
  residual whose exploitability and buyer impact are understood.
- **Low:** may be carried only with documentation if remediation creates disproportionate
  regression risk.

### Exit criteria — MT01 SECURITY ASSURANCE PASS

- zero open Critical/High findings;
- zero unreviewed cross-tenant/auth/secret-leakage finding at any severity;
- all required negative controls are green;
- independent reviewer confirms the evidence or records findings for remediation;
- security report identifies residual limitations honestly.

---

## Phase C — Real Environment Proof

This phase contains two hard sale gates.

### Gate C1 — Real Supabase E2E

The existing product text explicitly states Supabase is untested and scheduled for testing before
sale. Close that promise with a real project.

Prove end-to-end:

1. real Supabase project configuration;
2. real signup/login or documented supported auth establishment;
3. token verification through MT01's auth path;
4. trusted user -> tenant context;
5. tenant isolation negative controls from Phase B against the real auth path;
6. PostgreSQL connection using the intended buyer configuration;
7. migrations;
8. persistence;
9. subscription/quota path;
10. provider call success/failure accounting;
11. restart/reconnect;
12. auth/config failure behavior.

Do not rewrite the persistence layer as "Supabase-backed" unless the architecture actually
changes. If MT01 continues to use `pg` against PostgreSQL, describe it exactly that way.

**Exit:** REAL-SUPABASE PASS with reproducible evidence.

### Gate C2 — Buyer clean install + fresh deployment/manual pass

Use a clean buyer-style environment with no internal WSTERA dependencies.

A fresh operator/reviewer must follow the delivered deployment manual, not tribal knowledge.

Required sequence:

1. obtain only the buyer-delivered artifact/source;
2. install supported Node version;
3. `npm ci`;
4. configure documented environment values only;
5. configure real database/auth/provider;
6. run setup/preflight;
7. run tests/proofs;
8. start the product;
9. deploy once to a real target environment;
10. execute smoke tests against that deployment;
11. record every undocumented intervention needed.

Any required undocumented internal step is a documentation/product defect and must be fixed,
then the clean-install run repeated.

**Exit:** BUYER-CLEAN-INSTALL PASS + FRESH-DEPLOY-MANUAL PASS.

---

## Phase D — Commercial Release Readiness

This phase closes the business/legal delivery path without changing the technical product scope.

### Gate D1 — Commercial + legal lock

Resolve the existing drafts on `wip/windows-sync-20260925`:

- `LICENSE.md`
- `COMMERCIAL_LICENSE.md`
- `EULA.md`
- `THIRD_PARTY_LICENSES.md`
- `PROVENANCE.md`

Owner decisions required:

- final price;
- currency;
- license scope;
- number of developers/seats;
- redistribution/resale restriction;
- update entitlement period;
- support scope;
- refund policy/mechanics;
- governing jurisdiction;
- dispute-resolution mechanism;
- consumer-protection review appropriate to the chosen sale jurisdiction.

The old USD 149–199 figure is a historical target only until the Owner explicitly approves a
price. Do not publish it as current pricing before that decision.

Legal wording that the draft itself marks for legal counsel remains subject to that review.

### Gate D2 — Fulfillment path

Lock and prove:

```text
Sales/listing page
    -> checkout/payment
    -> success confirmation
    -> buyer receives the immutable release
    -> buyer receives applicable licence/terms
    -> receipt/order reference
    -> supported re-delivery/update path
```

Required decisions:

- storefront/payment provider;
- artifact delivery mechanism;
- access/re-delivery mechanism;
- update delivery for entitled buyers;
- support contact/path;
- failed payment/refund handling;
- what happens if automated fulfillment is unavailable.

Do not build a large custom commerce platform merely to unblock MT01 if a smaller reliable
mechanism satisfies the contract.

**Exit:** COMMERCIAL PASS + FULFILLMENT PASS.

---

## Phase E — Final Security Recheck + Immutable Release

### Objective

Seal the exact artifact that will be sold, after every previous phase has finished changing the
source/configuration.

### Required sequence

1. select final release commit;
2. freeze unrelated feature work;
3. rerun full typecheck/tests with the required database configuration;
4. rerun delivery/claims/setup/security negative controls;
5. rerun dependency audit;
6. rerun secret scan on the **packaged buyer artifact**;
7. rerun buyer-package path/internal-file scan;
8. verify no release-time configuration re-enables demo/debug behavior;
9. generate the buyer artifact from the declared delivery set;
10. regenerate final provenance;
11. generate SHA-256 checksums from the exact release artifact/files;
12. verify third-party license inventory;
13. assign semantic version;
14. create immutable tag/release;
15. verify the fulfillment system delivers the exact sealed artifact;
16. perform one final install/smoke from that artifact.

### Exit criteria — RELEASE + SECURITY FINAL PASS

- Phase A–D gates are closed;
- no Critical/High security finding reopened;
- final dependency/secret/package scans meet policy;
- artifact hashes and provenance match the artifact delivered to the buyer;
- buyer install/smoke from the sealed artifact passes;
- release/tag/version and commercial terms agree;
- no unapproved price or unsupported security/production claim appears in buyer-facing material.

Only after this gate may the version be listed for sale.

---

# 6. Seven hard sale gates

For execution tracking, the five phases resolve to seven hard gates:

| # | Gate | Phase | Current state on 2026-10-02 |
|---|---|---|---|
| 1 | SECURITY-DEPS | A | **PASS 2026-10-03** — 9 package roots audit clean; secret/package/runtime gates green; independent Mac recheck recorded in Phase A report |
| 2 | SECURITY-ASSURANCE | B | **IN PROGRESS 2026-10-03** — adversarial review found two High blockers; remediation is active under `WF-DEV-01` |
| 3 | REAL-SUPABASE | C | **OPEN** — explicitly untested |
| 4 | BUYER-CLEAN-INSTALL + FRESH-DEPLOY-MANUAL | C | **OPEN** |
| 5 | COMMERCIAL/LEGAL | D | **OPEN/PARTIAL** — drafts exist |
| 6 | FULFILLMENT | D | **OPEN** |
| 7 | FINAL-RELEASE-SECURITY-SEAL | E | **OPEN** — must be last |

No feature expansion is allowed to bypass or postpone these gates unless a gate itself proves
the feature is required for correctness, security, or the buyer contract.

---

# 7. Zero-tolerance release blockers

Regardless of phase, immediately stop sale/release on evidence of:

1. cross-tenant unauthorized read/write;
2. authentication bypass;
3. privilege escalation that reaches protected data/action;
4. actual secret/private key shipped in the buyer package;
5. payment/webhook forgery that can create an unauthorized state transition;
6. known exploitable Critical/High vulnerability in the shipped runtime;
7. production demo/debug authentication that can establish an identity;
8. release artifact/provenance mismatch;
9. buyer package requiring an undisclosed private WSTERA dependency.

These are release invariants, not backlog items.

---

# 8. Change-control rule until first sale

Until v1.0.0 is sealed:

- prioritize gate closure over feature growth;
- one bounded change set per finding where practical;
- every security remediation must carry a regression/negative-control proof;
- do not weaken a gate merely to make an existing implementation pass;
- if a gate is wrong, prove the gate is wrong with a red/green fixture before changing it;
- preserve historical evidence instead of rewriting it to appear current;
- update `docs/CURRENT_STATUS.md` when runtime/gate truth changes;
- update buyer-facing claims only after evidence exists;
- do not merge draft legal/commercial text into the final buyer artifact until approved;
- do not store live secrets in Git.

---

# 9. Immediate next execution order

The next work should be executed in this order:

1. **A1 dependency audit remediation**
2. **A2 secret/runtime fail-closed scan**
3. **A gate rerun**
4. **B threat/adversarial security run**
5. remediate B findings and repeat B until PASS
6. **C1 real Supabase E2E**
7. **C2 buyer clean install + fresh deployment/manual pass**
8. **D commercial/legal decisions**
9. **D fulfillment integration**
10. **E final security rerun + immutable release seal**

Do not start D/E work that depends on a final code artifact while A–C are still likely to change
the product. Commercial/legal review may proceed in parallel where it does not depend on final
checksums or final implementation details.

---

# 10. Definition of done for first sale

MT01 is ready for its first sale only when:

- all seven hard sale gates are PASS;
- the exact buyer artifact passes the security and clean-install checks;
- real Supabase/auth claims match what was actually tested;
- price/licence/refund/support/fulfillment are explicit;
- legal drafts have received the required Owner/legal decisions;
- the final artifact is immutable, versioned, hashed and provenance-matched;
- the delivered set contains no WSTERA internal dependency or live secret;
- buyer-facing claims describe residual limitations honestly.

After the first controlled sale, MT-SR-06 dogfood/field evidence should be completed before broad
promotion if it has not already been completed.
