# MT-MP-01 — File Classification

**Date:** 2026-09-08
**Purpose:** define what belongs to the MT01 buyer/product surface versus internal development evidence.

## Classification Rules

- **KEEP** — valid product/buyer artifact; preserve and keep synchronized with source.
- **REVISE** — valid artifact whose claims/configuration required MT-MP-01 reconciliation.
- **OUT-OF-SCOPE** — development/governance/history artifact; may remain in the repository but is not part of the buyer release surface.
- **REMOVE FROM BUYER TREE** — internal agent/handoff material embedded inside buyer source directories.

## Root Productization Drafts Present at Continuation Base

| File | Classification | Reason |
|---|---|---|
| `README.md` | REVISE -> KEEP | Buyer overview; needed root workspace, locked price and current limitations. |
| `COMMERCIAL_LICENSE.md` | REVISE -> KEEP (DRAFT) | Commercial direction is relevant; legal wording remains unapproved. |
| `EULA.md` | KEEP (DRAFT) | Buyer legal draft; not legal-final. |
| `LICENSE.md` | KEEP (DRAFT) | Buyer legal/source-license draft; not legal-final. |
| `SECURITY.md` | KEEP | Buyer security boundary and production responsibilities. |
| `THIRD_PARTY_LICENSES.md` | REVISE -> KEEP (DRAFT) | Dependency versions/licenses had to match the canonical lock. |
| `PROVENANCE.md` | KEEP (historical DRAFT) | Preserves earlier provenance/checksum baseline; final release checksums must be regenerated. |
| `BUILD-TO-SELL-EXECUTION-2026-09-06.md` | OUT-OF-SCOPE | Internal execution/governance brief, not buyer documentation. |
| `docs/` pre-existing control/daily material | OUT-OF-SCOPE unless explicitly listed below | Development status/history, not buyer package contract. |
## Buyer/Product Source

| Area | Classification | Notes |
|---|---|---|
| `modules/*/core`, `adapters`, `providers`, `examples`, `tests` | KEEP | Executable reusable module source/tests. |
| `modules/*/MODULE.md`, `DESIGN.md`, `VERSION` | REVISE/KEEP | Must match executable source and package metadata. |
| `modules/*/package.json` | REVISE -> KEEP | Private workspace metadata; versions/tooling reconciled. |
| `server/src`, `server/tests`, `server/.env.example` | KEEP | Reference server implementation/test/config contract. |
| `server/README.md` | REVISE -> KEEP | Setup changed to canonical root workspace install. |
| root `package.json` + `package-lock.json` | KEEP (new canonical surface) | Single reproducible workspace/install contract. |
| `scripts/verify-buyer-hygiene.mjs` | KEEP | Static buyer-path and high-confidence credential gate. |
| `scripts/verify-package-manifest.mjs` | KEEP | Detects package/version/workspace contract drift. |
| `docs/market-parity/MT-MP-01-PACKAGE-MANIFEST.json` | KEEP | Machine-readable exact package contract. |
| `docs/market-parity/MT-MP-01-PRODUCT-CONTRACT.md` | KEEP | Canonical MT-MP-01 buyer/product boundary. |

## Internal / Historical Material

- `BRIEF.md` — OUT-OF-SCOPE for buyer release; product planning/history.
- `STAGE3_EVIDENCE_REPORT.md` — OUT-OF-SCOPE; historical internal evidence with machine-local references.
- `docs/BRIEF-MT01-MARKET-PARITY-BUILD-TO-TEST-READY-2026-09-08.md` — OUT-OF-SCOPE; internal execution authority.
- `docs/daily/*` — OUT-OF-SCOPE; development journal/work briefs.
- `docs/CURRENT_STATUS.md` — OUT-OF-SCOPE for buyer release but maintained as internal current-state overlay.

These files may retain local paths when needed to preserve internal evidence; the buyer hygiene gate intentionally scans the defined buyer surface rather than rewriting historical evidence.
## Removed from Buyer Source Directories

The continuation base contained internal agent/build-round artifacts inside `modules/` or `server/`. They are not runtime/product dependencies and are removed from the buyer source tree:

- `modules/auth-supabase/.agy-design-prompt.txt`
- `modules/payment/.agy-prompt.md`
- `modules/tenant-context/agy-prompt.md`
- `server/ROUND1_HANDOFF.md`
- `server/ROUND2_HANDOFF.md`
- `server/ROUND3_HANDOFF.md`
- `server/ROUND4_HANDOFF.md`

## Lockfile Classification

Per-module and server `package-lock.json` files from the continuation base are replaced by one root lockfile. This avoids eight independent dependency graphs and makes `npm ci` from the repository root the sole supported clean-install path.

## Release Packaging Rule

A future immutable commercial archive must include only artifacts intentionally selected for the buyer surface. Internal execution briefs, daily logs, agent prompts, review evidence, local relay data, and machine-specific paths are not buyer deliverables even when retained in the development repository for provenance.
