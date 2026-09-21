-- Server-side log of client sign-ins, populated by the Clerk `session.created`
-- webhook (app/api/webhooks/clerk/route.ts) so logins can be reviewed in the
-- admin dashboard instead of digging through the Clerk dashboard's own logs.
-- client_id mirrors the CLIENT_COMPANY keys used elsewhere in this app
-- (AMIGOS, 3CHI, etc.) and is null for sign-ins that don't match a known
-- client email domain (admins, ambassadors on a shared Clerk instance, etc).
CREATE TABLE IF NOT EXISTS public.client_login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL,
  clerk_session_id text,
  email text,
  name text,
  client_id text,
  ip_address text,
  user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.client_login_events IS 'One row per Clerk session.created webhook delivery -- a sign-in event. client_id is null when the email does not match a known client domain (admin/internal accounts).';

CREATE INDEX IF NOT EXISTS client_login_events_occurred_at_idx ON public.client_login_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS client_login_events_client_id_idx ON public.client_login_events (client_id);

-- Service-role only (the webhook route and admin API use SUPABASE_SECRET_KEY) — no client policies.
ALTER TABLE public.client_login_events ENABLE ROW LEVEL SECURITY;
