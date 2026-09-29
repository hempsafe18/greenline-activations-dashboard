-- Already applied to prod (qqkbopkyfgiqsrrtvxzv) on 2026-09-29 — repo sync only, do not re-run.
alter table public.client_notifications
  add column if not exists requester_email text,
  add column if not exists requester_name text;

create table if not exists public.requester_email_log (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.client_notifications(id) on delete set null,
  event_id uuid,
  kind text not null check (kind in ('approved','declined','cancelled','rescheduled')),
  to_email text,
  status text not null check (status in ('sent','skipped_no_email','failed')),
  resend_id text,
  error text,
  created_at timestamptz not null default now()
);
alter table public.requester_email_log enable row level security;
create index if not exists requester_email_log_request_idx on public.requester_email_log (request_id, kind);
