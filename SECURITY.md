**STATUS: DRAFT — for internal Owner/legal review, not legal-final and not for public distribution.**

---

# Security Boundary

**Product:** Multi-Tenant AI SaaS Starter Kit (MT01)

This document describes the security properties of the starter kit's source modules, the reference server's in-memory boundaries, and the buyer's responsibilities before any production deployment.

> This document does not constitute a vulnerability disclosure policy or a security guarantee. See [Disclaimer](#disclaimer).

---

## Secure Defaults Provided by the Starter Kit

The following security properties are built into the shipped source code:

### `tenant-context` — Tenant Isolation
- `TenantContext` objects are created with `Object.freeze()` — the resolved tenant record is immutable after construction. No downstream code can mutate tenant identity, quotas, or plan data on an in-flight request.
- Tenant resolution from the `x-tenant-id` header is validated and structured before being passed to any business logic. Raw header values are never passed through unvalidated.

### `webhook-receiver` — Cryptographic Webhook Verification
- **Constant-time HMAC comparison.** Signature verification uses `crypto.subtle.verify` (Web Crypto API), which performs a constant-time comparison internally. Raw HMAC values are never compared with `===` or string equality, preventing timing-oracle attacks.
- **Payload size guard before JSON.parse.** The `payloadMaxBytes` limit (default 1 MiB) is enforced against the raw body string length before any JSON parsing. This prevents denial-of-service via large payloads triggering expensive parsing.
- **No secret leakage in error messages.** `WebhookError.message` values never contain the HMAC secret, raw signature header values, or any credential material. Error codes (`WEBHOOK_INVALID_SIGNATURE`, etc.) are safe to return in HTTP responses; the `.cause` field is internal only.
- **No environment access.** The module never reads `process.env`, `env`, or `globalThis`. All secrets and configuration are injected by the host via `createWebhookReceiver(config)`. Safe to embed in any runtime without side-effect risk.
- **No mutation of host input.** The `WebhookRequest` object passed to `verify()` is not mutated. Header normalization operates on an internal copy.
- **Web Crypto only.** All cryptographic operations use `crypto.subtle`. No `node:crypto`, `node:fs`, or Node-specific imports. Portable across Cloudflare Workers, Deno, Bun, and Node.js 20+.

### `payment` — Idempotency
- Stripe charges are created with unique idempotency keys. Duplicate charge requests within Stripe's idempotency window return the original charge result rather than creating a duplicate charge.

### General Module Design
- No module reads `process.env` or any global environment at import time. All secrets and configuration are passed in by the host.
- No module emits secrets in log output, thrown error messages, or returned error objects.

---

## Reference Server Boundaries

The reference server (`server/`) is a demonstration application. Its security posture is **not production-grade**:

| Concern | Reference Server State |
|---------|----------------------|
| Data persistence | In-memory only. All data lost on restart. Not suitable for real user data. |
| Secret management | API keys read from `.env` file. No vault integration, secret rotation, or access control. |
| Webhook endpoint | `/payment/webhook` demonstrates `StripeWebhookVerifier` integration. Not hardened for production traffic volumes or replay-attack scenarios beyond the module's built-in guards. |
| Authentication | Supabase JWT verification via `auth-supabase`. No session management, token refresh, or rate limiting. |
| Error handling | Demo-grade only. Internal errors may leak stack traces in development mode. |
| Rate limiting | None. |
| HTTPS / TLS | None (bare HTTP). Buyer must terminate TLS in production. |
| CORS | None configured. Buyer must add appropriate CORS policy. |

---

## Buyer Responsibilities

Before any production deployment, buyers must implement all of the following:

### Infrastructure
- **Real database**: Replace in-memory mock repositories with PostgreSQL, Supabase DB, Prisma, Drizzle, or equivalent. Implement proper migrations, backups, and access control.
- **TLS termination**: All traffic to the production server must be served over HTTPS. Configure a reverse proxy or load balancer with valid TLS certificates.
- **CORS policy**: Define and enforce a CORS policy appropriate for your frontend origins.
- **Rate limiting**: Apply rate limiting at the API gateway or middleware layer for all endpoints, especially AI completion and payment routes.

### Secrets Management
- Store all API keys (Supabase, Stripe, AI providers, webhook signing secrets) in a secrets manager or vault, not in plain `.env` files committed to source control.
- Rotate keys on schedule and on suspected compromise.
- Never log or expose raw API keys in HTTP responses, error messages, or server logs.

### Webhook Security
- Ensure the production `STRIPE_WEBHOOK_SECRET` is stored securely and not committed to source control.
- Configure Stripe's webhook allowlist to only send events to your verified endpoint URL.
- Review the `webhook-receiver` module's `WebhookReceiverConfig` — set appropriate `payloadMaxBytes` and `timestampToleranceSeconds` values for your production traffic profile.
- Implement a persistent `IdempotencyStore` (backed by Redis, Supabase DB, or similar) for production replay protection. The reference server uses only an **in-memory** idempotency store (a `Set` in `payment-demo.ts`) — it dedupes within a single process lifetime but the state is lost on restart and does not survive multiple instances.

### Observability
- Connect the `enterprise-features` tracer to a real OpenTelemetry exporter if distributed tracing is required. The shipped `MemoryTracer` accumulates spans in memory only; there is no OTel SDK or exporter included.
- Set up structured logging, alerting, and health monitoring appropriate to your production SLA.

### Authentication / Authorization
- Implement frontend auth flows and session management beyond the reference server's JWT-verification demo.
- Review Supabase Row-Level Security policies for your data model before exposing data to end users.

### Compliance
- Assess applicable data protection regulations (GDPR, CCPA, etc.) for your target markets.
- Conduct your own security review or penetration test before handling real user data or payment information.

---

## Disclaimer

This starter kit provides architectural patterns and secure defaults as described above. It is not a security audit, penetration test, compliance certification, or guarantee of fitness for any specific regulatory or security requirement. The Licensor makes no warranty that the Software is free of vulnerabilities or that it meets any particular security standard. Buyers are responsible for their own security posture, compliance, and production hardening.

No vulnerability disclosure or bug-bounty program is operated for this starter kit.

See [LICENSE.md](LICENSE.md) for the full disclaimer of warranty and limitation of liability.
