# MT01 Phase B R7 — Actual Webhook Route Cross-Process Replay Proof

> INTERNAL — NOT DELIVERED.

**Date:** 2026-10-04  
**Branch:** `work/mt01-phase-b-remediation-20261003`  
**Input revision:** `7b5da9943b04623b915e623c064124f46adf3af4`  
**Gate:** `WF-COUNCIL-01 / SECURITY-ASSURANCE` remains **IN PROGRESS** until a fresh independent reviewer inspects this proof.

## 1. Why R7 exists

The final independent review of R6 found no new bypass in the supplied code, but correctly held Phase B because R6 proved the PostgreSQL repository boundary directly rather than exercising the actual verified webhook route across separate processes.

R7 closes that proof gap at the HTTP route boundary.

## 2. Executable proof

Added:

`server/tests/phase-b-webhook-route-restart.test.ts`

The test starts **two separate Node.js server processes** with:

- the same PostgreSQL 16.4 database;
- the same Stripe webhook secret;
- independent process-local webhook replay caches.

The scenario is intentionally ordered so the durable ledger, rather than only `lastProcessedEventId`, must protect the state:

1. Process A receives a correctly signed `invoice.payment_failed` event **A**.
2. Persistent subscription state becomes `grace_period`, last event **A**.
3. Process A receives a correctly signed `invoice.paid` event **B**.
4. Persistent state becomes `active`, last event **B**.
5. Process B has never seen event A in its process-local `Set`, so a signed replay of **A** passes its receiver and reaches the real route/business path.
6. The actual route calls `subscriptionCore.handleBillingEvent()`.
7. Because persistent last event is now B, the simple last-id short circuit cannot reject A.
8. The durable `billing_event_ledger` claim for A rejects the replay in `saveForBillingEvent()`.
9. Persistent subscription state remains `active` with last event **B**.
10. The ledger contains exactly A and B, with no second A transition.

Result:

```text
phase-b-webhook-route-restart.test.ts  1/1 PASS
```

This is an end-to-end proof of the production route chain:

```text
signed HTTP webhook
  -> paymentWebhookHandler
  -> mapStripeEventToBilling
  -> subscriptionCore.handleBillingEvent
  -> PostgresSubscriptionRepository.saveForBillingEvent
  -> durable billing_event_ledger
```

Fresh regression on the R7 worktree:

- server typecheck: **PASS**;
- full server suite with PostgreSQL: **99/99 PASS** across 14 test files;
- dependency audit: **9 package roots**, all + production checks, **0 vulnerabilities**;
- buyer secret scan: **261 delivered files, 0 findings**;
- production demo-auth gate: **21/21 PASS**;
- deploy preflight: **7/7 PASS**;
- delivery manifest: **9/9 PASS**;
- `git diff --check`: **PASS**.

## 3. Security conclusion

For PostgreSQL-backed operation, a replayed verified event cannot re-apply subscription state across separate server processes or after a process restart, even when the receiving process has an empty in-memory replay cache.

The process-local receiver cache remains only an early duplicate filter. The durable security boundary for subscription state is the PostgreSQL billing-event ledger.

## 4. Residual / documented limitation

A deliberately DB-less demonstration/in-memory run does not provide durable state across process restart. It is not the persistent production-state path validated by this Phase B proof.

## 5. Gate state

```text
~~Phase A — SECURITY-DEPS~~      PASS / CLOSED
Phase B — SECURITY-ASSURANCE     IN PROGRESS
R1-R6 remediation/proofs         GREEN candidate
R7 actual route replay proof     GREEN candidate
Fresh independent review         REQUIRED
Phase C — REAL-SUPABASE          NOT AUTHORIZED YET
Sale/release                     HOLD
```

R7 does not self-approve Phase B.
