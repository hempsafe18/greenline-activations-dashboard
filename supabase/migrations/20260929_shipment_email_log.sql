-- Audit log for ambassador shipment notification emails (send-shipment-notification
-- Edge Function). shipment_ref is "inventory:<ids>" or "materials:<id>"; the function
-- skips any shipment that already has a 'sent' row so a retry can't double-email.
create table if not exists public.shipment_email_log (
  id uuid primary key default gen_random_uuid(),
  shipment_ref text not null,
  user_id uuid references public.profiles(id) on delete set null,
  to_email text,
  status text not null check (status in ('sent','skipped_no_email','failed')),
  resend_id text,
  error text,
  created_at timestamptz not null default now()
);
alter table public.shipment_email_log enable row level security;
create index if not exists shipment_email_log_ref_idx on public.shipment_email_log (shipment_ref, status);
