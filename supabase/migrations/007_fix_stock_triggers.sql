-- 007_fix_stock_triggers.sql
-- Fix migration 006: triggers referenced wrong column names
-- (type/qty/purchase_order_id vs actual movement_type/quantity_change/reference_id)

-- 1. Negative-stock lock: กันเบิกจนติดลบ (ใช้ sum ของ stock_movements ซึ่งเป็นค่าจริงที่แอปใช้คำนวณสต็อก)
CREATE OR REPLACE FUNCTION public.check_negative_stock()
RETURNS TRIGGER AS $$
DECLARE
  current_qty numeric;
BEGIN
  IF COALESCE(NEW.quantity_change, 0) >= 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.lot_id IS NOT NULL THEN
    SELECT COALESCE(SUM(quantity_change), 0) INTO current_qty
    FROM public.stock_movements
    WHERE lot_id = NEW.lot_id;
    IF current_qty + NEW.quantity_change < 0 THEN
      RAISE EXCEPTION 'Negative stock not allowed: lot % has qty %, trying to move %', NEW.lot_id, current_qty, NEW.quantity_change;
    END IF;
  ELSIF NEW.product_id IS NOT NULL THEN
    SELECT COALESCE(SUM(quantity_change), 0) INTO current_qty
    FROM public.stock_movements
    WHERE product_id = NEW.product_id;
    IF current_qty + NEW.quantity_change < 0 THEN
      RAISE EXCEPTION 'Negative stock not allowed: product % total qty %, trying to move %', NEW.product_id, current_qty, NEW.quantity_change;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_check_negative_stock ON public.stock_movements;
CREATE TRIGGER trg_check_negative_stock
  BEFORE INSERT OR UPDATE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION check_negative_stock();

-- 2. PO -> Receive binding: กันรับเกิน/ซ้ำ (validate ผ่าน trigger; quantity_received จัดการโดยแอป)
CREATE OR REPLACE FUNCTION public.check_po_receive_binding()
RETURNS TRIGGER AS $$
DECLARE
  po_item_record RECORD;
  po_status_text text;
  already_received numeric;
BEGIN
  IF NEW.movement_type <> 'stock_in' OR NEW.reference_type <> 'purchase_order' OR NEW.reference_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status INTO po_status_text FROM public.purchase_orders WHERE id = NEW.reference_id::uuid;
  IF po_status_text IS NULL THEN
    RAISE EXCEPTION 'Purchase order not found: %', NEW.reference_id;
  END IF;
  IF po_status_text = 'received' THEN
    RAISE EXCEPTION 'Purchase order already received: %', NEW.reference_id;
  END IF;

  SELECT * INTO po_item_record
  FROM public.purchase_order_items
  WHERE po_id = NEW.reference_id::uuid
    AND product_id = NEW.product_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PO item not found for PO % product %', NEW.reference_id, NEW.product_id;
  END IF;

  SELECT COALESCE(SUM(quantity_change), 0) INTO already_received
  FROM public.stock_movements
  WHERE reference_type = 'purchase_order'
    AND reference_id = NEW.reference_id
    AND product_id = NEW.product_id;

  IF already_received + COALESCE(NEW.quantity_change, 0) > po_item_record.quantity_ordered THEN
    RAISE EXCEPTION 'Receive exceeds PO qty: PO % product % ordered % already received % trying to receive %',
      NEW.reference_id, NEW.product_id, po_item_record.quantity_ordered, already_received, COALESCE(NEW.quantity_change, 0);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_check_po_receive ON public.stock_movements;
CREATE TRIGGER trg_check_po_receive
  BEFORE INSERT OR UPDATE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION check_po_receive_binding();

-- 3. ลบ trigger เดิมที่อัปเดต quantity_received อัตโนมัติ (แอปจัดการเอง ทำให้ไม่นับซ้ำ)
DROP TRIGGER IF EXISTS trg_update_po_received ON public.stock_movements;
