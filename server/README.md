# Multi-Tenant AI Starter Kit — Reference Server

A standalone Express reference server demonstrating how all **6 Multi-Tenant AI Starter Kit modules** integrate and compose together into an end-to-end multi-tenant backend architecture.

> **Note:** This server is **reference / example code** intended to prove that the modules compose cleanly with zero runtime overhead. It uses in-memory mock repositories and stubbed configurations. A starter-kit buyer would replace mock adapters with their production infrastructure (real database, real auth UI/frontend, secret management, telemetry collectors, and deployment pipelines).

---

## Demonstrated Modules

The reference server wires together all 6 starter kit modules:

1. **`tenant-context`** — Resolves and validates tenant identity (`x-tenant-id` header) into a typed, immutable `TenantContext` attached to each request.
2. **`auth-supabase`** — Authenticates users and checks role-based access control (RBAC) via Supabase JWT tokens (`Authorization: Bearer <token>`).
3. **`ai-provider`** — Standardized completion interface across OpenAI, Anthropic Claude, and Google Gemini.
4. **`enterprise-features`** — Resiliency via `CircuitBreaker` (fail-fast on cascading provider outages) and distributed execution observability via `MemoryTracer` / span tracking.
5. **`subscription`** — Tiered subscription plans (`free`, `pro`), entitlement evaluation, and quota limits (`ai_requests_per_month`).
6. **`payment`** — Stripe billing integration handling charge creation with idempotency keys and incoming webhook event parsing.

---

## Getting Started

### Prerequisites
- Node.js 20+ (with npm)

### Installation & Running

```bash
# Install dependencies
npm install

# Run the development server in watch mode (defaults to port 3003)
npm run dev

# Run test suite
npm run test
```

---

## Route Overview

| Method | Path | Access Gate | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Public | Basic health check returning `{ ok: true }`. |
| `POST` | `/payment/webhook` | Public (Raw Body) | Stripe webhook receiver parsing inbound event payloads without requiring tenant headers. |
| `GET` | `/whoami` | Tenant-Gated | Validates `x-tenant-id` header and returns resolved tenant context. |
| `GET` | `/me` | Tenant + Auth | Returns tenant context and authenticated user profile from Supabase JWT. |
| `POST` | `/ai/demo` | Tenant + Auth | Executes text generation prompt with the configured AI provider, protected by `CircuitBreaker` and traced via `MemoryTracer`. |
| `POST` | `/subscription/subscribe` | Tenant + Auth | Creates a subscription for the tenant on a chosen plan (`free` or `pro`). |
| `GET` | `/subscription/status` | Tenant + Auth | Retrieves active subscription status, feature access flags, and monthly quotas. |
| `POST` | `/payment/demo-charge` | Tenant + Auth | Creates a Stripe charge using integer minor currency units (cents) and unique idempotency keys. |

---

## Configuration (`.env`)

Copy `.env.example` to `.env` and provide your credentials.

> **Important:** All API credentials (Supabase, AI providers, Stripe) are the **buyer's own accounts**, not services provided by this starter kit.

| Variable | Required? | Description |
| :--- | :--- | :--- |
| `PORT` | Optional | Port for the Express server (default: `3003`). |
| `SUPABASE_URL` | Required for Auth | Buyer's own Supabase project URL (e.g. `https://xyz.supabase.co`). |
| `SUPABASE_ANON_KEY` | Required for Auth | Buyer's own Supabase anon/public API key. |
| `OPENAI_API_KEY` | Optional* | Buyer's OpenAI API key for `/ai/demo`. |
| `ANTHROPIC_API_KEY` | Optional* | Buyer's Anthropic API key for `/ai/demo`. |
| `GEMINI_API_KEY` | Optional* | Buyer's Google Gemini API key for `/ai/demo`. |
| `STRIPE_SECRET_KEY` | Optional | Buyer's Stripe Secret Key (`sk_test_...`) for payment charge demo and webhook adapter. |
| `STRIPE_WEBHOOK_SECRET` | Optional | Buyer's Stripe Webhook Signing Secret (`whsec_...`) for verifying incoming webhooks. |

*\* Note: Only one AI provider key (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY`) is needed to test the `/ai/demo` endpoint.*

---

## Production Readiness Disclaimer

This server is designed as an educational reference architecture showing clean module wiring. Before deploying to production, buyers must implement:
- **Persistent Storage**: Replace in-memory mock repositories (`createMockSubscriptionRepository`, `createMockPlanRepository`) with database adapters (e.g. PostgreSQL, Supabase DB, Prisma, Drizzle).
- **OpenTelemetry Exporter**: Connect the tracer to a real OTel collector if distributed tracing aggregation is required.
- **Frontend / Client Integration**: Provide user authentication flows and UI for tenant selection, subscription checkout, and AI prompts.
