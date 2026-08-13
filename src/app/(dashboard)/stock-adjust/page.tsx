"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/client";
import type { Product, Lot } from "@/lib/supabase/types";
import { cn } from "@/lib/utils/cn";
import {
  SlidersHorizontal,
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

interface AdjustForm {
  product_id: string;
  lot_id: string;
  direction: "in" | "out";
  quantity: string;
  location: string;
  note: string;
}

const emptyForm: AdjustForm = {
  product_id: "",
  lot_id: "",
  direction: "in",
  quantity: "",
  location: "",
  note: "",
};

interface AdjustRecord extends Record<string, unknown> {
  id: string;
  created_at: string;
  product_name: string;
  product_sku: string;
  lot_number: string | null;
  quantity_change: number;
  location: string | null;
  note: string | null;
  performed_by_name: string | null;
}

export default function StockAdjustPage() {
  const supabase = createClient();

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const [lots, setLots] = useState<Lot[]>([]);
  const [lotsLoading, setLotsLoading] = useState(false);

  const [form, setForm] = useState<AdjustForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [records, setRecords] = useState<AdjustRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);

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
  const selectedLot = lots.find((l) => l.id === form.lot_id);

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

  const fetchLots = useCallback(
    async (productId: string, direction: "in" | "out") => {
      setLotsLoading(true);
      let query = supabase
        .from("lots")
        .select("*")
        .eq("product_id", productId)
        .eq("is_active", true);
      if (direction === "out") {
        query = query.gt("quantity", 0);
      }
      const { data, error } = await query.order("lot_number", {
        ascending: true,
      });

      if (error) {
        setLots([]);
      } else {
        setLots(data ?? []);
      }
      setLotsLoading(false);
    },
    [supabase]
  );

  const fetchRecords = useCallback(async () => {
    setRecordsLoading(true);
    const { data, error } = await supabase
      .from("stock_movements")
      .select(`
        id,
        created_at,
        quantity_change,
        location,
        note,
        product:products(name, sku),
        lot:lots(lot_number),
        performer:users!stock_movements_performed_by_fkey(display_name)
      `)
      .eq("movement_type", "adjustment")
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      addToast("ไม่สามารถโหลดประวัติปรับยอดได้", "error");
    } else {
      const mapped: AdjustRecord[] = (data ?? []).map(
        (item: Record<string, unknown>) => {
          const product = item.product as { name: string; sku: string } | null;
          const lot = item.lot as { lot_number: string } | null;
          const performer = item.performer as { display_name: string } | undefined;
          return {
            id: item.id as string,
            created_at: item.created_at as string,
            product_name: product?.name ?? "",
            product_sku: product?.sku ?? "",
            lot_number: lot?.lot_number ?? null,
            quantity_change: item.quantity_change as number,
            location: (item.location as string) ?? null,
            note: (item.note as string) ?? null,
            performed_by_name: performer?.display_name ?? null,
          };
        }
      );
      setRecords(mapped);
    }
    setRecordsLoading(false);
  }, [supabase, addToast]);

  useEffect(() => {
    void (async () => {
      await Promise.all([fetchProducts(), fetchRecords()]);
    })();
  }, [fetchProducts, fetchRecords]);

  useEffect(() => {
    void (async () => {
      if (form.product_id && isPerLot) {
        await fetchLots(form.product_id, form.direction);
      } else {
        setLots([]);
      }
      setForm((prev) => ({ ...prev, lot_id: "" }));
    })();
  }, [form.product_id, form.direction, isPerLot, fetchLots]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value } as AdjustForm));
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
    if (!form.quantity || Number(form.quantity) <= 0) {
      setFormError("กรุณากรอกจำนวนที่มากกว่า 0");
      return;
    }
    if (!form.note.trim()) {
      setFormError("กรุณากรอกเหตุผลการปรับยอด");
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

    const qty = Number(form.quantity);
    const signedChange =
      form.direction === "in" ? qty : -qty;

    if (isPerLot) {
      const { data: lot, error: lotError } = await supabase
        .from("lots")
        .select("quantity")
        .eq("id", form.lot_id)
        .single();

      if (lotError || !lot) {
        setFormError("ไม่พบข้อมูลล็อต");
        setSaving(false);
        return;
      }

      const newQty = lot.quantity + signedChange;
      if (newQty < 0) {
        setFormError(
          `สต็อกในล็อตไม่เพียงพอ (มี ${lot.quantity.toLocaleString()}, ปรับลด ${qty.toLocaleString()})`
        );
        setSaving(false);
        return;
      }

      const { error: updateError } = await supabase
        .from("lots")
        .update({ quantity: newQty, location: form.location.trim() || null })
        .eq("id", form.lot_id);

      if (updateError) {
        setFormError("ไม่สามารถอัปเดตจำนวนล็อตได้");
        setSaving(false);
        return;
      }
    }

    const { error: movementError } = await supabase
      .from("stock_movements")
      .insert({
        product_id: form.product_id,
        lot_id: isPerLot ? form.lot_id : null,
        movement_type: "adjustment",
        quantity_change: signedChange,
        location: form.location.trim() || null,
        reference_type: "manual",
        note: form.note.trim(),
        performed_by: user.id,
      });

    if (movementError) {
      addToast("บันทึกรายการไม่สำเร็จ", "error");
      setFormError("ไม่สามารถบันทึกรายการปรับยอดได้");
      setSaving(false);
      return;
    }

    addToast("บันทึกรายการปรับยอดสต็อกสำเร็จ", "success");
    setForm(emptyForm);
    setSaving(false);
    fetchRecords();
  };

  const columns: Column<AdjustRecord>[] = [
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
      key: "quantity_change",
      label: "จำนวน",
      sortable: true,
      className: "text-right",
      render: (row) => (
        <span
          className={cn(
            "font-medium",
            row.quantity_change >= 0 ? "text-green-600" : "text-red-600"
          )}
        >
          {row.quantity_change >= 0 ? "+" : ""}
          {row.quantity_change.toLocaleString()}
        </span>
      ),
    },
    {
      key: "location",
      label: "ตำแหน่ง",
      render: (row) => (row.location ? <Badge>{row.location}</Badge> : "-"),
    },
    {
      key: "note",
      label: "เหตุผล",
      render: (row) => row.note ?? "-",
      className: "max-w-[220px] truncate",
    },
    {
      key: "performed_by_name",
      label: "ผู้ปรับ",
      render: (row) => row.performed_by_name ?? "ไม่ทราบ",
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
        <h1 className="text-2xl font-bold text-gray-900">ปรับยอดสต็อก</h1>
        <p className="text-sm text-gray-500">
          แก้ไขยอดคงเหลือด้วยมือ (เช่น เจอสินค้าเกิน/ขาด หรือเตียงข้อมูล)
        </p>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>บันทึกการปรับยอดสต็อก</CardTitle>
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
                  รูปแบบติดตาม: {isPerLot ? "ต่อล็อต" : "ต่อหน่วย"}
                </p>
              )}
            </div>

            {/* Direction */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="direction"
                className="text-sm font-medium text-gray-700"
              >
                ลักษณะ *
              </label>
              <select
                id="direction"
                name="direction"
                value={form.direction}
                onChange={handleChange}
                disabled={saving}
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="in">เพิ่มยอด (+)</option>
                <option value="out">ลดยอด (−)</option>
              </select>
            </div>

            {/* Lot (only for per_lot) */}
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
                    ไม่มีล็อตที่ปรับได้
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
                        {l.lot_number} (คงเหลือ {l.quantity.toLocaleString()})
                        {l.location ? ` @${l.location}` : ""}
                      </option>
                    ))}
                  </select>
                )}
                {selectedLot && (
                  <p className="text-xs text-gray-400">
                    คงเหลือ: {selectedLot.quantity.toLocaleString()} | หมดอายุ:{" "}
                    {selectedLot.expiry_date ?? "ไม่ระบุ"}
                  </p>
                )}
              </div>
            )}

            {/* Quantity */}
            <Input
              label="จำนวน *"
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              value={form.quantity}
              onChange={handleChange}
              placeholder="ระบุจำนวน"
              disabled={saving}
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

            {/* Reason */}
            <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
              <label
                htmlFor="note"
                className="text-sm font-medium text-gray-700"
              >
                เหตุผลการปรับยอด *
              </label>
              <input
                id="note"
                name="note"
                value={form.note}
                onChange={handleChange}
                placeholder="เช่น พบนับแล้วของเกิน 3 ชิ้น, ล้างสต็อกสินค้าเสียหาย"
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
                }}
                disabled={saving}
              >
                ล้างฟอร์ม
              </Button>
              <Button type="submit" loading={saving}>
                <SlidersHorizontal className="h-4 w-4" />
                บันทึกปรับยอด
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle>ประวัติการปรับยอดล่าสุด</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recordsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <Package className="h-12 w-12 text-gray-300" />
              <p className="text-sm text-gray-400">
                ยังไม่มีประวัติการปรับยอด
              </p>
            </div>
          ) : (
            <DataTable<AdjustRecord>
              columns={columns}
              data={records}
              keyField="id"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}