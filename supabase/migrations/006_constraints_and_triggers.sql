-- 006_constraints_and_triggers.sql

-- 1. Negative-stock lock: กันเบิกจนติดลบ
CREATE OR REPLACE FUNCTION check_negative_stock()
RETURNS TRIGGER AS $$
DECLARE
  current_qty numeric;
BEGIN
  IF NEW.qty >= 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.lot_id IS NOT NULL THEN
    SELECT qty INTO current_qty FROM lots WHERE id = NEW.lot_id FOR SHARE;
    IF current_qty IS NULL THEN
      RAISE EXCEPTION 'Lot not found: %', NEW.lot_id;
    END IF;
    IF current_qty + NEW.qty < 0 THEN
      RAISE EXCEPTION 'Negative stock not allowed: lot % has qty %, trying to move %', NEW.lot_id, current_qty, NEW.qty;
    END IF;
  ELSIF NEW.product_id IS NOT NULL THEN
    SELECT COALESCE(SUM(qty), 0) INTO current_qty FROM lots WHERE product_id = NEW.product_id;
    IF current_qty + NEW.qty < 0 THEN
      RAISE EXCEPTION 'Negative stock not allowed: product % total qty %, trying to move %', NEW.product_id, current_qty, NEW.qty;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_check_negative_stock ON stock_movements;
CREATE TRIGGER trg_check_negative_stock
BEFORE INSERT OR UPDATE ON stock_movements
FOR EACH ROW EXECUTE FUNCTION check_negative_stock();

-- 2. PO → Receive binding: กันรับเกิน/ซ้ำ
CREATE OR REPLACE FUNCTION check_po_receive_binding()
RETURNS TRIGGER AS $$
DECLARE
  po_item_record RECORD;
  new_received numeric;
BEGIN
  IF NEW.type <> 'IN' OR NEW.purchase_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO po_item_record
  FROM purchase_order_items
  WHERE purchase_order_id = NEW.purchase_order_id
    AND product_id = NEW.product_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PO item not found for PO % product %', NEW.purchase_order_id, NEW.product_id;
  END IF;

  new_received := po_item_record.qty_received + COALESCE(NEW.qty, 0);
  IF new_received > po_item_record.qty THEN
    RAISE EXCEPTION 'Receive exceeds PO qty: PO % product % ordered % already received % trying to receive %',
      NEW.purchase_order_id, NEW.product_id, po_item_record.qty, po_item_record.qty_received, COALESCE(NEW.qty, 0);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_check_po_receive ON stock_movements;
CREATE TRIGGER trg_check_po_receive
BEFORE INSERT OR UPDATE ON stock_movements
FOR EACH ROW EXECUTE FUNCTION check_po_receive_binding();

-- 3. Update PO qty_received on receive
CREATE OR REPLACE FUNCTION update_po_received_qty()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'IN' AND NEW.purchase_order_id IS NOT NULL THEN
    UPDATE purchase_order_items
    SET qty_received = qty_received + COALESCE(NEW.qty, 0)
    WHERE purchase_order_id = NEW.purchase_order_id
      AND product_id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_update_po_received ON stock_movements;
CREATE TRIGGER trg_update_po_received
AFTER INSERT OR UPDATE ON stock_movements
FOR EACH ROW EXECUTE FUNCTION update_po_received_qty();

-- 4. Stock snapshot: ตารางเก็บ snapshot ยอดคงเหลือทุกวัน (รันผ่าน pg_cron หรือ job)
CREATE TABLE IF NOT EXISTS stock_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL,
  product_id uuid NOT NULL REFERENCES products(id),
  lot_id uuid REFERENCES lots(id),
  qty numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (snapshot_date, product_id, lot_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_snapshots_date_product ON stock_snapshots(snapshot_date, product_id);

-- Function สร้าง snapshot (เรียกจาก cron job)
CREATE OR REPLACE FUNCTION create_daily_stock_snapshot(target_date date DEFAULT CURRENT_DATE)
RETURNS void AS $$
BEGIN
  INSERT INTO stock_snapshots (snapshot_date, product_id, lot_id, qty)
  SELECT target_date, l.product_id, l.id, l.qty
  FROM lots l
  WHERE l.qty > 0
  ON CONFLICT (snapshot_date, product_id, lot_id) DO UPDATE SET qty = EXCLUDED.qty;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 5. Audit trigger สำหรับ stock_snapshots
DROP TRIGGER IF EXISTS trg_audit_stock_snapshots ON stock_snapshots;
CREATE TRIGGER trg_audit_stock_snapshots
AFTER INSERT OR UPDATE OR DELETE ON stock_snapshots
FOR EACH ROW EXECUTE FUNCTION audit_trail_trigger();

-- Grant
GRANT EXECUTE ON FUNCTION create_daily_stock_snapshot(date) TO postgres, authenticated;
GRANT SELECT, INSERT ON stock_snapshots TO authenticated;