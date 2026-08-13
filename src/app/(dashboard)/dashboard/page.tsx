"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/supabase/types";
import { getExpiringLots, type ExpiringLot } from "@/lib/ai/tools";
import {
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  Banknote,
  Boxes,
  PackageOpen,
  Truck,
  Loader2,
} from "lucide-react";

interface MovementRow {
  id: string;
  created_at: string;
  movement_type: string;
  product_name: string;
  product_sku: string;
  quantity_change: number;
}

const movementBadgeVariant: Record<string, "success" | "danger" | "default" | "warning"> = {
  stock_in: "success",
  stock_out: "danger",
  transfer: "default",
  cycle_count_adjust: "warning",
  adjustment: "warning",
};

const movementTypeLabels: Record<string, string> = {
  stock_in: "รับเข้า",
  stock_out: "เบิกออก",
  transfer: "โอนย้าย",
  cycle_count_adjust: "ปรับปรุงสต็อก",
  return: "คืนสินค้า",
  adjustment: "ปรับยอด",
};

export default function DashboardPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);
  const [stockInToday, setStockInToday] = useState(0);
  const [stockOutToday, setStockOutToday] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [totalLots, setTotalLots] = useState(0);
  const [inventoryValue, setInventoryValue] = useState(0);
  const [totalStockInAll, setTotalStockInAll] = useState(0);
  const [totalStockOutAll, setTotalStockOutAll] = useState(0);
  const [recentMovements, setRecentMovements] = useState<MovementRow[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [lowStockCurrentStock, setLowStockCurrentStock] = useState<Record<string, number>>({});
  const [expiringLots, setExpiringLots] = useState<ExpiringLot[]>([]);

  const fetchData = useCallback(async () => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayISO = startOfToday.toISOString();

    const { count: activeCount } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);
    setTotalProducts(activeCount ?? 0);

    const { count: inCount } = await supabase
      .from("stock_movements")
      .select("*", { count: "exact", head: true })
      .eq("movement_type", "stock_in")
      .gte("created_at", startOfTodayISO);
    setStockInToday(inCount ?? 0);

    const { count: outCount } = await supabase
      .from("stock_movements")
      .select("*", { count: "exact", head: true })
      .eq("movement_type", "stock_out")
      .gte("created_at", startOfTodayISO);
    setStockOutToday(outCount ?? 0);

    const { count: activeLots } = await supabase
      .from("lots")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);
    setTotalLots(activeLots ?? 0);

    const { data: lotsWithPrice } = await supabase
      .from("lots")
      .select("quantity, product:products(price)")
      .eq("is_active", true);

    if (lotsWithPrice) {
      let total = 0;
      for (const lot of lotsWithPrice) {
        const product = lot.product as unknown as
          | { price: number | null }
          | { price: number | null }[]
          | null;
        const price =
          (Array.isArray(product) ? product[0]?.price : product?.price) ?? 0;
        total += (lot.quantity ?? 0) * price;
      }
      setInventoryValue(total);
    }

    const { data: inRows } = await supabase
      .from("stock_movements")
      .select("quantity_change")
      .eq("movement_type", "stock_in");
    setTotalStockInAll(
      (inRows ?? []).reduce((sum, r) => sum + (r.quantity_change ?? 0), 0)
    );

    const { data: outRows } = await supabase
      .from("stock_movements")
      .select("quantity_change")
      .eq("movement_type", "stock_out");
    setTotalStockOutAll(
      (outRows ?? []).reduce((sum, r) => sum + Math.abs(r.quantity_change ?? 0), 0)
    );

    const { data: movements } = await supabase
      .from("stock_movements")
      .select(`
        id,
        created_at,
        movement_type,
        quantity_change,
        product:products(name, sku)
      `)
      .order("created_at", { ascending: false })
      .limit(10);

    if (movements) {
      const mapped: MovementRow[] = movements.map((item: Record<string, unknown>) => {
        const product = item.product as { name: string; sku: string } | null;
        return {
          id: item.id as string,
          created_at: item.created_at as string,
          movement_type: item.movement_type as string,
          product_name: product?.name ?? "",
          product_sku: product?.sku ?? "",
          quantity_change: item.quantity_change as number,
        };
      });
      setRecentMovements(mapped);
    }

    const { data: activeProducts } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true);

    if (activeProducts) {
      const productIds = activeProducts.map((p) => p.id);

      const { data: allMovements } = await supabase
        .from("stock_movements")
        .select("product_id, quantity_change")
        .in("product_id", productIds);

      const stockMap: Record<string, number> = {};
      for (const m of allMovements ?? []) {
        stockMap[m.product_id] = (stockMap[m.product_id] ?? 0) + m.quantity_change;
      }

      const lowStock = activeProducts.filter(
        (p) => (stockMap[p.id] ?? 0) < p.reorder_point
      );

      const stockPerLowProduct: Record<string, number> = {};
      for (const p of lowStock) {
        stockPerLowProduct[p.id] = stockMap[p.id] ?? 0;
      }

      setLowStockCount(lowStock.length);
      setLowStockProducts(lowStock);
      setLowStockCurrentStock(stockPerLowProduct);
    }

    if (typeof supabase !== "undefined") {
      const client = supabase as unknown as Parameters<typeof getExpiringLots>[0];
      const lots = await getExpiringLots(client);
      setExpiringLots(lots);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void (async () => {
      await fetchData();
    })();
  }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchData();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const stats: {
    label: string;
    value: number;
    icon: typeof Package;
    tile: string;
    shadow: string;
    formatValue?: (value: number) => string;
  }[] = [
    {
      label: "สินค้าทั้งหมด",
      value: totalProducts,
      icon: Package,
      tile: "from-indigo-500 to-indigo-600",
      shadow: "shadow-indigo-500/30",
    },
    {
      label: "รับเข้าวันนี้",
      value: stockInToday,
      icon: ArrowDownToLine,
      tile: "from-emerald-500 to-teal-600",
      shadow: "shadow-emerald-500/30",
    },
    {
      label: "เบิกออกวันนี้",
      value: stockOutToday,
      icon: ArrowUpFromLine,
      tile: "from-amber-500 to-orange-600",
      shadow: "shadow-amber-500/30",
    },
    {
      label: "สินค้าใกล้หมด",
      value: lowStockCount,
      icon: AlertTriangle,
      tile: "from-rose-500 to-red-600",
      shadow: "shadow-rose-500/30",
    },
    {
      label: "ล็อตในสต็อก",
      value: totalLots,
      icon: Boxes,
      tile: "from-sky-500 to-blue-600",
      shadow: "shadow-sky-500/30",
    },
    {
      label: "มูลค่าสินค้าคงคลัง",
      value: inventoryValue,
      icon: Banknote,
      tile: "from-violet-500 to-purple-600",
      shadow: "shadow-violet-500/30",
      formatValue: (v: number) => `${v.toLocaleString("th-TH")} บาท`,
    },
    {
      label: "รับเข้าทั้งหมด",
      value: totalStockInAll,
      icon: PackageOpen,
      tile: "from-teal-500 to-cyan-600",
      shadow: "shadow-teal-500/30",
    },
    {
      label: "เบิกออกทั้งหมด",
      value: totalStockOutAll,
      icon: Truck,
      tile: "from-fuchsia-500 to-pink-600",
      shadow: "shadow-fuchsia-500/30",
    },
  ];

  const todayLabel = new Date().toLocaleDateString("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">แดชบอร์ด</h1>
          <p className="text-sm text-slate-500">ภาพรวมคลังสินค้า</p>
        </div>
        <p className="text-xs font-medium text-slate-400 sm:text-sm">{todayLabel}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((s) => (
              <Card key={s.label}>
                <CardContent className="flex items-center gap-4 p-5 sm:p-6">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${s.tile} text-white shadow-lg ${s.shadow}`}
                  >
                    <s.icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-2xl font-bold tabular-nums tracking-tight text-slate-900">
                      {s.formatValue
                        ? s.formatValue(s.value)
                        : s.value.toLocaleString()}
                    </p>
                    <p className="truncate text-sm text-slate-500">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>การเคลื่อนไหวล่าสุด</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                {recentMovements.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <Package className="h-12 w-12 text-slate-200" />
                    <p className="text-sm text-slate-400">
                      ยังไม่มีข้อมูล — เริ่มต้นด้วยการรับสินค้าเข้า
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-4 py-3 text-left font-medium text-slate-500">เวลา</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-500">ประเภท</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-500">สินค้า</th>
                        <th className="px-4 py-3 text-right font-medium text-slate-500">จำนวน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentMovements.map((m) => (
                        <tr key={m.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/50">
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                            {new Date(m.created_at).toLocaleString("th-TH", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={movementBadgeVariant[m.movement_type] ?? "default"}>
                              {movementTypeLabels[m.movement_type] ?? m.movement_type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span>{m.product_name}</span>
                              <span className="text-xs text-slate-400">{m.product_sku}</span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">
                            {m.quantity_change > 0 ? (
                              <span className="text-emerald-600">
                                +{m.quantity_change.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-red-600">
                                {m.quantity_change.toLocaleString()}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>สินค้าคงเหลือต่ำกว่าเกณฑ์</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                {lowStockProducts.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <Package className="h-12 w-12 text-slate-200" />
                    <p className="text-sm text-slate-400">ไม่มีสินค้าที่ต่ำกว่าเกณฑ์</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-4 py-3 text-left font-medium text-slate-500">สินค้า</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-500">SKU</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-500">หน่วย</th>
                        <th className="px-4 py-3 text-right font-medium text-slate-500">คงเหลือ</th>
                        <th className="px-4 py-3 text-right font-medium text-slate-500">จุดสั่งซื้อ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStockProducts.map((p) => (
                        <tr key={p.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/50">
                          <td className="px-4 py-3 text-slate-900">{p.name}</td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.sku}</td>
                          <td className="px-4 py-3 text-slate-600">{p.unit}</td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums text-red-600">
                            {(lowStockCurrentStock[p.id] ?? 0).toLocaleString()}{" "}
                            {p.unit}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                            {p.reorder_point.toLocaleString()} {p.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>

          {expiringLots.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>สินค้าใกล้หมดอายุ (30 วัน)</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-3 text-left font-medium text-slate-500">สินค้า</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">ล็อต</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-500">คงเหลือ</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">หมดอายุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiringLots.map((lot) => {
                      const expired = new Date(lot.expiry_date) < new Date();
                      return (
                        <tr key={lot.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/50">
                          <td className="px-4 py-3 text-slate-900">{lot.product_name}</td>
                          <td className="px-4 py-3">
                            <Badge variant={expired ? "danger" : "warning"}>{lot.lot_number}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums">
                            {lot.quantity.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className={expired ? "font-medium text-red-600" : "text-slate-600"}>
                              {new Date(lot.expiry_date).toLocaleDateString("th-TH")}
                              {expired && " (หมดอายุแล้ว)"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
