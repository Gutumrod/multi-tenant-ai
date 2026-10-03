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

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (typeof authHeader !== 'string') {
    return null;
  }

  const match = /^Bearer ([^\s]+)$/i.exec(authHeader);
  return match?.[1] ?? null;
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!supabase || !authHelpers) {
    res.status(503).json({ error: 'Auth not configured on this server instance' });
    return;
  }

  const jwt = extractBearerToken(req.headers.authorization);
  if (!jwt) {
    res.status(401).json({
      error: 'Missing or invalid Authorization header',
      code: 'AUTHORIZATION_HEADER_INVALID',
    });
    return;
  }

  try {
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
