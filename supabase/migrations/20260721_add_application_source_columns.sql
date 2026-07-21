-- Preserves the raw HubSpot ambassador-application fields that back the
-- curated `strengths` bullets, so strengths stay traceable to what each
-- ambassador actually submitted and can be revisited/regenerated later
-- without re-pulling a CSV export. Purely additive, nullable columns —
-- no existing column, data, or RLS policy on profiles is touched.
alter table public.profiles
  add column if not exists application_bio text,
  add column if not exists application_experience text,
  add column if not exists application_role_interest text[] not null default '{}',
  add column if not exists application_availability text,
  add column if not exists application_submitted_at timestamptz;
