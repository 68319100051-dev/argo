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
  ArrowUpFromLine,
  CheckCircle,
  XCircle,
  Loader2,
  Package,
  Printer,
  FileSpreadsheet,
} from "lucide-react";

type ToastType = "success" | "error";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let toastId = 0;

interface StockOutForm {
  product_id: string;
  lot_id: string;
  quantity: string;
  location: string;
  note: string;
}

const emptyForm: StockOutForm = {
  product_id: "",
  lot_id: "",
  quantity: "",
  location: "",
  note: "",
};

interface StockOutMovement extends Record<string, unknown> {
  id: string;
  created_at: string;
  product_name: string;
  product_sku: string;
  lot_number: string | null;
  quantity_change: number;
  location: string | null;
  note: string | null;
}

export default function StockOutPage() {
  const supabase = createClient();

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const [lots, setLots] = useState<Lot[]>([]);
  const [lotsLoading, setLotsLoading] = useState(false);

  const [form, setForm] = useState<StockOutForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [movements, setMovements] = useState<StockOutMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(true);

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
      .gt("quantity", 0)
      .eq("is_active", true)
      .order("lot_number", { ascending: true });

    if (error) {
      addToast("ไม่สามารถโหลดข้อมูลล็อตได้", "error");
    } else {
      setLots(data ?? []);
    }
    setLotsLoading(false);
  }, [supabase, addToast]);

  const fetchMovements = useCallback(async () => {
    setMovementsLoading(true);
    const { data, error } = await supabase
      .from("stock_movements")
      .select(`
        id,
        created_at,
        quantity_change,
        location,
        note,
        product:products(name, sku),
        lot:lots(lot_number)
      `)
      .eq("movement_type", "stock_out")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      addToast("ไม่สามารถโหลดประวัติการเบิกสินค้าได้", "error");
    } else {
      const mapped: StockOutMovement[] = (data ?? []).map((item: Record<string, unknown>) => {
        const product = item.product as { name: string; sku: string } | null;
        const lot = item.lot as { lot_number: string } | null;
        return {
          id: item.id as string,
          created_at: item.created_at as string,
          product_name: product?.name ?? "",
          product_sku: product?.sku ?? "",
          lot_number: lot?.lot_number ?? null,
          quantity_change: item.quantity_change as number,
          location: (item.location as string) ?? null,
          note: (item.note as string) ?? null,
        };
      });
      setMovements(mapped);
    }
    setMovementsLoading(false);
  }, [supabase, addToast]);

  useEffect(() => {
    void (async () => {
      await Promise.all([fetchProducts(), fetchMovements()]);
    })();
  }, [fetchProducts, fetchMovements]);

  useEffect(() => {
    void (async () => {
      if (form.product_id && isPerLot) {
        await fetchLots(form.product_id);
        setForm((prev) => ({ ...prev, lot_id: "" }));
      } else {
        setLots([]);
      }
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
    if (!form.quantity || Number(form.quantity) <= 0) {
      setFormError("กรุณากรอกจำนวนที่มากกว่า 0");
      return;
    }
    if (isPerLot && !form.lot_id) {
      setFormError("กรุณาเลือก Lot สำหรับสินค้าที่ติดตามแบบต่อล็อต");
      return;
    }

    setSaving(true);
    setFormError(null);

    const quantity = Number(form.quantity);

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
      const { data: lot, error: lotError } = await supabase
        .from("lots")
        .select("*")
        .eq("id", form.lot_id)
        .single();

      if (lotError || !lot) {
        setFormError("ไม่พบข้อมูลล็อต");
        setSaving(false);
        return;
      }

      if (lot.quantity < quantity) {
        setFormError(
          `สต็อกในล็อตไม่เพียงพอ (มี ${lot.quantity.toLocaleString()}, ต้องการ ${quantity.toLocaleString()})`
        );
        setSaving(false);
        return;
      }
    } else {
      const { data: totalData, error: totalError } = await supabase
        .from("stock_movements")
        .select("quantity_change")
        .eq("product_id", form.product_id)
        .in("movement_type", ["stock_in", "stock_out", "return", "cycle_count_adjust", "transfer", "adjustment"]);

      if (totalError) {
        setFormError("ไม่สามารถตรวจสอบสต็อกได้");
        setSaving(false);
        return;
      }

      const currentStock = (totalData ?? []).reduce(
        (sum, row) => sum + (row.quantity_change as number),
        0
      );

      if (currentStock < quantity) {
        setFormError(
          `สต็อกไม่เพียงพอ (มี ${currentStock.toLocaleString()}, ต้องการ ${quantity.toLocaleString()})`
        );
        setSaving(false);
        return;
      }
    }

    if (isPerLot) {
      const { data: lot, error: lotFetchError } = await supabase
        .from("lots")
        .select("quantity")
        .eq("id", form.lot_id)
        .single();

      if (lotFetchError || !lot) {
        setFormError("ไม่พบข้อมูลล็อต");
        setSaving(false);
        return;
      }

      const { error: updateError } = await supabase
        .from("lots")
        .update({ quantity: lot.quantity - quantity })
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
        lot_id: form.lot_id || null,
        movement_type: "stock_out",
        quantity_change: -quantity,
        location: form.location.trim() || null,
        reference_type: "manual",
        note: form.note.trim() || null,
        performed_by: user.id,
      });

    if (movementError) {
      addToast("บันทึกรายการไม่สำเร็จ", "error");
      setFormError("ไม่สามารถบันทึกรายการเบิกสินค้าได้");
      setSaving(false);
      return;
    }

    addToast("บันทึกรายการเบิกสินค้าสำเร็จ", "success");
    setForm(emptyForm);
    setSaving(false);
    fetchMovements();
  };

  const columns: Column<StockOutMovement>[] = [
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
        <span className="font-medium text-red-600">
          {row.quantity_change.toLocaleString()}
        </span>
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
        <h1 className="text-2xl font-bold text-gray-900">เบิกสินค้าออก</h1>
        <p className="text-sm text-gray-500">
          รองรับทั้งโหมด AI และกรอกด้วยตนเอง
        </p>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>บันทึกเบิกสินค้าออก</CardTitle>
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
              <label htmlFor="product_id" className="text-sm font-medium text-gray-700">
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
                <label htmlFor="lot_id" className="text-sm font-medium text-gray-700">
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
                    disabled={saving}
                    className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">-- เลือกล็อต --</option>
                    {lots.map((lot) => (
                      <option key={lot.id} value={lot.id}>
                        {lot.lot_number} (คงเหลือ {lot.quantity.toLocaleString()})
                      </option>
                    ))}
                  </select>
                )}
                {lots.length === 0 && !lotsLoading && (
                  <p className="text-xs text-amber-600">
                    ไม่พบล็อตที่มีสต็อกคงเหลือ
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
              placeholder="เช่น A-01-01 (เว้นว่างไว้ตัดสต็อกจากที่ไหนก็ได้)"
              disabled={saving}
            />

            {/* Note */}
            <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
              <label htmlFor="note" className="text-sm font-medium text-gray-700">
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
                <ArrowUpFromLine className="h-4 w-4" />
                บันทึกเบิกสินค้า
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Recent Movements */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>ประวัติการเบิกสินค้าล่าสุด</CardTitle>
            {movements.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const w = window.open("", "_blank");
                  if (!w) return;
                  const rows = movements.map((m, i) => `
                    <tr>
                      <td style="border:1px solid #ddd;padding:6px 10px">${i + 1}</td>
                      <td style="border:1px solid #ddd;padding:6px 10px">${new Date(m.created_at).toLocaleDateString("th-TH")}</td>
                      <td style="border:1px solid #ddd;padding:6px 10px">${m.product_sku}</td>
                      <td style="border:1px solid #ddd;padding:6px 10px">${m.product_name}</td>
                      <td style="border:1px solid #ddd;padding:6px 10px;text-align:right">${Math.abs(m.quantity_change)}</td>
                      <td style="border:1px solid #ddd;padding:6px 10px">${m.location ?? "-"}</td>
                      <td style="border:1px solid #ddd;padding:6px 10px">${m.note ?? "-"}</td>
                    </tr>
                  `).join("");
                  w.document.write(`
                    <html><head><meta charset="utf-8">
                    <style>
                      @page { margin: 15mm 20mm; }
                      body { font-family: 'Sarabun', 'TH Sarabun New', Tahoma, sans-serif; font-size: 13px; color: #333; }
                      .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e3a5f; padding-bottom: 12px; margin-bottom: 20px; }
                      .header h1 { font-size: 22px; color: #1e3a5f; margin: 0; }
                      .header .sub { font-size: 11px; color: #888; }
                      .header .right { text-align: right; font-size: 16px; font-weight: 600; color: #1e3a5f; }
                      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                      th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 11px; color: #1e293b; }
                      td { border: 1px solid #e2e8f0; padding: 6px 10px; }
                      .footer { margin-top: 40px; display: flex; justify-content: space-between; }
                      .footer .sig { text-align: center; flex: 1; }
                      .footer .sig .line { height: 40px; border-bottom: 1px solid #94a3b8; margin-bottom: 6px; }
                      .footer .sig .label { font-size: 11px; color: #64748b; }
                      .print-foot { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
                      @media print { .no-print { display: none !important; } }
                    </style></head><body>
                      <div class="header">
                        <div><h1>ARGO</h1><div class="sub">ระบบบริหารจัดการสต็อกสินค้า</div></div>
                        <div class="right">
                          <div>ใบเบิกสินค้า</div>
                          <div style="font-size:12px;color:#475569;margin-top:4px">วันที่: ${new Date().toLocaleDateString("th-TH")}</div>
                        </div>
                      </div>
                      <table>
                        <tr><th>ลำดับ</th><th>วันที่</th><th>รหัสสินค้า</th><th>ชื่อสินค้า</th><th>จำนวน</th><th>ตำแหน่ง</th><th>หมายเหตุ</th></tr>
                        ${rows}
                      </table>
                      <div style="margin-top:12px;text-align:right;font-weight:700;color:#1e3a5f">รวม: ${movements.reduce((s, m) => s + Math.abs(m.quantity_change), 0).toLocaleString()} ชิ้น</div>
                      <div class="footer">
                        <div class="sig"><div class="line"></div><div class="label">ผู้เบิก</div></div>
                        <div class="sig"><div class="line"></div><div class="label">ผู้อนุมัติ</div></div>
                        <div class="sig"><div class="line"></div><div class="label">ผู้จ่ายสินค้า</div></div>
                      </div>
                      <div class="print-foot">เอกสารนี้สร้างจากระบบ ARGO Stock Management</div>
                      <script>window.onload = function() { window.print(); }</script>
                    </body></html>
                  `);
                  w.document.close();
                }}
              >
                <Printer className="h-4 w-4" />
                พิมพ์
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const { exportToExcel } = await import("@/lib/documents/excel");
                  const rows = movements.map((m) => ({
                    "วันที่": new Date(m.created_at).toLocaleDateString("th-TH"),
                    "รหัสสินค้า": m.product_sku,
                    "ชื่อสินค้า": m.product_name,
                    "ล็อต": m.lot_number ?? "-",
                    "จำนวน": Math.abs(m.quantity_change),
                    "ตำแหน่ง": m.location ?? "-",
                    "หมายเหตุ": m.note ?? "-",
                  }));
                  exportToExcel(rows, [
                    { header: "วันที่", key: "วันที่", width: 15 },
                    { header: "รหัสสินค้า", key: "รหัสสินค้า", width: 15 },
                    { header: "ชื่อสินค้า", key: "ชื่อสินค้า", width: 30 },
                    { header: "ล็อต", key: "ล็อต", width: 12 },
                    { header: "จำนวน", key: "จำนวน", width: 10 },
                    { header: "ตำแหน่ง", key: "ตำแหน่ง", width: 15 },
                    { header: "หมายเหตุ", key: "หมายเหตุ", width: 20 },
                  ], `เบิกสินค้า-${new Date().toISOString().slice(0, 10)}`);
                }}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Button>
            </div>
          )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {movementsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : movements.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <Package className="h-12 w-12 text-gray-300" />
              <p className="text-sm text-gray-400">
                ยังไม่มีประวัติการเบิกสินค้า
              </p>
            </div>
          ) : (
            <DataTable<StockOutMovement>
              columns={columns}
              data={movements}
              keyField="id"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
