import type { NextFunction, Request, Response } from 'express';
import {
  AuthError,
  requireTenantMembership,
} from '../../../modules/auth-supabase/index.js';

declare global {
  namespace Express {
    interface Request {
      /**
       * Tenant identifier authorized against the trusted auth principal.
       *
       * Protected business handlers must use this value instead of reading the
       * caller-controlled x-tenant-id selector directly.
       */
      effectiveTenantId?: string;
    }
  }
}

/**
 * Binds the caller-requested tenant selector to the authenticated principal.
 *
 * tenantMiddleware resolves x-tenant-id as a selector only. authMiddleware (or
 * the explicitly non-production demo identity gate) resolves the principal.
 * This middleware is the authorization boundary between those two values and
 * every protected business handler.
 */
export const tenantAuthorizationMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authContext = req.authContext;
  if (!authContext) {
    res.status(401).json({
      error: 'Authentication context required',
      code: 'UNAUTHENTICATED',
    });
    return;
  }

  const requestedTenantId = req.tenantContext?.tenantId;
  if (!requestedTenantId) {
    res.status(403).json({
      error: 'Tenant authorization context required',
      code: 'TENANT_ACCESS_DENIED',
    });
    return;
  }

  try {
    const authorized = requireTenantMembership(authContext, requestedTenantId);
    const effectiveTenantId = authorized.tenantId;

    // requireTenantMembership() guarantees equality with requestedTenantId, but
    // fail closed here as well if a future resolver produces an auth context
    // without a concrete tenant id.
    if (!effectiveTenantId) {
      res.status(403).json({
        error: 'Authenticated principal has no authorized tenant',
        code: 'TENANT_ACCESS_DENIED',
      });
      return;
    }

    req.effectiveTenantId = effectiveTenantId;
    next();
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      res.status(error.status || 403).json({
        error: error.message,
        code: error.code,
      });
      return;
    }

    res.status(403).json({
      error: 'Tenant access denied',
      code: 'TENANT_ACCESS_DENIED',
    });
  }
};
