# MT-MP-01 — MT01 Product Contract

**Product:** MT01 / Multi-Tenant AI SaaS Starter Kit
**Contract date:** 2026-09-08
**Build lane:** BUILD-TO-SELL / MARKET-PARITY
**Current branch:** `feature/mt01-market-parity-continuation`
**Continuation base:** `a98acc121070f53320a0c2d04622a22fb2df6f4b`

## 1. Buyer Promise

MT01 is a source-code starter kit for a solo developer or small technical studio building a multi-tenant AI SaaS backend. The buyer receives seven composable TypeScript modules plus a Node/Express reference server and can install, inspect, test, modify, and integrate them without access to WSTERA private repositories, vaults, agent runtimes, or machine-specific paths.

MT01 is **not** a hosted SaaS, managed deployment, production certification, or custom-development service. The current source package demonstrates reusable contracts and reference integration; later market-parity phases add production-reference persistence, organization lifecycle, billing/entitlement integration, reference UI, deployment, observability, and common adapters.

## 2. Canonical Package Boundary

The exact machine-readable package inventory is:

`docs/market-parity/MT-MP-01-PACKAGE-MANIFEST.json`

Workspace package names are private/local identifiers. They are not claims that `@module-hub/*` packages are published to npm, and installation does not require a Modules Hub registry or repository.

| Module | Workspace package | Version |
|---|---|---:|
| `tenant-context` | `@module-hub/tenant-context` | `0.2.0` |
| `ai-provider` | `@module-hub/ai-provider` | `0.2.0` |
| `subscription` | `@module-hub/subscription` | `0.1.0` |
| `payment` | `@module-hub/payment` | `0.1.0` |
| `auth-supabase` | `@module-hub/auth-supabase` | `0.1.0` |
| `enterprise-features` | `@module-hub/enterprise-features` | `0.3.0` |
| `webhook-receiver` | `@module-hub/webhook-receiver` | `0.1.0` |

Reference server: `multi-tenant-ai-server@0.1.0` (private workspace package).

## 3. Shipped Capability Boundary

### Included now

- immutable/fail-closed tenant context creation, validation, and dynamic resolution;
- OpenAI, Anthropic, and Gemini provider adapters behind the `AIProvider` abstraction;
- subscription plan/entitlement core with repository interfaces and mock reference repositories;
- payment core with Stripe adapter, amount/idempotency rules, refund and event normalization;
- Supabase-auth helper/RBAC contracts and server-side guard helpers;
- CircuitBreaker plus MemoryTracer/NoopTracer reference telemetry primitives;
- generic HMAC webhook verification and implemented Stripe webhook signature verification;
- explicit LINE and GitHub webhook placeholder classes that fail closed as unsupported;
- Express reference server demonstrating composition of all seven modules.

### Explicitly not shipped yet

- production PostgreSQL/Supabase persistence adapters and migrations;
- durable webhook/idempotency storage across restarts/instances;
- complete organization/member/invite/tenant-switch lifecycle;
- production-shaped Stripe checkout/subscription/reconciliation persistence;
- buyer-facing Next.js reference application;
- production deployment configuration or managed hosting;
- Pino/OpenTelemetry OTLP production-reference adapter;
- transactional email/Resend and object-storage/Supabase Storage adapters;
- AI token streaming in `ai-provider` v0.2.0;
- implemented LINE or GitHub webhook verifier;
- production secret-management service, compliance certification, pentest, or SLA.

## 4. Supported Buyer Toolchain

Canonical clean-install baseline:

- Node.js `>=20`;
- npm `>=10`;
- TypeScript `5.9.3`;
- Vitest `3.2.7`;
- Vite `6.4.3` for test tooling;
- root npm workspaces over `modules/*` and `server`;
- one canonical root `package-lock.json`.

Reference server runtime dependencies are pinned to `express@5.2.1` and `@supabase/supabase-js@2.112.3`. Exact dependency truth is the root lockfile, not stale version ranges in historical documents.

## 5. Installation and Root Command Contract

From the repository root:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run lint
npm run verify
```

Current `build` is intentionally a source-package validation command and runs TypeScript typechecking; MT01 does not yet emit a production application bundle in MT-MP-01. `lint` currently means repository contract/hygiene checks, not ESLint style enforcement.

Reference server development command:

```bash
npm run dev --workspace=multi-tenant-ai-server
```

No supported setup step requires entering seven module directories or running independent installs.

## 6. Dependency and Portability Policy

- Dependency versions used by the supported workspace are locked in the root `package-lock.json`.
- Child package lockfiles are intentionally not part of the supported buyer setup.
- Seven reusable modules have zero npm runtime dependencies; their tooling dependencies are private development dependencies.
- Buyer-facing package source must not contain machine-specific workspace paths, WSTERA vault references, Secretary/Hermes runtime dependencies, private Modules Hub source paths, or generated credentials.
- Agent prompts and build-round handoff artifacts are not part of the buyer package boundary.
- `.env.example` contains variable names/descriptions only. Real `.env` files are ignored.

## 7. Current Known Limitations

The current reference server uses process-memory state for subscription repositories and webhook replay/idempotency examples. It therefore cannot represent restart-safe or multi-instance production persistence.

Auth/RBAC helper contracts exist, but MT01 does not yet demonstrate the full Supabase Auth -> membership -> verified organization -> TenantContext lifecycle required by MT-MP-03.
Billing/webhook foundations exist, including real Stripe signature verification, but durable event claims, provider refetch, monotonic subscription transitions, and reconciliation over persistent state remain later market-parity work.

The reference server is demonstrative source code, not a production deployment target. Production deployment, configuration validation, observability exporters, email/storage adapters, and a buyer-facing reference app remain future MT-MP phases.

## 8. Commercial and Legal Boundary

Current Owner-approved commercial posture:

- USD 149 one-time / single developer;
- perpetual use of the purchased version under the eventual approved license;
- 12 months of released updates;
- planned optional Update Pass target: USD 69/year;
- no Team tier in V1;
- no monthly source-code rental or hosted kill switch.

`LICENSE.md`, `COMMERCIAL_LICENSE.md`, and `EULA.md` remain **DRAFT** and are not legal-final. Pricing direction may be documented while jurisdiction, consumer-protection, refund, dispute, fulfillment, and final license wording remain subject to Owner/legal review.

## 9. Meaning of TEST-READY

MT-MP-01 completion does **not** mean MT01 is TEST-READY or sell-ready. The overall product may use the exact status `TEST-READY - FINAL ACCEPTANCE NOT YET RUN` only after all planned MT-MP capability phases have implementation artifacts and the test-readiness matrices/environment contracts are prepared.

For MT-MP-01 specifically, PASS means the package boundary, workspace/install contract, dependency lock, source/version claims, buyer hygiene, and Product Contract are internally consistent and reproducible from a clean install.

## 10. Release Evidence Expectations

Every market-parity checkpoint must retain:

- branch/HEAD and changed-file list;
- exact install/test/typecheck/build/static-check commands;
- observed test counts/results, not expected results;
- dependency/security audit result;
- buyer private-path/credential scan result;
- `git diff --check` and repository status;
- known limitations and unresolved Owner decisions;
- explicit distinction between development verification and final independent acceptance.

A green development test suite is necessary but is not final product acceptance.

## 11. MT-MP-01 File Classification

The KEEP / REVISE / OUT-OF-SCOPE classification for current productization and historical/internal files is recorded in:

`docs/market-parity/MT-MP-01-FILE-CLASSIFICATION.md`

Historical briefs/evidence may remain in the development repository for provenance while being explicitly outside the buyer release surface.

## 12. Current Gate Statement

**MT-MP-01 DEVELOPMENT GATE: PASS (2026-09-08).**

The completed diff was verified from a fresh root `npm ci`: all 8 workspaces typechecked, all 22 test files / 239 tests passed, the root build/static gates passed, buyer hygiene and package-manifest checks passed, `npm audit` reported zero vulnerabilities, and the staged diff passed `git diff --cached --check`.

This is development/package-contract evidence only. It does **not** make MT01 TEST-READY or sell-ready and does not authorize MT-MP-02, merge to `master`, deployment, billing integration, publication, or final independent acceptance testing.
