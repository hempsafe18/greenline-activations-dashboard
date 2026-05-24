-- Trigger function: POST each new recap row to the sync-recap-to-sheets Edge Function via pg_net
CREATE OR REPLACE FUNCTION call_sync_recap_to_sheets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://qqkbopkyfgiqsrrtvxzv.supabase.co/functions/v1/sync-recap-to-sheets',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxa2JvcGt5ZmdpcXNycnR2eHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NzQ4MzUsImV4cCI6MjA5MzE1MDgzNX0.JHnSwDv9HIeFJCnVsEwGAXIR5GjnVt6B3R6ITJ-2_Zs'
    ),
    body    := jsonb_build_object('record', to_jsonb(NEW)),
    timeout_milliseconds := 10000
  );
  RETURN NEW;
END;
$$;

-- Trigger: fire after each recap INSERT
DROP TRIGGER IF EXISTS on_recap_sync_to_sheets ON recaps;
CREATE TRIGGER on_recap_sync_to_sheets
  AFTER INSERT ON recaps
  FOR EACH ROW
  EXECUTE FUNCTION call_sync_recap_to_sheets();
