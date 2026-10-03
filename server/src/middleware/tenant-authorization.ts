import type { Request, Response, NextFunction } from 'express';
import {
  AuthError,
  requireTenantMembership,
} from '../../../modules/auth-supabase/index.js';

/**
 * Binds a caller-selected tenant to the trusted authenticated principal.
 *
 * tenantMiddleware resolves the requested x-tenant-id before authentication.
 * That value is only a selector. This middleware is the authorization boundary
 * that must run after authentication and before tenant-scoped business logic.
 */
export const tenantAuthorizationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.authContext) {
    res.status(401).json({
      error: 'Authentication context required',
      code: 'UNAUTHENTICATED',
    });
    return;
  }

  try {
    const requestedTenantId = req.tenantContext?.tenantId ?? '';
    requireTenantMembership(req.authContext, requestedTenantId);

    // Business handlers consume only the trusted principal's tenant id. The
    // header-derived tenant remains a selector/audit context and is never the
    // business-authority field after this boundary.
    const trustedTenantId = req.authContext.tenantId;
    if (!trustedTenantId) {
      res.status(403).json({
        error: 'Authenticated principal has no tenant context',
        code: 'TENANT_ACCESS_DENIED',
      });
      return;
    }
    req.authorizedTenantId = trustedTenantId;
    next();
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      res.status(error.status || 403).json({
        error: error.message,
        code: error.code,
      });
      return;
    }

    res.status(500).json({
      error: 'Tenant authorization failed',
      code: 'TENANT_AUTHORIZATION_FAILED',
    });
  }
};
