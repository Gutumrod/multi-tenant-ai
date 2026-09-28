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
 * WU-1 SECURITY: keeps server-controlled app claims and user-editable profile
 * metadata separate. `user_metadata` never overrides `app_metadata` and must
 * not be used as an authorization source.
 */
export function extractSupabaseMetadata(user: SupabaseUser) {
  return {
    appMetadata: user.app_metadata ?? {},
    userMetadata: user.user_metadata ?? {}
  };
}
