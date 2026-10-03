# MT01 Phase B R6 — Durable Webhook State Idempotency Proof

> INTERNAL — NOT DELIVERED.

**Date:** 2026-10-04  
**Branch:** `work/mt01-phase-b-remediation-20261003`  
**Input revision:** `6499de84b99072e460827369387cebf44cdacf72`  
**Gate:** `WF-COUNCIL-01 / SECURITY-ASSURANCE` remains **IN PROGRESS** pending final fresh independent review.

## 1. Why R6 exists

The independent review of R5 reported no blocking code findings, but requested explicit proof that replayed verified webhook events cannot apply subscription state twice across separate app instances or a process restart. The route-level webhook receiver has an in-memory replay cache, so that cache is treated only as an early duplicate filter, not as the durable state-transition boundary.

## 2. Durable boundary

For PostgreSQL-backed operation, `PostgresSubscriptionRepository.saveForBillingEvent()` claims `event_id` in `billing_event_ledger` with `ON CONFLICT DO NOTHING` and persists the subscription in the same transaction. A previously claimed event returns `false` before subscription mutation.

## 3. Executable proof

Added:

`server/tests/phase-b-webhook-durable-idempotency.test.ts`

The proof:

1. creates two independent PostgreSQL pools/repositories, representing two app instances;
2. races the same verified event id through both;
3. requires exactly one durable claim;
4. closes both pools;
5. opens a fresh pool/repository, representing process restart;
6. replays the same event id with a deliberately conflicting subscription state;
7. requires the replay to return `false`;
8. verifies persisted state remains from the first event;
9. verifies the ledger contains exactly one row for the event id.

Result on PostgreSQL 16.4:

```text
phase-b-webhook-durable-idempotency.test.ts  1/1 PASS
```

This proves the durable subscription-state transition is at-most-once across concurrent instances and restart, even though the receiver's in-memory duplicate cache itself resets.

Fresh regression after adding this proof:

- server typecheck: **PASS**;
- full server suite with PostgreSQL: **98/98 PASS** across 13 test files;
- dependency audit: **9 package roots**, all + production checks, **0 vulnerabilities**;
- buyer secret scan: **260 delivered files, 0 findings**;
- production demo-auth gate: **21/21 PASS**;
- deploy preflight: **7/7 PASS**;
- delivery manifest: **9/9 PASS**;
- `git diff --check`: **PASS**.

## 4. Residual / documented limitation

The in-memory receiver cache is process-local and remains a best-effort early duplicate filter. Cross-process/restart durability is provided by the PostgreSQL billing-event ledger at the state mutation boundary. Deployments that intentionally run without `DATABASE_URL` are demonstration/in-memory mode and do not provide durable state across process restart.

## 5. Gate state

```text
~~Phase A — SECURITY-DEPS~~      PASS / CLOSED
Phase B — SECURITY-ASSURANCE     IN PROGRESS
R1-R5 remediation                GREEN candidate
R6 durable webhook replay proof  GREEN candidate
Fresh independent review         REQUIRED
Phase C — REAL-SUPABASE          NOT AUTHORIZED YET
Sale/release                     HOLD
```

This proof does not self-approve Phase B.
