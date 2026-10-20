-- Kick Fizz client dashboard: register the client and its four trackable SKUs.
--
-- Kick Fizz sells two flavors, each in a 2mg and a 5mg Delta 9 THC dosage:
--   Day Drinking  - Lemonberry Ice
--   Evening Buzz  - Black Cherry Vanilla
-- Ambassador shipments are logged in 4-packs (ambassador_inventory_shipments.cases_sent), so
-- cans_per_case is 4. retail_price is the price of one 4-pack ($14.99 at 2mg, $17.99 at 5mg).
--
-- The company_name must stay exactly 'Kick Fizz': the dashboard APIs match on it, and
-- fn_events_set_client_id() resolves events.client_id from events.brand_name against it.

ALTER TABLE public.inventory_skus
  ADD COLUMN IF NOT EXISTS retail_price numeric(8,2);

INSERT INTO public.clients (company_name, contact_name, contact_email, contact_phone, notes)
SELECT 'Kick Fizz', 'Julie Rhodes', 'julie@kickbeverages.com', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM public.clients WHERE LOWER(TRIM(company_name)) = 'kick fizz'
);

INSERT INTO public.inventory_skus (sku, flavor_name, brand, cans_per_case, potency_mg, product_line, retail_price)
VALUES
  ('KICKFIZZ-DAYDRINKING-2MG',  'Day Drinking - Lemonberry Ice',        'Kick Fizz', 4, 2, 'day_drinking', 14.99),
  ('KICKFIZZ-DAYDRINKING-5MG',  'Day Drinking - Lemonberry Ice',        'Kick Fizz', 4, 5, 'day_drinking', 17.99),
  ('KICKFIZZ-EVENINGBUZZ-2MG',  'Evening Buzz - Black Cherry Vanilla',  'Kick Fizz', 4, 2, 'evening_buzz', 14.99),
  ('KICKFIZZ-EVENINGBUZZ-5MG',  'Evening Buzz - Black Cherry Vanilla',  'Kick Fizz', 4, 5, 'evening_buzz', 17.99)
ON CONFLICT (sku) DO NOTHING;
