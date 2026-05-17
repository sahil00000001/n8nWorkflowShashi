-- ============================================================
-- Lead Manager — two-user schema (Sahil + Shashi)
-- ============================================================
-- Run this in Supabase -> SQL Editor -> New query -> paste -> Run.
--
-- This DROPS the existing leads table and rebuilds it with the
-- owner column. Per your decision, existing data is wiped -- you'll
-- re-import Excel for each user.
-- ============================================================

drop table if exists public.leads;

create table public.leads (
  owner         text not null,
  email_lower   text not null,
  email         text not null,
  name          text default '',
  designation   text default '',
  company       text default '',
  location      text default '',
  linkedin_url  text default '',
  phone         text default '',
  notes         text default '',
  role          text default '',
  categories    jsonb default '[]'::jsonb,
  status        text default 'new',
  source        text default 'manual',
  source_file   text default '',
  added_at      timestamptz default now(),
  updated_at    timestamptz default now(),
  generated_at  timestamptz,
  primary key (owner, email_lower)
);

create index if not exists leads_owner_added_idx    on public.leads (owner, added_at desc);
create index if not exists leads_owner_status_idx   on public.leads (owner, status);
create index if not exists leads_owner_company_idx  on public.leads (owner, company);
create index if not exists leads_owner_location_idx on public.leads (owner, location);

-- Personal/single-org mode: anon key can read/write. The app filters
-- by owner client-side. Re-enable RLS + add Supabase Auth if you ever
-- share this app publicly.
alter table public.leads disable row level security;
