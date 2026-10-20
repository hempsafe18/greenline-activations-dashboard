-- Staff Assigned client notifications now carry the assigned ambassador(s) in
-- metadata.staff = [{ name, slug, profile_url }]. profile_url/slug are only set when the
-- ambassador's public profile exists (role=staff, active, HempSafe-certified — the same
-- filter as /profiles/[slug]); otherwise the client just sees the name.
-- Already applied to prod. The function also handles INSERT (TG_OP), but the existing
-- on_application_confirmed trigger stays AFTER UPDATE only (a swap to INSERT OR UPDATE
-- timed out on a lock) — confirmations inserted directly as 'confirmed' are not covered yet.

CREATE OR REPLACE FUNCTION public.notify_staff_assigned()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  ev_title      text;
  ev_location   text;
  ev_date       date;
  brand_name    text;
  staff_name    text;
  staff_slug    text;
  staff_public  boolean;
BEGIN
  IF NEW.status = 'confirmed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed') THEN
    SELECT title, location_name, event_date
      INTO ev_title, ev_location, ev_date
      FROM public.events WHERE id = NEW.event_id;

    brand_name := public.extract_brand_from_title(ev_title);
    SELECT full_name, slug, (role = 'staff' AND status = 'active' AND coalesce(hempsafe_certified, false))
      INTO staff_name, staff_slug, staff_public
      FROM public.profiles WHERE id = NEW.user_id;

    IF brand_name IS NOT NULL AND brand_name <> '' THEN
      INSERT INTO public.client_notifications (client_id, event_id, type, subject, body, read, metadata)
      VALUES (
        brand_name,
        NEW.event_id,
        'update',
        'Staff Assigned: ' || COALESCE(ev_location, ev_title) || ' on ' || ev_date::text,
        COALESCE(staff_name, 'A team member') ||
          ' has been confirmed for your activation at ' ||
          COALESCE(ev_location, 'the scheduled location') ||
          ' on ' || ev_date::text || '.',
        false,
        jsonb_build_object(
          'storeName', COALESCE(ev_location, ev_title),
          'eventDate', ev_date,
          'staff', jsonb_build_array(jsonb_build_object(
            'name', COALESCE(staff_name, 'A team member'),
            'slug', CASE WHEN staff_public THEN staff_slug END,
            'profile_url', CASE WHEN staff_public AND staff_slug IS NOT NULL THEN '/profiles/' || staff_slug END
          ))
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Backfill the two Moxy Atlanta (Mellow Fellow, 2026-10-31) confirmations that never produced a notification.
INSERT INTO public.client_notifications (client_id, event_id, type, subject, body, read, metadata, created_at)
SELECT 'Mellow Fellow', a.event_id, 'update',
       'Staff Assigned: ' || e.location_name || ' on ' || e.event_date::text,
       p.full_name || ' has been confirmed for your activation at ' || e.location_name || ' on ' || e.event_date::text || '.',
       false,
       jsonb_build_object('storeName', e.location_name, 'eventDate', e.event_date,
         'staff', jsonb_build_array(jsonb_build_object('name', p.full_name, 'slug', p.slug, 'profile_url', '/profiles/' || p.slug))),
       a.confirmed_at
FROM public.applications a
JOIN public.events e ON e.id = a.event_id
JOIN public.profiles p ON p.id = a.user_id
WHERE a.status = 'confirmed'
  AND a.event_id IN ('64178f27-b1eb-4aa6-89c1-559841ff5539', 'bdd04cb6-a144-40fa-a544-b707b56b2903')
  AND p.role = 'staff' AND p.status = 'active' AND p.hempsafe_certified AND p.slug IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.client_notifications n
                  WHERE n.event_id = a.event_id AND n.subject ILIKE 'Staff Assigned%' AND n.body LIKE p.full_name || '%');
