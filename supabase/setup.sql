-- Ink Atlas accounts: run this once in your Supabase project (SQL Editor, New query, Run).
-- Safe to run again: it only adds what is missing and replaces its own policies.
--
-- What it makes:
--   projects        each person's saved projects (body, tattoos, placements). Only the owner can see or change them.
--   shares          a frozen copy of a project made by "Send to someone". Nobody can list them;
--                   the app opens one only by its long random link id, through get_share().
--   artwork         private storage bucket for each person's tattoo artwork, in a folder named after them.
--   shared-artwork  storage bucket for artwork inside a shared copy. Files can only be fetched by their
--                   exact path, which contains the long random link id, and cannot be listed.

create extension if not exists pgcrypto;

-- Projects --------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default 'My tattoos' check (char_length(name) between 1 and 80),
  state jsonb not null,
  image_keys text[] not null default '{}',
  tattoos integer not null default 0,
  rev integer not null default 1,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_owner_updated on public.projects (owner, updated_at desc);
alter table public.projects enable row level security;

-- The server's clock decides when a project last changed, not the device's.
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();

drop policy if exists "projects: owner reads" on public.projects;
drop policy if exists "projects: owner adds" on public.projects;
drop policy if exists "projects: owner changes" on public.projects;
drop policy if exists "projects: owner deletes" on public.projects;
create policy "projects: owner reads" on public.projects for select to authenticated using (owner = (select auth.uid()));
create policy "projects: owner adds" on public.projects for insert to authenticated with check (owner = (select auth.uid()));
create policy "projects: owner changes" on public.projects for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "projects: owner deletes" on public.projects for delete to authenticated using (owner = (select auth.uid()));

-- Shared copies ---------------------------------------------------------------
create table if not exists public.shares (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{22,64}$'),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default 'Tattoo plan' check (char_length(name) between 1 and 80),
  from_name text check (from_name is null or char_length(from_name) <= 60),
  state jsonb not null,
  image_keys text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.shares enable row level security;

drop policy if exists "shares: owner reads" on public.shares;
drop policy if exists "shares: owner adds" on public.shares;
drop policy if exists "shares: owner deletes" on public.shares;
create policy "shares: owner reads" on public.shares for select to authenticated using (owner = (select auth.uid()));
create policy "shares: owner adds" on public.shares for insert to authenticated with check (owner = (select auth.uid()));
create policy "shares: owner deletes" on public.shares for delete to authenticated using (owner = (select auth.uid()));

-- Opening a shared copy by its link id. Anyone with the link can open it, signed in or not.
create or replace function public.get_share(share_id text)
returns table (id text, name text, from_name text, state jsonb, image_keys text[], folder text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select s.id, s.name, s.from_name, s.state, s.image_keys, s.owner::text || '/' || s.id, s.created_at
  from public.shares s where s.id = share_id;
$$;
revoke all on function public.get_share(text) from public;
grant execute on function public.get_share(text) to anon, authenticated;

-- Artwork storage -------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('artwork', 'artwork', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('shared-artwork', 'shared-artwork', true) on conflict (id) do nothing;

drop policy if exists "artwork: owner reads" on storage.objects;
drop policy if exists "artwork: owner adds" on storage.objects;
drop policy if exists "artwork: owner deletes" on storage.objects;
drop policy if exists "shared artwork: owner reads" on storage.objects;
drop policy if exists "shared artwork: owner adds" on storage.objects;
drop policy if exists "shared artwork: owner deletes" on storage.objects;
create policy "artwork: owner reads" on storage.objects for select to authenticated
  using (bucket_id = 'artwork' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "artwork: owner adds" on storage.objects for insert to authenticated
  with check (bucket_id = 'artwork' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "artwork: owner deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'artwork' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "shared artwork: owner reads" on storage.objects for select to authenticated
  using (bucket_id = 'shared-artwork' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "shared artwork: owner adds" on storage.objects for insert to authenticated
  with check (bucket_id = 'shared-artwork' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "shared artwork: owner deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'shared-artwork' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Working on a project together (added 2026-11-14) ---------------------------------
-- The owner makes an invite link; whoever opens it while signed in joins that one project.
-- People who joined can open and change that project (not rename or remove it, and not
-- invite others), and nothing else of the owner's. The owner can take anyone off it, and
-- anyone can leave. A project's artwork, once it is shared, lives in artwork/p/<project id>/.
--
--   project_members  who has joined which project (added only through accept_invite()).
--   invites          one link each, for one person, good for 14 days. Only the owner sees them.

alter table public.projects add column if not exists shared boolean not null default false;
alter table public.projects add column if not exists owner_name text check (owner_name is null or char_length(owner_name) <= 60);
alter table public.projects add column if not exists edited_by text check (edited_by is null or char_length(edited_by) <= 60);

create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text check (name is null or char_length(name) <= 60),
  added_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists project_members_user on public.project_members (user_id);
alter table public.project_members enable row level security;

create table if not exists public.invites (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{22,64}$'),
  project_id uuid not null references public.projects (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz
);
alter table public.invites enable row level security;

-- Comment only (added 2026-11-15): an invite, and the person who joins with it, can be "edit"
-- (change the tattoos, as before) or "comment" (pin comments, answer Looks good / Ask for a
-- change, and add reference pictures, but not move, resize, add or remove tattoos).
alter table public.invites add column if not exists role text not null default 'edit' check (role in ('edit', 'comment'));
alter table public.project_members add column if not exists role text not null default 'edit' check (role in ('edit', 'comment'));
create or replace function public.comment_only(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members m where m.project_id = pid and m.user_id = auth.uid() and m.role = 'comment');
$$;
-- A project without its comments, answers and reference pictures: what someone who can only
-- comment must leave exactly as it was.
create or replace function public.without_comments(s jsonb) returns jsonb
language sql immutable set search_path = public as $$
  select case
    when jsonb_typeof(s) is distinct from 'object' then s
    when jsonb_typeof(s->'tattoos') = 'array' then (s - 'notes' - 'refs') || jsonb_build_object('tattoos', coalesce(
      (select jsonb_agg(case when jsonb_typeof(x) = 'object' then x - 'review' else x end order by i) from jsonb_array_elements(s->'tattoos') with ordinality e(x, i)), '[]'::jsonb))
    else s - 'notes' - 'refs' end;
$$;

-- These look past row-level security on purpose (security definer), so the rules below can ask
-- "is this my project?" without the tables' own rules going round in a circle. Each answers
-- only for the person signed in.
create or replace function public.owns_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects p where p.id = pid and p.owner = auth.uid());
$$;
create or replace function public.joined_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members m join public.projects p on p.id = m.project_id
                 where m.project_id = pid and m.user_id = auth.uid() and not p.archived);
$$;
create or replace function public.can_open_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.owns_project(pid) or public.joined_project(pid);
$$;
-- For storage paths: artwork/p/<project id>/<file>. Anything that is not a project id is a no.
create or replace function public.can_open_project_folder(f text[]) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if f is null or array_length(f, 1) <> 2 or f[1] <> 'p' or f[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return public.can_open_project(f[2]::uuid);
end $$;
revoke all on function public.owns_project(uuid), public.joined_project(uuid), public.can_open_project(uuid), public.can_open_project_folder(text[]), public.comment_only(uuid) from public;
grant execute on function public.owns_project(uuid), public.joined_project(uuid), public.can_open_project(uuid), public.can_open_project_folder(text[]), public.comment_only(uuid) to authenticated;

-- Projects: the owner as before, plus people who joined can read and save it.
drop policy if exists "projects: owner reads" on public.projects;
drop policy if exists "projects: owner changes" on public.projects;
drop policy if exists "projects: owner or member reads" on public.projects;
drop policy if exists "projects: owner or member changes" on public.projects;
create policy "projects: owner or member reads" on public.projects for select to authenticated
  using (owner = (select auth.uid()) or public.joined_project(id));
create policy "projects: owner or member changes" on public.projects for update to authenticated
  using (owner = (select auth.uid()) or public.joined_project(id))
  with check (owner = (select auth.uid()) or public.joined_project(id));

-- Nobody can hand a project to someone else, and only the owner can rename it, remove it or
-- switch sharing on or off.
create or replace function public.projects_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if new.owner is distinct from old.owner then raise exception 'A project cannot change owner' using errcode = '42501'; end if;
  if auth.uid() is not null and auth.uid() is distinct from old.owner
     and (new.archived is distinct from old.archived or new.shared is distinct from old.shared
          or new.name is distinct from old.name or new.owner_name is distinct from old.owner_name) then
    raise exception 'Only the owner can do that' using errcode = '42501';
  end if;
  -- someone who can only comment: comments, answers and reference pictures, nothing else
  if auth.uid() is not null and auth.uid() is distinct from old.owner and public.comment_only(old.id)
     and (public.without_comments(new.state) is distinct from public.without_comments(old.state)
          or exists (select unnest(new.image_keys) except select unnest(old.image_keys)
                     except select r->>'img' from jsonb_array_elements(case when jsonb_typeof(new.state->'refs') = 'array' then new.state->'refs' else '[]'::jsonb end) r)) then
    raise exception 'You can comment and answer on this project, not change the tattoos' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists projects_guard on public.projects;
create trigger projects_guard before update on public.projects for each row execute function public.projects_guard();

-- Members: everyone on a project sees who else is on it. The owner can take someone off,
-- and anyone can take themselves off. Joining only happens through accept_invite().
drop policy if exists "members: same project reads" on public.project_members;
drop policy if exists "members: owner or self removes" on public.project_members;
create policy "members: same project reads" on public.project_members for select to authenticated
  using (user_id = (select auth.uid()) or public.can_open_project(project_id));
create policy "members: owner or self removes" on public.project_members for delete to authenticated
  using (user_id = (select auth.uid()) or public.owns_project(project_id));

-- Invites: only the project's owner makes, sees or cancels them.
drop policy if exists "invites: owner reads" on public.invites;
drop policy if exists "invites: owner adds" on public.invites;
drop policy if exists "invites: owner deletes" on public.invites;
create policy "invites: owner reads" on public.invites for select to authenticated using (public.owns_project(project_id));
create policy "invites: owner adds" on public.invites for insert to authenticated
  with check (created_by = (select auth.uid()) and public.owns_project(project_id) and used_by is null and expires_at <= now() + interval '30 days');
create policy "invites: owner deletes" on public.invites for delete to authenticated using (public.owns_project(project_id));

-- Opening an invite link while signed in. One person per link: the first to open it joins,
-- and it keeps working for that same person (on their other devices) until it runs out.
create or replace function public.accept_invite(invite_id text, my_name text default null)
returns table (project_id uuid, name text, owner_name text)
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); inv public.invites; p public.projects;
begin
  if me is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into inv from public.invites i where i.id = invite_id for update;
  if not found or inv.expires_at < now() or (inv.used_by is not null and inv.used_by <> me) then
    raise exception 'That invite no longer works. Ask for a new one.' using errcode = 'P0002';
  end if;
  select * into p from public.projects x where x.id = inv.project_id;
  if not found or p.archived then raise exception 'That invite no longer works. Ask for a new one.' using errcode = 'P0002'; end if;
  if p.owner <> me then
    insert into public.project_members (project_id, user_id, name, role) values (p.id, me, left(nullif(trim(my_name), ''), 60), inv.role)
      on conflict on constraint project_members_pkey do update set name = coalesce(excluded.name, public.project_members.name), role = excluded.role;
    update public.invites set used_by = me, used_at = coalesce(used_at, now()) where id = inv.id;
  end if;
  return query select p.id, p.name, p.owner_name;
end $$;
revoke all on function public.accept_invite(text, text) from public;
grant execute on function public.accept_invite(text, text) to authenticated;

-- Someone taken off a project (or leaving) cannot use their old invite to come back.
create or replace function public.members_gone() returns trigger language plpgsql security definer set search_path = public as $$
begin delete from public.invites where project_id = old.project_id and used_by = old.user_id; return old; end $$;
drop trigger if exists members_gone on public.project_members;
create trigger members_gone after delete on public.project_members for each row execute function public.members_gone();

-- Shared artwork folder: artwork/p/<project id>/<file>, for the owner and people who joined.
drop policy if exists "artwork: project people read" on storage.objects;
drop policy if exists "artwork: project people add" on storage.objects;
create policy "artwork: project people read" on storage.objects for select to authenticated
  using (bucket_id = 'artwork' and public.can_open_project_folder(storage.foldername(name)));
create policy "artwork: project people add" on storage.objects for insert to authenticated
  with check (bucket_id = 'artwork' and public.can_open_project_folder(storage.foldername(name)));

grant select, insert, update, delete on public.project_members, public.invites to authenticated;

-- The owner switching someone between "can change tattoos" and "comment only".
create or replace function public.set_member_role(pid uuid, member uuid, new_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if new_role is null or new_role not in ('edit', 'comment') then raise exception 'Unknown role' using errcode = '22023'; end if;
  if not public.owns_project(pid) then raise exception 'Only the owner can do that' using errcode = '42501'; end if;
  update public.project_members set role = new_role where project_id = pid and user_id = member;
end $$;
revoke all on function public.set_member_role(uuid, uuid, text) from public;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;

-- Every project at a glance (added 2026-11-15) ---------------------------------------
-- Read with the project list as `summary`: how many planned tattoos are approved, have a
-- change asked or are waiting on an answer, who asked, and the newest comment. Worked out
-- from the saved project each time it is read, so nothing extra is stored.
create or replace function public.summary(p public.projects) returns jsonb
language sql stable set search_path = public as $$
  with t as (
    select x from jsonb_array_elements(case when jsonb_typeof(p.state->'tattoos') = 'array' then p.state->'tattoos' else '[]'::jsonb end) x
    where jsonb_typeof(x) = 'object' and x->'status' is distinct from '"existing"'::jsonb and x->'hidden' is distinct from 'true'::jsonb
  ), n as (
    select x, i from jsonb_array_elements(case when jsonb_typeof(p.state->'notes') = 'array' then p.state->'notes' else '[]'::jsonb end) with ordinality e(x, i)
    where jsonb_typeof(x) = 'object'
  )
  select jsonb_build_object(
    'planned', (select count(*) from t),
    'approved', (select count(*) from t where x->'review'->>'verdict' = 'approved'),
    'changes', (select count(*) from t where x->'review'->>'verdict' = 'changes'),
    'change_by', coalesce((select jsonb_agg(distinct left(x->'review'->>'by', 60)) from t where x->'review'->>'verdict' = 'changes' and coalesce(x->'review'->>'by', '') <> ''), '[]'::jsonb),
    'comments', (select count(*) from n),
    'comment_by', (select left(x->>'by', 60) from n order by i desc limit 1),
    'comment_text', (select left(x->>'text', 80) from n order by i desc limit 1),
    'refs', case when jsonb_typeof(p.state->'refs') = 'array' then jsonb_array_length(p.state->'refs') else 0 end);
$$;
grant execute on function public.summary(public.projects) to authenticated;
