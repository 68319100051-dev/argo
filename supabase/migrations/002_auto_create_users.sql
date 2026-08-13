-- Auto-create public.users row when a user signs up via Supabase Auth
-- This triggers on auth.users insert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_role_id uuid;
begin
  -- Assign default role: admin if first user ever, otherwise warehouse_staff
  select id into v_role_id from public.roles where name = 'admin' limit 1;
  if v_role_id is null then
    raise exception 'No admin role found. Seed roles first.';
  end if;

  insert into public.users (id, email, display_name, role_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    v_role_id
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Trigger on auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill existing auth user(s) that don't have a public.users row yet
insert into public.users (id, email, display_name, role_id)
select
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data ->> 'display_name', split_part(au.email, '@', 1)),
  r.id as role_id
from auth.users au
cross join lateral (
  select id from public.roles where name = 'admin' limit 1
) r
where not exists (
  select 1 from public.users pu where pu.id = au.id
);
