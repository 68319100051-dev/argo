"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/supabase/types";
import { cn } from "@/lib/utils/cn";
import {
  ClipboardCheck,
  CheckCircle,
  XCircle,
  Loader2,
  Package,
} from "lucide-react";

type ToastType = "success" | "error";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let toastId = 0;

interface CycleCountForm {
  product_id: string;
  lot_id: string;
  actual_quantity: string;
  location: string;
  notes: string;
}

const emptyForm: CycleCountForm = {
  product_id: "",
  lot_id: "",
  actual_quantity: "",
  location: "",
  notes: "",
};

interface CycleCountRecord extends Record<string, unknown> {
  id: string;
  created_at: string;
  product_name: string;
  product_sku: string;
  lot_number: string | null;
  system_quantity: number;
  actual_quantity: number;
  variance: number;
  status: "pending" | "verified" | "resolved";
  counted_by_name: string | null;
}

const statusLabels: Record<string, string> = {
  pending: "รอตรวจสอบ",
  verified: "ตรวจสอบแล้ว",
  resolved: "แก้ไขแล้ว",
};

const statusVariants: Record<string, "warning" | "primary" | "success"> = {
  pending: "warning",
  verified: "primary",
  resolved: "success",
};

const statuses = ["all", "pending", "verified", "resolved"] as const;
type StatusFilter = (typeof statuses)[number];

const statusFilterLabels: Record<StatusFilter, string> = {
  all: "ทั้งหมด",
  pending: "รอตรวจสอบ",
  verified: "ตรวจสอบแล้ว",
  resolved: "แก้ไขแล้ว",
};

export default function CycleCountPage() {
  const supabase = createClient();

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const [lots, setLots] = useState<
    { id: string; lot_number: string; quantity: number }[]
  >([]);
  const [lotsLoading, setLotsLoading] = useState(false);

  const [form, setForm] = useState<CycleCountForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [systemQuantity, setSystemQuantity] = useState<number>(0);
  const [systemQtyLoading, setSystemQtyLoading] = useState(false);

  const [records, setRecords] = useState<CycleCountRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const selectedProduct = products.find((p) => p.id === form.product_id);
  const isPerLot = selectedProduct?.tracking_mode === "per_lot";

  const actualQuantity = Number(form.actual_quantity) || 0;
  const variance = actualQuantity - systemQuantity;

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      addToast("ไม่สามารถโหลดข้อมูลสินค้าได้", "error");
    } else {
      setProducts(data ?? []);
    }
    setProductsLoading(false);
  }, [supabase, addToast]);

  const fetchRecords = useCallback(async () => {
    setRecordsLoading(true);
    const { data, error } = await supabase
      .from("cycle_counts")
      .select(
        `
        id,
        created_at,
        system_quantity,
        actual_quantity,
        variance,
        status,
        product:products(name, sku),
        lot:lots(lot_number),
        counter:users!cycle_counts_counted_by_fkey(display_name)
      `
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      addToast("ไม่สามารถโหลดประวัตินับสต็อกได้", "error");
    } else {
      const mapped: CycleCountRecord[] = (data ?? []).map(
        (item: Record<string, unknown>) => {
          const product = item.product as { name: string; sku: string } | null;
          const lot = item.lot as { lot_number: string } | null;
          const counter = item.counter as { display_name: string } | undefined;
          return {
            id: item.id as string,
            created_at: item.created_at as string,
            system_quantity: item.system_quantity as number,
            actual_quantity: item.actual_quantity as number,
            variance: item.variance as number,
            status: item.status as "pending" | "verified" | "resolved",
            product_name: product?.name ?? "",
            product_sku: product?.sku ?? "",
            lot_number: lot?.lot_number ?? null,
            counted_by_name: counter?.display_name ?? null,
          };
        }
      );
      setRecords(mapped);
    }
    setRecordsLoading(false);
  }, [supabase, addToast]);

  const fetchLots = useCallback(
    async (productId: string) => {
      setLotsLoading(true);
      const { data, error } = await supabase
        .from("lots")
        .select("id, lot_number, quantity")
        .eq("product_id", productId)
        .eq("is_active", true)
        .order("lot_number", { ascending: true });

      if (error) {
        addToast("ไม่สามารถโหลดข้อมูลล็อตได้", "error");
      } else {
        setLots(data ?? []);
      }
      setLotsLoading(false);
    },
    [supabase, addToast]
  );

  const fetchSystemQuantity = useCallback(
    async (productId: string, lotId: string | null) => {
      setSystemQtyLoading(true);
      try {
        if (lotId) {
          const { data, error } = await supabase
            .from("lots")
            .select("quantity")
            .eq("id", lotId)
            .single();

          if (error || !data) {
            setSystemQuantity(0);
          } else {
            setSystemQuantity(data.quantity);
          }
        } else {
          const { data, error } = await supabase
            .from("stock_movements")
            .select("quantity_change")
            .eq("product_id", productId);

          if (error) {
            setSystemQuantity(0);
          } else {
            const total = (data ?? []).reduce(
              (sum, item) => sum + (item.quantity_change || 0),
              0
            );
            setSystemQuantity(total);
          }
        }
      } catch {
        setSystemQuantity(0);
      }
      setSystemQtyLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    void (async () => {
      await Promise.all([fetchProducts(), fetchRecords()]);
    })();
  }, [fetchProducts, fetchRecords]);

  useEffect(() => {
    void (async () => {
      if (!form.product_id) {
        setLots([]);
        setSystemQuantity(0);
        return;
      }

      if (isPerLot) {
        await fetchLots(form.product_id);
        setForm((prev) => ({ ...prev, lot_id: "" }));
        setSystemQuantity(0);
      } else {
        setLots([]);
        await fetchSystemQuantity(form.product_id, null);
      }
    })();
  }, [form.product_id, isPerLot, fetchLots, fetchSystemQuantity]);

  useEffect(() => {
    const selectedLot = lots.find((l) => l.id === form.lot_id);
    void (async () => {
      if (!form.lot_id || lots.length === 0) return;
      if (selectedLot) {
        setSystemQuantity(selectedLot.quantity);
      }
    })();
  }, [form.lot_id, lots]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormError(null);
  };

  const handleSubmit = async () => {
    if (!form.product_id) {
      setFormError("กรุณาเลือกสินค้า");
      return;
    }
    if (isPerLot && !form.lot_id) {
      setFormError("กรุณาเลือกล็อตสำหรับสินค้าที่ติดตามแบบต่อล็อต");
      return;
    }
    if (!form.actual_quantity || Number(form.actual_quantity) < 0) {
      setFormError("กรุณากรอกจำนวนที่นับได้");
      return;
    }

    setSaving(true);
    setFormError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setFormError("ไม่สามารถระบุผู้ใช้ได้");
      setSaving(false);
      return;
    }

    const { data: cycleCount, error: ccError } = await supabase
      .from("cycle_counts")
      .insert({
        product_id: form.product_id,
        lot_id: form.lot_id || null,
        system_quantity: systemQuantity,
        actual_quantity: actualQuantity,
        variance,
        location: form.location.trim() || null,
        notes: form.notes.trim() || null,
        status: "pending",
        counted_by: user.id,
        counted_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (ccError || !cycleCount) {
      setFormError("ไม่สามารถบันทึกการนับสต็อกได้");
      addToast("บันทึกไม่สำเร็จ", "error");
      setSaving(false);
      return;
    }

    if (variance !== 0) {
      const { error: smError } = await supabase
        .from("stock_movements")
        .insert({
          product_id: form.product_id,
          lot_id: form.lot_id || null,
          movement_type: "cycle_count_adjust",
          quantity_change: variance,
          reference_type: "cycle_count",
          reference_id: cycleCount.id,
          note: `Cycle count adjustment: variance ${variance}`,
          performed_by: user.id,
        });

      if (smError) {
        addToast(
          "บันทึกนับสต็อกสำเร็จ แต่ไม่สามารถปรับยอดในระบบได้ โปรดแจ้งผู้ดูแล",
          "error"
        );
      }
    }

    addToast("บันทึกการนับสต็อกสำเร็จ", "success");
    setForm(emptyForm);
    setSystemQuantity(0);
    setSaving(false);
    fetchRecords();
  };

  const filteredRecords =
    statusFilter === "all"
      ? records
      : records.filter((r) => r.status === statusFilter);

  const columns: Column<CycleCountRecord>[] = [
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
      key: "product_name",
      label: "สินค้า",
      sortable: true,
      render: (row) => (
        <div className="flex flex-col">
          <span>{row.product_name}</span>
          <span className="text-xs text-gray-400">{row.product_sku}</span>
        </div>
      ),
    },
    {
      key: "lot_number",
      label: "ล็อต",
      render: (row) =>
        row.lot_number ? (
          <Badge variant="primary">{row.lot_number}</Badge>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: "system_quantity",
      label: "ระบบ",
      sortable: true,
      className: "text-right",
      render: (row) => row.system_quantity.toLocaleString(),
    },
    {
      key: "actual_quantity",
      label: "นับได้",
      sortable: true,
      className: "text-right",
      render: (row) => row.actual_quantity.toLocaleString(),
    },
    {
      key: "variance",
      label: "ผลต่าง",
      sortable: true,
      className: "text-right",
      render: (row) => (
        <span
          className={cn(
            "font-medium",
            row.variance === 0
              ? "text-gray-500"
              : row.variance > 0
                ? "text-green-600"
                : "text-red-600"
          )}
        >
          {row.variance > 0 ? "+" : ""}
          {row.variance.toLocaleString()}
        </span>
      ),
    },
    {
      key: "status",
      label: "สถานะ",
      render: (row) => (
        <Badge variant={statusVariants[row.status]}>
          {statusLabels[row.status]}
        </Badge>
      ),
    },
    {
      key: "counted_by_name",
      label: "ผู้นับ",
      render: (row) => row.counted_by_name ?? "ไม่ทราบ",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all",
              t.type === "success"
                ? "bg-green-600 text-white"
                : "bg-red-600 text-white"
            )}
          >
            {t.type === "success" ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {t.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">นับสต็อก</h1>
        <p className="text-sm text-gray-500">
          ตรวจนับสินค้าและเทียบยอดในระบบ
        </p>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>บันทึกการนับสต็อก</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {/* Product */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="product_id"
                className="text-sm font-medium text-gray-700"
              >
                สินค้า *
              </label>
              {productsLoading ? (
                <div className="flex h-10 items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังโหลด...
                </div>
              ) : (
                <select
                  id="product_id"
                  name="product_id"
                  value={form.product_id}
                  onChange={handleChange}
                  disabled={saving}
                  className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">-- เลือกสินค้า --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              )}
              {selectedProduct && (
                <p className="text-xs text-gray-400">
                  รูปแบบติดตาม:{" "}
                  {isPerLot ? "ต่อล็อต" : "ต่อหน่วย"}
                </p>
              )}
            </div>

            {/* Lot (conditional) */}
            {isPerLot && (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="lot_id"
                  className="text-sm font-medium text-gray-700"
                >
                  ล็อต *
                </label>
                {lotsLoading ? (
                  <div className="flex h-10 items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    กำลังโหลด...
                  </div>
                ) : lots.length === 0 ? (
                  <div className="flex h-10 items-center text-sm text-gray-400">
                    ไม่มีล็อตสำหรับสินค้านี้
                  </div>
                ) : (
                  <select
                    id="lot_id"
                    name="lot_id"
                    value={form.lot_id}
                    onChange={handleChange}
                    disabled={saving}
                    className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">-- เลือกล็อต --</option>
                    {lots.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.lot_number} (ในระบบ: {l.quantity.toLocaleString()})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* System Quantity (read-only) */}
            <Input
              label="จำนวนในระบบ"
              id="system_quantity"
              name="system_quantity"
              type="number"
              value={systemQuantity}
              disabled
            />

            {/* Actual Quantity */}
            <Input
              label="จำนวนที่นับได้ *"
              id="actual_quantity"
              name="actual_quantity"
              type="number"
              min={0}
              value={form.actual_quantity}
              onChange={handleChange}
              placeholder="กรอกจำนวนที่ตรวจนับได้"
              disabled={saving || systemQtyLoading}
            />

            {/* Variance (read-only) */}
            <Input
              label="ผลต่าง"
              id="variance"
              name="variance"
              type="number"
              value={variance}
              disabled
            />

            {/* Location */}
            <Input
              label="ตำแหน่ง"
              id="location"
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder="เช่น A-01-01"
              disabled={saving}
            />

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="notes"
                className="text-sm font-medium text-gray-700"
              >
                หมายเหตุ
              </label>
              <input
                id="notes"
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="ระบุหมายเหตุ (ถ้ามี)"
                disabled={saving}
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Error */}
            {formError && (
              <p className="text-sm text-red-500 sm:col-span-2 lg:col-span-3">
                {formError}
              </p>
            )}

            {/* Submit */}
            <div className="flex items-center justify-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setForm(emptyForm);
                  setFormError(null);
                  setSystemQuantity(0);
                }}
                disabled={saving}
              >
                ล้างฟอร์ม
              </Button>
              <Button type="submit" loading={saving}>
                <ClipboardCheck className="h-4 w-4" />
                บันทึกนับสต็อก
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle>ประวัติการนับสต็อก</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Status Filters */}
          <div className="flex gap-2 border-b border-gray-200 px-6 py-3">
            {statuses.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
                  statusFilter === s
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {statusFilterLabels[s]}
              </button>
            ))}
          </div>

          {recordsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <Package className="h-12 w-12 text-gray-300" />
              <p className="text-sm text-gray-400">
                ยังไม่มีประวัติการนับสต็อก
              </p>
            </div>
          ) : (
            <DataTable<CycleCountRecord>
              columns={columns}
              data={filteredRecords}
              keyField="id"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
