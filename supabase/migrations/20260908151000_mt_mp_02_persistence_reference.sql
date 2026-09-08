begin;

create schema if not exists mt01;
create schema if not exists mt01_private;

revoke all on schema mt01 from public, anon, authenticated;
revoke all on schema mt01_private from public, anon, authenticated;
grant usage on schema mt01 to authenticated, service_role;
grant usage on schema mt01_private to authenticated, service_role;

create table mt01.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint tenants_slug_format check (
    slug = lower(slug)
    and char_length(slug) between 3 and 63
    and slug ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])$'
  ),
  constraint tenants_name_nonempty check (char_length(btrim(name)) between 1 and 120)
);

create table mt01.memberships (
  tenant_id uuid not null references mt01.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id),
  constraint memberships_role_allowed check (role in ('owner', 'admin', 'member'))
);
create table mt01.plans (
  id text primary key,
  name text not null,
  billing_interval text,
  price_minor_units bigint,
  currency text,
  entitlements jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plans_id_nonempty check (char_length(btrim(id)) between 1 and 80),
  constraint plans_name_nonempty check (char_length(btrim(name)) between 1 and 120),
  constraint plans_interval_allowed check (billing_interval is null or billing_interval in ('month', 'year')),
  constraint plans_price_nonnegative check (price_minor_units is null or price_minor_units >= 0),
  constraint plans_currency_format check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint plans_entitlements_object check (jsonb_typeof(entitlements) = 'object')
);

create table mt01.subscriptions (
  id text primary key,
  tenant_id uuid not null unique references mt01.tenants(id) on delete restrict,
  plan_id text not null references mt01.plans(id) on delete restrict,
  status text not null,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  last_processed_event_id text,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_id_nonempty check (char_length(btrim(id)) between 1 and 160),
  constraint subscriptions_status_allowed check (status in ('trialing','active','past_due','grace_period','cancel_at_period_end','cancelled','expired')),
  constraint subscriptions_period_order check (current_period_end >= current_period_start),
  constraint subscriptions_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create unique index subscriptions_provider_reference_unique
  on mt01.subscriptions(provider, provider_subscription_id)
  where provider is not null and provider_subscription_id is not null;
create table mt01.idempotency_keys (
  scope text not null,
  idempotency_key text not null,
  tenant_id uuid references mt01.tenants(id) on delete restrict,
  request_hash text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  primary key (scope, idempotency_key),
  constraint idempotency_scope_nonempty check (char_length(btrim(scope)) between 1 and 80),
  constraint idempotency_key_nonempty check (char_length(btrim(idempotency_key)) between 1 and 255),
  constraint idempotency_hash_format check (request_hash is null or request_hash ~ '^[0-9a-f]{64}$'),
  constraint idempotency_expiry_order check (expires_at is null or expires_at > created_at)
);

create index idempotency_keys_expiry_idx on mt01.idempotency_keys(expires_at)
  where expires_at is not null;

create table mt01.webhook_events (
  provider text not null,
  provider_event_id text not null,
  event_type text,
  tenant_id uuid references mt01.tenants(id) on delete set null,
  payload_hash text,
  status text not null default 'claimed',
  event_created_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  failure_code text,
  primary key (provider, provider_event_id),
  constraint webhook_provider_nonempty check (char_length(btrim(provider)) between 1 and 80),
  constraint webhook_event_id_nonempty check (char_length(btrim(provider_event_id)) between 1 and 255),
  constraint webhook_payload_hash_format check (payload_hash is null or payload_hash ~ '^[0-9a-f]{64}$'),
  constraint webhook_status_allowed check (status in ('claimed','processed','failed','ignored')),
  constraint webhook_processed_order check (processed_at is null or processed_at >= received_at)
);

create index webhook_events_tenant_received_idx on mt01.webhook_events(tenant_id, received_at desc);
create index webhook_events_status_received_idx on mt01.webhook_events(status, received_at);

create or replace function mt01_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger tenants_set_updated_at
before update on mt01.tenants
for each row execute function mt01_private.set_updated_at();

create trigger memberships_set_updated_at
before update on mt01.memberships
for each row execute function mt01_private.set_updated_at();

create trigger plans_set_updated_at
before update on mt01.plans
for each row execute function mt01_private.set_updated_at();

create trigger subscriptions_set_updated_at
before update on mt01.subscriptions
for each row execute function mt01_private.set_updated_at();

create or replace function mt01_private.is_active_member(
  target_tenant_id uuid,
  allowed_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from mt01.memberships m
    where m.tenant_id = target_tenant_id
      and m.user_id = (select auth.uid())
      and m.active
      and (allowed_roles is null or m.role = any(allowed_roles))
  );
$$;

revoke all on function mt01_private.set_updated_at() from public, anon, authenticated;
revoke all on function mt01_private.is_active_member(uuid, text[]) from public, anon, authenticated;
grant execute on function mt01_private.is_active_member(uuid, text[]) to authenticated;

alter table mt01.tenants enable row level security;
alter table mt01.memberships enable row level security;
alter table mt01.plans enable row level security;
alter table mt01.subscriptions enable row level security;
alter table mt01.idempotency_keys enable row level security;
alter table mt01.webhook_events enable row level security;

alter table mt01.tenants force row level security;
alter table mt01.memberships force row level security;
alter table mt01.plans force row level security;
alter table mt01.subscriptions force row level security;
alter table mt01.idempotency_keys force row level security;
alter table mt01.webhook_events force row level security;
create policy tenants_select_for_members
on mt01.tenants
for select
to authenticated
using (
  deleted_at is null
  and mt01_private.is_active_member(id)
);

create policy memberships_select_self_or_admin
on mt01.memberships
for select
to authenticated
using (
  user_id = (select auth.uid())
  or mt01_private.is_active_member(tenant_id, array['owner','admin']::text[])
);

create policy plans_select_active
on mt01.plans
for select
to authenticated
using (active);

create policy subscriptions_select_for_members
on mt01.subscriptions
for select
to authenticated
using (mt01_private.is_active_member(tenant_id));

revoke all on all tables in schema mt01 from public, anon, authenticated;
grant select on mt01.tenants, mt01.memberships, mt01.plans, mt01.subscriptions to authenticated;
grant all on all tables in schema mt01 to service_role;
grant usage, select on all sequences in schema mt01 to service_role;

alter default privileges in schema mt01 revoke all on tables from public, anon, authenticated;
alter default privileges in schema mt01 revoke all on sequences from public, anon, authenticated;
alter default privileges in schema mt01 revoke execute on functions from public, anon, authenticated;
alter default privileges in schema mt01 grant all on tables to service_role;
alter default privileges in schema mt01 grant usage, select on sequences to service_role;

comment on schema mt01 is 'MT01 buyer-facing persistence reference. Authenticated access is read-only and RLS-scoped; mutations are server-owned until lifecycle phases add explicit policies.';
comment on table mt01.idempotency_keys is 'Server-only persistent idempotency claims. No anon/authenticated grants.';
comment on table mt01.webhook_events is 'Server-only provider event claims/audit state. Store hashes and normalized metadata; avoid raw secrets.';

commit;