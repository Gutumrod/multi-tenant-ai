begin;

create or replace function mt01.claim_idempotency_key(
  p_scope text,
  p_key text,
  p_tenant_id uuid default null,
  p_ttl_seconds integer default null,
  p_request_hash text default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed boolean := false;
begin
  if p_ttl_seconds is not null and p_ttl_seconds <= 0 then
    raise exception 'ttl must be positive';
  end if;

  insert into mt01.idempotency_keys (
    scope, idempotency_key, tenant_id, request_hash, created_at, expires_at
  ) values (
    p_scope, p_key, p_tenant_id, p_request_hash, now(),
    case when p_ttl_seconds is null then null
         else now() + make_interval(secs => p_ttl_seconds) end
  )
  on conflict (scope, idempotency_key) do update
    set tenant_id = excluded.tenant_id,
        request_hash = excluded.request_hash,
        created_at = excluded.created_at,
        expires_at = excluded.expires_at
    where mt01.idempotency_keys.expires_at is not null
      and mt01.idempotency_keys.expires_at <= now()
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

revoke all on function mt01.claim_idempotency_key(text,text,uuid,integer,text)
  from public, anon, authenticated;
grant execute on function mt01.claim_idempotency_key(text,text,uuid,integer,text)
  to service_role;

create or replace function mt01.claim_webhook_event(
  p_provider text,
  p_event_id text,
  p_event_type text default null,
  p_tenant_id uuid default null,
  p_payload_hash text default null,
  p_event_created_at timestamptz default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed boolean := false;
begin
  insert into mt01.webhook_events (
    provider, provider_event_id, event_type, tenant_id,
    payload_hash, event_created_at, status
  ) values (
    p_provider, p_event_id, p_event_type, p_tenant_id,
    p_payload_hash, p_event_created_at, 'claimed'
  )
  on conflict (provider, provider_event_id) do nothing
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

revoke all on function mt01.claim_webhook_event(text,text,text,uuid,text,timestamptz)
  from public, anon, authenticated;
grant execute on function mt01.claim_webhook_event(text,text,text,uuid,text,timestamptz)
  to service_role;

commit;
