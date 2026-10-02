# MT01 Pre-Sale Phase A — Dependency & Runtime Security Report

> INTERNAL — NOT DELIVERED.
> Vendor security/remediation evidence. The buyer receives the executable security
> gates, not this internal work record.

**Date:** 2026-10-02
**Branch:** `work/mt01-phase-a-security-20261002`
**Parent plan:** `PRESALE-RELEASE-MASTER-PLAN-2026-10-02.md`
**Gate:** SECURITY-DEPS

## 1. Verdict

**PASS — Phase A / SECURITY-DEPS.**

This closes dependency/runtime hygiene only. It does **not** close Phase B
adversarial Security Assurance, real Supabase verification, buyer clean install,
commercial/legal, fulfillment, or final release seal.

No Critical, High, Moderate, or Low vulnerability is currently reported by
`npm audit` across any of the nine delivered package roots.

## 2. Starting findings

- Server/all dependencies: 8 total — 6 Moderate, 1 High, 1 Critical.
- Server/production-only: 3 Moderate, 0 High, 0 Critical.
- Production chain: Express / body-parser / qs.
- High/Critical findings were in the Vitest/Vite development/test stack.
- Every delivered module package carried the same old Vitest/Vite advisory set.
- `modules/rate-limit` also carried vulnerable coverage-tool dependencies.

The old toolchain had a supported safe path, so Phase A did not accept these as residual risk.

## 3. Runtime dependency remediation

- Express -> 4.22.3.
- body-parser -> 1.20.8 through the supported Express dependency range.
- qs -> 6.16.0.
- No forced Express major upgrade was used.

After the patch, `npm audit --omit=dev` reported zero vulnerabilities.

## 4. Test/development toolchain remediation

The server and all eight module packages were moved off the vulnerable Vitest/Vite line:

- Vitest -> 5.0.3.
- Vite peer -> 6.4.3.
- Server Node typings -> 22.x.
- rate-limit coverage-v8 -> 5.0.3.

The upgrade used neither `--force` nor `--legacy-peer-deps`.
All nine package roots now report zero vulnerabilities for both all-dependency and production-only audit.

## 5. Pre-existing buyer-package defect discovered

Module-wide verification exposed two legacy test defects in `modules/tenant-context`:

1. an enterprise test imported an obsolete/nonexistent `supa-auth` RBAC path;
2. a security test treated the `TenantContext` TypeScript type as a runtime constructor.

The fixes were limited to tests:

- RBAC import now targets `auth-supabase/core/rbac.js`;
- concurrency test now uses the public `createTenantContext()` factory.

No tenant-context runtime implementation changed. Result: typecheck PASS, 14/14 tests PASS.

## 6. Delivered security gates added

Two buyer-runnable proofs were added under `server/scripts/proofs/security/`:

- `dependency-audit.mjs`: audits server + all module roots, fails closed on malformed/unavailable audit evidence, and has negative-control self-tests.
- `buyer-package-secret-scan.mjs`: parses the Delivered set, scans buyer files for high-confidence credentials/private keys, redacts values, and has negative-control self-tests.

New scripts:

- `npm run test:security:deps`
- `npm run test:security:package`
- `npm run test:security`

Observed combined security result:

- dependency self-tests: 3/3 PASS;
- 9 package roots, all + production audit: PASS, zero vulnerabilities;
- secret-scan self-tests: 5/5 PASS;
- buyer-delivered secret scan: 252 text files, 0 findings;
- production demo-auth gate: 21/21 PASS;
- deploy preflight: 7/7 PASS.

Coverage output is ignored through `coverage/` and is not delivered.

## 7. Module verification after toolchain refresh

| Module | Typecheck | Tests |
|---|---|---:|
| ai-provider | PASS | 8/8 |
| auth-supabase | PASS | 32/32 |
| enterprise-features | PASS | 16/16 |
| payment | PASS | 21/21 |
| rate-limit | PASS | 36/36 |
| subscription | PASS | 39/39 |
| tenant-context | PASS | 14/14 |
| webhook-receiver | PASS | 136/136 |

The rate-limit coverage run also passed 36/36 under coverage-v8 5.

## 8. Provenance handling

Historical provenance was preserved rather than rewritten to make the current tree look byte-identical.
For rate-limit, `PROVENANCE-RATELIMIT.md` now records both the original 2026-09-28 adoption event
and the intentional 2026-10-02 security-toolchain divergence.

Buyer design snippets that still pointed to the known-vulnerable Vitest 2 line were refreshed to
the audited Vite 6.4.3 / Vitest 5.0.3 toolchain. Runtime contracts and runtime source were not
changed by this documentation/tooling refresh.

## 9. PostgreSQL 16.4 runtime proof

Phase A used an isolated local PostgreSQL 16.4 container on loopback only.
No Supabase project and no external production database was used.

Migration proof:

- fresh run applied `0001_persistence` and `0002_usage`;
- subsequent runs skipped both;
- six expected tables were present;
- persistent wiring selected Postgres repositories;
- `migration_runner_idempotent=true`.

WU-2 database proof: 5/5 PASS.
WU-3 quota proof: 6/6 PASS, including 16 concurrent increments -> final counter 16 and
the single-statement atomic upsert contract.

## 10. Full regression on the same database

Full server suite run 1: Test Files 6 passed (6), Tests 62 passed (62).
Full server suite run 2 on the same database: Test Files 6 passed (6), Tests 62 passed (62).

WU-4 web proof on the same isolated database:

- demo-auth: 21/21 PASS;
- i18n parity: 8/8 PASS;
- HTTP/database E2E: 9/9 PASS;
- proof rows cleaned after the run;
- no AI provider key and no external AI provider call.

## 11. Phase A exit criteria

SECURITY-DEPS is PASS because:

- all shipped package roots report 0 vulnerabilities;
- supported fixes closed the dev/test High/Critical findings;
- buyer-delivered secret scan reports 0 findings;
- demo auth remains fail-closed in production;
- all module typechecks/tests are green;
- database-backed tests/proofs remain green;
- no dependency exception/risk acceptance is required at this point.

## 12. Explicit residual boundaries

Phase A does **not** claim that MT01 is secure against all attacks.
Still open:

- Phase B adversarial auth/authorization/tenant-isolation review;
- real Supabase auth/project verification;
- broader attack-surface negative controls;
- buyer clean-install and real deployment;
- distributed/multi-instance rate-limit proof;
- final artifact security scan/release seal.

## 13. Independent controller recheck on Mac

A second pass reran the security gate, server regression, all eight module suites, rate-limit
coverage, delivery/claims negative controls, and PostgreSQL-backed proofs.

That recheck found one proof-harness resource-hygiene defect: `quota-proof.mjs` printed a correct
6/6 PASS summary but retained the shared PostgreSQL pool, so the standalone Node process did not
return promptly after successful completion. The harness now closes `serverPool` after cleanup.
No quota runtime implementation changed. The corrected harness must both print 6/6 PASS and exit
cleanly; this is part of the Phase A closure evidence.

The recheck also confirmed that the canonical migration command is
`npx tsx scripts/proofs/wu2/migrate-runner-proof.mts`; direct `node` execution of the TypeScript
proof is not the documented contract.

One early same-database rerun under concurrent verification load produced two 5-second test
timeouts (the concurrent billing-event claim and verified webhook apply). PostgreSQL showed no
lingering application locks afterward. The result was treated as a potential repeatability
blocker rather than ignored. Follow-up verification then produced:

- three consecutive full-suite runs on the same database: 62/62 PASS each;
- ten consecutive targeted runs of the two DB-sensitive suites: 9/9 PASS each (90 assertions);
- no recurrence of the timeout.

Phase A therefore records the first timeout as a transient test-environment/timing event, not as
evidence of a closed logical defect. If it recurs in later gates, reopen the finding rather than
raising the timeout threshold without root-cause evidence.

## 14. Next gate

Proceed to **Phase B — Full Security Assurance / Adversarial Review** after this Phase A
change set is committed with all repository gates green.
