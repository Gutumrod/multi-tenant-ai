import type { Mt01SupabaseClient } from './client.js';
import { toPersistenceError } from './errors.js';

export type WebhookEventClaim = {
  provider: string;
  eventId: string;
  eventType?: string;
  tenantId?: string;
  payloadHash?: string;
  eventCreatedAt?: Date;
};

export interface WebhookEventRepository {
  claim(input: WebhookEventClaim): Promise<boolean>;
  markProcessed(provider: string, eventId: string): Promise<void>;
  markFailed(provider: string, eventId: string, failureCode: string): Promise<void>;
  markIgnored(provider: string, eventId: string): Promise<void>;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createSupabaseWebhookEventRepository(
  client: Mt01SupabaseClient
): WebhookEventRepository {
  async function setStatus(
    provider: string,
    eventId: string,
    status: 'processed' | 'failed' | 'ignored',
    failureCode?: string
  ): Promise<void> {
    const { error } = await client
      .from('webhook_events')
      .update({
        status,
        processed_at: new Date().toISOString(),
        failure_code: failureCode ?? null,
      })
      .eq('provider', provider)
      .eq('provider_event_id', eventId);
    if (error) throw toPersistenceError('update webhook event status', error);
  }

  return {
    async claim(input: WebhookEventClaim): Promise<boolean> {
      const { data, error } = await client.rpc('claim_webhook_event', {
        p_provider: input.provider,
        p_event_id: input.eventId,
        ...(input.eventType ? { p_event_type: input.eventType } : {}),
        ...(input.tenantId ? { p_tenant_id: input.tenantId } : {}),
        ...(input.payloadHash ? { p_payload_hash: input.payloadHash } : {}),
        ...(input.eventCreatedAt ? { p_event_created_at: input.eventCreatedAt.toISOString() } : {}),
      });
      if (error) throw toPersistenceError('claim webhook event', error);
      return data === true;
    },

    markProcessed(provider: string, eventId: string): Promise<void> {
      return setStatus(provider, eventId, 'processed');
    },

    markFailed(provider: string, eventId: string, failureCode: string): Promise<void> {
      return setStatus(provider, eventId, 'failed', failureCode);
    },

    markIgnored(provider: string, eventId: string): Promise<void> {
      return setStatus(provider, eventId, 'ignored');
    },
  };
}
