import type { Request, Response, NextFunction } from 'express';
import { createTenantContext } from '../../../modules/tenant-context/core/context.js';

/**
 * WU-4 demonstration identity gate — OFF BY DEFAULT, and NOT authentication.
 *
 * The whole point of this middleware is to let a buyer walk the four sample-UI
 * screens on a clean machine that has no Supabase project, because this
 * repository ships no credentials and cannot ship them. It is deliberately a
 * separate module: nothing in modules/auth-supabase is touched, and the real
 * `authMiddleware` (server/src/middleware/auth.ts) keeps its current behaviour
 * in every configuration.
 *
 * Contract:
 *   - Enabled only when DEMO_AUTH is exactly the string 'true'.
 *   - Refuses to activate, and logs one clear error line, when NODE_ENV is
 *     'production'. `demoAuthMiddleware` then answers 503 and no demo identity
 *     is ever established. The refusal is a hard stop, not a warning.
 *   - Establishes a tenant identity ONLY from the caller-supplied
 *     `x-demo-account` header (falling back to `x-tenant-id`), validated against
 *     a character allow-list. There is no password, no user record, no token and
 *     no signature: `authContext.metadata.demoAuth === true` is the flag the UI
 *     reads to label the screen as a demonstration.
 *   - Mounted on the paid routes INSTEAD OF `authMiddleware` when the flag is
 *     on, so a demo request can never reach the real auth path and a real auth
 *     request can never be answered by this middleware.
 *
 * What it is NOT: it grants no privilege. Every other check in the system (the
 * tenant middleware's header requirement, the quota gate's entitlement and limit
 * checks, the subscription repository) still runs exactly as before, so a demo
 * identity is refused by the quota gate when it has no subscription or no
 * entitlement.
 */

export const DEMO_AUTH_ENV = 'DEMO_AUTH';
export const DEMO_ACCOUNT_HEADER = 'x-demo-account';

/** Maximum accepted length of a demo account id. */
export const DEMO_ACCOUNT_MAX_LENGTH = 64;

/**
 * Accepted id shapes: letters, digits and `. _ - @`. Anything else (including
 * `..`, slashes, spaces and any non-ASCII character) is refused, so an id can
 * never be used to smuggle a path or a control character into a database key.
 */
export const DEMO_ACCOUNT_PATTERN = /^[A-Za-z0-9._\-@]{1,64}$/;

export type DemoAuthRefusalReason = 'disabled' | 'production' | 'invalid_account_id';

export type DemoAuthState = {
  /** DEMO_AUTH was exactly 'true'. */
  requested: boolean;
  /** The middleware will accept demo identities on this process. */
  active: boolean;
  /** Present when `active` is false and the flag was requested. */
  refusal: DemoAuthRefusalReason | null;
};

export function isValidDemoAccountId(value: unknown): value is string {
  return typeof value === 'string' && DEMO_ACCOUNT_PATTERN.test(value);
}

/** Reads the header as a trimmed string; arrays take their first value. */
function headerValue(req: Request, name: string): string | null {
  const raw = req.headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Decides whether the gate may be active on this process. Reading the
 * environment is the only side effect, so this is safe to call from tests and
 * from app construction alike.
 */
export function demoAuthState(env: NodeJS.ProcessEnv = process.env): DemoAuthState {
  const requested = env[DEMO_AUTH_ENV] === 'true';

  if (!requested) {
    return { requested: false, active: false, refusal: null };
  }

  if (env.NODE_ENV === 'production') {
    return { requested: true, active: false, refusal: 'production' };
  }

  return { requested: true, active: true, refusal: null };
}

/**
 * The one log line a refused activation emits. Wording is stable so a deployment
 * log can be grepped for it.
 */
export function demoAuthRefusalMessage(state: DemoAuthState): string | null {
  if (state.refusal === 'production') {
    return (
      '[demo-auth] REFUSED: DEMO_AUTH=true with NODE_ENV=production. ' +
      'The demonstration identity gate is not mounted and no demo identity will be established. ' +
      'Set NODE_ENV to something other than production, or unset DEMO_AUTH.'
    );
  }
  return null;
}

/** The single 503 body used for every refused or invalid demo request. */
function refuse(res: Response, code: DemoAuthRefusalReason): void {
  res.status(503).json({
    error:
      code === 'production'
        ? 'Demonstration identity mode (DEMO_AUTH) is refused on a production server instance'
        : 'Demonstration identity mode (DEMO_AUTH) is not enabled on this server instance',
    code: code === 'production' ? 'DEMO_AUTH_REFUSED_IN_PRODUCTION' : 'DEMO_AUTH_DISABLED',
  });
}

/**
 * Builds the gate. The returned middleware is mounted on the paid routes only
 * when `demoAuthState().active` is true (see createApp()).
 */
export function createDemoAuthMiddleware(state: DemoAuthState = demoAuthState()) {
  return async function demoAuthMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (!state.active) {
      refuse(res, state.refusal ?? 'disabled');
      return;
    }

    const accountId = headerValue(req, DEMO_ACCOUNT_HEADER) ?? headerValue(req, 'x-tenant-id');
    if (!isValidDemoAccountId(accountId)) {
      res.status(400).json({
        error: `Missing or invalid ${DEMO_ACCOUNT_HEADER} header (1-${DEMO_ACCOUNT_MAX_LENGTH} characters from A-Z a-z 0-9 . _ - @)`,
        code: 'DEMO_ACCOUNT_ID_INVALID',
      });
      return;
    }

    const tenantContext = createTenantContext({
      tenantId: accountId,
      metadata: {
        resolvedVia: 'demo-auth',
        source: DEMO_ACCOUNT_HEADER,
        demoAuth: true,
      },
    });

    req.tenantContext = tenantContext;
    req.authContext = {
      userId: `demo_identity:${accountId}`,
      tenantId: accountId,
      roles: [],
      permissions: [],
      // The marker the sample UI reads to label itself a demonstration mode.
      metadata: {
        demoAuth: true,
        notAuthentication: true,
        source: DEMO_ACCOUNT_HEADER,
      },
    };

    next();
  };
}

/**
 * The middleware instance that answers 503 for a requested-but-refused gate
 * (DEMO_AUTH=true with NODE_ENV=production). Mounting this is what makes the
 * production refusal observable over HTTP instead of only in a log line.
 */
export const refusedDemoAuthMiddleware = createDemoAuthMiddleware({
  requested: true,
  active: false,
  refusal: 'production',
});
