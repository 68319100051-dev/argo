-- 009_stock_adjustment.sql
-- เพิ่ม movement_type 'adjustment' ให้ stock_movements (ปรับยอดสต็อกด้วยมือ)
-- ใช้ reference_type 'manual'

ALTER TABLE public.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check,
  ADD CONSTRAINT stock_movements_movement_type_check
    CHECK (movement_type IN ('stock_in', 'stock_out', 'transfer', 'cycle_count_adjust', 'return', 'adjustment'));