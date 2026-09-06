-- Tracks shipments of non-product materials (table/booth setup gear, signage,
-- educational literature, merch) sent to ambassadors ahead of an activation.
-- Deliberately separate from ambassador_inventory_shipments, which is a
-- product-SKU shipment/inventory ledger (sku is NOT NULL there) built for
-- beverage clients like Amigos - materials-only clients like Claybourne Co.
-- have no SKU to attach a row to, so this gets its own table rather than
-- forcing a fake SKU into that one.
create table public.ambassador_materials_shipments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  materials jsonb not null default '[]'::jsonb,
  tracking_number text,
  shipped_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.ambassador_materials_shipments is 'Non-product material shipments (signage, setup gear, literature, merch) to ambassadors, for clients with no product-SKU inventory to track.';
comment on column public.ambassador_materials_shipments.materials is 'Array of {item, quantity} objects, same shape as ambassador_inventory_shipments.materials.';

create index ambassador_materials_shipments_client_id_idx on public.ambassador_materials_shipments(client_id);
create index ambassador_materials_shipments_user_id_idx on public.ambassador_materials_shipments(user_id);

alter table public.ambassador_materials_shipments enable row level security;

create policy "Admins can manage materials shipments" on public.ambassador_materials_shipments
  for all
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

create policy "Users can view own materials shipments" on public.ambassador_materials_shipments
  for select
  using (auth.uid() = user_id or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
