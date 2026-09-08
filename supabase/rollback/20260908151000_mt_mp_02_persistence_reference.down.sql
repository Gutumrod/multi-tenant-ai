-- DESTRUCTIVE DEVELOPMENT ROLLBACK ONLY.
-- Refuses to run unless the session explicitly opts in.

do $$
begin
  if current_setting('mt01.allow_destructive_rollback', true) is distinct from 'yes' then
    raise exception 'Refusing destructive MT01 rollback. SET mt01.allow_destructive_rollback = ''yes'' in this session first.';
  end if;
end;
$$;

drop schema if exists mt01 cascade;
drop schema if exists mt01_private cascade;
