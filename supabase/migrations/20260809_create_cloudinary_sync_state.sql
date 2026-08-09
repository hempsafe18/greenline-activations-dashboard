-- Cursor for the recurring Cloudinary sync job (app/api/cron/cloudinary-sync).
-- Singleton row tracking the newest recap-photos storage object we've already
-- pushed to Cloudinary, so each run only processes what's new since last time.
CREATE TABLE IF NOT EXISTS public.cloudinary_sync_state (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_synced_at timestamptz NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.cloudinary_sync_state (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Service-role only (the cron route uses SUPABASE_SECRET_KEY) — no client policies.
ALTER TABLE public.cloudinary_sync_state ENABLE ROW LEVEL SECURITY;
