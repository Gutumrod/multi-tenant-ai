# BRIEF — MT01 Market-Parity Build to TEST-READY

**Product:** MT01 — Multi-Tenant AI SaaS Starter Kit
**Mode:** BUILD-TO-SELL / PRODUCT HARDENING / TEST-READY ONLY
**Owner authorization:** 2026-09-08
**Repo:** `D:\AI-Workspace\projects\saas-product-hub\products\multi-tenant-ai`
**Verified baseline:** `master@92139cf`

## Owner Direction
MT01 must be developed until it can credibly compete with paid SaaS starter kits while preserving its existing strengths: modular TypeScript architecture, provider abstraction, explicit tenant boundaries, composability, and low coupling.

The target is not “more green tests”. The product must become something a technical buyer can actually install, understand, run, extend, and prepare for production without hidden WSTERA dependencies.

This execution round MUST stop at **TEST-READY**. Do not perform or declare the final independent acceptance test in this round. A separate strict testing brief will be issued after build completion.

## Commercial decisions already approved
- V1 sale posture: **USD 149 one-time / single developer**.
- Purchased version may be used perpetually under the approved commercial-license boundary.
- Includes **12 months of released updates**.
- After the included period, planned optional Update Pass: **USD 69/year**; non-renewal must never disable the purchased version.
- No monthly source-code rental model for V1.
- No Team tier yet.
- WSTERA Billing Profile for MT01 is explicitly deferred until this build reaches TEST-READY and passes the later strict test campaign.

## Current Truth — do not rewrite history
Current product already has seven source modules plus an Express reference server:
1. `tenant-context`
2. `ai-provider`
3. `subscription`
4. `payment`
5. `auth-supabase`
6. `enterprise-features`
7. `webhook-receiver`

Known current limitations are real product gaps, not documentation problems:
- reference persistence is in-memory;
- no buyer-ready PostgreSQL/Supabase persistence package;
- no production frontend/auth/onboarding surface;
- no production deployment path;
- no production secret-management integration;
- no persistent webhook replay/idempotency store;
- no real OpenTelemetry exporter;
- no complete buyer-facing team/organization lifecycle;
- no release-grade end-to-end example product proving the starter works outside repository-local tests.

Current worktree already contains modified/untracked productization/legal/document files. **Do not reset, delete, overwrite, or bulk-stage them.** Reconcile them as existing partial work and preserve provenance. Historical evidence must remain historical.

## Product Positioning to Preserve
MT01 is not a clone of a full-stack boilerplate and must not become a monolith merely to imitate competitors.

Preserve these differentiators:
- framework-light, composable backend modules;
- explicit host-injected adapters rather than hidden globals;
- buyer-owned provider accounts and infrastructure;
- provider-neutral AI abstraction;
- immutable tenant context and fail-closed tenant boundaries;
- explicit entitlement and payment contracts;
- cryptographic webhook verification;
- portability across Node-oriented and Web Crypto-capable runtimes where contracts allow it;
- honest separation between starter-kit guarantees and buyer production responsibilities.

Market parity means closing the most expensive buyer gaps around persistence, auth/team lifecycle, deployability, observability, setup, and a real end-to-end application — **without sacrificing these architectural strengths**.

## Non-Goals
- Do not convert MT01 into hosted WSTERA SaaS.
- Do not integrate MT01 sale checkout into WSTERA Central Billing Core yet.
- Do not implement a monthly license kill-switch.
- Do not promise production certification, compliance certification, pentest certification, or uptime SLA.
- Do not hide incomplete features behind documentation claims.
- Do not retrofit unrelated WSTERA products just to create artificial dogfood evidence.

# Build Sequence

## MT-MP-01 — Canonical Product Contract + Workspace Hygiene
Before adding features, inventory the actual repository and lock the sellable package boundary.

Required:
- reconcile 7-module manifest/version claims across README/module docs/license/provenance;
- identify every tracked/untracked draft already present and classify KEEP / REVISE / OUT-OF-SCOPE;
- establish a root workspace command surface for install, typecheck, test, build, lint where applicable;
- no hidden dependency on `D:\AI-Workspace`, Modules Hub, WSTERA vault, local agent runtime, or private path;
- no committed secrets, generated credentials, local DB data, or machine-specific absolute paths in buyer artifacts;
- dependency versions must be pinned/locked and reproducible.

Deliverable: `docs/market-parity/MT-MP-01-PRODUCT-CONTRACT.md` plus exact package manifest.

## MT-MP-02 — Production Persistence Reference
Replace the “buyer must invent persistence” gap with at least one supported production-capable reference path.

Minimum target:
- PostgreSQL/Supabase-compatible schema and migrations;
- persistent tenant, membership/role, plan/subscription/entitlement, idempotency/webhook-event state;
- repository adapters implementing existing module contracts rather than bypassing them;
- tenant-scoped foreign keys / ownership constraints where applicable;
- forward migration + rollback/recovery guidance;
- seed/demo fixture separated from production migration;
- no service-role key exposed to browser/client code.

## MT-MP-03 — Auth, Organization, Team, RBAC Lifecycle
The starter must demonstrate a real B2B multi-tenant lifecycle, not only JWT verification.

Minimum target:
- sign-in/session integration boundary;
- create organization/tenant;
- invite member;
- accept/reject/expire invite;
- owner/admin/member roles with server-side authorization;
- membership removal and tenant switching;
- fail-closed cross-tenant access;
- clear separation between authentication, membership, role, and entitlement;
- reference RLS/policy guidance if Supabase is the supported reference implementation.

A buyer must be able to see exactly how identity becomes tenant context without trusting a raw client-selected tenant id.

## MT-MP-04 — Billing / Entitlement Reference for Buyer Apps
Preserve the existing `payment` and `subscription` modules but make the reference integration production-shaped.

Minimum target:
- Stripe Test-mode checkout/subscription reference using buyer-owned Stripe account;
- server-authoritative plan/price mapping; caller cannot set amount or arbitrary Stripe Price;
- raw-body webhook signature verification;
- persistent provider-event claim/idempotency;
- provider refetch before money/entitlement truth is accepted;
- monotonic subscription-state handling and out-of-order event protection;
- reconciliation entry point independent of browser redirect;
- entitlement state owned through explicit module/repository contracts.

This is buyer-facing starter functionality. It is separate from WSTERA charging customers for MT01 itself.

## MT-MP-05 — Buyer-Facing Reference App
Add one intentionally small but complete application that proves MT01 can bootstrap a real product.

Minimum surface:
- login/session;
- organization creation and switcher;
- member/invite management;
- plan/subscription status;
- billing action/portal entry where supported;
- AI playground using one provider through the existing abstraction;
- usage/quota display;
- account/settings page;
- visible error/failure states, not silent no-op placeholders.

The UI does not need to become a design-system product. It must be clean, responsive, understandable, and production-shaped enough that a buyer can follow the end-to-end architecture.

## MT-MP-06 — Deployment + Configuration Path
A buyer must have at least one documented, reproducible deployment path and one portable fallback path.

Required:
- production build command;
- environment schema validation with fail-fast missing/invalid config;
- deployment example for an approved primary target;
- generic Node-compatible deployment instructions as fallback;
- DB migration execution order;
- webhook endpoint configuration steps;
- health/readiness endpoint semantics;
- no production secret values in repository examples;
- explicit dev/test/live environment separation.

Do not claim a deployment target is supported unless the build artifact and runtime contract actually match it.

## MT-MP-07 — Observability, Security, and Failure Handling
Raise the reference implementation above demo-grade without pretending it is a certified production platform.

Required:
- structured logs with request/tenant correlation and secret redaction;
- real OpenTelemetry adapter example or explicitly supported exporter path;
- circuit-breaker integration that can be observed and diagnosed;
- rate-limit integration point and reference policy;
- centralized error mapping with safe public errors vs internal diagnostics;
- persistent webhook replay protection;
- timeout/retry policy where external providers are called;
- health/readiness checks that distinguish process-up from dependency-ready where appropriate;
- security checklist for auth, tenant isolation, provider secrets, payment webhooks, DB roles, and deployment.

No claim may say “secure” or “production-ready” merely because unit tests are green.

## MT-MP-08 — Common SaaS Adapters That Reduce Buyer Work
Close high-friction gaps with thin, replaceable contracts rather than hard-coding vendors.

Minimum:
- transactional email adapter contract + one working reference provider or test-safe transport;
- object/file storage adapter contract + one working reference path where product flows need it;
- provider configuration examples that do not leak vendor details into core domain modules;
- local/test fakes must be clearly named and impossible to confuse with production adapters.

Do not add a broad marketplace of integrations. Add only enough to prove the extension pattern and remove obvious “buyer must build everything” friction.

## MT-MP-09 — Setup / Developer Experience
The first buyer experience must be boring and deterministic.

Required:
- one canonical quickstart from clean clone/archive;
- automated or semi-automated setup command that validates prerequisites and configuration;
- `.env.example` containing names/descriptions only, no real credentials;
- database bootstrap/migration command;
- seed/demo command separated from production bootstrap;
- root-level commands for typecheck, test, build, lint/static checks, and reference-app start;
- actionable failure messages for missing runtime, DB, provider, or migration prerequisites;
- no instruction requiring knowledge of WSTERA internal directory structure.

A buyer should not need to open seven module folders and guess the install order.

## MT-MP-10 — AI-Agent-Friendly Repository
Preserve human readability while making the product easy to extend with modern coding agents.

Required:
- concise repository architecture map;
- module ownership/boundary document;
- safe extension instructions for adding providers, repositories, entitlements, and webhooks;
- machine-readable or clearly structured project commands;
- repository guidance that tells agents not to bypass tenant/auth/billing invariants;
- examples must reference real contracts and files, not imaginary APIs.

Do not make any specific AI coding tool a required runtime dependency of the product.

## MT-MP-11 — Buyer Documentation + Release Packaging
Documentation is part of the product and must describe the code that actually ships.

Required buyer docs:
- what MT01 is / is not;
- architecture diagram and request/data flow;
- clean setup and deployment;
- persistence model and migrations;
- auth/organization/team/RBAC lifecycle;
- AI provider setup;
- billing/webhook/reconciliation lifecycle;
- observability and failure handling;
- security boundary and production-hardening checklist;
- extension cookbook;
- troubleshooting guide;
- upgrade/migration notes;
- license, update entitlement, support boundary, and refund wording clearly separated from technical docs.

Prepare immutable release packaging structure, checksums/SBOM/provenance inputs, but do not cut the final commercial release/tag until the later strict test campaign passes.

## Support Boundary — prevent “$149 = custom development”
V1 purchase may include documented product usage guidance, clarification of advertised behavior, confirmed product-defect fixes, and released updates during the included update period.

It does NOT include custom app development, buyer-specific DB design, deployment service, provider-account setup, architecture consulting, incident response/SLA, migration of buyer legacy systems, or custom integration work unless separately contracted.

This boundary must be visible before public sale so the product can remain economically sustainable.

# Development Verification Rule
Green code is necessary but not sufficient.

During this build, developers MAY and SHOULD run normal self-checks continuously:
- unit tests;
- typecheck;
- lint/static analysis;
- build;
- migration syntax/compile checks;
- focused integration checks required to safely implement a feature.

However, these results are **development evidence only**. They must not be promoted to “product acceptance PASS”.

The later independent test campaign must prove behavior outside the developer's comfortable repository context, including fresh installation, real provider boundaries in non-production accounts, tenant isolation, failure injection, restart/persistence behavior, upgrade/recovery, and buyer task completion.

No one may close MT01 as sell-ready merely because `npm test` or CI is green.

# TEST-READY Exit Gate
This build may stop only when every item below is true or explicitly documented as a blocker requiring Owner decision:
- all planned market-parity capabilities above have implementation artifacts;
- no advertised capability is only a placeholder/stub;
- root setup path is documented;
- production-reference persistence exists;
- real organization/team/RBAC flow exists;
- production-shaped billing/webhook/reconciliation reference exists;
- reference app demonstrates the end-to-end path;
- at least one deployment configuration/path is prepared;
- observability/security/failure-handling hooks are implemented;
- buyer docs match current code;
- test fixtures, non-production credentials contract, test accounts/data plan, cleanup plan, and acceptance matrix are prepared.

## Required Test-Preparation Artifacts — prepare, do not execute final campaign
Create under `docs/test-readiness/`:
- `TEST-ENVIRONMENT-CONTRACT.md`
- `CLEAN-INSTALL-TEST-PLAN.md`
- `REAL-PROVIDER-NONPROD-PLAN.md`
- `TENANT-ISOLATION-MATRIX.md`
- `BILLING-WEBHOOK-RECONCILIATION-MATRIX.md`
- `FAILURE-INJECTION-MATRIX.md`
- `PERSISTENCE-RESTART-RECOVERY-MATRIX.md`
- `DEPLOYMENT-SMOKE-PLAN.md`
- `BUYER-JOURNEY-ACCEPTANCE.md`
- `SECURITY-NEGATIVE-TEST-MATRIX.md`
- `CLEANUP-ROLLBACK-PLAN.md`
- `FINAL-TEST-HANDOFF.md`

The later testing brief will decide exact execution order, independent reviewer/worktree strategy, real non-production providers, adversarial cases, and PASS/FAIL criteria.

## Evidence Standard for Build Completion
Every MT-MP work package must leave:
- changed files list;
- exact commands used for development self-checks;
- observed result, not “should pass”;
- known limitations/open decisions;
- proof that no secret/live credential was added;
- git diff/status snapshot before checkpoint;
- explicit statement distinguishing development verification from final acceptance.

Screenshots/log excerpts may supplement evidence but cannot replace provider/database/runtime state verification.

# Git / Change-Control Rules
- Work from the verified repository; do not rewrite or squash historical evidence merely to make status look cleaner.
- Preserve pre-existing modified/untracked draft work unless intentionally reconciled and documented.
- Stage only files belonging to the current bounded work package.
- Never commit `node_modules`, secrets, real `.env`, local DB files, agent relay runtime, or machine-local artifacts.
- Prefer small reviewable checkpoints per MT-MP package rather than one giant opaque commit.
- Before any push, verify tests/self-checks relevant to that package and inspect staged diff.
- Final TEST-READY checkpoint must be clean except explicitly documented pre-existing unrelated files.

# Commercial Repricing Rule
The currently approved V1 posture remains **USD 149 one-time**. Completing market-parity work does **not** automatically change the sale price.

After the strict independent acceptance campaign, Owner may separately consider a future MT01 V2 price around USD 249 and/or the USD 69/year optional Update Pass based on proven usability, production readiness, support burden, and market position. No agent may silently change pricing or license terms.

# Final Deliverable of This Build Round
When implementation is complete, produce one `MT01-TEST-READY-HANDOFF-YYYY-MM-DD.md` containing:
- verified HEAD/branch/divergence;
- concise capability inventory;
- remaining honest limitations;
- development verification summary;
- exact test-preparation artifact paths;
- environment/provider requirements for the strict campaign;
- unresolved Owner decisions, if any;
- explicit final status: `TEST-READY — FINAL ACCEPTANCE NOT YET RUN`.

# HARD STOP
**STOP immediately at `TEST-READY`.**

Do not run the final clean-install acceptance, real-provider matrix, adversarial isolation campaign, deployment acceptance, or sell-ready declaration under this brief. Return control to Secretary/Owner so a separate strict testing brief can be issued.

Only after that later campaign passes may MT01 proceed to WSTERA Billing Profile #3 admission and commercial release decisions.
