-- Name-based /profiles/[slug] URLs and a state filter for the ambassador
-- directory. Additive columns only, no existing column/data/RLS touched.
alter table public.profiles
  add column if not exists slug text,
  add column if not exists state text;

create unique index if not exists profiles_slug_key on public.profiles (slug);

-- Auto-generates a URL-safe slug for new ambassadors (from full_name) so
-- every future portal sign-up gets a working /profiles/[slug] link without
-- manual admin intervention. Resolves collisions with a numeric suffix.
create or replace function public.set_profile_slug()
returns trigger as $$
declare
  base_slug text;
  candidate text;
  suffix int := 1;
begin
  if new.slug is not null and new.slug <> '' then
    return new;
  end if;

  base_slug := trim(both '-' from regexp_replace(lower(trim(coalesce(new.full_name, ''))), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then
    base_slug := 'ambassador';
  end if;

  candidate := base_slug;
  while exists (select 1 from public.profiles where slug = candidate and id <> new.id) loop
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix;
  end loop;

  new.slug := candidate;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_profile_slug on public.profiles;
create trigger trg_set_profile_slug
  before insert on public.profiles
  for each row
  execute function public.set_profile_slug();

-- Existing rows are backfilled separately (not tracked here, since it's
-- real ambassador data, not schema). Once backfilled, slug is required.
alter table public.profiles alter column slug set not null;
