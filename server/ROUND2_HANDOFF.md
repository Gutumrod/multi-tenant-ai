# Round 2 Handoff: Supabase Auth Integration & `/me` Route Wiring

## Files Created & Edited

### Files Created
1. `server/src/lib/supabase.ts`:
   - Reads `process.env.SUPABASE_URL` and `process.env.SUPABASE_ANON_KEY`.
   - Exports `supabase: SupabaseClient | null` created via `createClient` from `@supabase/supabase-js`.
   - If either variable is missing, safely exports `null` without throwing at import time so unconfigured servers boot and serve `/health`.

2. `server/src/middleware/auth.ts`:
   - Extends Express `Request` type via module augmentation with `authContext?: AuthContext`.
   - Instantiates `authHelpers` using `createSupabaseAuthHelpers({ supabaseClient: supabase })` when `supabase` is configured.
   - Extracts Bearer token from `Authorization` header (`req.headers.authorization`).
   - If `supabase` or `authHelpers` is `null`, returns `503 { error: 'Auth not configured on this server instance' }`.
   - Calls `await authHelpers.requireUser({ jwt })` and assigns result to `req.authContext`.
   - On `AuthError`, returns status code (`error.status || 401`) with `{ error: error.message, code: error.code }`; on unexpected error, returns `401 { error: 'Unauthorized' }`.

3. `server/ROUND2_HANDOFF.md`:
   - This handoff document documenting changes, exact API usages, and design decisions.

### Files Edited
1. `server/package.json`:
   - Added `"@supabase/supabase-js": "^2.45.4"` to `dependencies`.

2. `server/src/index.ts`:
   - Imported `authMiddleware` from `./middleware/auth.js`.
   - Added `GET /me` route gated by `tenantMiddleware` (mounted earlier via `app.use(tenantMiddleware)`) and `authMiddleware`, returning `{ tenant: req.tenantContext, auth: req.authContext }`.

3. `server/.env.example`:
   - Appended `SUPABASE_URL=` and `SUPABASE_ANON_KEY=` with comments clarifying they represent the buyer's own Supabase project credentials obtained from their Supabase dashboard.

---

## Exact `auth-supabase` Function & Type Names Used

- `createSupabaseAuthHelpers` (imported from `../../../modules/auth-supabase/index.js`):
  - Factory function taking `{ supabaseClient: SupabaseAuthClient }` and returning `SupabaseAuthHelpers`.
- `authHelpers.requireUser(options?: GetCurrentUserOptions)`:
  - Invoked with `{ jwt }` extracted from `req.headers.authorization` to validate session and produce normalized `AuthContext`.
- `AuthContext` (imported from `../../../modules/auth-supabase/index.js`):
  - Used for Express global declaration augmentation: `Express.Request.authContext?: AuthContext`.
- `AuthError` (imported from `../../../modules/auth-supabase/index.js`):
  - Used in `catch` block with `instanceof AuthError` to capture structured error properties (`error.message`, `error.code`, `error.status`).

---

## Design Decisions & Notes

- **Client Fallback & 503 Guard**: To maintain a reference server that boots cleanly even before a buyer configures credentials, `supabase` is typed as `SupabaseClient | null`. Any request to `/me` without Supabase credentials configured immediately receives a clear `503 { error: 'Auth not configured on this server instance' }`.
- **Error Propagation**: `auth-supabase` exports `AuthError` which carries `code` (`'UNAUTHENTICATED' | 'FORBIDDEN' | 'TENANT_ACCESS_DENIED' | 'INVALID_SESSION'`), `message`, and `status`. The middleware returns `{ error: error.message, code: error.code }` with `error.status` (defaulting to `401`).
- **Middleware Execution Hierarchy**: Because `app.use(tenantMiddleware)` is registered before route declarations in `server/src/index.ts`, `tenantMiddleware` evaluates first. If tenant headers are missing/invalid, a `400` error is returned before auth evaluation begins. When tenant check passes, `authMiddleware` executes, guaranteeing both `req.tenantContext` and `req.authContext` are populated on success.
- **Strict Compliance**: Followed pure file-writing requirements without running any shell commands, touching only files inside `products/multi-tenant-ai/server/`.
