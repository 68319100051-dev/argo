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
  ArrowLeftRight,
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

interface TransferForm {
  product_id: string;
  lot_id: string;
  quantity: string;
  from_location: string;
  to_location: string;
  note: string;
}

const emptyForm: TransferForm = {
  product_id: "",
  lot_id: "",
  quantity: "",
  from_location: "",
  to_location: "",
  note: "",
};

interface TransferRecord extends Record<string, unknown> {
  reference_id: string;
  created_at: string;
  product_name: string;
  product_sku: string;
  lot_number: string | null;
  quantity: number;
  from_location: string;
  to_location: string;
  note: string | null;
  performed_by_name: string | null;
}

export default function StockTransferPage() {
  const supabase = createClient();

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const [lots, setLots] = useState<Lot[]>([]);
  const [lotsLoading, setLotsLoading] = useState(false);

  const [form, setForm] = useState<TransferForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(true);

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

  const fetchLots = useCallback(async (productId: string) => {
    setLotsLoading(true);
    const { data, error } = await supabase
      .from("lots")
      .select("*")
      .eq("product_id", productId)
      .eq("is_active", true)
      .gt("quantity", 0)
      .or(`expiry_date.is.null,expiry_date.gte.${new Date().toISOString()}`)
      .order("lot_number", { ascending: true });

    if (!error) {
      setLots(data ?? []);
    } else {
      setLots([]);
    }
    setLotsLoading(false);
  }, [supabase]);

  const fetchTransfers = useCallback(async () => {
    setTransfersLoading(true);
    const { data, error } = await supabase
      .from("stock_movements")
      .select(`
        id,
        created_at,
        reference_id,
        movement_type,
        quantity_change,
        location,
        note,
        product:products(name, sku),
        lot:lots(lot_number),
        performer:users!stock_movements_performed_by_fkey(display_name)
      `)
      .eq("reference_type", "transfer_order")
      .order("created_at", { ascending: false })
      .limit(40);

    if (error) {
      addToast("ไม่สามารถโหลดประวัติการโอนย้ายได้", "error");
    } else {
      const transferMap = new Map<string, TransferRecord>();
      for (const raw of data ?? []) {
        const item = raw as Record<string, unknown>;
        const refId = item.reference_id as string;
        if (!refId) continue;

        if (!transferMap.has(refId)) {
          const product = item.product as { name: string; sku: string } | null;
          const lot = item.lot as { lot_number: string } | null;
          const performer = item.performer as { display_name: string } | undefined;
          transferMap.set(refId, {
            reference_id: refId,
            created_at: item.created_at as string,
            product_name: product?.name ?? "",
            product_sku: product?.sku ?? "",
            lot_number: lot?.lot_number ?? null,
            quantity: 0,
            from_location: "",
            to_location: "",
            note: item.note as string | null,
            performed_by_name: performer?.display_name ?? null,
          });
        }

        const record = transferMap.get(refId)!;
        if (item.movement_type === "stock_out") {
          record.quantity = Math.abs(item.quantity_change as number);
          record.from_location = (item.location as string) ?? "";
        } else if (item.movement_type === "stock_in") {
          record.to_location = (item.location as string) ?? "";
        }
      }

      const sorted = Array.from(transferMap.values())
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .slice(0, 20);
      setTransfers(sorted);
    }
    setTransfersLoading(false);
  }, [supabase, addToast]);

  useEffect(() => {
    void (async () => {
      await Promise.all([fetchProducts(), fetchTransfers()]);
    })();
  }, [fetchProducts, fetchTransfers]);

  useEffect(() => {
    void (async () => {
      if (form.product_id && isPerLot) {
        await fetchLots(form.product_id);
      } else {
        setLots([]);
      }
      setForm((prev) => ({ ...prev, lot_id: "" }));
    })();
  }, [form.product_id, isPerLot, fetchLots]);

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
    const qty = Number(form.quantity);
    if (!form.quantity || qty <= 0) {
      setFormError("กรุณากรอกจำนวนที่มากกว่า 0");
      return;
    }
    if (!form.from_location.trim()) {
      setFormError("กรุณากรอกตำแหน่งต้นทาง");
      return;
    }
    if (!form.to_location.trim()) {
      setFormError("กรุณากรอกตำแหน่งปลายทาง");
      return;
    }
    if (form.from_location.trim() === form.to_location.trim()) {
      setFormError("ตำแหน่งต้นทางและปลายทางต้องไม่เหมือนกัน");
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

    if (isPerLot) {
      if (!form.lot_id) {
        setFormError("กรุณาเลือกล็อต");
        setSaving(false);
        return;
      }
      if (!selectedLot || qty > selectedLot.quantity) {
        setFormError("จำนวนที่โอนย้ายมากกว่าจำนวนคงเหลือในล็อต");
        setSaving(false);
        return;
      }
      if (
        selectedLot.expiry_date &&
        new Date(selectedLot.expiry_date) < new Date()
      ) {
        setFormError("ไม่สามารถโอนย้ายสินค้าจากล็อตที่หมดอายุแล้ว");
        setSaving(false);
        return;
      }
    } else {
      const { data: stockData } = await supabase
        .from("stock_movements")
        .select("quantity_change")
        .eq("product_id", form.product_id);
      const available = (stockData ?? []).reduce(
        (sum: number, m: { quantity_change: number }) =>
          sum + (m.quantity_change ?? 0),
        0
      );
      if (qty > available) {
        setFormError(
          `จำนวนคงเหลือไม่เพียงพอ (มี ${available.toLocaleString()} หน่วย)`
        );
        setSaving(false);
        return;
      }
    }

    const referenceId = crypto.randomUUID();
    const stockOut = await supabase.from("stock_movements").insert({
      product_id: form.product_id,
      lot_id: isPerLot ? form.lot_id : null,
      movement_type: "stock_out",
      quantity_change: -qty,
      location: form.from_location.trim(),
      reference_type: "transfer_order",
      reference_id: referenceId,
      note: form.note.trim() || null,
      performed_by: user.id,
    });

    if (stockOut.error) {
      setFormError("ไม่สามารถบันทึกรายการตัดสต็อกต้นทางได้");
      addToast("บันทึกรายการไม่สำเร็จ", "error");
      setSaving(false);
      return;
    }

    const stockIn = await supabase.from("stock_movements").insert({
      product_id: form.product_id,
      lot_id: isPerLot ? form.lot_id : null,
      movement_type: "stock_in",
      quantity_change: qty,
      location: form.to_location.trim(),
      reference_type: "transfer_order",
      reference_id: referenceId,
      note: form.note.trim() || null,
      performed_by: user.id,
    });

    if (stockIn.error) {
      setFormError("ไม่สามารถบันทึกรายการรับสินค้าปลายทางได้");
      addToast("บันทึกรายการไม่สำเร็จ กรุณาตรวจสอบ", "error");
      setSaving(false);
      return;
    }

    if (isPerLot && form.lot_id) {
      await supabase
        .from("lots")
        .update({ location: form.to_location.trim() })
        .eq("id", form.lot_id);
    }

    addToast("บันทึกรายการโอนย้ายสินค้าสำเร็จ", "success");
    setForm(emptyForm);
    setSaving(false);
    fetchTransfers();
  };

  const columns: Column<TransferRecord>[] = [
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
      key: "quantity",
      label: "จำนวน",
      sortable: true,
      className: "text-right",
      render: (row) => (
        <span className="font-medium">{row.quantity.toLocaleString()}</span>
      ),
    },
    {
      key: "from_location",
      label: "จาก",
      render: (row) => (
        <Badge variant="default">{row.from_location || "-"}</Badge>
      ),
    },
    {
      key: "to_location",
      label: "ไปยัง",
      render: (row) => (
        <Badge variant="primary">{row.to_location || "-"}</Badge>
      ),
    },
    {
      key: "performed_by_name",
      label: "ผู้บันทึก",
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
        <h1 className="text-2xl font-bold text-gray-900">โอนย้ายสินค้า</h1>
        <p className="text-sm text-gray-500">
          บันทึกการโอนย้ายสินค้าระหว่างคลังหรือตำแหน่งจัดเก็บ
        </p>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>บันทึกการโอนย้ายสินค้า</CardTitle>
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
                ) : (
                  <select
                    id="lot_id"
                    name="lot_id"
                    value={form.lot_id}
                    onChange={handleChange}
                    disabled={saving || lots.length === 0}
                    className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">-- เลือกล็อต --</option>
                    {lots.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.lot_number} (คงเหลือ {l.quantity.toLocaleString()}
                        {l.location ? ` @${l.location}` : ""})
                      </option>
                    ))}
                  </select>
                )}
                {selectedLot && (
                  <p className="text-xs text-gray-400">
                    คงเหลือ: {selectedLot.quantity.toLocaleString()} | ตำแหน่ง:{" "}
                    {selectedLot.location ?? "-"}
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

            {/* From Location */}
            <Input
              label="ตำแหน่งต้นทาง *"
              id="from_location"
              name="from_location"
              value={form.from_location}
              onChange={handleChange}
              placeholder="เช่น A-01-01"
              disabled={saving}
            />

            {/* To Location */}
            <Input
              label="ตำแหน่งปลายทาง *"
              id="to_location"
              name="to_location"
              value={form.to_location}
              onChange={handleChange}
              placeholder="เช่น B-02-03"
              disabled={saving}
            />

            {/* Note */}
            <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
              <label
                htmlFor="note"
                className="text-sm font-medium text-gray-700"
              >
                หมายเหตุ
              </label>
              <input
                id="note"
                name="note"
                value={form.note}
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
                }}
                disabled={saving}
              >
                ล้างฟอร์ม
              </Button>
              <Button type="submit" loading={saving}>
                <ArrowLeftRight className="h-4 w-4" />
                บันทึกโอนย้าย
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Recent Transfers */}
      <Card>
        <CardHeader>
          <CardTitle>ประวัติการโอนย้ายล่าสุด</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {transfersLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : transfers.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <Package className="h-12 w-12 text-gray-300" />
              <p className="text-sm text-gray-400">
                ยังไม่มีประวัติการโอนย้าย
              </p>
            </div>
          ) : (
            <DataTable<TransferRecord>
              columns={columns}
              data={transfers}
              keyField="reference_id"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
