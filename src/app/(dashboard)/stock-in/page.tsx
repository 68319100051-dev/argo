"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/supabase/types";
import { cn } from "@/lib/utils/cn";
import { generateQrPayload } from "@/lib/qr/generator";
import {
  ArrowDownToLine,
  CheckCircle,
  XCircle,
  Loader2,
  Package,
  Printer,
  FileSpreadsheet,
  ScanText,
  Upload,
} from "lucide-react";

interface OcrItem {
  sku?: string;
  name?: string;
  quantity?: number;
  unit?: string;
}

interface OcrData {
  items: OcrItem[];
  supplierName?: string;
  documentDate?: string;
}

type ToastType = "success" | "error";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let toastId = 0;

interface StockInForm {
  product_id: string;
  lot_number: string;
  quantity: string;
  location: string;
  expiry_date: string;
  note: string;
}

const emptyForm: StockInForm = {
  product_id: "",
  lot_number: "",
  quantity: "",
  location: "",
  expiry_date: "",
  note: "",
};

interface StockInMovement extends Record<string, unknown> {
  id: string;
  created_at: string;
  product_name: string;
  product_sku: string;
  lot_number: string | null;
  quantity_change: number;
  location: string | null;
  performed_by_name: string | null;
}

export default function StockInPage() {
  const supabase = createClient();

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const [form, setForm] = useState<StockInForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [movements, setMovements] = useState<StockInMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(true);

  const [toasts, setToasts] = useState<Toast[]>([]);

  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrData, setOcrData] = useState<OcrData | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const handleOcrFile = async (file: File) => {
    setOcrError(null);
    setOcrData(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));

    setOcrLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/agents/ocr", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOcrError(body?.error ?? "ไม่สามารถประมวลผลเอกสารได้");
      } else {
        setOcrData(body?.data as OcrData);
        addToast("อ่านเอกสารสำเร็จ กรุณาตรวจสอบข้อมูลก่อนบันทึก", "success");
      }
    } catch {
      setOcrError("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setOcrLoading(false);
    }
  };

  const applyOcrItem = (item: OcrItem) => {
    if (item.name && item.sku) {
      const match = products.find(
        (p) => p.sku.toLowerCase() === item.sku?.toLowerCase() || p.name.toLowerCase() === item.name?.toLowerCase()
      );
      if (match) {
        setForm((prev) => ({
          ...prev,
          product_id: match.id,
          quantity: item.quantity ? String(item.quantity) : prev.quantity,
        }));
        addToast(`พบสินค้า ${match.name} — เติมข้อมูลให้แล้ว`, "success");
        return;
      }
    }
    setFormError("ไม่พบสินค้าที่ตรงในระบบจากเอกสาร กรุณาเลือกสินค้าด้วยตนเอง");
  };

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
        lot:lots(lot_number),
        performer:users!stock_movements_performed_by_fkey(display_name)
      `)
      .eq("movement_type", "stock_in")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      addToast("ไม่สามารถโหลดประวัติการรับสินค้าได้", "error");
    } else {
      const mapped: StockInMovement[] = (data ?? []).map((item: Record<string, unknown>) => {
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
          performed_by_name: performer?.display_name ?? null,
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
    if (isPerLot && !form.lot_number.trim()) {
      setFormError("กรุณากรอก Lot Number สำหรับสินค้าที่ติดตามแบบต่อล็อต");
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

    let lotId: string | null = null;

    if (isPerLot) {
      const { data: existingLot } = await supabase
        .from("lots")
        .select("id, quantity")
        .eq("product_id", form.product_id)
        .eq("lot_number", form.lot_number.trim())
        .single();

      if (existingLot) {
        const { error: updateLotError } = await supabase
          .from("lots")
          .update({
            quantity: existingLot.quantity + Number(form.quantity),
            location: form.location.trim() || null,
            expiry_date: form.expiry_date || null,
          })
          .eq("id", existingLot.id);

        if (updateLotError) {
          setFormError("ไม่สามารถอัปเดตล็อตได้");
          setSaving(false);
          return;
        }

        lotId = existingLot.id;
      } else {
        const qrCode = generateQrPayload({
          productId: form.product_id,
          lotNumber: form.lot_number.trim(),
          location: form.location.trim() || undefined,
        });

        const { data: newLot, error: insertLotError } = await supabase
          .from("lots")
          .insert({
            product_id: form.product_id,
            lot_number: form.lot_number.trim(),
            quantity: Number(form.quantity),
            location: form.location.trim() || null,
            expiry_date: form.expiry_date || null,
            created_by: user.id,
            qr_code: qrCode,
          })
          .select("id")
          .single();

        if (insertLotError || !newLot) {
          setFormError("ไม่สามารถสร้างล็อตใหม่ได้");
          setSaving(false);
          return;
        }

        lotId = newLot.id;

        const qrCodeWithLot = generateQrPayload({
          productId: form.product_id,
          lotId: lotId ?? undefined,
          lotNumber: form.lot_number.trim(),
          location: form.location.trim() || undefined,
        });
        await supabase.from("lots").update({ qr_code: qrCodeWithLot }).eq("id", lotId);
      }
    }

    const { error: movementError } = await supabase
      .from("stock_movements")
      .insert({
        product_id: form.product_id,
        lot_id: lotId,
        movement_type: "stock_in",
        quantity_change: Number(form.quantity),
        location: form.location.trim() || null,
        reference_type: "manual",
        note: form.note.trim() || null,
        performed_by: user.id,
      });

    if (movementError) {
      setFormError("ไม่สามารถบันทึกรายการรับสินค้าได้");
      addToast("บันทึกรายการไม่สำเร็จ", "error");
      setSaving(false);
      return;
    }

    addToast("บันทึกรายการรับสินค้าสำเร็จ", "success");
    setForm(emptyForm);
    setSaving(false);
    fetchMovements();
  };

  const columns: Column<StockInMovement>[] = [
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
        <span className="font-medium text-green-600">
          +{row.quantity_change.toLocaleString()}
        </span>
      ),
    },
    {
      key: "location",
      label: "ตำแหน่ง",
      render: (row) => row.location ?? "-",
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
        <h1 className="text-2xl font-bold text-gray-900">รับสินค้าเข้า</h1>
        <p className="text-sm text-gray-500">
          บันทึกการรับสินค้าเข้าเข้าคลังสินค้า
        </p>
      </div>

      {/* OCR Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ScanText className="h-5 w-5 text-indigo-600" />
            <CardTitle>สแกนเอกสารรับสินค้า (OCR)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleOcrFile(f);
              e.target.value = "";
            }}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={ocrLoading}
            >
              {ocrLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              อัปโหลดภาพใบส่งของ / ใบแจ้งหนี้
            </Button>
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="เอกสารที่จะสแกน"
                className="h-32 w-32 rounded-lg border border-gray-200 object-cover"
              />
            )}
          </div>

          {ocrError && (
            <p className="text-sm text-red-500">{ocrError}</p>
          )}

          {ocrData && (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">
                  ข้อมูลจากเอกสารสอบ ({ocrData.supplierName ?? "ไม่ระบุผู้ขาย"}
                  {ocrData.documentDate ? ` · ${ocrData.documentDate}` : ""})
                </p>
                <Button size="sm" variant="ghost" onClick={() => { setOcrData(null); }}>
                  ปิด
                </Button>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {ocrData.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm shadow-sm">
                    <div>
                      <p className="font-medium text-gray-800">{item.name ?? "ไม่ระบุชื่อ"}</p>
                      {item.sku && <p className="text-xs text-gray-400">{item.sku}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-600">
                        {item.quantity ?? 0} {item.unit ?? "ชิ้น"}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => applyOcrItem(item)}>
                        ใช้ในฟอร์ม
                      </Button>
                    </div>
                  </div>
                ))}
                {ocrData.items.length === 0 && (
                  <p className="text-sm text-gray-500">ไม่พบรายการสินค้าในเอกสาร</p>
                )}
                <p className="text-xs text-gray-400">
                  ข้อมูลจาก OCR ใช้ประกอบการตรวจสอบเท่านั้น — กรุณายืนยันสินค้าและจำนวนด้วยตนเองก่อนบันทึก
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>บันทึกรับสินค้าเข้า</CardTitle>
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

            {/* Lot Number */}
            <Input
              label={`Lot Number ${isPerLot ? "*" : ""}`}
              id="lot_number"
              name="lot_number"
              value={form.lot_number}
              onChange={handleChange}
              placeholder={isPerLot ? "ระบุเลขล็อต" : "ไม่จำเป็น"}
              disabled={saving || !form.product_id}
            />

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
              label="ตำแหน่งจัดเก็บ"
              id="location"
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder="เช่น A-01-01"
              disabled={saving}
            />

            {/* Expiry Date */}
            <Input
              label="วันที่หมดอายุ"
              id="expiry_date"
              name="expiry_date"
              type="date"
              value={form.expiry_date}
              onChange={handleChange}
              disabled={saving}
            />

            {/* Note */}
            <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
              <label htmlFor="note" className="text-sm font-medium text-gray-700">
                หมายเหตุ / อ้างอิง
              </label>
              <input
                id="note"
                name="note"
                value={form.note}
                onChange={handleChange}
                placeholder="ระบุหมายเหตุหรือเลขที่อ้างอิง (ถ้ามี)"
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
                <ArrowDownToLine className="h-4 w-4" />
                บันทึกรับสินค้า
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Recent Movements */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>ประวัติการรับสินค้าล่าสุด</CardTitle>
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
                      <td style="border:1px solid #ddd;padding:6px 10px;text-align:right">${m.quantity_change}</td>
                      <td style="border:1px solid #ddd;padding:6px 10px">${m.location ?? "-"}</td>
                      <td style="border:1px solid #ddd;padding:6px 10px">${m.performed_by_name ?? "-"}</td>
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
                          <div>ใบรับสินค้า</div>
                          <div style="font-size:12px;color:#475569;margin-top:4px">วันที่: ${new Date().toLocaleDateString("th-TH")}</div>
                        </div>
                      </div>
                      <table>
                        <tr><th>ลำดับ</th><th>วันที่</th><th>รหัสสินค้า</th><th>ชื่อสินค้า</th><th>จำนวน</th><th>ตำแหน่ง</th><th>ผู้บันทึก</th></tr>
                        ${rows}
                      </table>
                      <div style="margin-top:12px;text-align:right;font-weight:700;color:#1e3a5f">รวม: ${movements.reduce((s, m) => s + m.quantity_change, 0).toLocaleString()} ชิ้น</div>
                      <div class="footer">
                        <div class="sig"><div class="line"></div><div class="label">ผู้ส่งสินค้า</div></div>
                        <div class="sig"><div class="line"></div><div class="label">ผู้รับสินค้า</div></div>
                        <div class="sig"><div class="line"></div><div class="label">ผู้ตรวจสอบ</div></div>
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
                    "จำนวน": m.quantity_change,
                    "ตำแหน่ง": m.location ?? "-",
                    "ผู้บันทึก": m.performed_by_name ?? "-",
                  }));
                  exportToExcel(rows, [
                    { header: "วันที่", key: "วันที่", width: 15 },
                    { header: "รหัสสินค้า", key: "รหัสสินค้า", width: 15 },
                    { header: "ชื่อสินค้า", key: "ชื่อสินค้า", width: 30 },
                    { header: "ล็อต", key: "ล็อต", width: 12 },
                    { header: "จำนวน", key: "จำนวน", width: 10 },
                    { header: "ตำแหน่ง", key: "ตำแหน่ง", width: 15 },
                    { header: "ผู้บันทึก", key: "ผู้บันทึก", width: 15 },
                  ], `รับสินค้า-${new Date().toISOString().slice(0, 10)}`);
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
                ยังไม่มีประวัติการรับสินค้า
              </p>
            </div>
          ) : (
            <DataTable<StockInMovement>
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
