# Round 4 Handoff: Subscription & Payment Wiring

## Summary of Changes

Extended `products/multi-tenant-ai/server/` with subscription management (mock repositories, seed plans, entitlement checks) and Stripe payment integration (demo charges, webhook event parsing), keeping existing routes, middleware, and architecture patterns intact.

---

## Files Created & Edited

### Files Created
1. `server/src/lib/subscriptions.ts`:
   - Configures and seeds `createMockPlanRepository` with two starter plans: `free` (50 AI requests/month) and `pro` (1000 AI requests/month).
   - Initializes `createMockSubscriptionRepository([])` with no initial subscriptions.
   - Instantiates and exports `subscriptionCore` using `createSubscriptionCore(mockSubscriptionRepo, mockPlanRepo)`.

2. `server/src/routes/subscription-demo.ts`:
   - `subscribeHandler` for `POST /subscription/subscribe`: Validates `planId`, retrieves `accountId` from `req.tenantContext.tenantId`, invokes `subscriptionCore.createSubscription(...)`, and maps errors (`PLAN_NOT_FOUND` -> `404`, `SUBSCRIPTION_ALREADY_EXISTS` -> `409`).
   - `subscriptionStatusHandler` for `GET /subscription/status`: Retrieves current subscription for `req.tenantContext.tenantId`, queries `canUseFeature(accountId, 'ai_requests_per_month')` and `getLimit(accountId, 'ai_requests_per_month')`, and returns the composite status object.

3. `server/src/lib/payments.ts`:
   - Exports `getStripeAdapter()`: Inspects `process.env.STRIPE_SECRET_KEY` and constructs a configured `createStripeAdapter({ secretKey, webhookSecret })` instance or returns `null`.
   - Exports `getConfiguredPaymentCore()`: Wraps `getStripeAdapter()` with `createPaymentCore({}, adapter)` or returns `null` if not configured.

4. `server/src/routes/payment-demo.ts`:
   - `demoChargeHandler` for `POST /payment/demo-charge`: Gated by tenant and auth context. Validates `amountMinorUnits` and `currency`, verifies payment provider configuration (graceful `503` if missing), executes `paymentCore.createPayment(...)` with a generated UUID idempotency key, and maps `PaymentError` / status codes.
   - `paymentWebhookHandler` for `POST /payment/webhook`: Public endpoint (not tenant/auth gated). Obtains the underlying Stripe adapter, handles parsed JSON or raw Buffer bodies, executes `stripeAdapter.parsePaymentEvent(...)`, and responds `200 { received: true }` on success or `400` on parse failure.

5. `server/ROUND4_HANDOFF.md`:
   - Handoff documentation detailing files created/edited, tenant context resolution, seed plans, and architecture notes.

### Files Edited
1. `server/src/index.ts`:
   - Imported handlers from `./routes/subscription-demo.js` and `./routes/payment-demo.js`.
   - Mounted `POST /payment/webhook` **before** `app.use(tenantMiddleware)` with `express.raw({ type: 'application/json' })` middleware (since Stripe webhooks are external/public without tenant headers).
   - Mounted `POST /subscription/subscribe`, `GET /subscription/status`, and `POST /payment/demo-charge` **after** `app.use(tenantMiddleware)` gated with `authMiddleware`.

2. `server/.env.example`:
   - Added optional environment variables `STRIPE_SECRET_KEY=` and `STRIPE_WEBHOOK_SECRET=` with explanatory comments for buyers.

---

## Exact Tenant Context Field Name for `accountId`

The tenant context contract defined in `modules/tenant-context/core/types.ts` specifies:
```ts
export type TenantContext = {
  readonly tenantId: string;
  readonly actorId?: string;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly environment?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
};
```
Therefore, the exact property used for `accountId` in subscription creation and entitlement checks is:
**`req.tenantContext.tenantId`** (accessed via `req.tenantContext?.tenantId`).

---

## Seed Plans Chosen

In `server/src/lib/subscriptions.ts`, the mock repository is seeded with two tiers gating `'ai_requests_per_month'`:

1. **Free Tier (`free`)**:
   - `id`: `'free'`
   - `name`: `'Free Tier'`
   - `billingInterval`: `'month'`
   - `priceMinorUnits`: `0`
   - `currency`: `'USD'`
   - `entitlements`: `{ ai_requests_per_month: 50 }`

2. **Pro Tier (`pro`)**:
   - `id`: `'pro'`
   - `name`: `'Pro Tier'`
   - `billingInterval`: `'month'`
   - `priceMinorUnits`: `2900` ($29.00/mo)
   - `currency`: `'USD'`
   - `entitlements`: `{ ai_requests_per_month: 1000 }`

---

## Architecture & Integration Notes

1. **Stripe Webhook Middleware Placement**:
   - Webhook requests originate from Stripe and do not carry custom `x-tenant-id` headers or user authorization JWTs.
   - `POST /payment/webhook` is mounted upstream before `app.use(tenantMiddleware)` to avoid tenant resolution rejection (`400 Missing or invalid x-tenant-id header`).
   - The route handler supports both raw `Buffer` payloads (from `express.raw()`) and JSON objects.

2. **Error Code Mapping**:
   - `SubscriptionError` with code `PLAN_NOT_FOUND` maps to HTTP `404`.
   - `SubscriptionError` with code `SUBSCRIPTION_ALREADY_EXISTS` maps to HTTP `409`.
   - `PaymentError` instances are mapped to `error.status` when provided (e.g. 401, 429), or 400 for validation failures (`INVALID_AMOUNT`, `UNSUPPORTED_CURRENCY`, `MISSING_IDEMPOTENCY_KEY`), falling back to 502 for provider errors.
   - Missing configuration for payment provider returns `503 Service Unavailable`.

3. **Constraints Adherence**:
   - Strict file-writing only; no terminal commands were run.
   - Changes confined exclusively to `products/multi-tenant-ai/server/`.
