-- Kick Fizz client dashboard: register the client and its four trackable SKUs.
--
-- Kick Fizz sells two flavors, each in a 2mg and a 5mg Delta 9 THC dosage:
--   Day Drinking  - Lemonberry Ice
--   Evening Buzz  - Black Cherry Vanilla
-- Both ship as a 4-pack or a 24-can case (6 x 4-packs). Ambassador shipments are logged in
-- cases (ambassador_inventory_shipments.cases_sent), so cans_per_case is the 24-can case.
--
-- Contact fields are blank until Kick Fizz's point of contact is known (clients.contact_* are
-- NOT NULL, so '' is used rather than a made-up address). Fill them in on the clients row.
-- The company_name must stay exactly 'Kick Fizz': the dashboard APIs match on it, and
-- fn_events_set_client_id() resolves events.client_id from events.brand_name against it.

INSERT INTO public.clients (company_name, contact_name, contact_email, contact_phone, notes)
SELECT 'Kick Fizz', '', '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM public.clients WHERE LOWER(TRIM(company_name)) = 'kick fizz'
);

INSERT INTO public.inventory_skus (sku, flavor_name, brand, cans_per_case, potency_mg, product_line)
VALUES
  ('KICKFIZZ-DAYDRINKING-2MG',  'Day Drinking - Lemonberry Ice',        'Kick Fizz', 24, 2, 'day_drinking'),
  ('KICKFIZZ-DAYDRINKING-5MG',  'Day Drinking - Lemonberry Ice',        'Kick Fizz', 24, 5, 'day_drinking'),
  ('KICKFIZZ-EVENINGBUZZ-2MG',  'Evening Buzz - Black Cherry Vanilla',  'Kick Fizz', 24, 2, 'evening_buzz'),
  ('KICKFIZZ-EVENINGBUZZ-5MG',  'Evening Buzz - Black Cherry Vanilla',  'Kick Fizz', 24, 5, 'evening_buzz')
ON CONFLICT (sku) DO NOTHING;
