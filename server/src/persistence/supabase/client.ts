import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.js';
import { PersistenceError } from './errors.js';

export type Mt01SupabaseClient = SupabaseClient<Database, 'mt01'>;

export type PersistenceEnvironment = Readonly<Record<string, string | undefined>>;

function requiredServerSecret(env: PersistenceEnvironment): string | null {
  const secret = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? null;
  if (!secret) return null;

  if (secret.startsWith('sb_publishable_')) {
    throw new PersistenceError(
      'PERSISTENCE_NOT_CONFIGURED',
      'Persistence requires a server-only Supabase secret key, not a publishable key'
    );
  }

  return secret;
}

export function createSupabasePersistenceClient(
  env: PersistenceEnvironment = process.env
): Mt01SupabaseClient | null {
  const url = env.SUPABASE_URL;
  const secret = requiredServerSecret(env);
  if (!url || !secret) return null;

  return createClient<Database, 'mt01'>(url, secret, {
    db: { schema: 'mt01' },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
