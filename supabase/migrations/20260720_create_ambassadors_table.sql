-- Brand ambassador profile directory (/profiles, /profiles/[id])
create table if not exists ambassadors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  headshot_url text,
  strengths text[] not null default '{}',
  markets text[] not null default '{}',
  hempsafe_certified boolean not null default false,
  hempsafe_cert_date date,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create index if not exists ambassadors_status_idx on ambassadors (status);

alter table ambassadors enable row level security;

-- /profiles/[id] is a public, no-login client link — only expose active profiles,
-- and only the columns the profile page actually renders (no contact info exists
-- on this table at all, so a blanket select is safe here).
create policy "Public can view active ambassadors"
  on ambassadors for select
  to anon
  using (status = 'active');
