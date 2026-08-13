"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { createClient } from "@/lib/supabase/client";
import type { Product, Lot } from "@/lib/supabase/types";
import { cn } from "@/lib/utils/cn";
import {
  ArrowLeft,
  Loader2,
  Package,
  Boxes,
  Tag,
  Gauge,
  Banknote,
  CalendarClock,
} from "lucide-react";

interface MovementRow extends Record<string, unknown> {
  id: string;
  created_at: string;
  movement_type: string;
  quantity_change: number;
  lot_number: string | null;
  location: string | null;
  note: string | null;
  performed_by_name: string | null;
}

const typeLabels: Record<string, string> = {
  stock_in: "รับเข้า",
  stock_out: "เบิกออก",
  transfer: "โอนย้าย",
  cycle_count_adjust: "ปรับปรุงสต็อก",
  return: "คืนสินค้า",
  adjustment: "ปรับยอด",
};

const typeVariant: Record<string, "success" | "danger" | "default" | "warning"> = {
  stock_in: "success",
  stock_out: "danger",
  transfer: "default",
  cycle_count_adjust: "warning",
  adjustment: "warning",
  return: "default",
};

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [product, setProduct] = useState<Product | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [trend, setTrend] = useState<{ date: string; label: string; qty: number }[]>([]);

  const nowMs = useState(() => Date.now())[0];

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: prod, error: prodErr } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();
    if (prodErr || !prod) {
      setError("ไม่พบสินค้านี้");
      setLoading(false);
      return;
    }
    setProduct(prod as Product);

    const isPerLot = (prod as Product).tracking_mode === "per_lot";

    if (isPerLot) {
      const { data: lotRows } = await supabase
        .from("lots")
        .select("*")
        .eq("product_id", id)
        .order("expiry_date", { ascending: true, nullsFirst: false });
      setLots((lotRows ?? []) as Lot[]);
    }

    const { data: movRows } = await supabase
      .from("stock_movements")
      .select(`
        id,
        created_at,
        movement_type,
        quantity_change,
        location,
        note,
        lot:lots(lot_number),
        performer:users!stock_movements_performed_by_fkey(display_name)
      `)
      .eq("product_id", id)
      .order("created_at", { ascending: false })
      .limit(100);

    const mapped: MovementRow[] = (movRows ?? []).map(
      (m: Record<string, unknown>) => {
        const lot = m.lot as { lot_number: string } | null;
        const performer = m.performer as { display_name: string } | undefined;
        return {
          id: m.id as string,
          created_at: m.created_at as string,
          movement_type: m.movement_type as string,
          quantity_change: m.quantity_change as number,
          lot_number: lot?.lot_number ?? null,
          location: (m.location as string) ?? null,
          note: (m.note as string) ?? null,
          performed_by_name: performer?.display_name ?? null,
        };
      }
    );
    setMovements(mapped);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    void (async () => {
      await fetchAll();
    })();
  }, [fetchAll]);

  useEffect(() => {
    if (!product) return;
    void (async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

      const { data } = await supabase
        .from("stock_movements")
        .select("quantity_change, created_at")
        .eq("product_id", product.id)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: true });

      const daily: Record<string, number> = {};
      for (const m of data ?? []) {
        const day = (m.created_at as string).slice(0, 10);
        daily[day] = (daily[day] ?? 0) + (m.quantity_change ?? 0);
      }

      let running = 0;
      const { data: allBefore } = await supabase
        .from("stock_movements")
        .select("quantity_change")
        .eq("product_id", product.id)
        .lt("created_at", thirtyDaysAgo.toISOString());
      running = (allBefore ?? []).reduce(
        (s, m) => s + (m.quantity_change ?? 0),
        0
      );

      const days: { date: string; label: string; qty: number }[] = [];
      for (let i = 0; i < 30; i++) {
        const d = new Date(thirtyDaysAgo);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        running += daily[key] ?? 0;
        days.push({
          date: key,
          label: d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit" }),
          qty: running,
        });
      }
      setTrend(days);
    })();
  }, [product, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center gap-3 py-24">
        <p className="text-sm text-gray-500">{error ?? "สินค้าไม่พบ"}</p>
        <Link href="/products">
          <Button variant="outline">กลับไปหน้าสินค้า</Button>
        </Link>
      </div>
    );
  }

  const currentStock = movements.reduce((s, m) => s + m.quantity_change, 0);
  const isPerLot = product.tracking_mode === "per_lot";
  const maxQty = Math.max(...trend.map((t) => t.qty), 1);

  const movementColumns: Column<MovementRow>[] = [
    {
      key: "created_at",
      label: "วันที่",
      sortable: true,
      render: (row) =>
        new Date(row.created_at).toLocaleString("th-TH", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
    },
    {
      key: "movement_type",
      label: "รายการ",
      render: (row) => (
        <Badge variant={typeVariant[row.movement_type] ?? "default"}>
          {typeLabels[row.movement_type] ?? row.movement_type}
        </Badge>
      ),
    },
    {
      key: "quantity_change",
      label: "จำนวน",
      sortable: true,
      className: "text-right",
      render: (row) => (
        <span
          className={cn(
            "font-medium tabular-nums",
            row.quantity_change >= 0 ? "text-green-600" : "text-red-600"
          )}
        >
          {row.quantity_change > 0 ? "+" : ""}
          {row.quantity_change.toLocaleString()}
        </span>
      ),
    },
    {
      key: "lot_number",
      label: "ล็อต",
      render: (row) =>
        row.lot_number ? (
          <Badge variant="primary">{row.lot_number}</Badge>
        ) : (
          "-"
        ),
    },
    {
      key: "location",
      label: "ตำแหน่ง",
      render: (row) => row.location ?? "-",
    },
    {
      key: "note",
      label: "หมายเหตุ",
      render: (row) => row.note ?? "-",
      className: "max-w-[200px] truncate",
    },
    {
      key: "performed_by_name",
      label: "ผู้บันทึก",
      render: (row) => row.performed_by_name ?? "ไม่ทราบ",
    },
  ];

  const today = new Date(nowMs).toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      {/* Back */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/products")}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
          <p className="font-mono text-sm text-gray-500">{product.sku}</p>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="flex items-center gap-3">
            <Boxes className="h-5 w-5 text-indigo-600" />
            <div>
              <p className="text-xs text-gray-400">คงเหลือ</p>
              <p className="text-xl font-bold text-gray-900">
                {currentStock.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <Tag className="h-5 w-5 text-indigo-600" />
            <div>
              <p className="text-xs text-gray-400">รูปแบบติดตาม</p>
              <p className="text-sm font-semibold text-gray-900">
                {isPerLot ? "ต่อล็อต" : "ต่อหน่วย"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <Gauge className="h-5 w-5 text-indigo-600" />
            <div>
              <p className="text-xs text-gray-400">หมวดหมู่</p>
              <p className="text-sm font-semibold text-gray-900">
                {product.category ?? "-"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <Banknote className="h-5 w-5 text-indigo-600" />
            <div>
              <p className="text-xs text-gray-400">ราคา</p>
              <p className="text-sm font-semibold text-gray-900">
                {product.price != null
                  ? `${product.price.toLocaleString()} บาท`
                  : "-"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <Gauge className="h-5 w-5 text-indigo-600" />
            <div>
              <p className="text-xs text-gray-400">จุดสั่งซื้อซ้ำ</p>
              <p className="text-sm font-semibold text-gray-900">
                {product.reorder_point.toLocaleString()}{" "}
                {product.unit || "ชิ้น"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {product.description && (
        <p className="text-sm text-gray-600">{product.description}</p>
      )}

      {/* Trend */}
      <Card>
        <CardHeader>
          <CardTitle>แนวโน้มสต็อก 30 วัน</CardTitle>
        </CardHeader>
        <CardContent>
          {trend.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Package className="h-10 w-10 text-gray-300" />
              <p className="text-sm text-gray-400">ยังไม่มีข้อมูลเพื่อสร้างกราฟ</p>
            </div>
          ) : (
            <div className="flex items-end gap-[3px]">
              {trend.map((t, i) => (
                <div key={t.date} className="group flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-40 w-full items-end justify-center">
                    <div
                      className="w-full max-w-[18px] rounded-t bg-gradient-to-t from-indigo-500 to-violet-500 transition-all group-hover:from-indigo-400 group-hover:to-violet-400"
                      style={{ height: `${Math.max((t.qty / maxQty) * 100, 1)}%` }}
                    />
                  </div>
                  {i % 5 === 0 && (
                    <span className="text-[10px] text-gray-400">{t.label}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lots (per_lot only) */}
      {isPerLot && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-indigo-600" />
              <CardTitle>ล็อตทั้งหมด</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {lots.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <Package className="h-10 w-10 text-gray-300" />
                <p className="text-sm text-gray-400">ยังไม่มีล็อต</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {lots.map((lot) => {
                  const expired =
                    lot.expiry_date &&
                    new Date(lot.expiry_date) < new Date(today);
                  const expiringSoon =
                    lot.expiry_date &&
                    !expired &&
                    new Date(lot.expiry_date) <=
                      new Date(nowMs + 30 * 86400000);
                  return (
                    <div
                      key={lot.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-6 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-gray-700">
                          {lot.lot_number}
                        </span>
                        {lot.location && (
                          <Badge>{lot.location}</Badge>
                        )}
                        {lot.quantity <= 0 && (
                          <Badge variant="danger">หมด</Badge>
                        )}
                        {lot.expiry_date && (
                          <Badge
                            variant={
                              expired
                                ? "danger"
                                : expiringSoon
                                  ? "warning"
                                  : "success"
                            }
                          >
                            หมดอายุ {new Date(lot.expiry_date).toLocaleDateString("th-TH")}
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm font-medium tabular-nums">
                        {lot.quantity.toLocaleString()}{" "}
                        <span className="text-xs text-gray-400">
                          {product.unit}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Movements */}
      <Card>
        <CardHeader>
          <CardTitle>ประวัติการเคลื่อนไหวสต็อก</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {movements.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Package className="h-10 w-10 text-gray-300" />
              <p className="text-sm text-gray-400">ยังไม่มีประวัติการเคลื่อนไหว</p>
            </div>
          ) : (
            <DataTable<MovementRow>
              columns={movementColumns}
              data={movements}
              keyField="id"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}