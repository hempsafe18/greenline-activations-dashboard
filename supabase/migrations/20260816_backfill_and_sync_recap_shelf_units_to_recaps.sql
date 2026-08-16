-- Backfill the flattened per-flavor shelf-unit columns on recaps from
-- recap_shelf_units, which is the actual source of the per-SKU counts
-- submitted by reps. SKU -> flavor mapping comes from inventory_skus:
--   2126280039 = Key Lime Margarita
--   2126280040 = Watermelon Mojito
--   2126280041 = Cherry Limeade

UPDATE recaps r
SET units_start_key_lime = su.units_start,
    units_end_key_lime = su.units_end
FROM recap_shelf_units su
WHERE su.recap_id = r.id AND su.sku = '2126280039';

UPDATE recaps r
SET units_start_watermelon_mojito = su.units_start,
    units_end_watermelon_mojito = su.units_end
FROM recap_shelf_units su
WHERE su.recap_id = r.id AND su.sku = '2126280040';

UPDATE recaps r
SET units_start_cherry_limeade = su.units_start,
    units_end_cherry_limeade = su.units_end
FROM recap_shelf_units su
WHERE su.recap_id = r.id AND su.sku = '2126280041';

-- Keep them in sync going forward: whenever a shelf-unit row is inserted
-- or updated, mirror it onto the matching flattened column on recaps.
CREATE OR REPLACE FUNCTION sync_recap_shelf_units_to_recap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.sku = '2126280039' THEN
    UPDATE recaps SET units_start_key_lime = NEW.units_start, units_end_key_lime = NEW.units_end WHERE id = NEW.recap_id;
  ELSIF NEW.sku = '2126280040' THEN
    UPDATE recaps SET units_start_watermelon_mojito = NEW.units_start, units_end_watermelon_mojito = NEW.units_end WHERE id = NEW.recap_id;
  ELSIF NEW.sku = '2126280041' THEN
    UPDATE recaps SET units_start_cherry_limeade = NEW.units_start, units_end_cherry_limeade = NEW.units_end WHERE id = NEW.recap_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_recap_shelf_units ON recap_shelf_units;
CREATE TRIGGER trg_sync_recap_shelf_units
AFTER INSERT OR UPDATE ON recap_shelf_units
FOR EACH ROW
EXECUTE FUNCTION sync_recap_shelf_units_to_recap();
