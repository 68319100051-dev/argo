"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Layers,
  Loader2,
} from "lucide-react";

interface MovementRow {
  id: string;
  created_at: string;
  movement_type: string;
  product_name: string;
  product_sku: string;
  product_unit: string;
  quantity_change: number;
}

interface ProductRow {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  location: string;
  stock: number;
  value: number;
}

interface DailyInOut {
  label: string;
  inAmt: number;
  outAmt: number;
}

interface TrendPoint {
  label: string;
  value: number;
}

const movementBadgeVariant: Record<
  string,
  "success" | "danger" | "default" | "warning"
> = {
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

const LOW_STOCK_THRESHOLD = 3;

const NOW_EPOCH = Date.now();

function MiniStackBar({ data }: { data: DailyInOut[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.inAmt, d.outAmt]));
  return (
    <div className="flex h-44 items-end gap-2">
      {data.map((d, i) => (
        <div
          key={i}
          className="flex h-full flex-1 flex-col items-center justify-end gap-1"
        >
          <div className="flex w-full flex-1 items-end justify-center gap-1">
            <div
              className="w-3 rounded-t bg-emerald-500"
              style={{ height: `${(d.inAmt / max) * 88}%` }}
              title={`รับเข้า ${d.inAmt}`}
            />
            <div
              className="w-3 rounded-t bg-amber-500"
              style={{ height: `${(d.outAmt / max) * 88}%` }}
              title={`เบิกออก ${d.outAmt}`}
            />
          </div>
          <span className="text-[10px] text-slate-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function MiniLine({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center text-sm text-slate-400">
        ยังไม่มีข้อมูลแนวโน้ม
      </div>
    );
  }
  const max = Math.max(1, ...data.map((d) => d.value));
  const pts = data
    .map((d, i) => {
      const x = data.length === 1 ? 0 : (i / (data.length - 1)) * 200;
      const y = 60 - (d.value / max) * 52;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <div className="flex h-44 flex-col">
      <svg viewBox="0 0 200 64" className="h-40 w-full">
        <polyline
          points={pts}
          fill="none"
          stroke="#6366f1"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {data.map((d, i) => {
          const x = data.length === 1 ? 0 : (i / (data.length - 1)) * 200;
          const y = 60 - (d.value / max) * 52;
          return <circle key={i} cx={x} cy={y} r="2.2" fill="#6366f1" />;
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);
  const [stockInToday, setStockInToday] = useState(0);
  const [stockOutToday, setStockOutToday] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [totalStockUnits, setTotalStockUnits] = useState(0);
  const [inventoryValue, setInventoryValue] = useState(0);
  const [totalStockInAll, setTotalStockInAll] = useState(0);
  const [totalStockOutAll, setTotalStockOutAll] = useState(0);
  const [recentMovements, setRecentMovements] = useState<MovementRow[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [lowStockCurrentStock, setLowStockCurrentStock] = useState<
    Record<string, number>
  >({});
  const [expiringLots, setExpiringLots] = useState<ExpiringLot[]>([]);
  const [productUnit, setProductUnit] = useState<Record<string, string>>({});
  const [allProducts, setAllProducts] = useState<ProductRow[]>([]);
  const [categoryValue, setCategoryValue] = useState<Record<string, number>>({});
  const [dailyInOut, setDailyInOut] = useState<DailyInOut[]>([]);
  const [stockTrend, setStockTrend] = useState<TrendPoint[]>([]);

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
      .select(
        "id, created_at, movement_type, quantity_change, product:products(name, sku, unit)"
      )
      .order("created_at", { ascending: false })
      .limit(10);

    if (movements) {
      const mapped: MovementRow[] = movements.map(
        (item: Record<string, unknown>) => {
          const product = item.product as {
            name: string;
            sku: string;
            unit: string | null;
          } | null;
          return {
            id: item.id as string,
            created_at: item.created_at as string,
            movement_type: item.movement_type as string,
            product_name: product?.name ?? "",
            product_sku: product?.sku ?? "",
            product_unit: product?.unit ?? "",
            quantity_change: item.quantity_change as number,
          };
        }
      );
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
        stockMap[m.product_id] =
          (stockMap[m.product_id] ?? 0) + (m.quantity_change ?? 0);
      }

      const { data: activeLotsData } = await supabase
        .from("lots")
        .select("product_id, quantity")
        .eq("is_active", true);

      for (const lot of activeLotsData ?? []) {
        stockMap[lot.product_id] =
          (stockMap[lot.product_id] ?? 0) + (lot.quantity ?? 0);
      }

      const { data: lotLocations } = await supabase
        .from("lots")
        .select("product_id, location")
        .eq("is_active", true);

      const locationMap: Record<string, string> = {};
      for (const lot of lotLocations ?? []) {
        if (lot.location && !locationMap[lot.product_id]) {
          locationMap[lot.product_id] = lot.location;
        }
      }

      const lowStock: Product[] = [];
      const stockPerLowProduct: Record<string, number> = {};
      const productRows: ProductRow[] = [];
      const catValue: Record<string, number> = {};
      const unitMap: Record<string, string> = {};
      let totalValue = 0;
      let totalUnits = 0;

      for (const p of activeProducts) {
        const stock = Math.max(0, stockMap[p.id] ?? 0);
        const price = p.price ?? 0;
        const value = price > 0 ? stock * price : 0;

        totalUnits += stock;
        unitMap[p.id] = p.unit ?? "";
        productRows.push({
          id: p.id,
          name: p.name,
          sku: p.sku,
          category: p.category ?? "",
          unit: p.unit ?? "",
          location: locationMap[p.id] ?? "-",
          stock,
          value,
        });

        const cat = p.category || "อื่นๆ";
        catValue[cat] = (catValue[cat] ?? 0) + value;

        if (stock <= LOW_STOCK_THRESHOLD) {
          lowStock.push(p);
          stockPerLowProduct[p.id] = stock;
        }
        totalValue += value;
      }

      setProductUnit(unitMap);
      setLowStockCount(lowStock.length);
      setLowStockProducts(lowStock);
      setLowStockCurrentStock(stockPerLowProduct);
      setInventoryValue(totalValue);
      setTotalStockUnits(totalUnits);
      setAllProducts(productRows);
      setCategoryValue(catValue);
    }

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    weekAgo.setHours(0, 0, 0, 0);
    const { data: weekMovements } = await supabase
      .from("stock_movements")
      .select("created_at, movement_type, quantity_change")
      .in("movement_type", ["stock_in", "stock_out"])
      .gte("created_at", weekAgo.toISOString());

    const dayOfISO = (iso: string) => iso.slice(0, 10);
    const days: DailyInOut[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        label: d.toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
        }),
        inAmt: 0,
        outAmt: 0,
      });
    }
    for (const m of weekMovements ?? []) {
      const fmt = (iso: string | number | Date) =>
        new Date(iso).toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
        });
      const target = days.find((x) => x.label === fmt(m.created_at as string));
      if (!target) continue;
      if (m.movement_type === "stock_in") {
        target.inAmt += m.quantity_change ?? 0;
      } else {
        target.outAmt += Math.abs(m.quantity_change ?? 0);
      }
    }
    setDailyInOut(days);

    const trendStart = new Date();
    trendStart.setDate(trendStart.getDate() - 13);
    const { data: snapshots } = await supabase
      .from("stock_snapshots")
      .select("snapshot_date, qty")
      .gte("snapshot_date", dayOfISO(trendStart.toISOString()))
      .order("snapshot_date", { ascending: true });

    const trendMap: Record<string, number> = {};
    for (const s of snapshots ?? []) {
      trendMap[s.snapshot_date as string] =
        (trendMap[s.snapshot_date as string] ?? 0) + (s.qty ?? 0);
    }
    const trendPts: TrendPoint[] = Object.entries(trendMap).map(([date, value]) => ({
      label: new Date(date).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
      }),
      value: Math.round(value),
    }));
    setStockTrend(trendPts);

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
    suffix: string;
    subtitle?: string;
    icon: typeof Package;
    tile: string;
    shadow: string;
  }[] = [
    {
      label: "สินค้าทั้งหมด",
      value: totalProducts,
      suffix: "รายการ",
      icon: Package,
      tile: "from-indigo-500 to-indigo-600",
      shadow: "shadow-indigo-500/30",
    },
    {
      label: "รับเข้าวันนี้",
      value: stockInToday,
      suffix: "ครั้ง",
      icon: ArrowDownToLine,
      tile: "from-emerald-500 to-teal-600",
      shadow: "shadow-emerald-500/30",
    },
    {
      label: "เบิกออกวันนี้",
      value: stockOutToday,
      suffix: "ครั้ง",
      icon: ArrowUpFromLine,
      tile: "from-amber-500 to-orange-600",
      shadow: "shadow-amber-500/30",
    },
    {
      label: "สินค้าใกล้หมด (≤3)",
      value: lowStockCount,
      suffix: "รายการ",
      icon: AlertTriangle,
      tile: "from-rose-500 to-red-600",
      shadow: "shadow-rose-500/30",
    },
    {
      label: "สินค้าทั้งหมดในคลัง",
      value: totalStockUnits,
      suffix: "ชิ้น",
      icon: Boxes,
      tile: "from-sky-500 to-blue-600",
      shadow: "shadow-sky-500/30",
    },
    {
      label: "ยอดคงเหลือในคลัง",
      value: totalStockUnits,
      suffix: "ชิ้น",
      subtitle: `มูลค่า ${inventoryValue.toLocaleString("th-TH")} บาท`,
      icon: Banknote,
      tile: "from-violet-500 to-purple-600",
      shadow: "shadow-violet-500/30",
    },
    {
      label: "รับเข้าทั้งหมด",
      value: totalStockInAll,
      suffix: "ชิ้น",
      icon: PackageOpen,
      tile: "from-teal-500 to-cyan-600",
      shadow: "shadow-teal-500/30",
    },
    {
      label: "เบิกออกทั้งหมด",
      value: totalStockOutAll,
      suffix: "ชิ้น",
      icon: Truck,
      tile: "from-fuchsia-500 to-pink-600",
      shadow: "shadow-fuchsia-500/30",
    },
  ];

  const categoryEntries = useMemo(
    () =>
      Object.entries(categoryValue)
        .sort((a, b) => b[1] - a[1])
        .filter(([, v]) => v > 0),
    [categoryValue]
  );

  const categoryTotal = categoryEntries.reduce((s, [, v]) => s + v, 0);

  const trendTotal = useMemo(
    () => stockTrend.reduce((s, p) => s + p.value, 0),
    [stockTrend]
  );

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
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            แดชบอร์ด
          </h1>
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
                      {s.value.toLocaleString("th-TH")}
                      <span className="ml-1 text-sm font-medium text-slate-400">
                        {s.suffix}
                      </span>
                    </p>
                    <p className="truncate text-sm text-slate-500">{s.label}</p>
                    {s.subtitle && (
                      <p className="truncate text-xs text-slate-400">{s.subtitle}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>รับ-เบิกสินค้า (7 วัน)</CardTitle>
              </CardHeader>
              <CardContent>
                <MiniStackBar data={dailyInOut} />
                <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> รับเข้า
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> เบิกออก
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>แนวโน้มยอดคงเหลือ (14 วัน)</CardTitle>
              </CardHeader>
              <CardContent>
                <MiniLine data={stockTrend} />
                {trendTotal > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    รวมยอดคงเหลือระยะเวลา 14 วัน:{" "}
                    <span className="font-semibold text-slate-700">
                      {trendTotal.toLocaleString("th-TH")} ชิ้น
                    </span>
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {categoryEntries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>มูลค่าสินค้าคงคลังตามหมวดหมู่</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {categoryEntries.map(([cat, value]) => {
                    const pct =
                      categoryTotal > 0 ? Math.round((value / categoryTotal) * 100) : 0;
                    return (
                      <div key={cat} className="rounded-xl border border-slate-100 p-4">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-700">{cat}</span>
                          <span className="text-xs text-slate-400">
                            {value.toLocaleString("th-TH")} บาท ({pct}%)
                          </span>
                        </div>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>สินค้าทั้งหมด ({allProducts.length})</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left font-medium text-slate-500">สินค้า</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">หมวด</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">ตำแหน่ง</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-500">คงเหลือ</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-500">มูลค่า</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {allProducts.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-slate-100 transition-colors hover:bg-slate-50/50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-slate-900">{p.name}</span>
                          <span className="text-xs text-slate-400">
                            {p.sku} · หน่วย: {p.unit}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.category}</td>
                      <td className="px-4 py-3 text-slate-600">{p.location}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {p.stock.toLocaleString("th-TH")} {p.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                        {p.value.toLocaleString("th-TH")} บาท
                      </td>
                      <td className="px-4 py-3">
                        {p.stock <= LOW_STOCK_THRESHOLD ? (
                          <Badge variant="danger">ใกล้หมด</Badge>
                        ) : p.stock === 0 ? (
                          <Badge variant="default">หมด</Badge>
                        ) : (
                          <Badge variant="success">ปกติ</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>สินค้าใกล้หมด (≤ {LOW_STOCK_THRESHOLD} ชิ้น)</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                {lowStockProducts.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <Package className="h-12 w-12 text-slate-200" />
                    <p className="text-sm text-slate-400">ไม่มีสินค้าที่ใกล้หมด</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-4 py-3 text-left font-medium text-slate-500">สินค้า</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-500">หมวด</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-500">ตำแหน่ง</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-500">หน่วย</th>
                        <th className="px-4 py-3 text-right font-medium text-slate-500">คงเหลือ</th>
                        <th className="px-4 py-3 text-right font-medium text-slate-500">เกณฑ์</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStockProducts.map((p) => (
                        <tr
                          key={p.id}
                          className="border-b border-slate-100 transition-colors hover:bg-slate-50/50"
                        >
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="text-slate-900">{p.name}</span>
                              <span className="text-xs text-slate-400">{p.sku}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{p.category}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {allProducts.find((x) => x.id === p.id)?.location ?? "-"}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{p.unit}</td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums text-red-600">
                            {(lowStockCurrentStock[p.id] ?? 0).toLocaleString("th-TH")}{" "}
                            {p.unit}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                            {LOW_STOCK_THRESHOLD} {p.unit}
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
                        <tr
                          key={m.id}
                          className="border-b border-slate-100 transition-colors hover:bg-slate-50/50"
                        >
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
                              <span className="text-xs text-slate-400">
                                {m.product_sku} · {m.product_unit}
                              </span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">
                            {m.quantity_change > 0 ? (
                              <span className="text-emerald-600">
                                +{m.quantity_change.toLocaleString("th-TH")}{" "}
                                {m.product_unit}
                              </span>
                            ) : (
                              <span className="text-red-600">
                                {m.quantity_change.toLocaleString("th-TH")}{" "}
                                {m.product_unit}
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
          </div>

          {expiringLots.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  สินค้าใกล้หมดอายุ (30 วัน) — {expiringLots.length} ล็อต
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-3 text-left font-medium text-slate-500">สินค้า</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">ล็อต</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-500">คงเหลือ</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-500">เหลือ</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">หมดอายุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiringLots.map((lot) => {
                      const unit = productUnit[lot.product_id] ?? "";
                      const expTime = new Date(lot.expiry_date).getTime();
                      const expired = expTime < NOW_EPOCH;
                      const daysLeft = Math.ceil((expTime - NOW_EPOCH) / 86400000);
                      return (
                        <tr
                          key={lot.id}
                          className="border-b border-slate-100 transition-colors hover:bg-slate-50/50"
                        >
                          <td className="px-4 py-3 text-slate-900">{lot.product_name}</td>
                          <td className="px-4 py-3">
                            <Badge variant={expired ? "danger" : "warning"}>
                              {lot.lot_number}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums">
                            {lot.quantity.toLocaleString("th-TH")} {unit}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {expired ? (
                              <span className="font-medium text-red-600">หมดแล้ว</span>
                            ) : (
                              <span className="text-slate-600">
                                {daysLeft.toLocaleString("th-TH")} วัน
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-slate-600">
                              {new Date(lot.expiry_date).toLocaleDateString("th-TH")}
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

          {categoryEntries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-4 w-4" /> สรุปตามหมวดหมู่
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {categoryEntries.map(([cat, value]) => (
                    <div key={cat} className="rounded-xl border border-slate-100 p-4">
                      <p className="truncate text-sm text-slate-500">{cat}</p>
                      <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
                        {value.toLocaleString("th-TH")} บาท
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}