import type { SupabaseAuthClient, SupabaseUser } from '../core/types.js';

/**
 * Structural check helper to verify if a client is compatible with SupabaseAuthHelpers.
 */
export function isSupabaseAuthClient(client: any): client is SupabaseAuthClient {
  return (
    client &&
    typeof client === 'object' &&
    client.auth &&
    typeof client.auth.getUser === 'function'
  );
}

/**
 * Utility to extract metadata from a raw Supabase user.
 *
 * WU-1 SECURITY: returns server-controlled claims only. `user_metadata` is
 * writable by the end user in Supabase, so it is never merged here and can
 * never override `app_metadata`.
 */
export function extractSupabaseMetadata(user: SupabaseUser) {
  return {
    ...user.app_metadata
  };
}
