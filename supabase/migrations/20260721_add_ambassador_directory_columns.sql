-- /profiles ambassador directory reads from the existing ambassador-portal
-- `profiles` table (real roster, real avatar_url, real hempsafe_certified)
-- rather than a separate table. This just adds the columns the directory
-- needs that don't exist yet — purely additive, no existing column, data,
-- or RLS policy on `profiles` is touched.
alter table public.profiles
  add column if not exists markets text[] not null default '{}',
  add column if not exists strengths text[] not null default '{}',
  add column if not exists hempsafe_cert_date date,
  add column if not exists status text not null default 'active';

alter table public.profiles
  add constraint profiles_status_check check (status in ('active', 'inactive'));

-- Backfill markets from the existing single `city` column so current
-- ambassadors show up in the directory immediately; multi-market ambassadors
-- can be edited afterward via the Supabase dashboard.
update public.profiles
set markets = array[city]
where city is not null and city <> '' and markets = '{}';
