-- Already applied to prod (qqkbopkyfgiqsrrtvxzv) on 2026-09-29 — repo sync only, do not re-run.
-- Definitions copied from pg_get_functiondef / pg_get_triggerdef on prod.
--
-- NOT INCLUDED: public._call_requester_email(payload jsonb). It is a SECURITY DEFINER
-- wrapper that calls net.http_post to the send-requester-update-email edge function
-- (30s timeout) with a hardcoded Authorization bearer key, so it was left out of the repo.
-- Pull it with `supabase db pull` (or pg_get_functiondef) if you want it versioned,
-- ideally reading the key from Vault instead of inlining it.

CREATE OR REPLACE FUNCTION public.email_requester_on_decision()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (NEW.metadata ? 'requestType' or NEW.subject ilike 'New Event Request%')
     and OLD.status is distinct from NEW.status then
    if NEW.status = 'approved' then
      perform public._call_requester_email(jsonb_build_object('kind','approved','request_id',NEW.id));
    elsif NEW.status in ('declined','rejected') then
      perform public._call_requester_email(jsonb_build_object('kind','declined','request_id',NEW.id));
    end if;
  end if;
  return NEW;
end; $function$;

CREATE OR REPLACE FUNCTION public.email_requester_on_event_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare kind text; r record;
begin
  if NEW.status = 'cancelled' and OLD.status is distinct from 'cancelled' then
    kind := 'cancelled';
  elsif NEW.status <> 'cancelled' and (
        NEW.event_date is distinct from OLD.event_date
     or NEW.start_time is distinct from OLD.start_time
     or NEW.end_time   is distinct from OLD.end_time
     or (NEW.status = 'rescheduled' and OLD.status is distinct from 'rescheduled')) then
    kind := 'rescheduled';
  else
    return NEW;
  end if;
  if greatest(NEW.event_date, OLD.event_date) < current_date then return NEW; end if;

  for r in select id from public.client_notifications
           where event_id = NEW.id and (metadata ? 'requestType' or subject ilike 'New Event Request%')
  loop
    perform public._call_requester_email(jsonb_build_object(
      'kind', kind, 'request_id', r.id,
      'old_date', OLD.event_date, 'old_start', OLD.start_time, 'old_end', OLD.end_time));
  end loop;
  return NEW;
end; $function$;

CREATE TRIGGER on_request_decision_email AFTER UPDATE OF status ON public.client_notifications FOR EACH ROW EXECUTE FUNCTION email_requester_on_decision();
CREATE TRIGGER on_event_change_email_requester AFTER UPDATE OF status, event_date, start_time, end_time ON public.events FOR EACH ROW EXECUTE FUNCTION email_requester_on_event_change();
