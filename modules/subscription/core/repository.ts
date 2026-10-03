import { Plan, Subscription, SubscriptionStatus } from './types.js';

export interface SubscriptionRepository {
  getByAccountId(accountId: string): Promise<Subscription | null>;
  save(subscription: Subscription): Promise<void>;
  /**
   * Atomically persist the subscription and claim eventId in a durable
   * idempotency ledger. Returns false when the event was already claimed.
   */
  saveForBillingEvent(subscription: Subscription, eventId: string): Promise<boolean>;
  updateStatus(accountId: string, status: SubscriptionStatus, extra?: Partial<Subscription>): Promise<void>;
}

export interface PlanRepository {
  getById(planId: string): Promise<Plan | null>;
  listAll(): Promise<Plan[]>;
  save(plan: Plan): Promise<void>;
}

/**
 * Durable paid-resource usage counters (HOUSE-SWARM-7 WU-3 — a LOCAL addition to
 * this module contract, NOT part of upstream modules-hub; see
 * PROVENANCE-WU3.md).
 *
 * One counter per (accountId, featureKey, periodStart). `periodStart` is the
 * start of the billing period the counter belongs to, so each period starts at
 * zero without any reset job.
 *
 * `increment`/`decrement` MUST be single atomic statements on a durable store.
 * Finite quota enforcement MUST use `tryIncrementWithinLimit`, which combines
 * the limit check and increment in the same atomic store operation so concurrent
 * callers cannot over-consume the final unit.
 * Implementations MUST NOT let the counter go below zero.
 */
export interface UsageCounterRepository {
  getUsage(accountId: string, featureKey: string, periodStart: Date): Promise<number>;
  increment(accountId: string, featureKey: string, periodStart: Date, by?: number): Promise<number>;
  /** Returns the post-consume count, or null when the requested increment would exceed limit. */
  tryIncrementWithinLimit(
    accountId: string,
    featureKey: string,
    periodStart: Date,
    limit: number,
    by?: number
  ): Promise<number | null>;
  decrement(accountId: string, featureKey: string, periodStart: Date, by?: number): Promise<number>;
}
