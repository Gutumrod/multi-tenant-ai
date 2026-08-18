import {
  createMockSubscriptionRepository,
  createMockPlanRepository,
} from '../../../modules/subscription/adapters/mock-repository.js';
import {
  createSubscriptionCore,
  type SubscriptionCore,
} from '../../../modules/subscription/core/service.js';
import type { Plan } from '../../../modules/subscription/core/types.js';

export const SEED_PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free Tier',
    billingInterval: 'month',
    priceMinorUnits: 0,
    currency: 'USD',
    entitlements: {
      ai_requests_per_month: 50,
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
    },
  },
];

const mockPlanRepo = createMockPlanRepository(SEED_PLANS);
const mockSubscriptionRepo = createMockSubscriptionRepository([]);

export const subscriptionCore: SubscriptionCore = createSubscriptionCore(
  mockSubscriptionRepo,
  mockPlanRepo
);
