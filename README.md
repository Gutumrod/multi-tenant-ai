**STATUS: DRAFT — for internal Owner/legal review, not legal-final and not for public distribution.**

---

# Multi-Tenant AI SaaS Starter Kit (MT01)

A TypeScript backend blueprint providing seven composable modules for building multi-tenant AI SaaS products. Includes a reference Express server wiring all modules end-to-end.

> **This is a source starter kit, not a hosted SaaS product.** Buyers receive the source code and integrate it into their own infrastructure. See [What's Excluded](#whats-excluded) before purchase.

---

## Module Manifest

| # | Module | Version | Purpose | Runtime / Provider / DB Expectation |
|---|--------|---------|---------|--------------------------------------|
| 1 | `tenant-context` | v0.2.0 | Multi-tenant identity and quota context — immutable frozen tenant record per request | Pure TypeScript, zero runtime dependencies, framework-agnostic |
| 2 | `ai-provider` | v0.2.0 | Standardized completion interface across providers | OpenAI / Anthropic Claude / Google Gemini (buyer's API keys) |
| 3 | `subscription` | v0.1.0 | Entitlement engine — free/pro tier plans, quota enforcement (`ai_requests_per_month`) | None bundled; host injects repository adapter |
| 4 | `payment` | v0.1.0 | Stripe billing — integer minor-unit charges, idempotency keys, webhook event parsing | Stripe API (buyer's account) |
| 5 | `auth-supabase` | v0.1.0 | RBAC / Row-Level Security via Supabase JWT verification | Supabase project (buyer's account) |
| 6 | `enterprise-features` | v0.3.0 | CircuitBreaker (fail-fast on cascading outages) + MemoryTracer / NoopTracer span tracking | None; **no OpenTelemetry exporter ships** — buyer wires OTel adapter |
| 7 | `webhook-receiver` | v0.1.0 | Provider-agnostic cryptographic webhook verification — `GenericHmacVerifier` + `StripeWebhookVerifier` ship; `line`/`github` are contract placeholders | Web Crypto API only (`crypto.subtle`); runs on Cloudflare Workers, Deno, Bun, Node.js 20+; no `node:crypto` |

All seven modules have **zero runtime dependencies**. Dev tooling only: TypeScript 5.6.x, Vitest 2.1.x.

---

## What's Included

- **Seven TypeScript modules** (source, not compiled) covering the core concerns of a multi-tenant AI SaaS backend: identity, AI completion, entitlement, payments, auth, resilience, and webhook verification.
- **Reference Express server** (`server/`) wiring all seven modules into a working demo application. See [server/README.md](server/README.md) and the [Reference Server section](#reference-server) below.
- **Module design documents** (`modules/*/MODULE.md`, `modules/*/DESIGN.md`) explaining each module's contract, public API, config surface, and integration checklist.
- **Extension points**: each module accepts host-injected repositories, config, and verifiers — no module reaches into env or hardcoded infrastructure.

---

## What's Excluded

The following are **explicit non-goals** of this starter kit — they are buyer responsibilities:

| Excluded | Notes |
|----------|-------|
| Hosted deployment | No deployment config, Dockerfile, or cloud setup. Buyer provides their own infrastructure. |
| Real database adapters | Reference server uses in-memory mock repositories only. Buyer implements PostgreSQL/Supabase DB/Prisma/Drizzle adapters. |
| Auth UI / frontend | No login pages, onboarding flows, or client-side code. Buyer builds or sources their own frontend. |
| OpenTelemetry exporter | `enterprise-features` ships `MemoryTracer` and `NoopTracer`. Connecting to a real OTel collector is the buyer's responsibility. |
| `webhook-receiver` line/github providers | `LineWebhookVerifier` and `GithubWebhookVerifier` are contract placeholder classes that return `WEBHOOK_UNKNOWN_PROVIDER`. They are not implemented. |
| Secret management | No vault integration, secrets injection pipeline, or key rotation. Buyer manages all API keys and secrets. |
| Production-readiness guarantee | This is a backend blueprint for technical builders. See [Reference Server](#reference-server) and [SECURITY.md](SECURITY.md). |

---

## Reference Server

`server/` is a standalone Express application (port 3003) wiring all seven modules into a demonstrable end-to-end backend. It proves the modules compose cleanly.

**Boundaries — the reference server is NOT production code:**

- Uses **in-memory mock repositories** (`createMockSubscriptionRepository`, `createMockPlanRepository`). All data is lost on restart.
- Uses **stub configurations** — Supabase, Stripe, and AI provider credentials are read from `.env` but the server is not hardened for production secret management.
- No persistent storage, no database, no frontend, no deployment config.
- Webhook endpoint (`/payment/webhook`) uses `StripeWebhookVerifier` + `handleBillingEvent` to demonstrate the full webhook-receiver integration path. **Not a production webhook handler.**

A starter-kit buyer replaces mock adapters with real infrastructure before going to production.

See [server/README.md](server/README.md) for routes, configuration, and getting-started instructions.

---

## Runtime Requirements

- **Modules 1–6**: Framework-agnostic pure TypeScript. Node.js 18+ (or any runtime supporting ESM + TypeScript toolchain). No runtime dependencies.
- **Module 7 (`webhook-receiver`)**: Requires a runtime with the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) (`crypto.subtle`). Verified compatible: Cloudflare Workers, Deno, Bun, Node.js 20+.
- **Reference server**: Node.js 20+ with npm.

---

## Pricing and Licensing

> **Target price posture (for Owner review — not final):** USD 149–199 per developer, single-developer license.

- Licenses are sold per individual developer seat. No Team tier in V1.
- This is a **single purchase** — no subscription, no recurring fee.
- See [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md) for full commercial terms (DRAFT).
- See [LICENSE.md](LICENSE.md) for the source license (DRAFT).
- See [EULA.md](EULA.md) for end-user license terms (DRAFT).

---

## Update Model

- **Purchased version**: Perpetual use. You may use the version you purchased indefinitely in unlimited commercial projects.
- **Updates**: 12 months of updates from the date of purchase are included. Updates are delivered as immutable versioned releases.
- **After 12 months**: No automatic updates. You continue using the purchased version. Additional update periods may be purchased separately if offered.
- This is **not** a lifetime-updates model.

---

## Documentation Index

| Document | Purpose |
|----------|---------|
| [server/README.md](server/README.md) | Reference server setup, routes, and configuration |
| [SECURITY.md](SECURITY.md) | Security boundary of the starter kit and buyer responsibilities |
| [LICENSE.md](LICENSE.md) | Source license (DRAFT) |
| [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md) | Commercial terms — pricing, updates, refund policy (DRAFT) |
| [EULA.md](EULA.md) | End User License Agreement (DRAFT) |
| [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) | Third-party dependency inventory and license notices |
| [PROVENANCE.md](PROVENANCE.md) | Module provenance, git history, and checksums |
