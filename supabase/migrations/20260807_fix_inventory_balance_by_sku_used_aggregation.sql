-- inventory_balance_by_sku read 0 total_cans_used company-wide because its `used`
-- subquery joined on `used.user_id = sent.user_id` — coupling usage aggregation to
-- whichever ambassadors happened to have shipments recorded. With
-- ambassador_inventory_shipments empty, `sent` (and therefore sent.user_id) was NULL
-- for every SKU, so `used.user_id = NULL` never matched and usage was dropped
-- entirely, even though inventory_balance_by_ambassador summed it correctly.
-- Fix: aggregate cans used per SKU independently of shipments, then combine.
CREATE OR REPLACE VIEW public.inventory_balance_by_sku
WITH (security_invoker = true) AS
SELECT
  s.sku,
  s.flavor_name,
  s.cans_per_case,
  COALESCE(sent.total_cases_sent, 0::numeric) AS total_cases_sent,
  COALESCE(sent.total_cases_sent, 0::numeric) * s.cans_per_case::numeric AS total_cans_sent,
  COALESCE(used.total_cans_used, 0::numeric) AS total_cans_used,
  (COALESCE(sent.total_cases_sent, 0::numeric) * s.cans_per_case::numeric) - COALESCE(used.total_cans_used, 0::numeric) AS calculated_cans_remaining,
  round(
    ((COALESCE(sent.total_cases_sent, 0::numeric) * s.cans_per_case::numeric) - COALESCE(used.total_cans_used, 0::numeric))
      / NULLIF(s.cans_per_case, 0)::numeric,
    2
  ) AS calculated_cases_remaining
FROM inventory_skus s
LEFT JOIN (
  SELECT sku, SUM(cases_sent) AS total_cases_sent
  FROM ambassador_inventory_shipments
  GROUP BY sku
) sent ON sent.sku = s.sku
LEFT JOIN (
  SELECT sku, SUM(cans_used) AS total_cans_used
  FROM recap_inventory_usage
  GROUP BY sku
) used ON used.sku = s.sku;
