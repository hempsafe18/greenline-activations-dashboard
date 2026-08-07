-- A shipment can include non-beverage marketing materials (tablecloth, standee, ice
-- bucket, stickers) alongside the tracked SKU cases. These aren't "cases of a flavor" —
-- they have no cans_per_case math and ambassadors never report usage on them via
-- recaps — so they don't belong in inventory_skus/inventory_balance_by_* at all. Store
-- them as a small JSON array on the shipment row instead: [{"item":"standee","quantity":1}].
-- When a client logs a shipment covering multiple SKUs, the same materials array is
-- duplicated across each per-SKU row (this table is already one row per SKU sharing a
-- tracking_number/shipped_at — see the ambassador_inventory_shipments table comment).
ALTER TABLE public.ambassador_inventory_shipments
  ADD COLUMN IF NOT EXISTS materials jsonb NOT NULL DEFAULT '[]'::jsonb;
