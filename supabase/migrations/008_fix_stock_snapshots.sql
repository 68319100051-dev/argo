-- 008_fix_stock_snapshots.sql
-- Fix create_daily_stock_snapshot: original referenced lots.qty (doesn't exist)
-- and only captured per_lot products. New version captures both:
--   - per_lot  : qty from lots.quantity (grouped by lot)
--   - per_unit : qty from stock_movements sum (grouped by product, lot_id null)

create or replace function public.create_daily_stock_snapshot(target_date date default current_date)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- per_lot products: snapshot each active lot
  insert into public.stock_snapshots (snapshot_date, product_id, lot_id, qty)
  select target_date, l.product_id, l.id, l.quantity
  from public.lots l
  where l.is_active and l.quantity > 0
  on conflict (snapshot_date, product_id, lot_id) do update set qty = excluded.qty;

  -- per_unit products: sum of stock movements (no lot)
  insert into public.stock_snapshots (snapshot_date, product_id, lot_id, qty)
  select target_date, m.product_id, null, sum(m.quantity_change)
  from public.stock_movements m
  join public.products p on p.id = m.product_id
  where p.tracking_mode = 'per_unit'
  group by m.product_id
  having sum(m.quantity_change) > 0
  on conflict (snapshot_date, product_id, lot_id) do update set qty = excluded.qty;

  return;
end;
$function$;

grant execute on function public.create_daily_stock_snapshot(date) to postgres, authenticated;

-- Daily cron at 00:30 ICT (17:30 UTC)
select cron.schedule(
  'daily-stock-snapshot',
  '30 17 * * *',
  $$select public.create_daily_stock_snapshot(current_date)$$
);
