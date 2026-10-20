-- Mellow Fellow Log Shipment tab: register the four trackable SKUs.
--
-- Mellow Fellow Delta 9 THC + CBD Seltzer, 20MG per can (10mg Delta 9 THC + 10mg CBD), sold and
-- shipped to ambassadors as 4-packs only. Ambassador shipments are logged in 4-packs
-- (ambassador_inventory_shipments.cases_sent), so cans_per_case is 4. potency_mg is the
-- 20MG shown on the product name. retail_price is the price of one 4-pack on
-- mellowfellow.fun at the time of writing ($15.99 sale, $19.99 regular).
--
-- brand must stay exactly 'Mellow Fellow': /api/shipments filters inventory_skus by it
-- (see CLIENT_COMPANY there). The clients row already exists.
-- Max Dose (100mg) products are single cans on the store page and are intentionally not
-- tracked here.

ALTER TABLE public.inventory_skus
  ADD COLUMN IF NOT EXISTS retail_price numeric(8,2);

INSERT INTO public.inventory_skus (sku, flavor_name, brand, cans_per_case, potency_mg, product_line, retail_price)
VALUES
  ('MELLOWFELLOW-BLACKBERRYLEMON-20MG',  'Blackberry Lemon',  'Mellow Fellow', 4, 20, 'delta9_cbd_seltzer', 15.99),
  ('MELLOWFELLOW-BLUERASPBERRY-20MG',    'Blue Raspberry',    'Mellow Fellow', 4, 20, 'delta9_cbd_seltzer', 15.99),
  ('MELLOWFELLOW-PINEAPPLEORANGE-20MG',  'Pineapple Orange',  'Mellow Fellow', 4, 20, 'delta9_cbd_seltzer', 15.99),
  ('MELLOWFELLOW-STRAWBERRYMANGO-20MG',  'Strawberry Mango',  'Mellow Fellow', 4, 20, 'delta9_cbd_seltzer', 15.99)
ON CONFLICT (sku) DO NOTHING;
