-- Fix default role assignment: first user ever becomes admin, subsequent users become warehouse_staff
-- (Previous version assigned 'admin' to every new user regardless of user count)

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_role_id uuid;
begin
  select r.id into v_role_id
  from public.roles r
  where r.name = case
    when (select count(*) from public.users) = 0 then 'admin'
    else 'warehouse_staff'
  end
  limit 1;

  if v_role_id is null then
    raise exception 'No matching role found. Seed roles first.';
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
