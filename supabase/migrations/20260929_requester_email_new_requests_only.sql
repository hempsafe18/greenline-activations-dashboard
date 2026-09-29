-- Limit requester emails to New Activation Requests. Edit/Cancel requests that the
-- admin "Acknowledges" also flip status to 'approved', and were triggering an
-- "Approved... on the schedule" email. Also excludes them from the event-change lookup.
CREATE OR REPLACE FUNCTION public.email_requester_on_decision()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (NEW.metadata->>'requestType' = 'New Activation Request' or NEW.subject ilike 'New Event Request%')
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
           where event_id = NEW.id
             and (metadata->>'requestType' = 'New Activation Request' or subject ilike 'New Event Request%')
  loop
    perform public._call_requester_email(jsonb_build_object(
      'kind', kind, 'request_id', r.id,
      'old_date', OLD.event_date, 'old_start', OLD.start_time, 'old_end', OLD.end_time));
  end loop;
  return NEW;
end; $function$;
