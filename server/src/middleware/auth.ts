import type { Request, Response, NextFunction } from 'express';
import type { AuthContext } from '../../../modules/auth-supabase/index.js';
import { createSupabaseAuthHelpers, AuthError } from '../../../modules/auth-supabase/index.js';
import { supabase } from '../lib/supabase.js';

declare global {
  namespace Express {
    interface Request {
      authContext?: AuthContext;
    }
  }
}

const authHelpers = supabase ? createSupabaseAuthHelpers({ supabaseClient: supabase }) : null;

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!supabase || !authHelpers) {
    res.status(503).json({ error: 'Auth not configured on this server instance' });
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    const jwt = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    const context = await authHelpers.requireUser({ jwt });
    req.authContext = context;
    next();
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.status || 401).json({ error: error.message, code: error.code });
      return;
    }
    res.status(401).json({ error: 'Unauthorized' });
  }
};
