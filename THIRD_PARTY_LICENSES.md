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
| `typescript` | `5.6.3` (pinned in modules) | Apache-2.0 | Yes (all modules) | No — tooling only |
| `vitest` | `2.1.4` (pinned in modules) | MIT | Yes (all modules) | No — test tooling only |

---

## Reference Server Dependencies (`server/`)

### Runtime Dependencies (bundled with the reference server when run by the buyer)

| Package | Version Range | License | Notes |
|---------|---------------|---------|-------|
| `express` | `^4.19.2` | MIT | HTTP server framework. MIT license; permissive. |
| `@supabase/supabase-js` | `^2.45.4` | MIT / Apache-2.0 (dual) | Supabase JS client. The package is dual-licensed; verify the current published SPDX identifier in the package's `package.json` at the version resolved by the buyer's `npm install`. |

### Dev Dependencies (tooling; NOT bundled into any runtime artifact)

| Package | Version Range | License | Notes |
|---------|---------------|---------|-------|
| `typescript` | `^5.6.3` | Apache-2.0 | TypeScript compiler. Used for type-checking only. |
| `tsx` | `^4.19.0` | MIT | TypeScript execute — used for `npm run dev` / `npm run start`. Present in the server runtime environment when the buyer runs `tsx`; not a compiled artifact. |
| `vitest` | `^2.1.4` | MIT | Test runner. Used for `npm run test` only. |
| `@types/express` | `^4.17.21` | MIT | TypeScript type definitions for Express. Dev only. |
| `@types/node` | `^20.14.0` | MIT | TypeScript type definitions for Node.js. Dev only. |

---

## Notes on `@supabase/supabase-js` Licensing

The `@supabase/supabase-js` package has historically been distributed under a dual MIT/Apache-2.0 license. Buyers should verify the SPDX license identifier in the specific resolved version's `package.json` before production use and distribution. Both MIT and Apache-2.0 are permissive open-source licenses that permit commercial use.

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
