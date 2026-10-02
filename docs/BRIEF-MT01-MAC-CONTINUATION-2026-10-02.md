# BRIEF — MT01 Mac Continuation

**Date:** 2026-10-02  
**Project:** MT01 Multi-Tenant AI Starter Kit  
**Repository:** Gutumrod/multi-tenant-ai  
**Continuation branch:** `work/mt01-mac-continuation-20261002`  
**Base commit:** `eef992a1275655f091e7b8da001225343e5246b7`

## Source of Truth

Use the remote repository as the source of truth. Do not copy the stale Windows main checkout over the Mac checkout.

The Windows main checkout was audited before this handoff:
- local `master` was behind `origin/master` by 20 commits and ahead by 0
- no local branch tip existed outside remote history
- no stash existed
- no real `.env`, credential, or secret file was found in the project
- old dirty review worktrees were inspected; their useful fixes are already represented by the current remote history, or they are obsolete review/scratch state
- old untracked commercial/legal documents are already preserved on remote branch `wip/windows-sync-20260925`
- old untracked daily documents differ from their remote copies only by UTF-8 BOM

Do not merge old Windows untracked files or old review worktrees into this continuation branch.

## Verified baseline before migration

Verified on a clean worktree at `eef992a`:

- `npm run typecheck` -> PASS
- `npm test` -> PASS: 57 passed, 5 skipped, 62 total
- PostgreSQL persistence tests were the 5 skipped tests because no `DATABASE_URL` was supplied in that run
- `npm run test:delivery` -> PASS: 9/9
- `node scripts/proofs/wu5/delivery-manifest-check.mjs --self-test` -> PASS: 7/7
- `node scripts/proofs/wu6/claims-check.mjs` -> PASS: 10/10
- `node scripts/proofs/fu/claims-check-numeric-fixtures.mjs` -> PASS: 7/7

## Mac bootstrap procedure

On the Mac, first inspect any existing checkout before changing it.

If no useful local-only work exists, use a clean checkout:

```bash
git clone https://github.com/Gutumrod/multi-tenant-ai.git
cd multi-tenant-ai
git fetch --all --prune
git checkout work/mt01-mac-continuation-20261002
git rev-parse HEAD
git status --short --branch
```

Expected initial base before this handoff commit:
`eef992a1275655f091e7b8da001225343e5246b7`

After this handoff file is committed, the branch HEAD will be one documentation commit ahead of that base.

## Runtime verification on Mac

Require Node.js 22 or newer.

```bash
cd server
node --version
npm ci
npm run typecheck
npm test
npm run test:delivery
node scripts/proofs/wu5/delivery-manifest-check.mjs --self-test
node scripts/proofs/wu6/claims-check.mjs
node scripts/proofs/fu/claims-check-numeric-fixtures.mjs
```

Do not claim PostgreSQL/Supabase persistence verification from the plain `npm test` result if `DATABASE_URL` is absent.

## Next production-readiness sequence

Do not add unrelated features.

1. Verify real Supabase auth path end-to-end.
2. Run buyer-style clean-install proof on Mac with no WSTERA internal dependencies.
3. Perform first real deployment and record runtime evidence.
4. Add/verify CI for typecheck, tests, delivery manifest, claims gates, and required security/setup proofs.
5. Lock commercial/legal terms only after Owner review.
6. Produce immutable release artifact and provenance/checksums.

## Current known boundaries

- No OpenTelemetry exporter.
- No LINE webhook verifier.
- No GitHub webhook verifier.
- Webhook rate limiting is in-process, not distributed.
- Current source has not yet been proven against a real Supabase project for the sale claim.
- No production deployment evidence exists yet.

## Migration rule

The Mac continuation branch is the active working branch for the next MT01 session.  
Remote Git history is authoritative. Windows review/scratch worktrees are historical evidence only unless a new audit proves otherwise.
