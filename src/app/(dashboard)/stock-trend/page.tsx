"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loader2, TrendingUp, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { StockSnapshot } from "@/lib/supabase/types";

interface SnapshotRow extends StockSnapshot {
  product: { id: string; sku: string; name: string; unit: string } | null;
}

interface DatePoint {
  date: string;
  total: number;
}

const RANGE_OPTIONS = [
  { key: 14, label: "14 วัน" },
  { key: 30, label: "30 วัน" },
  { key: 90, label: "90 วัน" },
];

export default function StockTrendPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState(30);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const since = new Date();
    since.setDate(since.getDate() - (range - 1));
    since.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("stock_snapshots")
      .select("id, snapshot_date, product_id, lot_id, qty, created_at, product:products(id, sku, name, unit)")
      .gte("snapshot_date", since.toISOString().slice(0, 10))
      .order("snapshot_date", { ascending: true });

    if (error) {
      setError("ไม่สามารถโหลดแนวโน้มสต็อกได้");
    } else {
      setRows((data ?? []) as unknown as SnapshotRow[]);
    }
    setLoading(false);
  }, [supabase, range]);

  useEffect(() => {
    void (async () => {
      await fetchData();
    })();
  }, [fetchData]);

  const perProduct = useCallback(() => {
    const map: Record<string, { sku: string; name: string; unit: string; days: number[] }> = {};
    const dateIndex: Record<string, number> = {};
    const orderedDates: string[] = [];

    for (const r of rows) {
      const day = r.snapshot_date.slice(0, 10);
      if (!(day in dateIndex)) {
        dateIndex[day] = orderedDates.length;
        orderedDates.push(day);
      }
      const p = r.product ?? { id: r.product_id, sku: "?", name: "?", unit: "" };
      if (!map[p.id]) {
        map[p.id] = { sku: p.sku, name: p.name, unit: p.unit, days: new Array(orderedDates.length).fill(0) };
      }
      const idx = dateIndex[day];
      while (map[p.id].days.length <= idx) {
        map[p.id].days.push(map[p.id].days[map[p.id].days.length - 1] ?? 0);
      }
      map[p.id].days[idx] = (map[p.id].days[idx] ?? 0) + Number(r.qty);
    }

    const list = Object.entries(map).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.days[b.days.length - 1] ?? 0 - (a.days[a.days.length - 1] ?? 0));
    return { list, dates: orderedDates };
  }, [rows]);

  const { list, dates } = perProduct();

  const totalByDate: DatePoint[] = (() => {
    return dates.map((d) => {
      const total = list.reduce((s, p) => s + (p.days[dates.indexOf(d)] ?? 0), 0);
      return { date: d, total };
    });
  })();

  const maxTotal = Math.max(1, ...totalByDate.map((t) => t.total));

  const shortDate = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit" });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <BarChart3 className="h-6 w-6 text-indigo-600" />
            แนวโน้มสต็อก
          </h1>
          <p className="text-sm text-gray-500">
            ยอดคงเหลือรายวันจาก snapshot อัตโนมัติ (ตัดทุกวัน 00:30)
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-1">
          {RANGE_OPTIONS.map((o) => (
            <Button
              key={o.key}
              size="sm"
              variant={range === o.key ? "primary" : "ghost"}
              onClick={() => setRange(o.key)}
            >
              {o.label}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <TrendingUp className="h-12 w-12 text-gray-300" />
            <p className="text-sm text-gray-500">
              ยังไม่มีข้อมูล snapshot — ระบบจะเก็บยอดสต็อกอัตโนมัติทุกวันเวลา 00:30
              หากต้องการดูทันที ให้รอวันถัดไปหรือตรวจสอบว่า cron job ทำงาน
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>ยอดคงเหลือรวมรายวัน</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-40 items-end gap-1">
                {totalByDate.map((t) => {
                  const h = Math.round((t.total / maxTotal) * 100);
                  return (
                    <div key={t.date} className="group flex flex-1 flex-col items-center justify-end" title={`${shortDate(t.date)}: ${t.total.toLocaleString()}`}>
                      <div
                        className="w-full rounded-t bg-gradient-to-t from-indigo-500 to-violet-400 transition-all hover:opacity-80"
                        style={{ height: `${Math.max(3, h)}%` }}
                      />
                      {dates.length <= 31 && (
                        <span className="mt-1 text-[9px] text-gray-400">{shortDate(t.date)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>แนวโน้มต่อสินค้า</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {list.map((p) => {
                const last = p.days[p.days.length - 1] ?? 0;
                const max = Math.max(1, ...p.days);
                return (
                  <div key={p.id}>
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{p.name}</span>
                        <span className="font-mono text-xs text-gray-400">{p.sku}</span>
                      </div>
                      <span className="text-sm font-bold text-gray-700">
                        {last.toLocaleString()} {p.unit}
                      </span>
                    </div>
                    <div className="flex h-12 items-end gap-0.5">
                      {p.days.map((d, i) => (
                        <div
                          key={i}
                          title={dates[i] ? `${shortDate(dates[i])}: ${d.toLocaleString()}` : ""}
                          className="flex-1 rounded-t bg-indigo-200"
                          style={{ height: `${Math.max(3, (d / max) * 100)}%` }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}