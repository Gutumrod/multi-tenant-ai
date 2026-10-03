import type { Request, Response, NextFunction } from 'express';
import type { TenantContext } from '../../../modules/tenant-context/core/types.js';
import { HeaderTenantResolver } from '../../../modules/tenant-context/adapters/header-resolver.js';

declare global {
  namespace Express {
    interface Request {
      /** Caller-requested tenant selector; untrusted until tenant authorization succeeds. */
      tenantContext?: TenantContext;
      /** Trusted effective tenant established only after authenticated membership authorization. */
      authorizedTenantId?: string;
    }
  }
}

const resolver = new HeaderTenantResolver();

export const tenantMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const context = await resolver.resolve(req.headers);
    if (!context) {
      res.status(400).json({ error: 'Missing or invalid x-tenant-id header' });
      return;
    }
    req.tenantContext = context;
    next();
  } catch (error) {
    res.status(400).json({ error: 'Missing or invalid x-tenant-id header' });
  }
};
