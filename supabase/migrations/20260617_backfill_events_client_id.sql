-- Backfill events.client_id for all rows where it is NULL.
--
-- Matching logic: strip \r\n from brand_name, then case-insensitive compare
-- against clients.company_name. This handles the "AMIGOS\r\n" / "MELLOW FELLOW\r\n"
-- sanitization bug from older sync runs.
--
-- Safe to run multiple times: the WHERE client_id IS NULL guard is idempotent.

UPDATE public.events e
SET client_id = c.id
FROM public.clients c
WHERE e.client_id IS NULL
  AND TRIM(REPLACE(REPLACE(e.brand_name, E'\r', ''), E'\n', '')) ILIKE c.company_name;

-- Verify: how many rows still have client_id = NULL after backfill?
-- (Rows with brand_name values that don't match any client will remain NULL.)
-- SELECT brand_name, COUNT(*) FROM public.events WHERE client_id IS NULL GROUP BY brand_name;
