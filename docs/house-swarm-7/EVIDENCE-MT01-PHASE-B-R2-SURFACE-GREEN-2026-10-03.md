# MT01 Phase B — R2 Surface Hardening GREEN Evidence

> INTERNAL — NOT DELIVERED.

**Date:** 2026-10-03
**Branch:** `work/mt01-phase-b-remediation-20261003`
**Parent evidence:** `EVIDENCE-MT01-PHASE-B-R1-GREEN-2026-10-03.md`
**Scope:** Phase B B6/B7 provider-error and HTTP surface hardening
**State:** GREEN CANDIDATE — Phase B remains IN PROGRESS / STOP SALE

## 1. RED proof

Added `server/tests/phase-b-surface-security.test.ts` before remediation.

Command:

`npx vitest run tests/phase-b-surface-security.test.ts`

Pre-fix result:

- 1 test file failed
- 7 failed / 0 passed

The RED run reproduced:

- no baseline security headers on `/health`;
- malformed JSON fell through to an HTML error response;
- explicit JSON request size bound was absent at the product contract level;
- AI prompt size was unbounded by the route;
- thrown AI provider error text was returned to the client;
- structured AI provider failure detail was returned with HTTP 200;
- thrown payment provider error text was returned to the client.

The fixtures used synthetic secret-like strings and proved those strings were visible before remediation.

## 2. Remediation

### HTTP surface

`server/src/app.ts` now:

- sets baseline headers:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- keeps CORS closed by default (no permissive ACAO header is introduced);
- sets explicit JSON request limit to `64kb`;
- sets explicit webhook raw-body limit to `256kb`;
- converts malformed JSON to sanitized JSON `400 INVALID_JSON`;
- converts body overflow to sanitized JSON `413 REQUEST_BODY_TOO_LARGE`;
- no longer returns sample-UI render exception text.

### AI boundary

`server/src/routes/ai-demo.ts` now:

- rejects prompts above 32,000 characters with `413 PROMPT_TOO_LARGE` before quota/provider side effects;
- converts thrown provider failures to `502 AI_PROVIDER_REQUEST_FAILED`;
- converts structured provider failure results to the same sanitized 502 contract;
- releases quota on either provider failure path;
- does not proxy provider failure message text to the client.

### Payment / subscription / webhook boundary

`server/src/routes/payment-demo.ts` now:

- sanitizes unknown payment-provider exceptions as `PAYMENT_PROVIDER_REQUEST_FAILED`;
- sanitizes 5xx provider-result messages;
- does not echo webhook verification or parse failure messages;
- converts unexpected webhook processing errors to a stable application error.

`server/src/routes/subscription-demo.ts` now sanitizes unexpected internal failures while preserving explicit domain errors.

## 3. GREEN proof

Command:

`npm run typecheck && npx vitest run tests/phase-b-surface-security.test.ts`

Result:

- typecheck PASS
- 1/1 file PASS
- 7/7 tests PASS

Targeted Phase B set:

`npx vitest run tests/phase-b-high-security.test.ts tests/phase-b-surface-security.test.ts tests/auth-input-boundary.test.ts`

Result:

- 3/3 files PASS
- 25/25 tests PASS

## 4. Full regression

Full server suite after remediation:

- 8 test files PASS
- 1 PostgreSQL test file SKIPPED because `DATABASE_URL` is absent on this Windows executor
- 82 tests PASS
- 5 PostgreSQL tests SKIPPED
- no non-DB regression failure

## 5. Delivery / buyer package

After classifying the new buyer-delivered security test:

- delivery manifest: 9/9 PASS
- delivered files: 256
- not-delivered working papers before this evidence record: 22
- buyer-delivered secret scan: 256 files scanned, 0 findings
- `git diff --check`: PASS
- typecheck: PASS

This evidence file itself is vendor-internal and must be added to the manifest's not-delivered list before the final delivery rerun.

## 6. Remaining Phase B blockers / incomplete proof

This is not a Phase B PASS.

Still required:

- PostgreSQL-backed Phase B rerun on the current remediation revision;
- SQL-injection-shaped persistence proof on current revision;
- migration/reconnect/restart persistence proof on current revision;
- full B1 forged/expired/unknown-user proof against the intended auth boundary;
- privilege/admin negative-control closure where applicable;
- remaining webhook oversized/stale-timestamp cases where supported;
- independent reviewer over the frozen revision;
- final Phase B evidence bundle and gate verdict.

Windows executor observation:

- `psql`, `postgres`, and `docker` were not available in PATH during this run;
- therefore database proof remains an explicit environment blocker, not an invented PASS.

## 7. Gate state

```text
Phase A — SECURITY-DEPS        PASS / CLOSED
Phase B — SECURITY-ASSURANCE   IN PROGRESS
Sale/release                   HOLD / STOP SALE
Phase C                        NOT AUTHORIZED
```
