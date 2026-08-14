# Task: Write DESIGN.md for the Tenant Context module (v0.1)

You are the ARCHITECT for the Tenant Context module in the Module Hub monorepo. Your ONLY deliverable is a single DESIGN.md file. Do NOT write any code, tests, or other docs. Do NOT run scaffolders, git clean, or rm -rf.

## Output file (write to this EXACT absolute path)
D:\AI-Workspace\projects\modules-hub\modules\tenant-context\DESIGN.md

Write the complete DESIGN.md to that exact absolute path. Verify the file exists there before finishing.

## Module standard / format reference
Match the structure and tone of the existing HTTP Client module DESIGN.md (D:\AI-Workspace\projects\modules-hub\http-client-module\DESIGN.md). That file uses numbered sections: Purpose, Public API (exact signatures), Exact Core Types, Structured Errors, Security Requirements, File Structure, Test Requirements (table), integration example reference shape, package.json/tsconfig.json, Explicit Non-Goals, Acceptance Criteria. Follow the same conventions: TypeScript, ES2022, strict mode, moduleResolution Bundler, Cloudflare Workers compatible (no node:* imports, Web APIs only), config injected by Host (core never reads env).

## Scope lock — v0.1 tenant context ONLY
- TenantContext contract: { tenantId, actorId?, requestId?, correlationId?, environment?, metadata? } — tenantId is the canonical identifier.
- Public API: createTenantContext(), validateTenantContext(), requireTenantContext(), optional withTenantContext() — MUST NOT use a global mutable variable.
- Explicit context passing is the default (request → TenantContext → service(context, input)). NO dependency on Node AsyncLocalStorage / Cloudflare-specific / Deno-specific runtime storage in Core.
- Tenant resolution: module does NOT guess tenant from hostname/subdomain/header/JWT/URL — Host resolves. Optional TenantContextResolver interface { resolve(input): Promise<TenantContext | null> } but source-specific resolver must live in an adapter.
- Membership authorization: correct flow is Auth Helper → verify membership → Host → create TenantContext. NOT Tenant Context querying Supabase users/roles.
- Tenant isolation: every tenant-scoped operation receives canonical tenantId. Host must not use arbitrary tenant id from user input without verification.
- Document clearly: Valid TenantContext = shape correct, NOT authorization granted. Authorization is Host/Auth layer's job.
- Errors: TENANT_CONTEXT_REQUIRED, TENANT_CONTEXT_INVALID, TENANT_ID_INVALID, TENANT_RESOLUTION_FAILED. Do NOT use TENANT_ACCESS_DENIED in Core (module is not the authorizer).
- Security: prevent context mutation, tenant id confusion, untrusted metadata overriding canonical fields, cross-request context leak, global singleton tenant state. Canonical fields must NOT be overridden by metadata.
- Config injected by host — core never reads env directly.

## DESIGN.md must specify
1. Architecture diagram (Authentication/Request → Host resolves tenant → TenantContext → Business Logic/Modules).
2. Folder structure matching http-client module standard (core/, adapters/, tests/unit, tests/adapters, examples/, MODULE.md, VERSION, package.json, tsconfig.json, index.ts).
3. TenantContext contract (exact type).
4. Exact signatures for createTenantContext, validateTenantContext, requireTenantContext, withTenantContext.
5. TenantContextResolver interface.
6. Error model (TenantContextError class + the 4 codes).
7. Config contract (TenantContextConfig injected by Host).
8. Test plan (per brief Tests): valid context, missing tenant, invalid tenant id, metadata, canonical field protection, context immutable behavior, context passed between layers, resolver success/missing/failure, no global tenant leakage. Present as a table like the http-client DESIGN.md test table.
9. Explicit Non-Goals (authentication, authorization, membership database, tenant CRUD, billing, subscription, tenant settings, RLS policy generation, database connection routing, subdomain routing).
10. Acceptance Criteria for the Stage 4 reviewer.

## Constraints
- Write ONLY DESIGN.md. Do not create any code/test/doc files.
- Write to the exact absolute path: D:\AI-Workspace\projects\modules-hub\modules\tenant-context\DESIGN.md
- Verify the file exists before finishing.
