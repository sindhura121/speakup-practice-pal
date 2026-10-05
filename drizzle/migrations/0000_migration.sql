
create table public.profiles (
  id uuid primary key,
  display_name text not null default 'Speaker',
  avatar_color text not null default 'coral',
  level text not null default 'intermediate',
  xp integer not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by signed-in" on public.profiles for select to authenticated using (true);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  mode text not null,
  prompt text not null,
  config jsonb not null default '{}'::jsonb,
  duration_sec integer not null default 0,
  overall_score integer,
  scores jsonb not null default '{}'::jsonb,
  feedback jsonb not null default '{}'::jsonb,
  transcript text,
  recording_path text,
  attempt_of uuid references public.practice_sessions(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.practice_sessions (user_id, created_at desc);
grant select, insert, update, delete on public.practice_sessions to authenticated;
grant all on public.practice_sessions to service_role;
alter table public.practice_sessions enable row level security;
create policy "own sessions" on public.practice_sessions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.prompt_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  mode text not null,
  prompt text not null,
  core_idea text,
  created_at timestamptz not null default now()
);
create index on public.prompt_history (user_id, created_at desc);
grant select, insert, delete on public.prompt_history to authenticated;
grant all on public.prompt_history to service_role;
alter table public.prompt_history enable row level security;
create policy "own prompts" on public.prompt_history for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  badge text not null,
  earned_at timestamptz not null default now(),
  unique (user_id, badge)
);
grant select, insert on public.achievements to authenticated;
grant all on public.achievements to service_role;
alter table public.achievements enable row level security;
create policy "own achievements" on public.achievements for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('debate','gd')),
  host_id uuid not null default auth.uid(),
  topic text not null,
  capacity integer not null default 2,
  ai_count integer not null default 0,
  ai_personalities jsonb not null default '[]'::jsonb,
  duration_sec integer not null default 120,
  is_public boolean not null default false,
  status text not null default 'waiting',
  started_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.room_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  display_name text not null,
  side text,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (room_id, user_id)
);
create table public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid,
  speaker_name text not null,
  is_ai boolean not null default false,
  personality text,
  content text not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_room_member(_room uuid, _user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.room_participants where room_id = _room and user_id = _user)
      or exists (select 1 from public.rooms where id = _room and host_id = _user)
$$;

grant select, insert, update on public.rooms to authenticated;
grant all on public.rooms to service_role;
alter table public.rooms enable row level security;
create policy "rooms readable by signed-in" on public.rooms for select to authenticated using (true);
create policy "host creates" on public.rooms for insert to authenticated with check (auth.uid() = host_id);
create policy "host updates" on public.rooms for update to authenticated using (auth.uid() = host_id);

grant select, insert, update, delete on public.room_participants to authenticated;
grant all on public.room_participants to service_role;
alter table public.room_participants enable row level security;
create policy "members see participants" on public.room_participants for select to authenticated using (public.is_room_member(room_id, auth.uid()));
create policy "join self" on public.room_participants for insert to authenticated with check (auth.uid() = user_id);
create policy "update self" on public.room_participants for update to authenticated using (auth.uid() = user_id);
create policy "leave self" on public.room_participants for delete to authenticated using (auth.uid() = user_id);

grant select, insert on public.room_messages to authenticated;
grant all on public.room_messages to service_role;
alter table public.room_messages enable row level security;
create policy "members read messages" on public.room_messages for select to authenticated using (public.is_room_member(room_id, auth.uid()));
create policy "members post" on public.room_messages for insert to authenticated with check (public.is_room_member(room_id, auth.uid()) and (user_id = auth.uid() or (is_ai and exists (select 1 from public.rooms r where r.id = room_id and r.host_id = auth.uid()))));

create table public.match_queue (
  user_id uuid primary key default auth.uid(),
  kind text not null,
  level text not null,
  duration_sec integer not null,
  room_id uuid references public.rooms(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.match_queue to authenticated;
grant all on public.match_queue to service_role;
alter table public.match_queue enable row level security;
create policy "own queue" on public.match_queue for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid(),
  reported_user_id uuid not null,
  room_id uuid,
  reason text not null,
  created_at timestamptz not null default now()
);
grant insert on public.user_reports to authenticated;
grant all on public.user_reports to service_role;
alter table public.user_reports enable row level security;
create policy "file reports" on public.user_reports for insert to authenticated with check (auth.uid() = reporter_id);

create table public.user_blocks (
  blocker_id uuid not null default auth.uid(),
  blocked_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
grant select, insert, delete on public.user_blocks to authenticated;
grant all on public.user_blocks to service_role;
alter table public.user_blocks enable row level security;
create policy "own blocks" on public.user_blocks for all to authenticated using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

create or replace function public.find_match(_kind text, _level text, _duration integer, _topic text, _name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare other record; new_room uuid; me uuid := auth.uid(); existing uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select room_id into existing from match_queue where user_id = me and room_id is not null;
  if existing is not null then delete from match_queue where user_id = me; return existing; end if;
  select q.* into other from match_queue q
   where q.user_id <> me and q.kind = _kind and q.room_id is null and q.level = _level
     and abs(q.duration_sec - _duration) <= 60
     and not exists (select 1 from user_blocks b where (b.blocker_id = me and b.blocked_id = q.user_id) or (b.blocker_id = q.user_id and b.blocked_id = me))
   order by q.created_at limit 1 for update skip locked;
  if other.user_id is null then
    insert into match_queue (user_id, kind, level, duration_sec) values (me, _kind, _level, _duration)
      on conflict (user_id) do update set kind = excluded.kind, level = excluded.level, duration_sec = excluded.duration_sec, room_id = null, created_at = now();
    return null;
  end if;
  insert into rooms (code, kind, host_id, topic, capacity, duration_sec, is_public, status)
    values ('SPK-' || lpad((floor(random()*100000))::int::text, 5, '0'), _kind, me, _topic, 2, _duration, true, 'waiting')
    returning id into new_room;
  insert into room_participants (room_id, user_id, display_name, side) values (new_room, me, _name, 'for');
  insert into room_participants (room_id, user_id, display_name, side)
    values (new_room, other.user_id, coalesce((select display_name from profiles where id = other.user_id),'Speaker'), 'against');
  update match_queue set room_id = new_room where user_id = other.user_id;
  delete from match_queue where user_id = me;
  return new_room;
end; $$;
revoke execute on function public.find_match(text,text,integer,text,text) from public, anon;
grant execute on function public.find_match(text,text,integer,text,text) to authenticated;

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_participants;
alter publication supabase_realtime add table public.room_messages;

create policy "own recordings read" on storage.objects for select to authenticated using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own recordings write" on storage.objects for insert to authenticated with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own recordings delete" on storage.objects for delete to authenticated using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
