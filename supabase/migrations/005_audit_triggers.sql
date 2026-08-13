-- 005: Audit trail via DB triggers
-- แทนที่ logAudit ที่เรียกจาก client (ซึ่งไม่เคยถูกใช้) ด้วย trigger ระดับ DB
-- เพื่อให้ทุก insert/update/delete ถูกบันทึกอัตโนมัติ ไม่สามารถบายพาสได้

-- 1) changed_by ต้องเป็น nullable เพราะ operation ที่มาจาก service role (เช่น invite, auto-create) จะไม่มี auth.uid()
alter table public.audit_trail alter column changed_by drop not null;

-- 2) ฟังก์ชัน trigger
create or replace function public.audit_trail_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.audit_trail (table_name, record_id, action, old_data, new_data, changed_by)
    values (tg_table_name, new.id, 'INSERT', null, to_jsonb(new), auth.uid());
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into public.audit_trail (table_name, record_id, action, old_data, new_data, changed_by)
    values (tg_table_name, new.id, 'UPDATE', to_jsonb(old), to_jsonb(new), auth.uid());
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.audit_trail (table_name, record_id, action, old_data, new_data, changed_by)
    values (tg_table_name, old.id, 'DELETE', to_jsonb(old), null, auth.uid());
    return old;
  end if;
  return null;
end;
$$;

-- 3) แนบ trigger กับตารางหลักทั้งหมด
drop trigger if exists trg_audit_products on public.products;
create trigger trg_audit_products
  after insert or update or delete on public.products
  for each row execute function public.audit_trail_trigger();

drop trigger if exists trg_audit_lots on public.lots;
create trigger trg_audit_lots
  after insert or update or delete on public.lots
  for each row execute function public.audit_trail_trigger();

drop trigger if exists trg_audit_stock_movements on public.stock_movements;
create trigger trg_audit_stock_movements
  after insert or update or delete on public.stock_movements
  for each row execute function public.audit_trail_trigger();

drop trigger if exists trg_audit_suppliers on public.suppliers;
create trigger trg_audit_suppliers
  after insert or update or delete on public.suppliers
  for each row execute function public.audit_trail_trigger();

drop trigger if exists trg_audit_purchase_orders on public.purchase_orders;
create trigger trg_audit_purchase_orders
  after insert or update or delete on public.purchase_orders
  for each row execute function public.audit_trail_trigger();

drop trigger if exists trg_audit_purchase_order_items on public.purchase_order_items;
create trigger trg_audit_purchase_order_items
  after insert or update or delete on public.purchase_order_items
  for each row execute function public.audit_trail_trigger();

drop trigger if exists trg_audit_cycle_counts on public.cycle_counts;
create trigger trg_audit_cycle_counts
  after insert or update or delete on public.cycle_counts
  for each row execute function public.audit_trail_trigger();

drop trigger if exists trg_audit_users on public.users;
create trigger trg_audit_users
  after insert or update or delete on public.users
  for each row execute function public.audit_trail_trigger();

drop trigger if exists trg_audit_ai_settings on public.ai_settings;
create trigger trg_audit_ai_settings
  after insert or update or delete on public.ai_settings
  for each row execute function public.audit_trail_trigger();
