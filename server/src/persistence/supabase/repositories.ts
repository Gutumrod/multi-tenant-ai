import type { PlanRepository, SubscriptionRepository } from '../../../../modules/subscription/core/repository.js';
import type { Plan, Subscription, SubscriptionStatus } from '../../../../modules/subscription/core/types.js';
import type { Json } from './database.types.js';
import type { Mt01SupabaseClient } from './client.js';
import { planFromRow, subscriptionFromRow } from './mappers.js';
import { toPersistenceError } from './errors.js';

export function createSupabasePlanRepository(client: Mt01SupabaseClient): PlanRepository {
  return {
    async getById(planId: string): Promise<Plan | null> {
      const { data, error } = await client
        .from('plans')
        .select('*')
        .eq('id', planId)
        .maybeSingle();
      if (error) throw toPersistenceError('get plan', error);
      return data ? planFromRow(data) : null;
    },

    async listAll(): Promise<Plan[]> {
      const { data, error } = await client
        .from('plans')
        .select('*')
        .order('id', { ascending: true });
      if (error) throw toPersistenceError('list plans', error);
      return (data ?? []).map(planFromRow);
    },

    async save(plan: Plan): Promise<void> {
      const { error } = await client.from('plans').upsert({
        id: plan.id,
        name: plan.name,
        billing_interval: plan.billingInterval ?? null,
        price_minor_units: plan.priceMinorUnits ?? null,
        currency: plan.currency?.toUpperCase() ?? null,
        entitlements: plan.entitlements as Json,
        active: true,
      }, { onConflict: 'id' });
      if (error) throw toPersistenceError('save plan', error);
    },
  };
}

export function createSupabaseSubscriptionRepository(
  client: Mt01SupabaseClient
): SubscriptionRepository {
  return {
    async getByAccountId(accountId: string): Promise<Subscription | null> {
      const { data, error } = await client
        .from('subscriptions')
        .select('*')
        .eq('tenant_id', accountId)
        .maybeSingle();
      if (error) throw toPersistenceError('get subscription', error);
      return data ? subscriptionFromRow(data) : null;
    },

    async save(subscription: Subscription): Promise<void> {
      const { error } = await client.from('subscriptions').upsert({
        id: subscription.id,
        tenant_id: subscription.accountId,
        plan_id: subscription.planId,
        status: subscription.status,
        current_period_start: subscription.currentPeriodStart.toISOString(),
        current_period_end: subscription.currentPeriodEnd.toISOString(),
        trial_end: subscription.trialEnd?.toISOString() ?? null,
        cancel_at_period_end: subscription.cancelAtPeriodEnd,
        canceled_at: subscription.canceledAt?.toISOString() ?? null,
        metadata: (subscription.metadata ?? {}) as Json,
        last_processed_event_id: subscription.lastProcessedEventId ?? null,
      }, { onConflict: 'tenant_id' });
      if (error) throw toPersistenceError('save subscription', error);
    },

    async updateStatus(
      accountId: string,
      status: SubscriptionStatus,
      extra: Partial<Subscription> = {}
    ): Promise<void> {
      const update = {
        status,
        ...(extra.planId ? { plan_id: extra.planId } : {}),
        ...(extra.currentPeriodEnd ? { current_period_end: extra.currentPeriodEnd.toISOString() } : {}),
        ...(extra.cancelAtPeriodEnd !== undefined ? { cancel_at_period_end: extra.cancelAtPeriodEnd } : {}),
        ...(extra.canceledAt ? { canceled_at: extra.canceledAt.toISOString() } : {}),
        ...(extra.lastProcessedEventId ? { last_processed_event_id: extra.lastProcessedEventId } : {}),
      };
      const { error } = await client.from('subscriptions').update(update).eq('tenant_id', accountId);
      if (error) throw toPersistenceError('update subscription status', error);
    },
  };
}
