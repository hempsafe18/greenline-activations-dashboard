-- When an ambassador reports post-activation sample inventory
-- (recap_inventory_usage) and a SKU drops below 6 cans remaining, notify the
-- owning client so they can send a replenishment shipment. Mirrors the
-- existing call_sync_recap_to_sheets pg_net pattern in this project (same
-- anon-key JWT, same fire-and-forget http_post to an Edge Function).
--
-- Edge Function: supabase/functions/send-low-inventory-alert
CREATE OR REPLACE FUNCTION public.call_low_inventory_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.cans_remaining IS NULL OR NEW.cans_remaining >= 6 THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := 'https://qqkbopkyfgiqsrrtvxzv.supabase.co/functions/v1/send-low-inventory-alert',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxa2JvcGt5ZmdpcXNycnR2eHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NzQ4MzUsImV4cCI6MjA5MzE1MDgzNX0.JHnSwDv9HIeFJCnVsEwGAXIR5GjnVt6B3R6ITJ-2_Zs'
    ),
    body    := jsonb_build_object('record', to_jsonb(NEW)),
    timeout_milliseconds := 10000
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_low_inventory_alert ON public.recap_inventory_usage;
CREATE TRIGGER trg_low_inventory_alert
  AFTER INSERT ON public.recap_inventory_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.call_low_inventory_alert();
