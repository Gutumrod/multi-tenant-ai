-- 0001_persistence.sql — MT01 persistence layer (HOUSE-SWARM-7 WU-2)
--
-- Versioned, re-runnable DDL for the reference server's real-database path:
-- tenant, plan and subscription storage plus the durable billing-event
-- idempotency ledger.
--
-- Every statement in this file is safe to run more than once
-- (CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS / ON CONFLICT
-- upsert). Version bookkeeping is the runner's job
-- (server/src/lib/persistence/migrate.ts), which records this file's version in
-- schema_migrations inside the same transaction.

-- ---------------------------------------------------------------------------
-- Migration bookkeeping
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     text PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Tenants (mirrors modules/tenant-context TenantInfo)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id          text PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  tier        text NOT NULL DEFAULT 'free',
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_tier_check CHECK (tier IN ('free', 'pro', 'enterprise'))
);

CREATE INDEX IF NOT EXISTS tenants_slug_idx ON tenants (slug);

-- ---------------------------------------------------------------------------
-- Plans (mirrors modules/subscription/core/types.ts Plan)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plans (
  id                  text PRIMARY KEY,
  name                text NOT NULL,
  billing_interval    text,
  price_minor_units   integer,
  currency            text,
  entitlements        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plans_billing_interval_check
    CHECK (billing_interval IS NULL OR billing_interval IN ('month', 'year'))
);

-- ---------------------------------------------------------------------------
-- Subscriptions (mirrors modules/subscription/core/types.ts Subscription;
-- the repository contract addresses a subscription by accountId)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id                        text PRIMARY KEY,
  account_id                text NOT NULL UNIQUE,
  tenant_id                 text REFERENCES tenants (id) ON DELETE SET NULL,
  plan_id                   text NOT NULL REFERENCES plans (id),
  status                    text NOT NULL,
  current_period_start      timestamptz NOT NULL,
  current_period_end        timestamptz NOT NULL,
  trial_end                 timestamptz,
  grace_period_end          timestamptz,
  cancel_at_period_end      boolean NOT NULL DEFAULT false,
  canceled_at               timestamptz,
  metadata                  jsonb,
  last_processed_event_id   text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_status_check CHECK (
    status IN (
      'trialing',
      'active',
      'past_due',
      'grace_period',
      'cancel_at_period_end',
      'cancelled',
      'expired'
    )
  )
);

CREATE INDEX IF NOT EXISTS subscriptions_account_id_idx ON subscriptions (account_id);
CREATE INDEX IF NOT EXISTS subscriptions_tenant_id_idx ON subscriptions (tenant_id);

-- ---------------------------------------------------------------------------
-- Durable billing-event idempotency ledger.
-- event_id is the primary key: claiming an event id twice is impossible, so a
-- replayed billing event mutates subscription state at most once even across
-- process restarts.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing_event_ledger (
  event_id         text PRIMARY KEY,
  account_id       text NOT NULL,
  event_type       text,
  subscription_id  text,
  claimed_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_event_ledger_account_id_idx
  ON billing_event_ledger (account_id);

-- ---------------------------------------------------------------------------
-- Seed plans (idempotent upsert; values match SEED_PLANS in
-- server/src/lib/subscriptions.ts)
-- ---------------------------------------------------------------------------
INSERT INTO plans (id, name, billing_interval, price_minor_units, currency, entitlements)
VALUES
  (
    'free',
    'Free Tier',
    'month',
    0,
    'USD',
    '{"ai_requests_per_month": 50}'::jsonb
  ),
  (
    'pro',
    'Pro Tier',
    'month',
    2900,
    'USD',
    '{"ai_requests_per_month": 1000}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  name              = EXCLUDED.name,
  billing_interval  = EXCLUDED.billing_interval,
  price_minor_units = EXCLUDED.price_minor_units,
  currency          = EXCLUDED.currency,
  entitlements      = EXCLUDED.entitlements,
  updated_at        = now();
