**STATUS: DRAFT — for internal Owner/legal review, not legal-final and not for public distribution.**

---

# Module Provenance

**Product:** Multi-Tenant AI SaaS Starter Kit (MT01)
**Build-to-sell pass baseline:** `master @ 92139cfa4697fbade1a023d76dc4734dd82d5862`
**Pass date:** 2026-09-06

> **DRAFT — These checksums are computed from the working tree at the baseline commit above. They must be regenerated for the final immutable release artifact. Do not use these values to verify a buyer delivery without first confirming the artifact matches the baseline commit.**

---

## Module Manifest

| # | Module | Version | Introducing Commit | Description |
|---|--------|---------|-------------------|-------------|
| 1 | `tenant-context` | v0.2.0 | `8600384` | Multi-tenant identity + quota context; immutable/frozen TenantContext, zero-dependency pure TypeScript |
| 2 | `ai-provider` | v0.2.0 | `8600384` | Standardized completion interface — OpenAI, Anthropic Claude, Google Gemini |
| 3 | `subscription` | v0.1.0 | `8600384` | Entitlement engine — free/pro tier plans, quota enforcement (`ai_requests_per_month`) |
| 4 | `payment` | v0.1.0 | `8600384` | Stripe billing — integer minor-unit charges, idempotency keys, webhook event parsing |
| 5 | `auth-supabase` | v0.1.0 | `8600384` | RBAC / Row-Level Security via Supabase JWT verification |
| 6 | `enterprise-features` | v0.3.0 | `ce9ceb9` | CircuitBreaker (fail-fast) + MemoryTracer / NoopTracer; no OpenTelemetry adapter shipped |
| 7 | `webhook-receiver` | v0.1.0 | `ef821f6` | Provider-agnostic cryptographic webhook verification (Web Crypto only); ships GenericHmacVerifier + StripeWebhookVerifier; line/github are contract placeholders |

---

## Git History (build-to-sell baseline)

| Commit SHA | Message |
|------------|---------|
| `8600384` | Initial commit: multi-tenant-ai product scaffold (tenant-context, ai-provider, subscription, payment, auth-supabase) |
| `ce9ceb9` | Add enterprise-features module (CircuitBreaker + Tracer) + .gitignore |
| `3247b41` | Add multi-tenant-ai starter-kit reference server |
| `ef821f6` | Add webhook-receiver + subscription fixes, wire real Stripe verification |
| `92139cf` | fix(webhook): correct middleware order, wire handleBillingEvent, fix replay status |

**Verified baseline:** `master @ 92139cfa4697fbade1a023d76dc4734dd82d5862`

---

## Module Entry-Point Checksums (SHA-256)

Checksums are computed from the module entry-point source files as they exist at the baseline commit. For modules with a barrel `core/index.ts` (webhook-receiver), the core barrel is used.

> **Regenerate this table for each immutable release artifact.** Use `sha256sum <file>` (Linux/macOS) or `Get-FileHash <file> -Algorithm SHA256` (PowerShell) on the final packaged files.

| Module | Entry Point File | SHA-256 |
|--------|-----------------|---------|
| `tenant-context` | `modules/tenant-context/index.ts` | `a06db219f83fd299973856c648293bcfca1f606a2617b7750f75b13dd28ca5fd` |
| `ai-provider` | `modules/ai-provider/index.ts` | `8f8181ee4d40291937f155df37396dc7d6d8709e2cc8133328b61153d6faf507` |
| `subscription` | `modules/subscription/index.ts` | `03c3139969e047b936267233afce14c735c5d33fe488bd6215471c1a77a7cab8` |
| `payment` | `modules/payment/index.ts` | `03c3139969e047b936267233afce14c735c5d33fe488bd6215471c1a77a7cab8` |
| `auth-supabase` | `modules/auth-supabase/index.ts` | `a06db219f83fd299973856c648293bcfca1f606a2617b7750f75b13dd28ca5fd` |
| `enterprise-features` | `modules/enterprise-features/index.ts` | `12ea629643eabb8e200532f1235bb9cd68532b2fb345e5f0363dffa7cecb683e` |
| `webhook-receiver` | `modules/webhook-receiver/core/index.ts` | `5a5c5e4b2f64d715dc3e0f2664d89fc2be4b1ce2e4e11f8215f3162a2126b4f5` |

### webhook-receiver Provider Checksums

| Provider | File | SHA-256 |
|----------|------|---------|
| `GenericHmacVerifier` | `modules/webhook-receiver/providers/generic-hmac/index.ts` | `d6c11ed461a8317c032cadfa5a73b20a31896e4576f8d4a18008d252b2bc7a12` |
| `StripeWebhookVerifier` | `modules/webhook-receiver/providers/stripe/index.ts` | `8ebf1aa444b98bf98b6eb2766489a2dd719c7ddd75cf0987f8f3347782ecac9a` |
| `GithubWebhookVerifier` (placeholder) | `modules/webhook-receiver/providers/github/index.ts` | `08941d794ac60dd0824ec2baeb45e4f28d76add1919507e789a6df1695a0cc02` |
| `LineWebhookVerifier` (placeholder) | `modules/webhook-receiver/providers/line/index.ts` | `93bd0a00906d4a497721c12d25bd19819df7361f7feaee5c8ff3a3286bde4f3e` |

---

## Notes

- `subscription/index.ts` and `payment/index.ts` share the same SHA-256 (`03c3...`). This is expected if both index files are identical re-exports or otherwise identical in content at this baseline.
- `tenant-context/index.ts` and `auth-supabase/index.ts` also share the same SHA-256 (`a06d...`). Verify this is expected before the final release artifact is prepared.
- All checksums were generated using `sha256sum` on Windows (Git Bash) from the working tree at `92139cf`.

---

> **DRAFT — Regenerate checksums for the final immutable release artifact. These values reflect the development working tree, not a sealed distribution package.**
