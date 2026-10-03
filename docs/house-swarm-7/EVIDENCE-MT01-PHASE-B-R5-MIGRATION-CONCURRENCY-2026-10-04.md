# MT01 Phase B R5 — Concurrent Migration Startup Closure Evidence

> INTERNAL — NOT DELIVERED.

**Date:** 2026-10-04  
**Branch:** `work/mt01-phase-b-remediation-20261003`  
**Pre-fix review revision:** `22938e79efde0a50f6d9f33677a3f20cf2634a68`  
**Workflow:** `WF-DEV-01 v1.4.0` bounded remediation after independent `WF-COUNCIL-01 / SECURITY-ASSURANCE` finding  
**Gate:** Phase B remains **IN PROGRESS / SALE HOLD** pending a fresh independent review of the post-fix SHA.

## 1. Independent review finding

A fresh PostgreSQL-backed Phase B rerun exposed a concurrent migration bootstrap race that prior evidence had not covered.

The failure is production-relevant because `initSubscriptionRepositories()` runs `runMigrations()` during application startup when `DATABASE_URL` is configured. Two or more app instances starting against the same fresh database could enter the migration bootstrap concurrently.

Observed failure:

```text
duplicate key value violates unique constraint "pg_type_typname_nsp_index"
```

The collision happened while multiple callers executed `CREATE TABLE IF NOT EXISTS schema_migrations` concurrently. Follow-on suites then observed missing persistence tables because one bootstrap path had aborted.

Severity for Phase B handling: **Medium release blocker** under the current rule that Medium findings are remediated before Phase B exit unless the Owner explicitly accepts a documented residual.

## 2. RED-before-fix proof

Added:

`server/tests/phase-b-migration-concurrency.test.ts`

The test creates a fresh isolated PostgreSQL schema and starts eight concurrent `runMigrations()` calls against it.

Result on pre-fix revision:

- test files: 1 failed;
- tests: 1 failed;
- failure: `pg_type_typname_nsp_index` duplicate-key violation from `ensureMigrationsTable()`.

This reproduces the startup race directly instead of depending on incidental Vitest file ordering.

## 3. Remediation

`server/src/lib/persistence/migrate.ts` now:

- acquires a stable PostgreSQL session-level advisory lock before bootstrap table creation;
- holds the lock across migration discovery and all migration applications;
- uses the same dedicated PostgreSQL client for each per-migration transaction;
- preserves lexical migration ordering and one-transaction-per-migration semantics;
- destroys the dedicated session on every exit path so PostgreSQL releases the session advisory lock even if migration SQL throws;
- keeps later callers idempotent: once they acquire the lock they re-read `schema_migrations` and skip versions already applied.

This is database-level coordination and therefore works across processes/instances; it does not rely on an in-process mutex.

## 4. GREEN proof

With `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55433/mt01_phaseb_independent_review` on PostgreSQL 16.4:

- migration concurrency negative control: **1/1 PASS**;
- PostgreSQL persistence + DB adversarial + quota race targeted set: **11/11 PASS**;
- server typecheck: **PASS**;
- full server suite with PostgreSQL enabled: **97/97 PASS** across 12 test files;
- dependency-audit self tests: **3/3 PASS**;
- dependency audits: **9 package roots**, all + production checks, **0 vulnerabilities**;
- buyer secret scanner self tests: **5/5 PASS**;
- buyer delivered secret scan before manifest reclassification: **258 files, 0 findings**;
- demo-auth security gate: **21/21 PASS**;
- deploy preflight: **7/7 PASS**;
- `git diff --check`: **PASS**.

The new test was then added to the buyer delivery manifest and delivery/security gates were rerun before commit.

## 5. Gate statement

```text
~~Phase A — SECURITY-DEPS~~      PASS / CLOSED
Phase B — SECURITY-ASSURANCE     IN PROGRESS
R1-R4 remediation                GREEN candidate
R5 migration startup race        REMEDIATED / GREEN candidate
Fresh independent Phase B review REQUIRED
Phase C — REAL-SUPABASE          NOT AUTHORIZED YET
Sale/release                     HOLD
```

This evidence does **not** declare Phase B PASS. The post-fix commit must be reviewed by an independent reviewer that did not author R5.
