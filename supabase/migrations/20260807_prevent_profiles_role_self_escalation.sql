-- "Users can update own profile" (auth.uid() = id) has no column restriction, so any
-- authenticated user can currently UPDATE profiles SET role = 'admin' WHERE id = auth.uid()
-- and grant themselves admin rights on every role='admin'-gated table/RLS policy in this
-- schema. Block role changes from that path specifically, without touching the ability of
-- ambassadors to edit their own name/phone/address/etc, and without breaking legitimate
-- role changes made by trusted backend code (Edge Functions, admin tooling) using the
-- service_role key, or by superuser/migrations.
--
-- current_user (not auth.role()) is the reliable signal here: PostgREST actually assumes
-- the Postgres role named by the caller's JWT "role" claim for the duration of the request
-- (anon / authenticated / service_role), whereas auth.role() reads a JWT claim that is only
-- present for PostgREST-routed requests and is NULL for direct/superuser SQL sessions.
CREATE OR REPLACE FUNCTION public.prevent_profile_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND current_user = 'authenticated' THEN
    RAISE EXCEPTION 'role cannot be changed via a direct profile update; use the admin service role'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_self_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_self_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_role_self_escalation();

-- NOTE: the function was initially created SECURITY DEFINER, which silently defeated the
-- guard (current_user resolves to the function owner inside a SECURITY DEFINER call, not
-- the actual caller) — confirmed by a rolled-back test where the "blocked" UPDATE went
-- through. SECURITY INVOKER above is correct; this migration reflects the final state.
