import { Plan, Subscription, SubscriptionStatus } from '../core/index.js';
import { PlanRepository, SubscriptionRepository, UsageCounterRepository } from '../core/index.js';

export function createMockSubscriptionRepository(initialSubs: Subscription[] = []): SubscriptionRepository {
  const store = new Map<string, Subscription>();
  const processedEventIds = new Set<string>();
  for (const s of initialSubs) {
    store.set(s.accountId, { ...s });
    if (s.lastProcessedEventId) processedEventIds.add(s.lastProcessedEventId);
  }

  return {
    async getByAccountId(accountId: string): Promise<Subscription | null> {
      const subscription = store.get(accountId);
      return subscription ? { ...subscription } : null;
    },
    async save(subscription: Subscription): Promise<void> {
      store.set(subscription.accountId, { ...subscription });
    },
    async saveForBillingEvent(subscription: Subscription, eventId: string): Promise<boolean> {
      if (processedEventIds.has(eventId)) return false;
      processedEventIds.add(eventId);
      store.set(subscription.accountId, { ...subscription });
      return true;
    },
    async updateStatus(accountId: string, status: SubscriptionStatus, extra?: Partial<Subscription>): Promise<void> {
      const existing = store.get(accountId);
      if (existing) {
        store.set(accountId, { ...existing, status, ...extra });
      }
    },
  };
}

export function createMockPlanRepository(initialPlans: Plan[] = []): PlanRepository {
  const store = new Map<string, Plan>();
  for (const p of initialPlans) {
    store.set(p.id, { ...p });
  }

  return {
    async getById(planId: string): Promise<Plan | null> {
      return store.get(planId) || null;
    },
    async listAll(): Promise<Plan[]> {
      return Array.from(store.values());
    },
    async save(plan: Plan): Promise<void> {
      store.set(plan.id, { ...plan });
    },
  };
}

/**
 * In-memory UsageCounterRepository (WU-3 local addition).
 *
 * Keeps the module's hermetic suite and any DB-less run working: the durable
 * contract is implemented here by a Map keyed exactly like the database's
 * primary key. Node is single-threaded, so a Map read-modify-write is already
 * atomic with respect to other async work — this is the in-memory stand-in for
 * the single-statement upsert, not a second algorithm.
 */
export function createMockUsageCounterRepository(
  initial: Array<{ accountId: string; featureKey: string; periodStart: Date; usageCount: number }> = []
): UsageCounterRepository {
  const store = new Map<string, number>();
  const key = (accountId: string, featureKey: string, periodStart: Date): string =>
    `${accountId}\u0000${featureKey}\u0000${periodStart.toISOString()}`;

  for (const entry of initial) {
    store.set(key(entry.accountId, entry.featureKey, entry.periodStart), entry.usageCount);
  }

  return {
    async getUsage(accountId: string, featureKey: string, periodStart: Date): Promise<number> {
      return store.get(key(accountId, featureKey, periodStart)) ?? 0;
    },
    async increment(
      accountId: string,
      featureKey: string,
      periodStart: Date,
      by: number = 1
    ): Promise<number> {
      const k = key(accountId, featureKey, periodStart);
      const next = (store.get(k) ?? 0) + by;
      store.set(k, next);
      return next;
    },
    async decrement(
      accountId: string,
      featureKey: string,
      periodStart: Date,
      by: number = 1
    ): Promise<number> {
      const k = key(accountId, featureKey, periodStart);
      // Never below zero, mirroring the database's CHECK (usage_count >= 0).
      const next = Math.max(0, (store.get(k) ?? 0) - by);
      store.set(k, next);
      return next;
    },
  };
}
