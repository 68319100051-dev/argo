-- ARGO Initial Schema
-- Run this in Supabase SQL Editor

-- 1. Roles
create table roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (name in ('warehouse_staff', 'warehouse_head', 'admin')),
  description text,
  created_at  timestamptz not null default now()
);

-- 2. Users (extends Supabase auth.users)
create table users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null unique,
  display_name  text not null,
  role_id       uuid not null references roles(id),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 3. Products
create table products (
  id                uuid primary key default gen_random_uuid(),
  sku               text not null unique,
  name              text not null,
  description       text,
  category          text,
  unit              text not null default 'ชิ้น',
  tracking_mode     text not null check (tracking_mode in ('per_unit', 'per_lot')) default 'per_unit',
  reorder_point     integer not null default 0,
  price             numeric(12,2) default 0,
  is_active         boolean not null default true,
  created_by        uuid references users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_products_sku on products(sku);
create index idx_products_category on products(category);

-- 4. Lots (only used when tracking_mode = 'per_lot')
create table lots (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references products(id) on delete cascade,
  lot_number        text not null,
  quantity          integer not null default 0,
  location          text,
  expiry_date       date,
  qr_code           text unique,
  is_active         boolean not null default true,
  created_by        uuid references users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(product_id, lot_number)
);

create index idx_lots_product on lots(product_id);
create index idx_lots_qr on lots(qr_code);
create index idx_lots_location on lots(location);

-- 5. Stock movements (audit trail for every stock change)
create table stock_movements (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references products(id),
  lot_id            uuid references lots(id),
  movement_type     text not null check (movement_type in ('stock_in', 'stock_out', 'transfer', 'cycle_count_adjust', 'return')),
  quantity_change   integer not null, -- positive = in, negative = out
  location          text,
  reference_type    text check (reference_type in ('purchase_order', 'transfer_order', 'cycle_count', 'manual')),
  reference_id      text,
  note              text,
  performed_by      uuid not null references users(id),
  created_at        timestamptz not null default now()
);

create index idx_stock_movements_product on stock_movements(product_id);
create index idx_stock_movements_lot on stock_movements(lot_id);
create index idx_stock_movements_type on stock_movements(movement_type);
create index idx_stock_movements_created on stock_movements(created_at);

-- 6. Suppliers
create table suppliers (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  name              text not null,
  contact_person    text,
  phone             text,
  email             text,
  address           text,
  is_active         boolean not null default true,
  created_by        uuid references users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_suppliers_code on suppliers(code);

-- 7. Purchase orders
create type po_status as enum ('draft', 'pending_approval', 'approved', 'received', 'cancelled');

create table purchase_orders (
  id                uuid primary key default gen_random_uuid(),
  po_number         text not null unique,
  supplier_id       uuid not null references suppliers(id),
  status            po_status not null default 'draft',
  order_date        date not null default current_date,
  expected_date     date,
  notes             text,
  total_amount      numeric(12,2) default 0,
  created_by        uuid not null references users(id),
  approved_by       uuid references users(id),
  approved_at       timestamptz,
  received_by       uuid references users(id),
  received_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_po_supplier on purchase_orders(supplier_id);
create index idx_po_status on purchase_orders(status);

-- 8. Purchase order items
create table purchase_order_items (
  id                uuid primary key default gen_random_uuid(),
  po_id             uuid not null references purchase_orders(id) on delete cascade,
  product_id        uuid not null references products(id),
  quantity_ordered  integer not null,
  quantity_received integer not null default 0,
  unit_price        numeric(12,2) not null default 0,
  created_at        timestamptz not null default now()
);

create index idx_poi_po on purchase_order_items(po_id);

-- 9. Cycle counts
create table cycle_counts (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references products(id),
  lot_id            uuid references lots(id),
  system_quantity   integer not null,
  actual_quantity   integer not null,
  variance          integer not null,
  location          text,
  notes             text,
  status            text not null check (status in ('pending', 'verified', 'resolved')) default 'pending',
  counted_by        uuid not null references users(id),
  verified_by       uuid references users(id),
  counted_at        timestamptz not null default now(),
  verified_at       timestamptz,
  created_at        timestamptz not null default now()
);

create index idx_cc_product on cycle_counts(product_id);
create index idx_cc_status on cycle_counts(status);

-- 10. Agent activity log (AI layer)
create table agent_activity_log (
  id                uuid primary key default gen_random_uuid(),
  agent_type        text not null check (agent_type in ('forecasting', 'chat', 'anomaly', 'ocr', 'orchestrator')),
  action            text not null,
  summary           text,
  details           jsonb,
  requires_review   boolean not null default false,
  review_status     text check (review_status in ('pending', 'approved', 'rejected')) default 'pending',
  reviewed_by       uuid references users(id),
  reviewed_at       timestamptz,
  created_by        uuid references users(id),
  created_at        timestamptz not null default now()
);

create index idx_agent_type on agent_activity_log(agent_type);
create index idx_agent_review on agent_activity_log(review_status) where review_status = 'pending';

-- 11. Audit trail (all data changes)
create table audit_trail (
  id                uuid primary key default gen_random_uuid(),
  table_name        text not null,
  record_id         uuid not null,
  action            text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data          jsonb,
  new_data          jsonb,
  changed_by        uuid not null references users(id),
  ip_address        text,
  created_at        timestamptz not null default now()
);

create index idx_audit_table on audit_trail(table_name);
create index idx_audit_record on audit_trail(record_id);
create index idx_audit_created on audit_trail(created_at);

-- 12. AI settings (admin config)
create table ai_settings (
  id                uuid primary key default gen_random_uuid(),
  agent_type        text not null unique check (agent_type in ('forecasting', 'chat', 'anomaly', 'ocr', 'orchestrator')),
  is_enabled        boolean not null default true,
  spending_limit    numeric(10,2),
  extra_config      jsonb,
  updated_by        uuid references users(id),
  updated_at        timestamptz not null default now()
);

-- ========== ROW LEVEL SECURITY ==========

-- Enable RLS on all tables
alter table roles enable row level security;
alter table users enable row level security;
alter table products enable row level security;
alter table lots enable row level security;
alter table stock_movements enable row level security;
alter table suppliers enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;
alter table cycle_counts enable row level security;
alter table agent_activity_log enable row level security;
alter table audit_trail enable row level security;
alter table ai_settings enable row level security;

-- Helper: get current user's role
create or replace function current_user_role()
returns text
language sql
stable
as $$
  select r.name
  from users u
  join roles r on r.id = u.role_id
  where u.id = auth.uid();
$$;

-- Helper: check if user has role
create or replace function has_role(required_role text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from users u
    join roles r on r.id = u.role_id
    where u.id = auth.uid() and r.name = required_role
  );
$$;

-- RLS Policies

-- roles: everyone can read, only admin can write
create policy "roles_read_all" on roles for select using (true);
create policy "roles_write_admin" on roles for all using (has_role('admin'));

-- users: read own, admin read all; write only admin
create policy "users_read_own" on users for select using (id = auth.uid());
create policy "users_read_admin" on users for select using (has_role('admin'));
create policy "users_write_admin" on users for all using (has_role('admin'));

-- products: all authenticated can read; warehouse_head+admin can write
create policy "products_read_all" on products for select using (auth.role() = 'authenticated');
create policy "products_write_head_and_admin" on products for all using (has_role('admin') or has_role('warehouse_head'));

-- lots: all authenticated can read; warehouse_head+admin can write
create policy "lots_read_all" on lots for select using (auth.role() = 'authenticated');
create policy "lots_write_head_and_admin" on lots for all using (has_role('admin') or has_role('warehouse_head'));

-- stock_movements: all authenticated can read; all can insert (for stock ops), only admin can delete
create policy "movements_read_all" on stock_movements for select using (auth.role() = 'authenticated');
create policy "movements_insert_all" on stock_movements for insert with check (auth.role() = 'authenticated');
create policy "movements_delete_admin" on stock_movements for delete using (has_role('admin'));

-- suppliers: all authenticated can read; warehouse_head+admin can write
create policy "suppliers_read_all" on suppliers for select using (auth.role() = 'authenticated');
create policy "suppliers_write_head_and_admin" on suppliers for all using (has_role('admin') or has_role('warehouse_head'));

-- purchase_orders: all authenticated can read; insert all, approve only head/admin
create policy "po_read_all" on purchase_orders for select using (auth.role() = 'authenticated');
create policy "po_insert_all" on purchase_orders for insert with check (auth.role() = 'authenticated');
create policy "po_update_head_admin" on purchase_orders for update using (has_role('admin') or has_role('warehouse_head'));
create policy "po_delete_admin" on purchase_orders for delete using (has_role('admin'));

-- purchase_order_items: inherit from purchase_orders
create policy "poi_read_all" on purchase_order_items for select using (auth.role() = 'authenticated');
create policy "poi_write" on purchase_order_items for all using (has_role('admin') or has_role('warehouse_head'));

-- cycle_counts: all authenticated can read and insert; verify only head/admin
create policy "cc_read_all" on cycle_counts for select using (auth.role() = 'authenticated');
create policy "cc_insert_all" on cycle_counts for insert with check (auth.role() = 'authenticated');
create policy "cc_verify_head_admin" on cycle_counts for update using (has_role('admin') or has_role('warehouse_head'));

-- agent_activity_log: all authenticated can read and insert; review by head/admin
create policy "agent_log_read_all" on agent_activity_log for select using (auth.role() = 'authenticated');
create policy "agent_log_insert" on agent_activity_log for insert with check (auth.role() = 'authenticated');
create policy "agent_log_review" on agent_activity_log for update using (has_role('admin') or has_role('warehouse_head'));

-- audit_trail: all authenticated can read, only trigger/service can write
create policy "audit_read_all" on audit_trail for select using (auth.role() = 'authenticated');
create policy "audit_insert_service" on audit_trail for insert with check (auth.role() = 'authenticated');

-- ai_settings: read all authenticated, write only admin
create policy "ai_settings_read_all" on ai_settings for select using (auth.role() = 'authenticated');
create policy "ai_settings_write_admin" on ai_settings for all using (has_role('admin'));

-- ========== SEED DATA ==========

insert into roles (name, description) values
  ('warehouse_staff', 'พนักงานคลัง - เบิกสินค้า, รับเข้า, นับสต็อก'),
  ('warehouse_head', 'หัวหน้าคลัง - อนุมัติ PO, ตรวจสอบ cycle count, จัดการสินค้า'),
  ('admin', 'ผู้ดูแลระบบ - จัดการผู้ใช้, ตั้งค่าระบบ, ดู audit trail');

insert into ai_settings (agent_type, is_enabled) values
  ('forecasting', true),
  ('chat', true),
  ('anomaly', true),
  ('ocr', true),
  ('orchestrator', true);
