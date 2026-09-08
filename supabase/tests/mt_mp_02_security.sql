-- MT-MP-02 database security assertions. Raises on the first invariant breach.

do $$
declare
  expected_tables text[] := array[
    'tenants','memberships','plans','subscriptions','idempotency_keys','webhook_events'
  ];
  client_read_tables text[] := array['tenants','memberships','plans','subscriptions'];
  table_name text;
begin
  if to_regnamespace('mt01') is null or to_regnamespace('mt01_private') is null then
    raise exception 'MT01 schemas are missing';
  end if;

  foreach table_name in array expected_tables loop
    if to_regclass(format('mt01.%I', table_name)) is null then
      raise exception 'Missing table mt01.%', table_name;
    end if;

    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'mt01' and c.relname = table_name
        and c.relrowsecurity and c.relforcerowsecurity
    ) then
      raise exception 'RLS/FORCE RLS missing on mt01.%', table_name;
    end if;

    if has_table_privilege('anon', format('mt01.%I', table_name), 'SELECT')
       or has_table_privilege('anon', format('mt01.%I', table_name), 'INSERT')
       or has_table_privilege('anon', format('mt01.%I', table_name), 'UPDATE')
       or has_table_privilege('anon', format('mt01.%I', table_name), 'DELETE') then
      raise exception 'anon unexpectedly has privileges on mt01.%', table_name;
    end if;

    if has_table_privilege('authenticated', format('mt01.%I', table_name), 'INSERT')
       or has_table_privilege('authenticated', format('mt01.%I', table_name), 'UPDATE')
       or has_table_privilege('authenticated', format('mt01.%I', table_name), 'DELETE') then
      raise exception 'authenticated unexpectedly has write privileges on mt01.%', table_name;
    end if;
  end loop;

  foreach table_name in array client_read_tables loop
    if not has_table_privilege('authenticated', format('mt01.%I', table_name), 'SELECT') then
      raise exception 'authenticated SELECT grant missing on mt01.%', table_name;
    end if;
  end loop;

  if has_table_privilege('authenticated', 'mt01.idempotency_keys', 'SELECT')
     or has_table_privilege('authenticated', 'mt01.webhook_events', 'SELECT') then
    raise exception 'server-only tables are exposed to authenticated';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'mt01_private'
      and p.proname = 'is_active_member'
      and p.prosecdef
      and 'search_path=""' = any(p.proconfig)
  ) then
    raise exception 'is_active_member must be SECURITY DEFINER with empty search_path';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'mt01' and tablename = 'tenants'
      and policyname = 'tenants_select_for_members'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'mt01' and tablename = 'memberships'
      and policyname = 'memberships_select_self_or_admin'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'mt01' and tablename = 'subscriptions'
      and policyname = 'subscriptions_select_for_members'
  ) then
    raise exception 'required tenant-scoped RLS policies are missing';
  end if;

  if not has_table_privilege('service_role', 'mt01.webhook_events', 'INSERT,SELECT,UPDATE')
     or not has_table_privilege('service_role', 'mt01.idempotency_keys', 'INSERT,SELECT,UPDATE') then
    raise exception 'service_role server persistence grants missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'mt01' and tablename = 'idempotency_keys'
      and policyname = 'idempotency_keys_explicit_client_deny'
      and permissive = 'RESTRICTIVE'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'mt01' and tablename = 'webhook_events'
      and policyname = 'webhook_events_explicit_client_deny'
      and permissive = 'RESTRICTIVE'
  ) then
    raise exception 'explicit restrictive deny policies are missing';
  end if;

  if has_function_privilege('anon', 'mt01.claim_idempotency_key(text,text,uuid,integer,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'mt01.claim_idempotency_key(text,text,uuid,integer,text)', 'EXECUTE')
     or has_function_privilege('anon', 'mt01.claim_webhook_event(text,text,text,uuid,text,timestamptz)', 'EXECUTE')
     or has_function_privilege('authenticated', 'mt01.claim_webhook_event(text,text,text,uuid,text,timestamptz)', 'EXECUTE') then
    raise exception 'atomic claim RPCs are executable by client roles';
  end if;

  if not has_function_privilege('service_role', 'mt01.claim_idempotency_key(text,text,uuid,integer,text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'mt01.claim_webhook_event(text,text,text,uuid,text,timestamptz)', 'EXECUTE') then
    raise exception 'service_role atomic claim RPC execute grants missing';
  end if;
end;
$$;

select 'MT-MP-02 database security assertions PASS' as result;
