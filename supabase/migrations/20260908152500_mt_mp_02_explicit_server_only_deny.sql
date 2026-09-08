begin;

create policy idempotency_keys_explicit_client_deny
on mt01.idempotency_keys
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create policy webhook_events_explicit_client_deny
on mt01.webhook_events
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

comment on policy idempotency_keys_explicit_client_deny on mt01.idempotency_keys
  is 'Defense in depth: server-only table. Client roles are denied even if grants change accidentally.';
comment on policy webhook_events_explicit_client_deny on mt01.webhook_events
  is 'Defense in depth: server-only table. Client roles are denied even if grants change accidentally.';

commit;
