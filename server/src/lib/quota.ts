/**
 * The single authoritative paid-resource quota gate (HOUSE-SWARM-7 WU-3).
 *
 * Every route that consumes something that costs money calls
 * `assertAndConsumeQuota` BEFORE it reaches the paid call, and calls
 * `releaseQuota` when that paid call fails, so a failed downstream call can
 * never burn a unit of quota.
 *
 * Decision rule (fails closed):
 *   - no subscription row for the account        -> NO_SUBSCRIPTION
 *   - subscription present but no entitlement,
 *     or an entitlement limit of 0               -> FEATURE_NOT_ENTITLED
 *   - usage already at/above the limit           -> QUOTA_EXCEEDED
 *   - `null` limit with an entitlement present   -> unlimited (consume, allow)
 *
 * Finite quota consumption is a single atomic compare-and-consume operation in
 * the repository (`tryIncrementWithinLimit`). The limit check and increment are
 * therefore one store operation: concurrent callers racing for the final unit
 * cannot all pass a stale read. Unlimited quotas still use the ordinary atomic
 * increment path.
 *
 * Local, MT01-side addition: this file is NOT part of upstream modules-hub (see
 * modules/subscription/PROVENANCE-WU3.md).
 */
import { subscriptionCore, usageCounterRepository } from './subscriptions.js';
import type { SubscriptionCore } from '../../../modules/subscription/core/service.js';
import type { Subscription } from '../../../modules/subscription/core/types.js';
import type { UsageCounterRepository } from '../../../modules/subscription/core/repository.js';

export type QuotaRefusalReason = 'NO_SUBSCRIPTION' | 'FEATURE_NOT_ENTITLED' | 'QUOTA_EXCEEDED';

export type QuotaConsumeDecision = {
  allowed: true;
  accountId: string;
  featureKey: string;
  periodStart: Date;
  usage: number;
  limit: number | null;
};

export type QuotaRefusalDecision = {
  allowed: false;
  reason: QuotaRefusalReason;
  accountId: string;
  featureKey: string;
  periodStart: Date;
  usage: number;
  limit: number;
};

export type QuotaDecision = QuotaConsumeDecision | QuotaRefusalDecision;

export type AssertAndConsumeQuotaParams = {
  accountId: string;
  featureKey: string;
  /** Injected clock; defaults to now. Used to pick the counter's period. */
  now?: Date;
};

export interface QuotaGate {
  /**
   * Decide + consume in one call. Never consumes when it refuses.
   */
  assertAndConsumeQuota(params: AssertAndConsumeQuotaParams): Promise<QuotaDecision>;
  /**
   * Give a previously consumed unit back (rollback path). Returns the counter
   * value after the release.
   */
  releaseQuota(params: AssertAndConsumeQuotaParams): Promise<number>;
}

/** Deps of the gate; the real SubscriptionCore and the usage-counter repo satisfy them. */
export interface QuotaGateDeps {
  subscriptions: Pick<
    SubscriptionCore,
    'canUseFeature' | 'getLimit' | 'checkUsage' | 'getSubscription'
  >;
  usageCounters: UsageCounterRepository;
}

export type QuotaRefusalResponse = {
  status: 402 | 429;
  body: {
    error: string;
    code: 'QUOTA_NOT_ENTITLED' | 'QUOTA_EXCEEDED';
    featureKey: string;
    limit: number;
    usage?: number;
  };
};

/**
 * Maps a refusal decision to the one documented HTTP shape every paid route
 * uses, so /ai/demo and /payment/demo-charge cannot drift apart:
 *   no subscription or no entitlement -> 402 QUOTA_NOT_ENTITLED
 *   at/over the limit                 -> 429 QUOTA_EXCEEDED
 */
export function quotaRefusalResponse(refusal: QuotaRefusalDecision): QuotaRefusalResponse {
  if (refusal.reason === 'QUOTA_EXCEEDED') {
    return {
      status: 429,
      body: {
        error: `Monthly quota exceeded for ${refusal.featureKey}`,
        code: 'QUOTA_EXCEEDED',
        featureKey: refusal.featureKey,
        limit: refusal.limit,
        usage: refusal.usage,
      },
    };
  }

  return {
    status: 402,
    body: {
      error:
        refusal.reason === 'NO_SUBSCRIPTION'
          ? `No active subscription for this account (feature ${refusal.featureKey})`
          : `The current plan does not include ${refusal.featureKey}`,
      code: 'QUOTA_NOT_ENTITLED',
      featureKey: refusal.featureKey,
      limit: refusal.limit,
    },
  };
}

/**
 * First instant of the UTC calendar month containing `now`. Used only when the
 * account has no subscription whose billing period covers `now` (i.e. on the
 * refusal paths), so the month key can never diverge from a real billing period.
 */
export function utcMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

/**
 * The counter period for an account: the subscription's own billing-period start
 * while `now` falls inside that period, otherwise the UTC month start. Deriving
 * it from the subscription (not from `now`) keeps the key stable across calls
 * within one period, so consume and release always address the same counter row.
 */
export function resolveQuotaPeriodStart(subscription: Subscription | null, now: Date): Date {
  const start = subscription?.currentPeriodStart;
  const end = subscription?.currentPeriodEnd;
  if (
    start instanceof Date &&
    Number.isFinite(start.getTime()) &&
    start.getTime() <= now.getTime() &&
    end instanceof Date &&
    Number.isFinite(end.getTime()) &&
    end.getTime() > now.getTime()
  ) {
    return start;
  }
  return utcMonthStart(now);
}

export function createQuotaGate(deps: QuotaGateDeps): QuotaGate {
  const { subscriptions, usageCounters } = deps;

  async function periodStartFor(accountId: string, now: Date): Promise<Date> {
    const subscription = await subscriptions.getSubscription(accountId);
    return resolveQuotaPeriodStart(subscription, now);
  }

  return {
    async assertAndConsumeQuota(
      params: AssertAndConsumeQuotaParams
    ): Promise<QuotaDecision> {
      const { accountId, featureKey } = params;
      const now = params.now ?? new Date();

      const subscription = await subscriptions.getSubscription(accountId);
      const periodStart = resolveQuotaPeriodStart(subscription, now);
      const usage = await usageCounters.getUsage(accountId, featureKey, periodStart);

      const base = { accountId, featureKey, periodStart, usage };

      // Fail closed: without a subscription row there is no plan to read an
      // entitlement from, so there is nothing to allow.
      if (!subscription) {
        return { allowed: false, reason: 'NO_SUBSCRIPTION', limit: 0, ...base };
      }

      const entitled = await subscriptions.canUseFeature(accountId, featureKey);
      const limit = await subscriptions.getLimit(accountId, featureKey);

      // Fail closed: no entitlement, or an entitlement that resolves to a limit
      // of 0, is a refusal rather than an unlimited allowance.
      if (!entitled || limit === 0) {
        return { allowed: false, reason: 'FEATURE_NOT_ENTITLED', limit: limit ?? 0, ...base };
      }

      if (limit === null) {
        const consumed = await usageCounters.increment(accountId, featureKey, periodStart);
        return { allowed: true, accountId, featureKey, periodStart, usage: consumed, limit: null };
      }

      const consumed = await usageCounters.tryIncrementWithinLimit(
        accountId,
        featureKey,
        periodStart,
        limit
      );
      if (consumed === null) {
        // Re-read only to report the authoritative current value. The decision
        // itself was already made atomically by tryIncrementWithinLimit.
        const currentUsage = await usageCounters.getUsage(accountId, featureKey, periodStart);
        return {
          allowed: false,
          reason: 'QUOTA_EXCEEDED',
          accountId,
          featureKey,
          periodStart,
          usage: currentUsage,
          limit,
        };
      }

      return { allowed: true, accountId, featureKey, periodStart, usage: consumed, limit };
    },

    async releaseQuota(params: AssertAndConsumeQuotaParams): Promise<number> {
      const now = params.now ?? new Date();
      const periodStart = await periodStartFor(params.accountId, now);
      return usageCounters.decrement(params.accountId, params.featureKey, periodStart);
    },
  };
}

/**
 * The process-wide gate used by the routes: the real subscription core
 * (Postgres when DATABASE_URL is set, in-memory otherwise) plus the matching
 * usage-counter repository.
 */
export const quotaGate: QuotaGate = createQuotaGate({
  subscriptions: subscriptionCore,
  usageCounters: usageCounterRepository,
});
