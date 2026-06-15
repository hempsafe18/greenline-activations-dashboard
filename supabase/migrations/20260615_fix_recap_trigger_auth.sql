-- Replace the hardcoded anon JWT with a database setting so the key
-- can be rotated without touching committed code.
-- After running this migration, set the key via:
--   ALTER DATABASE postgres SET app.settings.anon_key = '<your-anon-key>';
-- (or inject it from CI using SUPABASE_DB_PASSWORD + psql)

CREATE OR REPLACE FUNCTION call_sync_recap_to_sheets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  anon_key text;
BEGIN
  anon_key := current_setting('app.settings.anon_key', true);
  IF anon_key IS NULL OR anon_key = '' THEN
    RAISE WARNING 'app.settings.anon_key is not set — recap Sheet sync skipped';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := 'https://qqkbopkyfgiqsrrtvxzv.supabase.co/functions/v1/sync-recap-to-sheets',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body    := jsonb_build_object('record', to_jsonb(NEW)),
    timeout_milliseconds := 10000
  );
  RETURN NEW;
END;
$$;
