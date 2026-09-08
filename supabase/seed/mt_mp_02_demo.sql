-- MT01 DEMO/LOCAL FIXTURE ONLY. Never run as a production bootstrap.
-- Production migrations intentionally create no tenant, membership, subscription,
-- webhook, or idempotency records.

insert into mt01.plans (
  id, name, billing_interval, price_minor_units, currency, entitlements, active
)
values
  ('free', 'Free Tier', 'month', 0, 'USD', '{"ai_requests_per_month":50}'::jsonb, true),
  ('pro', 'Pro Tier', 'month', 2900, 'USD', '{"ai_requests_per_month":1000}'::jsonb, true)
on conflict (id) do update
set name = excluded.name,
    billing_interval = excluded.billing_interval,
    price_minor_units = excluded.price_minor_units,
    currency = excluded.currency,
    entitlements = excluded.entitlements,
    active = excluded.active;
