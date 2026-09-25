# MT01 Multi-Tenant AI Starter Kit — Build-to-Sell Execution Brief

**Owner direction:** BUILD-TO-SELL.
**Verified baseline:** `master@92139cf`; pre-existing `?? docs/` remains unrelated and must not be swept into this work.
**Council:** Product PASS; Business/Market PASS after Owner D1-D4.

## Commercial boundary locked by Council
- Product is a low-priced backend blueprint/starter kit, not a hosted production SaaS.
- Primary beachhead: agency / technical agency building SaaS backends for clients; secondary: advanced indie builder / small technical team.
- Price posture: USD 149–199 single purchase; no Team tier yet.
- Perpetual use of purchased version + 12 months updates; do not market as lifetime updates.
- 14-day limited refund policy direction; legal wording still requires explicit review.
- Seven-module composition includes `webhook-receiver`; fix all 6-vs-7 documentation drift.

## Sell-ready destination
A technical buyer can purchase one immutable version, understand exactly what it includes/excludes, install it in a clean environment, run the reference server/tests, connect supported providers, inspect tenant/billing/webhook boundaries, and extend/deploy it without WSTERA internal repositories or secrets.

## Execution sequence
### MT-SR-01 — Product/package contract reconciliation
Lock the seven-module manifest, supported runtime/providers/database expectations, extension points, explicit non-goals and honest reference-server boundary. Remove stale "production-ready" or six-module claims.

### MT-SR-02 — License + provenance + dependency package
Prepare the sellable license/refund/update wording for Owner/legal review, module provenance/checksums, third-party license inventory, dependency/security scan and redistribution notes. Do not alter historical upstream grants.

### MT-SR-03 — Clean-install buyer acceptance
From a fresh environment, prove install, environment validation, reference server start, tests, webhook verification, billing-event path, tenant/provider isolation examples and failure messaging. No hidden WSTERA path or credential dependency.

### MT-SR-04 — Buyer documentation and release artifact
Ship README/quickstart, architecture map, provider configuration, security boundary, example flows, upgrade notes, limitations, changelog, checksum/SBOM and versioned archive/tag.

### MT-SR-05 — Checkout/fulfillment/support readiness
Define purchase -> immutable version delivery -> re-delivery/revocation support path, support scope, update entitlement and refund workflow. Use WSTERA platform fulfillment only when that shared capability is actually available; do not block packaging proof on it.

### MT-SR-06 — Internal dogfood proof
Before broad commercial launch, use MT01 as a bootstrap/reference on at least one real WSTERA build without retrofitting old products merely to manufacture evidence. Record what worked and what required product-specific divergence.

## Immediate next ticket
**Start MT-SR-01 and MT-SR-02 as one bounded productization pass.** Do not expand into a full hosted production backend; the product being sold is the source starter kit/blueprint.

## Definition of done
- Seven-module contract is consistent everywhere.
- Clean buyer install succeeds from an immutable release artifact.
- License/update/refund/support terms are explicit and reviewed before public sale.
- Buyer package contains no WSTERA-internal dependency.
- One real dogfood record exists before broad launch.