-- Leaving a room removes the player. Host handoff is allowed only from leave_room.
-- Catches are valid only after the head start, during hunting.

create or replace function public.players_prevent_cheat_update()
returns trigger
language plpgsql
set search_path to public
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'cannot change user_id';
  end if;
  if new.room_id is distinct from old.room_id then
    raise exception 'cannot change room_id';
  end if;
  if new.is_host is distinct from old.is_host
     and current_setting('manhunt.allow_host_change', true) is distinct from 'on' then
    raise exception 'cannot change is_host';
  end if;
  if new.role is distinct from old.role
     and not (select rolbypassrls from pg_roles where rolname = current_user) then
    if current_setting('manhunt.allow_role_change', true) is distinct from 'on' then
      raise exception 'role changes only via catch/start RPCs';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.rooms_prevent_host_steal()
returns trigger
language plpgsql
set search_path to public
as $$
begin
  if new.host_id is distinct from old.host_id
     and current_setting('manhunt.allow_host_change', true) is distinct from 'on' then
    raise exception 'cannot change host_id';
  end if;
  if new.code is distinct from old.code then
    raise exception 'cannot change room code';
  end if;
  return new;
end;
$$;

create or replace function public.catch_player(
  p_room_id uuid,
  p_target_player_id uuid,
  p_catch_secret text
)
returns players
language plpgsql
security definer
set search_path to public
as $$
declare
  hunter public.players;
  target public.players;
  secret text;
  r public.rooms;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into r from public.rooms where id = p_room_id;
  if r.id is null then
    raise exception 'room not found';
  end if;
  if r.phase <> 'hunting' then
    raise exception 'catch only during hunting';
  end if;

  select * into hunter from public.players
  where room_id = p_room_id and user_id = auth.uid();
  if hunter.id is null or hunter.role <> 'hunter' then
    raise exception 'only hunters can catch';
  end if;

  select * into target from public.players
  where id = p_target_player_id and room_id = p_room_id;
  if target.id is null then
    raise exception 'target not found';
  end if;
  if target.role <> 'hider' then
    raise exception 'target already a hunter';
  end if;

  select catch_secret into secret
  from public.player_secrets
  where player_id = p_target_player_id;

  if secret is null or secret <> p_catch_secret then
    raise exception 'invalid catch secret';
  end if;

  perform set_config('manhunt.allow_role_change', 'on', true);

  update public.players
  set role = 'hunter'
  where id = target.id
  returning * into target;

  if not exists (
    select 1 from public.players
    where room_id = p_room_id and role = 'hider'
  ) then
    update public.rooms set phase = 'ended' where id = p_room_id;
  end if;

  return target;
end;
$$;

create or replace function public.leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path to public
as $$
declare
  me public.players;
  r public.rooms;
  next_host public.players;
  hiders_left int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into me from public.players
  where room_id = p_room_id and user_id = auth.uid();
  if me.id is null then
    return;
  end if;

  select * into r from public.rooms where id = p_room_id;
  if r.id is null then
    return;
  end if;

  perform set_config('manhunt.allow_host_change', 'on', true);

  delete from public.players where id = me.id;

  if not exists (select 1 from public.players where room_id = p_room_id) then
    delete from public.rooms where id = p_room_id;
    return;
  end if;

  if me.is_host then
    select * into next_host from public.players
    where room_id = p_room_id
    order by joined_at asc
    limit 1;

    update public.players set is_host = true where id = next_host.id;
    update public.rooms set host_id = next_host.user_id where id = p_room_id;
  end if;

  if r.phase in ('hiding', 'hunting') then
    select count(*) into hiders_left from public.players
    where room_id = p_room_id and role = 'hider';
    if hiders_left = 0 then
      update public.rooms set phase = 'ended' where id = p_room_id;
    end if;
  end if;
end;
$$;
