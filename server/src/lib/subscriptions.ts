import {
  createMockSubscriptionRepository,
  createMockPlanRepository,
  createMockUsageCounterRepository,
} from '../../../modules/subscription/adapters/mock-repository.js';
import {
  createSubscriptionCore,
  type SubscriptionCore,
} from '../../../modules/subscription/core/service.js';
import type { Plan } from '../../../modules/subscription/core/types.js';
import type {
  PlanRepository,
  SubscriptionRepository,
  UsageCounterRepository,
} from '../../../modules/subscription/core/repository.js';
import { getPgPool } from './persistence/pg.js';
import { runMigrations } from './persistence/migrate.js';
import { createPostgresRepositories } from './persistence/pg-repositories.js';

// Feature keys for the paid resources this reference server consumes. The route
// inventory (docs/house-swarm-7/WU3-PAID-ROUTE-INVENTORY.md) maps each paid
// route to one of these.
export const AI_REQUESTS_PER_MONTH = 'ai_requests_per_month';
export const PAYMENTS_PER_MONTH = 'payments_per_month';

export const SEED_PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free Tier',
    billingInterval: 'month',
    priceMinorUnits: 0,
    currency: 'USD',
    entitlements: {
      ai_requests_per_month: 50,
      payments_per_month: 5,
    },
  },
  {
    id: 'pro',
    name: 'Pro Tier',
    billingInterval: 'month',
    priceMinorUnits: 2900,
    currency: 'USD',
    entitlements: {
      ai_requests_per_month: 1000,
      payments_per_month: 100,
    },
  },
];

const mockPlanRepo = createMockPlanRepository(SEED_PLANS);
const mockSubscriptionRepo = createMockSubscriptionRepository([]);
const mockUsageCounterRepo = createMockUsageCounterRepository([]);

const pool = getPgPool();
const pgRepositories = pool ? createPostgresRepositories(pool) : null;

// With DATABASE_URL set the reference server uses the real database (migrations
// are applied before the repositories are handed out). Without it the process
// keeps the in-memory repositories so hermetic unit tests and DB-less runs are
// unchanged. SEED_PLANS stays the seed definition for both paths; the migration
// set upserts the same two plans.
export const subscriptionCore: SubscriptionCore = createSubscriptionCore(
  pgRepositories ? pgRepositories.subscriptions : mockSubscriptionRepo,
  pgRepositories ? pgRepositories.plans : mockPlanRepo
);

// The durable usage counter behind the quota gate (server/src/lib/quota.ts):
// Postgres when DATABASE_URL is configured, in-memory otherwise. Both satisfy
// the UsageCounterRepository contract (modules/subscription/core/repository.ts).
export const usageCounterRepository: UsageCounterRepository = pgRepositories
  ? pgRepositories.usageCounters
  : mockUsageCounterRepo;

/**
 * Resolves the subscription repositories for this process, running pending
 * migrations first when a database is configured. Never awaited at module load
 * so that importing this module cannot hang or fail on a DB-less host.
 */
export async function initSubscriptionRepositories(): Promise<{
  subscriptionRepo: SubscriptionRepository;
  planRepo: PlanRepository;
  usageCounterRepo: UsageCounterRepository;
  persistent: boolean;
}> {
  if (!pool) {
    return {
      subscriptionRepo: mockSubscriptionRepo,
      planRepo: mockPlanRepo,
      usageCounterRepo: mockUsageCounterRepo,
      persistent: false,
    };
  }

  await runMigrations(pool);
  const repositories = createPostgresRepositories(pool);
  await Promise.all(SEED_PLANS.map((plan) => repositories.plans.save(plan)));

  return {
    subscriptionRepo: repositories.subscriptions,
    planRepo: repositories.plans,
    usageCounterRepo: repositories.usageCounters,
    persistent: true,
  };
}
