-- Trigger: automatically populate events.client_id from brand_name on INSERT or UPDATE.
--
-- This ensures any future inserts (manual SQL, Google Sheets sync, API routes) always
-- get client_id populated without requiring callers to know the UUID.
-- Falls back to NULL if brand_name doesn't match any clients.company_name row.

CREATE OR REPLACE FUNCTION public.fn_events_set_client_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Only resolve if client_id is not already explicitly provided
  IF NEW.client_id IS NULL AND NEW.brand_name IS NOT NULL THEN
    SELECT id INTO NEW.client_id
    FROM public.clients
    WHERE LOWER(TRIM(company_name)) = LOWER(TRIM(REPLACE(REPLACE(NEW.brand_name, E'\r', ''), E'\n', '')))
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_set_client_id ON public.events;

CREATE TRIGGER trg_events_set_client_id
  BEFORE INSERT OR UPDATE OF brand_name, client_id
  ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_events_set_client_id();
