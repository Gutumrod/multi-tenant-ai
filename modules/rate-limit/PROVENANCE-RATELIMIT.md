# PROVENANCE — modules/rate-limit (H7-FU-RATELIMIT)

Copy provenance for the Module Reuse Check performed by HOUSE-SWARM-7 follow-up
work unit `H7-FU-RATELIMIT` (correlation id
`house-swarm-7-followup-ratelimit-20260928`). It follows the shape of
`modules/subscription/PROVENANCE-WU2.md`.

    module:         rate-limit
    source_repo:    modules-hub
    source_version: 0.1.0 (upstream)  /  0.1.0 (MT01 copy, `VERSION` file)
    source_commit:  cd88c570ab57f6976d15f85d09973d0cfbf0cd63
    source_path:    rate-limit            (repo-relative: the module folder)
    staged read-only reference:
                    vendor-internal staging copy, not part of the delivered folder
                    — a vendor-local READ-ONLY copy of `source_repo` at the
                    `source_commit` above (the commit SHA above is recorded in the
                    staging copy's SOURCE_COMMIT.txt)
    copied_at:      2026-09-28 (UTC)
    base revision:  601033249d2b1ab005d1ca83dfbe33f66af6e356

No file from `modules-hub` is imported across repositories at runtime: the files
below are copies inside MT01 and **`modules-hub` was never modified**. The staged
copy was opened read-only and was not written to.

## Files copied from the staged upstream commit

At the H7-FU-RATELIMIT copy point on 2026-09-28, every file listed here was a
byte-identical copy of the staged module file with the same relative path
(verified with `diff -q` after writing — all SAME, see `RESULT` in the work-unit
report). This table records that historical adoption event; the Phase A security
overlay below records the intentional MT01-side divergence that happened later:

| local file | upstream file |
|---|---|
| `index.ts` | `index.ts` |
| `VERSION` | `VERSION` |
| `core/index.ts` | `core/index.ts` |
| `core/types.ts` | `core/types.ts` |
| `core/config.ts` | `core/config.ts` |
| `core/error.ts` | `core/error.ts` |
| `core/limiter.ts` | `core/limiter.ts` |
| `adapters/index.ts` | `adapters/index.ts` |
| `adapters/memory-store.ts` | `adapters/memory-store.ts` |
| `MODULE.md` | `MODULE.md` |
| `DESIGN.md` | `DESIGN.md` |
| `examples/integration.example.ts` | `examples/integration.example.ts` |
| `tsconfig.json` | `tsconfig.json` |
| `vitest.config.ts` | `vitest.config.ts` |
| `package-lock.json` | `package-lock.json` |
| `tests/config.test.ts` | `tests/config.test.ts` |
| `tests/limiter.test.ts` | `tests/limiter.test.ts` |
| `tests/memory-store.test.ts` | `tests/memory-store.test.ts` |
| `tests/unit/config.test.ts` | `tests/unit/config.test.ts` |
| `tests/unit/error.test.ts` | `tests/unit/error.test.ts` |
| `tests/unit/limiter.test.ts` | `tests/unit/limiter.test.ts` |
| `tests/unit/memory-store.test.ts` | `tests/unit/memory-store.test.ts` |
| `tests/integration/rate-limit.test.ts` | `tests/integration/rate-limit.test.ts` |
| `package.json` | `package.json` — see the local-change note below |

The module's own test files came across with the module, so its behaviour is
verifiable inside MT01 rather than only at the source repository.

## Deliberately NOT copied

The staged folder also holds `codex-prompt.txt`, `codex-result.json` and
`qwen-stage4-prompt.txt`. Those are `modules-hub` **working files** for the agent
runs that produced the module — not module source — and are excluded from the
copy. Nothing named `codex*` or `qwen*` exists under `modules/rate-limit/`.

## Local changes made on top of the copy (MT01 side)

### At the original H7 adoption

1. `modules/rate-limit/PROVENANCE-RATELIMIT.md` — this file (new, MT01-only).
2. `modules/rate-limit/package.json` received the MT01 metadata fields
   `"private": true` and `"description"`. At that time its test-tool
   devDependencies still matched the staged upstream copy.
3. The remaining copied files were unchanged at the end of that H7 work unit;
   the byte-identity statement above is therefore evidence about the adoption
   point, not a promise that later MT01 security maintenance can never diverge.

### Phase A security overlay — 2026-10-02

The MT01 pre-sale security pass intentionally changed **development/test tooling
only** after `npm audit` identified known Vitest/Vite-family vulnerabilities.
The current MT01 copy now differs from the staged 2026-09-28 upstream snapshot
in these package/document files:

- `package.json` — Vitest moved to `^5.0.3`, the required Vite peer is pinned at
  `^6.4.3`, and `@vitest/coverage-v8` moved to `^5.0.3`.
- `package-lock.json` — regenerated from that manifest.
- `DESIGN.md` — its package reference shape was updated to the same safe
  development/test toolchain so a buyer is not instructed to reinstall the
  vulnerable historical versions.

This overlay **does not add a runtime dependency and does not change the
rate-limit runtime implementation**: `core/`, `adapters/`, `index.ts`,
`VERSION`, `MODULE.md`, `examples/`, `tsconfig.json`, `vitest.config.ts` and the
test source files remain outside this security-toolchain edit. The module still
declares no `dependencies` block and remains dependency-free at runtime.

The post-refresh evidence is executable inside the delivered package:
`npm audit` reports zero vulnerabilities for this module, `npm run typecheck`
passes, `npm test` passes 36/36 tests, and `npm run test:coverage` also passes
36/36 under Vitest 5 / coverage-v8 5.

## Host wiring (outside the module copy)

The Host side of this reuse — identity (the key), environment reading, and the
HTTP response mapping — deliberately does **not** live in the module, because the
module's declared boundary forbids it (`MODULE.md` §Architectural boundary: the
module MUST NOT resolve identities, MUST NOT read `process.env`, MUST NOT inspect
router paths). That host code is:

- `server/src/lib/rate-limit.ts` — reads the two environment variables, composes
  the key, builds the limiter from `createMemoryStore()`, and maps a refusal to
  the HTTP response.
- `server/src/app.ts` — mounts that middleware on `POST /payment/webhook` only,
  **after** `express.raw()` and before the handler (re-ordered in the MT01 pre-sale
  cleanup, lane P3b; the limiter needs the raw body because it verifies the signature
  itself).
- the vendor's FU-RATELIMIT.md record (not delivered) — the wiring, key choice, environment
  variables, failure mode and limitation, in writing.

## Notes / limits

- The module's memory adapter is **single-process** (`MODULE.md` §Known limitation
  — NOT for distributed production): the counter lives in one local `Map`, so a
  multi-instance deployment shares no counter. This copy does not change that and
  the MT01-side documentation states it plainly.
- `modules-hub` was not modified, not fetched from, and not imported across the
  repository boundary.
