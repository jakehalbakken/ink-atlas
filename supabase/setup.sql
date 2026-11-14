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
