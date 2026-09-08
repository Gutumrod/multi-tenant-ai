import type { IdempotencyStore } from '../../../../modules/webhook-receiver/core/types.js';
import type { Mt01SupabaseClient } from './client.js';
import { toPersistenceError } from './errors.js';

export type AtomicIdempotencyStore = IdempotencyStore & {
  claim(key: string, ttlSeconds?: number): Promise<boolean>;
};

export function createSupabaseIdempotencyStore(
  client: Mt01SupabaseClient,
  scope = 'webhook'
): AtomicIdempotencyStore {
  async function claim(key: string, ttlSeconds?: number): Promise<boolean> {
    const { data, error } = await client.rpc('claim_idempotency_key', {
      p_scope: scope,
      p_key: key,
      ...(ttlSeconds !== undefined ? { p_ttl_seconds: ttlSeconds } : {}),
    });
    if (error) throw toPersistenceError('claim idempotency key', error);
    return data === true;
  }

  return {
    claim,

    async has(key: string): Promise<boolean> {
      const { data, error } = await client
        .from('idempotency_keys')
        .select('expires_at')
        .eq('scope', scope)
        .eq('idempotency_key', key)
        .maybeSingle();
      if (error) throw toPersistenceError('read idempotency key', error);
      if (!data) return false;
      return data.expires_at === null || new Date(data.expires_at).getTime() > Date.now();
    },

    async set(key: string, ttlSeconds?: number): Promise<void> {
      await claim(key, ttlSeconds);
    },
  };
}
