# WU-3 PAID-ROUTE INVENTORY — every route registered in `server/src/app.ts`

Authoritative inventory of **all eight** routes registered in
`server/src/app.ts`, for HOUSE-SWARM-7 **WU-3** (brief
`BRIEF-HOUSE-SWARM-7-MT01-FINISH-2026-09-26.md` §WU-3, criterion: *"มีรายการ route
ทั้งหมดที่ใช้ AI/ทรัพยากรมีค่า + สถานะว่าคุมแล้วทุกรายการ"* — a list of ALL routes
that consume AI/paid resources plus whether each one is controlled, not just the
one route that used to be controlled).

Scope note: this document describes how the **reference server** wires its routes
today. It is a statement of fact about the code, not an approval of it.

    app.ts revision inspected: server/src/app.ts (61 lines)
    routes registered:         8
    quota-gated:               2   (POST /ai/demo, POST /payment/demo-charge)
    not quota-gated:           6   (1 by design + 1 explicitly out of scope
                                    + 4 because they consume no paid resource)
    feature keys:              ai_requests_per_month, payments_per_month
                               (server/src/lib/subscriptions.ts)
    quota gate:                server/src/lib/quota.ts  (assertAndConsumeQuota /
                               releaseQuota)

Method of inspection: `server/src/app.ts` read directly; each handler read to
determine whether it reaches a billable outbound call. "Paid resource consumed"
means a call that costs money — an AI provider request
(`modules/ai-provider`, reached through `getConfiguredProvider()` /
`provider.generateText()`) or a payment-provider request
(`modules/payment` Stripe adapter, reached through `getConfiguredPaymentCore()`
/ `createPayment()` against `https://api.stripe.com/v1`).

## The inventory

| # | method | path | paid resource consumed | quota-guarded | justification when "no" |
|---|---|---|---|---|---|
| 1 | POST | `/payment/webhook` | payment provider call — outbound, but provider-initiated (see below) | **no** | **Explicitly out of scope, not an omission.** This route is invoked by the payment provider (Stripe) itself, not by a tenant session: there is no tenant request to attribute a usage unit to and no `x-tenant-id` header. It is mounted first in `app.ts`, before the global `express.json()` and before `tenantMiddleware`, precisely so its scoped `express.raw()` can receive Stripe's raw signed body. It is authenticated by webhook signature verification (`StripeWebhookVerifier` + `STRIPE_WEBHOOK_SECRET`), not by tenant identity, and it applies verified events to subscription state. It consumes no tenant's paid quota allowance: the resource it spends is the provider's own delivery, and the tenant's paid usage is recorded separately by whichever tenant-initiated route caused the event. Gating it on tenant quota would either reject legitimate billing events (locking tenants out of paid state changes) or let a forged tenant header suppress them. |
| 2 | GET | `/health` | none | **no** | Consumes no paid resource at all: the handler is a literal `res.json({ ok: true })` with no provider call, no repository call, and no tenant context (`server/src/app.ts` mounts it before `tenantMiddleware`). A liveness probe that spent quota would make uptime monitoring consume a tenant's allowance. |
| 3 | GET | `/whoami` | none | **no** | Consumes no paid resource at all: it echoes `req.tenantContext`, which `tenantMiddleware` already resolved from the `x-tenant-id` header. No provider call, no repository call — it is a tenant-resolution probe, not a billable operation. |
| 4 | GET | `/me` | none | **no** | Consumes no paid resource at all: it echoes the already-resolved `req.tenantContext` and `req.authContext`. The `authMiddleware` runs `authHelpers.requireUser({ jwt })`, which verifies a JWT through the Supabase auth client — a session check, not a per-request paid provider call, so there is nothing to meter. |
| 5 | POST | `/ai/demo` | **AI provider call** (`getConfiguredProvider()` then `provider.generateText()` under the circuit breaker) | **yes** | — (guarded) |
| 6 | POST | `/subscription/subscribe` | none | **no** | Consumes no paid resource at all: `subscribeHandler` calls `subscriptionCore.createSubscription()`, which reads a plan row and writes a subscription row through the local repositories. No AI call, no payment-provider call — creating a subscription record does not itself charge anyone. The money path is provider-driven: the charge happens at the payment provider and comes back through route 1. |
| 7 | GET | `/subscription/status` | none | **no** | Consumes no paid resource at all: `subscriptionStatusHandler` reads the subscription and the plan's `ai_requests_per_month` entitlement and returns them. Read-only against the local database; no provider call. |
| 8 | POST | `/payment/demo-charge` | **payment provider call** (`getConfiguredPaymentCore()` then `paymentCore.createPayment()`, an outbound Stripe API request) | **yes** | — (guarded) |

**Routes covered: 8 of 8 registered in `server/src/app.ts`.** No route in that
file is unaccounted for.

## The two guarded routes

Both guarded routes use the same single gate
(`server/src/lib/quota.ts` → `quotaGate.assertAndConsumeQuota`) and run it
**before** the paid call is reached, so a refusal never becomes a provider
request:

| route | feature key | gate placement | release on failure |
|---|---|---|---|
| POST `/ai/demo` | `ai_requests_per_month` | immediately after validating `prompt` and tenant context; the gate runs before `getConfiguredProvider()` (ai-demo.ts) | unit given back when no provider is configured, when the provider returns `success === false`, and when the call throws (including `CircuitBreakerError`) |
| POST `/payment/demo-charge` | `payments_per_month` | immediately after body validation and tenant context; the gate runs before `getConfiguredPaymentCore()` (payment-demo.ts) | unit given back when no payment provider is configured, when `createPayment()` returns `!success`, and when it throws (`PaymentError` or otherwise) |

## Routes that correctly answer "no" — the distinction that matters

There are two different reasons for "no" in the table above, and they must not be
collapsed:

1. **No paid resource consumed (routes 2, 3, 4, 6, 7).** These are a correct
   "no". There is nothing to meter: no AI call, no payment-provider call. Gating
   them would consume a tenant's quota for read-only or purely local work, which
   would be a defect rather than a safeguard. These five routes stay quota-free
   on purpose.

2. **Paid resource consumed but not tenant-quota gated (route 1,
   `POST /payment/webhook`).** This one is *not* covered by reason 1 — it does
   involve the payment provider. It is listed as an explicit out-of-scope entry
   with its reason, rather than left unmentioned, because the difference between
   "nothing to meter" and "metered somewhere else / authenticated by another
   mechanism" is exactly the kind of gap this inventory exists to make visible.
   Its reason: it is invoked by the payment provider itself rather than by a
   tenant session, so there is no tenant request to attribute a usage unit to,
   and it is authenticated by webhook signature verification instead. See row 1
   for the full justification.

## Known limits of this inventory

- Route 1's out-of-scope status is a **statement of the current design**, not a
  claim that webhook deliveries are free of cost or abuse risk. Rate limiting or
  signature-replay defence for that endpoint would be separate work and is not
  claimed here.
- The gate is a **snapshot check, not a compare-and-set**: two concurrent
  requests can both read `usage = limit - 1` and both be allowed. This residual
  race is documented in `server/src/lib/quota.ts` and is deliberately outside
  WU-3's declared design; the counter itself can never lose a write.
- The gate enforces per-account, not per-process or global, limits.
