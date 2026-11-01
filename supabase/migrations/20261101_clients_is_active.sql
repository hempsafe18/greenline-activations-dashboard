-- Let admins mark a client inactive from the Master Dashboard.
-- Inactive clients keep their history and portal; they are just flagged and
-- excluded from the "Brands Active" count.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE public.clients
SET is_active = false
WHERE LOWER(TRIM(company_name)) IN ('3chi', 'groovewagon');
