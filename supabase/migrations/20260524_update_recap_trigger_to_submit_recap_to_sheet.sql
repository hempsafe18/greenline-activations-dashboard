-- Update the recap webhook trigger to call the existing submit-recap-to-sheet
-- Edge Function (which uses OAuth refresh token credentials already configured)
CREATE OR REPLACE FUNCTION call_sync_recap_to_sheets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://qqkbopkyfgiqsrrtvxzv.supabase.co/functions/v1/submit-recap-to-sheet',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxa2JvcGt5ZmdpcXNycnR2eHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NzQ4MzUsImV4cCI6MjA5MzE1MDgzNX0.JHnSwDv9HIeFJCnVsEwGAXIR5GjnVt6B3R6ITJ-2_Zs'
    ),
    body    := jsonb_build_object('record', to_jsonb(NEW)),
    timeout_milliseconds := 15000
  );
  RETURN NEW;
END;
$$;
