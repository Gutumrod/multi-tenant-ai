# BRIEF — MT01 Market-Parity Continuation Handoff

**Date:** 2026-09-08  
**Product:** MT01 / Multi-Tenant AI Starter Kit  
**Mode:** BUILD-TO-SELL / MARKET-PARITY / TEST-READY ONLY  
**Owner:** WSTERA Owner  
**Purpose:** hand off MT01 product work to a fresh chat without carrying the Agent Relay / S-Bridge / Council runtime investigation into this product execution lane.

---

# 0. NEW CHAT MANDATE

This chat owns **MT01 product continuation only**.

Do not modify, redesign, or debug:

- S-Bridge
- Hermes core/runtime
- Agent Relay infrastructure
- Council infrastructure
- external-agent profile plumbing

Those are being investigated in a separate control chat.

For MT01, use the current product architecture and canonical build brief below. If agent orchestration is unavailable or blocked, do not redesign orchestration from this chat; continue only with an authorized execution method or report the blocker.

The immediate product objective is:

> continue MT01 from its verified current state toward market parity, but stop at **TEST-READY**. Do not perform the final independent acceptance campaign and do not deploy production.

---

# 1. CANONICAL SOURCE OF TRUTH

Primary execution brief:

`D:\AI-Workspace\projects\saas-product-hub\products\multi-tenant-ai\docs\BRIEF-MT01-MARKET-PARITY-BUILD-TO-TEST-READY-2026-09-08.md`

Build-to-sell context:

`D:\AI-Workspace\projects\saas-product-hub\products\multi-tenant-ai\BUILD-TO-SELL-EXECUTION-2026-09-06.md`

Repository:

`D:\AI-Workspace\projects\saas-product-hub\products\multi-tenant-ai`

Do not trust `docs\CURRENT_STATUS.md` as the sole current truth. It is dated 2026-09-02 and contains older wording / an unresolved `$head` placeholder. Verify against Git + source + this handoff + canonical 2026-09-08 brief.

---

# 2. LOCKED PRODUCT / COMMERCIAL DIRECTION

Preserve these decisions:

- buyer: solo developer / small technical studio that wants an integration kit, not a hosted SaaS product;
- launch price: **USD 149 one-time / single developer**;
- purchased version is perpetual;
- includes **12 months of released updates**;
- optional future Update Pass target: **USD 69/year**;
- no Team tier in V1;
- no hosted monthly kill switch;
- WSTERA Billing Profile integration is **deferred** until MT01 reaches TEST-READY and later passes the strict acceptance campaign;
- do not perform production deployment in this build round;
- do not perform live money movement;
- do not claim production-ready before the later independent acceptance campaign.

Hard stop wording at the end of this build program:

`TEST-READY - FINAL ACCEPTANCE NOT YET RUN`

---

# 3. LOCKED TARGET ARCHITECTURE

Canonical target shape:

```text
MT01
├─ modules/              # reusable core
├─ packages/             # production/reference adapters
├─ server/               # Node reference API
├─ apps/reference-app/   # buyer-facing Next.js app
├─ supabase/migrations/
├─ scripts/
└─ docs/
```

Reference choices already approved by the canonical brief:

- TypeScript / Node;
- npm workspace-style buyer setup;
- Supabase PostgreSQL reference persistence;
- Supabase Auth: identity -> membership -> verified organization -> TenantContext;
- Next.js buyer-facing reference app, separate from reusable core;
- Stripe **test-mode** buyer reference;
- server-authoritative plan -> price mapping;
- raw signed webhook verification;
- persistent event claim / idempotency;
- provider refetch before trusted billing state transition;
- monotonic subscription transition rules;
- reconciliation path;
- Pino + OpenTelemetry OTLP reference;
- Zod environment validation;
- generic EmailAdapter with Resend reference implementation;
- generic StorageAdapter with Supabase Storage reference implementation;
- do not force Cloudflare as the Node/Express runtime.

---

# 4. VERIFIED GIT STATE — DO NOT DESTROY IT

## Main repository

Branch:

`master`

HEAD:

`92139cfa4697fbade1a023d76dc4734dd82d5862`

Latest committed checkpoint:

`92139cf fix(webhook): correct middleware order, wire handleBillingEvent, fix replay status`

Verified pre-existing dirty WIP on `master`:

```text
 M BRIEF.md
 M server/README.md
?? BUILD-TO-SELL-EXECUTION-2026-09-06.md
?? COMMERCIAL_LICENSE.md
?? EULA.md
?? LICENSE.md
?? PROVENANCE.md
?? README.md
?? SECURITY.md
?? THIRD_PARTY_LICENSES.md
?? docs/
```

Rules:

- **DO NOT** reset this state;
- **DO NOT** `git clean` it;
- **DO NOT** bulk-stage it;
- **DO NOT** overwrite these files from an older commit;
- do not claim the working tree was clean before this handoff.

These files include current productization/legal/documentation WIP and must be preserved.

---

# 5. CLEAN CONTINUATION BASE AVAILABLE

A clean trial integration worktree exists at:

`D:\AI-Workspace\runtime\reviews\mt01-team-trial-2026-09-08\integration`

Branch:

`feature/mt01-market-parity-team-trial`

HEAD:

`a98acc121070f53320a0c2d04622a22fb2df6f4b`

History:

```text
a98acc1 merge(mt01): accept reviewed Ornith portability hygiene
f5f9265 docs(mt01): remove private Modules Hub paths from buyer design docs
dfde940 chore(mt01): checkpoint current productization WIP on trial branch
92139cf fix(webhook): correct middleware order, wire handleBillingEvent, fix replay status
```

A normalized content comparison on 2026-09-08 verified:

- the clean feature worktree contains the same current product WIP as main;
- after CRLF/LF normalization, the **only actual content differences** are the three reviewed Ornith portability fixes listed below.

Therefore the preferred continuation strategy is:

1. leave dirty `master` untouched;
2. start a fresh continuation branch/worktree **from `a98acc1`**;
3. suggested branch: `feature/mt01-market-parity-continuation`;
4. do not merge to master until the intended product gate is explicitly accepted.

Do not continue writing new MT01 product work directly into dirty `master` unless Owner explicitly changes this direction.

---

# 6. VERIFIED WORK THAT IS VALID

## 6.1 Existing product baseline

The repository already contains seven reusable module areas:

1. `tenant-context`
2. `ai-provider`
3. `subscription`
4. `payment`
5. `auth-supabase`
6. `enterprise-features`
7. `webhook-receiver`

There is also an Express/Node reference `server/`.

The current committed server baseline already includes work around:

- webhook middleware ordering;
- billing-event wiring;
- replay status handling;
- Stripe verification path;
- subscription/webhook integration.

Do not erase this history or restart from a blank scaffold.

## 6.2 Reviewed Ornith portability hygiene — VALID

Reviewed commit:

`f5f92656e836f8d87cbaa78590351198ff2b067a`

Merged into clean feature integration via:

`a98acc121070f53320a0c2d04622a22fb2df6f4b`

Verified diff is exactly one replacement in each of:

- `modules/auth-supabase/DESIGN.md`
- `modules/payment/DESIGN.md`
- `modules/webhook-receiver/DESIGN.md`

Purpose:

replace private `D:\AI-Workspace\...\modules-hub...` file-location references with repo-relative buyer package paths.

This work is valid and should be preserved.

## 6.3 Current server verification

Run on actual main workspace on 2026-09-08:

```text
server npm test       PASS
2 test files          PASS
13 tests              PASS
server npm typecheck  PASS
```

This is a **development baseline only**. It does not prove MT01 is market-parity or TEST-READY.

## 6.4 Existing module tests

Module-level tests exist across the reusable modules, including tenant-context, ai-provider, subscription, payment, auth-supabase, enterprise-features, and webhook-receiver.

However, on the inspected main worktree the module directories currently have no local `node_modules`, so module test/typecheck commands were **not re-run during this handoff inspection**. Do not report them as freshly verified until dependencies are installed through a reproducible workspace/install path.

---

# 7. WORK THAT IS NOT VALIDLY COMPLETE

## MT-MP-01 PRODUCT CONTRACT IS STILL INCOMPLETE

Required canonical deliverable:

`docs/market-parity/MT-MP-01-PRODUCT-CONTRACT.md`

It does **not** currently exist in the product repository.

A Claude-generated file appeared late during the previous team trial after the execution had already been frozen/terminated. It was explicitly quarantined by the final review and must not be credited as completed work.

Review-only snapshot:

`D:\AI-Workspace\runtime\reviews\mt01-team-trial-2026-09-08\evidence\CLAUDE-LATE-ARTIFACT-SNAPSHOT.md`

Rules for this snapshot:

- `REVIEW_ONLY`;
- not accepted product evidence;
- do not merge/copy blindly;
- any useful factual statement must be independently reverified against current source before reuse.

Canonical final trial closure:

`D:\AI-Workspace\runtime\reviews\mt01-team-trial-2026-09-08\codex-final-closure\CODEX-FINAL-CLOSURE.txt`

Canonical trial verdict included:

```text
FINAL_TRIAL_VERDICT = BLOCK
CLAUDE_BUILDER_VERDICT = FAIL
ORNITH_BUILDER_VERDICT = PASS
AGY_REVIEWER_VERDICT = PARTIAL_PASS
EVIDENCE_CHAIN_INTEGRITY = PARTIAL / COMPROMISED
```

The failure was a team-trial/evidence-chain result. It does not invalidate the reviewed Ornith portability changes above.

---

# 8. VERIFIED CURRENT PACKAGE / WORKSPACE TRUTH

Current source inspection on 2026-09-08 found:

| Area | Package name | Version |
|---|---|---:|
| ai-provider | `@module-hub/ai-provider` | `0.1.0` |
| auth-supabase | `@module-hub/auth-supabase` | `0.1.0` |
| enterprise-features | `@module-hub/enterprise-features` | `0.3.0` |
| payment | `@module-hub/payment` | `0.1.0` |
| subscription | `@module-hub/subscription` | `0.1.0` |
| tenant-context | `@module-hub/tenant-context` | `0.1.0` |
| webhook-receiver | `webhook-receiver` | `0.1.0` |
| server | `multi-tenant-ai-server` | `0.1.0` |

This is important:

- package naming is not yet unified under a buyer-facing MT01 namespace;
- versions are not fully aligned (`enterprise-features` is `0.3.0`, most reusable modules are `0.1.0`);
- `webhook-receiver` and `server` use different naming conventions;
- any older brief/report claiming current package versions such as 1.x/2.x must be reverified against source before reuse.

Verified absent at repository root/current architecture:

```text
root package.json       MISSING
root package-lock.json  MISSING
packages/               MISSING
apps/reference-app/     MISSING
supabase/migrations/    MISSING
docs/market-parity/     MISSING
```

Therefore the canonical target npm workspace / reference-adapter / reference-app structure has **not yet been established**.

---

# 9. VERIFIED TECHNICAL GAPS

The following are current source-level facts or direct consequences of missing target artifacts.

## Persistence

Current code still contains in-process/in-memory state in production-relevant areas, including:

- AI-provider concurrency/rate state;
- enterprise feature mutable state / health state;
- webhook idempotency store;
- reference/demo state seams.

The payment/webhook design already discusses store interfaces, persistent event IDs, replay and reconciliation semantics, but a buyer-ready Supabase/PostgreSQL reference implementation is not present yet.

Therefore:

**production-reference persistence is not complete.**

## Auth / organization lifecycle

Reusable auth and tenant modules exist, but the canonical end-to-end Supabase Auth -> membership -> verified organization -> TenantContext reference lifecycle is not yet demonstrated as the required market-parity buyer path.

## Billing / entitlement

Payment/subscription/webhook foundations exist, but the complete reference path required by the canonical brief is not finished:

- server-authoritative plan -> price map;
- persistent webhook event claim;
- durable idempotency/replay;
- provider refetch before trusted transition;
- monotonic subscription transition protection;
- reconciliation over durable state;
- buyer-facing entitlement demonstration.

No live billing is authorized in this round.

## Buyer-facing reference app

`apps/reference-app/` does not exist.

Therefore there is currently no release-grade buyer-facing Next.js app proving the full onboarding/auth/org/billing/entitlement path.

## Deployment / configuration

The canonical deployment/configuration target has not been completed as a reproducible buyer path. Production deployment is not authorized; only deployment-ready reference configuration is required before TEST-READY.

## Observability / security / failure handling

Existing enterprise modules contain reference/in-process telemetry concepts, but the canonical Pino + OpenTelemetry OTLP production-reference adapter path and the complete failure-handling evidence required by MT-MP-07 remain work.

## Common SaaS adapters

The canonical EmailAdapter + Resend and StorageAdapter + Supabase Storage market-parity references remain to be completed.

## Buyer DX / packaging

No root npm workspace command surface currently exists, so there is no single reproducible root command contract yet for install/typecheck/test/build/lint where applicable.

Buyer documentation/legal files exist as current WIP, but earlier status explicitly marked legal/commercial documents as **DRAFT** pending Owner/legal review. Do not silently convert them into approved legal claims.

---

# 10. BUILD SEQUENCE AND CURRENT HANDOFF STATUS

Canonical sequence remains:

1. `MT-MP-01` — Canonical Product Contract + Workspace Hygiene
2. `MT-MP-02` — Production Persistence Reference
3. `MT-MP-03` — Auth, Organization, Team, RBAC Lifecycle
4. `MT-MP-04` — Billing / Entitlement Reference for Buyer Apps
5. `MT-MP-05` — Buyer-Facing Reference App
6. `MT-MP-06` — Deployment + Configuration Path
7. `MT-MP-07` — Observability, Security, Failure Handling
8. `MT-MP-08` — Common SaaS Adapters That Reduce Buyer Work
9. `MT-MP-09` — Setup / Developer Experience
10. `MT-MP-10` — AI-Agent-Friendly Repository
11. `MT-MP-11` — Buyer Documentation + Release Packaging

Handoff assessment:

| Phase | Status at handoff | Notes |
|---|---|---|
| MT-MP-01 | **INCOMPLETE / PARTIAL** | inventory evidence exists and 3 portability edits passed; canonical Product Contract + root workspace contract still missing |
| MT-MP-02 | **NOT COMPLETE** | interfaces/design exist; durable buyer-reference persistence missing |
| MT-MP-03 | **PARTIAL FOUNDATION** | reusable auth/tenant logic exists; complete real org/team/RBAC reference lifecycle missing |
| MT-MP-04 | **PARTIAL FOUNDATION** | payment/subscription/webhook core exists; durable production-shaped buyer reference incomplete |
| MT-MP-05 | **NOT STARTED AS TARGET ARTIFACT** | `apps/reference-app/` missing |
| MT-MP-06 | **NOT COMPLETE** | target deployment/config path not prepared as required |
| MT-MP-07 | **PARTIAL FOUNDATION** | telemetry/security concepts exist; market-parity reference incomplete |
| MT-MP-08 | **NOT COMPLETE** | email/storage reference adapters remain |
| MT-MP-09 | **PARTIAL** | module/server docs exist; root reproducible setup surface missing |
| MT-MP-10 | **PARTIAL** | repo has module docs/tests, but canonical agent-friendly market-parity pass not complete |
| MT-MP-11 | **PARTIAL WIP** | README/legal/commercial docs exist but are not release-ready/fully approved |

Do not mark a later phase `PASS` merely because a reusable core module already exists.

---

# 11. IMMEDIATE NEXT ASSIGNMENT — DO THIS FIRST

## MODE

**MT-MP-01 ONLY — PRODUCT CONTRACT + WORKSPACE HYGIENE**

Do not begin MT-MP-02 implementation until MT-MP-01 is completed, verified, reported to Owner, and the next step is authorized.

## Recommended branch/worktree

Create a new clean continuation branch from:

`a98acc121070f53320a0c2d04622a22fb2df6f4b`

Suggested branch:

`feature/mt01-market-parity-continuation`

Keep `master` untouched.

## Required MT-MP-01 work

The canonical brief requires all of the following:

1. inventory the actual repository — do not trust old status prose;
2. reconcile the seven-module manifest/version claims across README/module docs/license/provenance;
3. classify every current tracked/untracked productization draft as `KEEP / REVISE / OUT-OF-SCOPE`;
4. establish a root workspace command surface for install/typecheck/test/build/lint where applicable;
5. remove buyer-facing hidden dependencies on:
   - `D:\AI-Workspace`;
   - Modules Hub private source paths;
   - WSTERA vault;
   - local agent runtime;
   - machine-specific absolute paths;
6. ensure no committed secret, generated credential, local DB data, or machine-specific artifact enters buyer deliverables;
7. make dependency/version installation reproducible and locked;
8. create the canonical deliverable:

`docs/market-parity/MT-MP-01-PRODUCT-CONTRACT.md`

plus an exact package manifest.

## Product Contract must state at minimum

- exact buyer promise;
- exact included modules;
- exact adapters/reference surfaces included vs planned;
- package names + package versions actually shipped;
- supported baseline runtime/toolchain;
- installation/root-command contract;
- what is explicitly non-goal / not included;
- current limitations;
- what `TEST-READY` means for this product;
- release evidence expectations;
- commercial/license references, with draft/legal-review status stated honestly.

Do not copy claims from the quarantined Claude artifact without source verification.

---

# 12. MT-MP-01 VERIFICATION REQUIREMENTS

Before reporting MT-MP-01 complete, prove at minimum:

```text
[ ] clean isolated continuation worktree/branch identified
[ ] exact package inventory generated from source
[ ] root workspace command surface exists
[ ] clean install path documented and reproducible
[ ] package locks/dependency policy reconciled
[ ] module tests run after reproducible install
[ ] module typechecks run after reproducible install
[ ] server tests pass
[ ] server typecheck passes
[ ] buyer-facing private-path scan passes
[ ] secret/high-confidence credential scan passes
[ ] git diff --check passes
[ ] changed-file allowlist reviewed
[ ] no unexpected untracked helper/scratch files
[ ] canonical MT-MP-01-PRODUCT-CONTRACT.md exists
[ ] Product Contract claims match current code
[ ] dirty master remains untouched
```

Do not count "tests green" alone as acceptance. Inspect the actual implementation, package boundaries, and buyer workflow.

If dependency installation requires changing lockfiles, package metadata, or root workspace structure, make those changes only in the continuation branch and document why.

---

# 13. TEST-READY GATE — FUTURE, NOT YET REACHED

The canonical brief says this build program may stop at TEST-READY only when all of these are true or explicitly blocked by an Owner decision:

- all planned market-parity capabilities have implementation artifacts;
- no advertised capability is only a placeholder/stub;
- root setup path is documented;
- production-reference persistence exists;
- real organization/team/RBAC flow exists;
- production-shaped billing/webhook/reconciliation reference exists;
- reference app demonstrates the end-to-end path;
- at least one deployment configuration/path is prepared;
- observability/security/failure-handling hooks are implemented;
- buyer docs match code;
- test fixtures, non-production credentials contract, test accounts/data plan, cleanup plan, and acceptance matrix are prepared.

When all MT-MP phases are built, create:

`MT01-TEST-READY-HANDOFF-YYYY-MM-DD.md`

with explicit status:

`TEST-READY - FINAL ACCEPTANCE NOT YET RUN`

Then STOP. A separate strict acceptance-test brief must be issued afterward.

---

# 14. AGENT / ORCHESTRATION BOUNDARY FOR THIS NEW CHAT

Valid prior qualification evidence exists for Ornith as:

`QUALIFIED_BOUNDED_BUILDER`

Evidence:

`D:\AI-Workspace\runtime\reviews\mt01-agent-team-2026-09-08\codex-review-ornith-final\CODEX-ORNITH-FINAL-QUALIFICATION.txt`

Use Ornith only within its qualified boundary unless a newer qualification supersedes it:

- small bounded docs/code tasks;
- explicit file allowlist;
- narrow acceptance criteria;
- external diff/status/untracked gate;
- no secrets;
- no deployment ownership;
- no schema ownership;
- no billing/security-critical ownership;
- blocked verification => BLOCK, not guess.

The full Claude/AGY/Qwen/Codex Agent Relay identity/provenance behavior is being re-tested in another chat. **Do not turn that infrastructure investigation into MT01 scope.**

If using any agent on MT01, require actual execution evidence and keep product review independent from self-report.

---

# 15. EVIDENCE POINTERS

Canonical build brief:

`D:\AI-Workspace\projects\saas-product-hub\products\multi-tenant-ai\docs\BRIEF-MT01-MARKET-PARITY-BUILD-TO-TEST-READY-2026-09-08.md`

Build-to-sell context:

`D:\AI-Workspace\projects\saas-product-hub\products\multi-tenant-ai\BUILD-TO-SELL-EXECUTION-2026-09-06.md`

Team-trial factual report:

`D:\AI-Workspace\runtime\reviews\mt01-team-trial-2026-09-08\evidence\HERMES-TEAM-TRIAL-REPORT-2026-09-08.md`

Canonical Codex trial closure:

`D:\AI-Workspace\runtime\reviews\mt01-team-trial-2026-09-08\codex-final-closure\CODEX-FINAL-CLOSURE.txt`

Quarantined Claude Product Contract snapshot — REVIEW ONLY:

`D:\AI-Workspace\runtime\reviews\mt01-team-trial-2026-09-08\evidence\CLAUDE-LATE-ARTIFACT-SNAPSHOT.md`

Ornith qualification:

`D:\AI-Workspace\runtime\reviews\mt01-agent-team-2026-09-08\codex-review-ornith-final\CODEX-ORNITH-FINAL-QUALIFICATION.txt`

---

# 16. FIRST REPORT BACK TO OWNER

After completing **MT-MP-01 only**, report:

1. branch/worktree + HEAD;
2. exact files changed;
3. exact seven-module/package manifest after reconciliation;
4. root install/test/typecheck/build/lint command surface;
5. test/typecheck results with counts;
6. private-path/secret/diff gates;
7. what claims were corrected from stale documentation;
8. any blocker that prevents reproducible buyer setup;
9. whether MT-MP-01 is genuinely PASS or still REMEDIATE;
10. **STOP and wait before MT-MP-02.**

Do not merge to `master`, deploy, publish, or begin final acceptance testing from this handoff without explicit Owner direction.