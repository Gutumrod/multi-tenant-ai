**STATUS: DRAFT — for internal Owner/legal review, not legal-final and not for public distribution.**

---

# Third-Party Licenses

This document inventories third-party dependencies used in the Multi-Tenant AI SaaS Starter Kit (MT01).

> **DRAFT — Final redistribution terms and bundling decisions require legal review. License texts quoted below are accurate as of 2026-09-06 based on published package metadata; verify against current package releases before any distribution.**

---

## Module Dependencies (7 modules: `modules/*/`)

All seven modules — `tenant-context`, `ai-provider`, `subscription`, `payment`, `auth-supabase`, `enterprise-features`, and `webhook-receiver` — have **zero runtime dependencies**.

- `webhook-receiver` uses the [Web Crypto API](https://www.w3.org/TR/WebCryptoAPI/) (`crypto.subtle`), which is a platform-native browser/runtime standard, not an npm package. No third-party library is bundled.
- Each module's `devDependencies` (listed below) are used for type-checking and testing only. They are **not bundled** into the sold source files.

| Package | Version | License | Module dev dep? | Bundled into sold source? |
|---------|---------|---------|-----------------|--------------------------|
| `typescript` | `5.9.3` (pinned in modules) | Apache-2.0 | Yes (all modules) | No — tooling only |
| `vitest` | `3.2.7` (pinned in modules) | MIT | Yes (all modules) | No — test tooling only |
| `vite` | `6.4.3` (root dev dependency; deduped for Vitest) | MIT | Test-tool dependency | No — tooling only |

---

## Reference Server Dependencies (`server/`)

### Runtime Dependencies (bundled with the reference server when run by the buyer)

| Package | Version Range | License | Notes |
|---------|---------------|---------|-------|
| `express` | `5.2.1` | MIT | HTTP server framework; exact version locked by the root workspace lockfile. |
| `@supabase/supabase-js` | `2.112.3` | MIT | Supabase JS client; exact version locked by the root workspace lockfile. |

### Dev Dependencies (tooling; NOT bundled into any runtime artifact)

| Package | Version Range | License | Notes |
|---------|---------------|---------|-------|
| `typescript` | `5.9.3` | Apache-2.0 | TypeScript compiler. Used for type-checking only. |
| `tsx` | `4.23.12` | MIT | TypeScript execute — used for `npm run dev` / `npm run start`. |
| `vitest` | `3.2.7` | MIT | Test runner. Used for `npm run test` only. |
| `@types/express` | `5.0.6` | MIT | TypeScript type definitions for Express. Dev only. |
| `@types/node` | `20.19.43` | MIT | TypeScript type definitions for Node.js. Dev only. |

---

## Notes on `@supabase/supabase-js` Licensing

The currently locked `@supabase/supabase-js` `2.112.3` package metadata declares the MIT license. Re-verify package metadata and required notices when preparing the final immutable release artifact.

---

## No Other Bundled Third-Party Code

The seven modules do not import from any npm package at runtime. All source files in `modules/*/` are original TypeScript authored for this starter kit, with the exception of the platform-native Web Crypto API used by `webhook-receiver`.

---

## Buyer Responsibility

When a buyer integrates the Software into their own product:
- They are responsible for reviewing and complying with the licenses of any additional dependencies they add.
- Runtime dependencies listed above (`express`, `@supabase/supabase-js`) will be installed in the buyer's environment via `npm install`. The buyer must ensure their use complies with those packages' current licenses.
- This document does not constitute legal advice.

---

> **DRAFT — Final redistribution decisions, attribution obligations, and any required license notices in shipped artifacts require legal review.**
