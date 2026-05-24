-- Join profiles to include rep email and full_name in the Sheet payload
CREATE OR REPLACE FUNCTION call_sync_recap_to_sheets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rep_email    text;
  rep_name     text;
  payload      jsonb;
BEGIN
  SELECT email, full_name INTO rep_email, rep_name
  FROM profiles WHERE id = NEW.user_id;

  payload := to_jsonb(NEW) || jsonb_build_object(
    'email',     COALESCE(rep_email, ''),
    'full_name', COALESCE(rep_name, '')
  );

  PERFORM net.http_post(
    url     := 'https://qqkbopkyfgiqsrrtvxzv.supabase.co/functions/v1/submit-recap-to-sheet',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxa2JvcGt5ZmdpcXNycnR2eHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NzQ4MzUsImV4cCI6MjA5MzE1MDgzNX0.JHnSwDv9HIeFJCnVsEwGAXIR5GjnVt6B3R6ITJ-2_Zs'
    ),
    body    := jsonb_build_object('record', payload),
    timeout_milliseconds := 15000
  );
  RETURN NEW;
END;
$$;
