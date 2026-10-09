-- Client logins are now recorded from two places: the Clerk `session.created`
-- webhook and the first dashboard load of a session (lib/login-log.ts). One
-- row per Clerk session, whichever arrives first, so make the session id unique.
-- NULL session ids stay allowed (NULLs are distinct in a unique index).
CREATE UNIQUE INDEX IF NOT EXISTS client_login_events_clerk_session_id_key
  ON public.client_login_events (clerk_session_id);
