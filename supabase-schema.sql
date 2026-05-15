-- Run this once in Supabase → SQL Editor → New query → paste → Run.

create table if not exists public.leads (
  email_lower   text primary key,
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
  generated_at  timestamptz
);

create index if not exists leads_added_at_idx on public.leads (added_at desc);
create index if not exists leads_status_idx   on public.leads (status);
create index if not exists leads_company_idx  on public.leads (company);
create index if not exists leads_location_idx on public.leads (location);

-- Single-user / personal mode: disable RLS so the anon key can read/write.
-- If you ever share this app publicly, switch to RLS + Supabase Auth instead.
alter table public.leads disable row level security;
