"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { createClient } from "@/lib/supabase/client";
import type { Product, Lot } from "@/lib/supabase/types";
import { generateSku } from "@/lib/utils/formats";
import { cn } from "@/lib/utils/cn";
import Link from "next/link";
import { QrDisplay } from "@/components/qr/QrDisplay";
import { generateQrPayload } from "@/lib/qr/generator";
import { printQrLabels } from "@/lib/qr/print";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  QrCode,
  Package,
  Printer,
  MapPin,
  CheckCircle,
  XCircle,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";

type FormData = {
  sku: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  tracking_mode: "per_unit" | "per_lot";
  reorder_point: number;
  price: string;
  initial_quantity: number;
};

const emptyForm: FormData = {
  sku: "",
  name: "",
  description: "",
  category: "",
  unit: "ชิ้น",
  tracking_mode: "per_unit",
  reorder_point: 0,
  price: "",
  initial_quantity: 0,
};

type ToastType = "success" | "error";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let toastId = 0;

const trackingModeLabels: Record<string, string> = {
  per_unit: "ต่อหน่วย",
  per_lot: "ต่อล็อต",
};

const trackingModeOptions = [
  { value: "per_unit", label: "ต่อหน่วย" },
  { value: "per_lot", label: "ต่อล็อต" },
];

export default function ProductsPage() {
  const supabase = createClient();

  const [products, setProducts] = useState<Product[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [showQrProduct, setShowQrProduct] = useState<string | null>(null);
  const [productLots, setProductLots] = useState<Lot[]>([]);
  const [lotLoading, setLotLoading] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);

    const [productRes, stockRes] = await Promise.all([
      supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("stock_movements")
        .select("product_id, quantity_change")
        .in("movement_type", ["stock_in", "stock_out", "cycle_count_adjust", "return", "adjustment"]),
    ]);

    if (productRes.error) {
      addToast("ไม่สามารถโหลดข้อมูลสินค้าได้", "error");
    } else {
      setProducts(productRes.data ?? []);
    }

    const map: Record<string, number> = {};
    for (const m of stockRes.data ?? []) {
      map[m.product_id] = (map[m.product_id] ?? 0) + (m.quantity_change ?? 0);
    }
    setStockMap(map);
    setLoading(false);
  }, [supabase, addToast]);

  useEffect(() => {
    void (async () => {
      await fetchProducts();
    })();
  }, [fetchProducts]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!showQrProduct) {
        setProductLots([]);
        return;
      }
      const product = products.find((p) => p.id === showQrProduct);
      if (!product || product.tracking_mode !== "per_lot") {
        setProductLots([]);
        return;
      }
      setLotLoading(true);
      const { data } = await supabase
        .from("lots")
        .select("*")
        .eq("product_id", showQrProduct)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setProductLots(data ?? []);
        setLotLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showQrProduct, products, supabase]);

  const openAddModal = () => {
    setEditingId(null);
    setForm({ ...emptyForm, sku: generateSku("", "") });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingId(product.id);
    setForm({
      sku: product.sku,
      name: product.name,
      description: product.description ?? "",
      category: product.category ?? "",
      unit: product.unit,
      tracking_mode: product.tracking_mode,
      reorder_point: product.reorder_point,
      price: product.price?.toString() ?? "",
      initial_quantity: stockMap[product.id] ?? 0,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError("กรุณากรอกชื่อสินค้า");
      return;
    }
    if (!form.sku.trim()) {
      setFormError("กรุณากรอก SKU");
      return;
    }

    setSaving(true);
    setFormError(null);

    const payload = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      unit: form.unit,
      tracking_mode: form.tracking_mode,
      reorder_point: Number(form.reorder_point),
      price: form.price ? Number(form.price) : null,
    };

    const { data: { user } } = await supabase.auth.getUser();

    if (editingId) {
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", editingId);

      if (error) {
        setFormError(error.message);
        addToast("แก้ไขสินค้าไม่สำเร็จ", "error");
      } else {
        const currentStock = stockMap[editingId] ?? 0;
        const newStock = form.initial_quantity;
        if (newStock !== currentStock && user?.id) {
          const diff = newStock - currentStock;
          await supabase.from("stock_movements").insert({
            product_id: editingId,
            movement_type: "cycle_count_adjust",
            quantity_change: diff,
            note: `ปรับสต๊อกจาก ${currentStock} เป็น ${newStock}`,
            performed_by: user.id,
          });
        }
        addToast("แก้ไขสินค้าสำเร็จ", "success");
        setModalOpen(false);
        fetchProducts();
      }
    } else {
      const { data: newProduct, error } = await supabase
        .from("products")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        setFormError(error.message);
        addToast("เพิ่มสินค้าไม่สำเร็จ", "error");
      } else if (form.initial_quantity > 0 && newProduct && user?.id) {
        const { error: mvError } = await supabase
          .from("stock_movements")
          .insert({
            product_id: newProduct.id,
            movement_type: "stock_in",
            quantity_change: form.initial_quantity,
            note: "สต๊อกเริ่มต้น",
            performed_by: user?.id,
          });
        if (mvError) {
          addToast("เพิ่มสินค้าสำเร็จ แต่บันทึกสต๊อกเริ่มต้นล้มเหลว", "error");
        } else {
          addToast("เพิ่มสินค้าสำเร็จ", "success");
        }
        setModalOpen(false);
        fetchProducts();
      } else {
        addToast("เพิ่มสินค้าสำเร็จ", "success");
        setModalOpen(false);
        fetchProducts();
      }
    }

    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);

    const { error } = await supabase
      .from("products")
      .update({ is_active: false })
      .eq("id", deleteConfirm);

    if (error) {
      addToast("ลบสินค้าไม่สำเร็จ", "error");
    } else {
      addToast("ลบสินค้าสำเร็จ", "success");
      setProducts((prev) => prev.filter((p) => p.id !== deleteConfirm));
    }

    setDeleting(false);
    setDeleteConfirm(null);
  };

  const filtered = products.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q)
    );
  });

  const handlePrintAll = async () => {
    const items = filtered.map((p) => ({
      data: generateQrPayload({ productId: p.id }),
      title: p.name,
      subtitle: `SKU: ${p.sku}`,
      detail:
        p.tracking_mode === "per_lot"
          ? "ติดตามต่อล็อต — พิมพ์ป้ายล็อตในหน้าป้าย QR"
          : undefined,
    }));
    if (items.length === 0) {
      addToast("ไม่มีสินค้าให้พิมพ์", "error");
      return;
    }
    await printQrLabels(items);
  };

  const handleExport = async () => {
    if (products.length === 0) {
      addToast("ไม่มีสินค้าให้ส่งออก", "error");
      return;
    }
    const { exportToExcel } = await import("@/lib/documents/excel");
    const dateStr = new Date().toISOString().slice(0, 10);
    const rows = products.map((p) => ({
      รหัสสินค้า: p.sku,
      ชื่อสินค้า: p.name,
      หมวดหมู่: p.category ?? "",
      หน่วย: p.unit,
      การติดตาม: trackingModeLabels[p.tracking_mode] ?? p.tracking_mode,
      สต็อกปัจจุบัน: stockMap[p.id] ?? 0,
      จุดสั่งซื้อซ้ำ: p.reorder_point,
      ราคา: p.price ?? 0,
    }));
    exportToExcel(
      rows,
      [
        { header: "รหัสสินค้า", key: "รหัสสินค้า", width: 15 },
        { header: "ชื่อสินค้า", key: "ชื่อสินค้า", width: 30 },
        { header: "หมวดหมู่", key: "หมวดหมู่", width: 15 },
        { header: "หน่วย", key: "หน่วย", width: 8 },
        { header: "การติดตาม", key: "การติดตาม", width: 10 },
        { header: "สต็อกปัจจุบัน", key: "สต็อกปัจจุบัน", width: 14 },
        { header: "จุดสั่งซื้อซ้ำ", key: "จุดสั่งซื้อซ้ำ", width: 14 },
        { header: "ราคา", key: "ราคา", width: 14 },
      ],
      `สินค้า_${dateStr}`
    );
  };

  const handlePrintProduct = async (product: Product) => {
    await printQrLabels([
      {
        data: generateQrPayload({ productId: product.id }),
        title: product.name,
        subtitle: `SKU: ${product.sku}`,
      },
    ]);
  };

  const handlePrintLot = async (product: Product, lot: Lot) => {
    await printQrLabels([
      {
        data:
          lot.qr_code ??
          generateQrPayload({
            productId: product.id,
            lotId: lot.id,
            lotNumber: lot.lot_number,
            location: lot.location ?? undefined,
          }),
        title: `${product.name} — ล็อต ${lot.lot_number}`,
        subtitle: `SKU: ${product.sku}`,
        detail: lot.location ? `ตำแหน่ง: ${lot.location}` : undefined,
      },
    ]);
  };

  const handlePrintAllLots = async (product: Product) => {
    if (productLots.length === 0) {
      addToast("ไม่มีล็อตให้พิมพ์", "error");
      return;
    }
    await printQrLabels(
      productLots.map((lot) => ({
        data:
          lot.qr_code ??
          generateQrPayload({
            productId: product.id,
            lotId: lot.id,
            lotNumber: lot.lot_number,
            location: lot.location ?? undefined,
          }),
        title: `${product.name} — ล็อต ${lot.lot_number}`,
        subtitle: `SKU: ${product.sku}`,
        detail: lot.location ? `ตำแหน่ง: ${lot.location}` : undefined,
      }))
    );
  };

  const columns: Column<Product>[] = [
    {
      key: "sku",
      label: "SKU",
      sortable: true,
      className: "font-mono text-xs",
    },
    {
      key: "name",
      label: "ชื่อสินค้า",
      sortable: true,
      render: (row) => (
        <Link
          href={`/products/${row.id}`}
          className="font-medium text-indigo-600 hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: "category",
      label: "หมวดหมู่",
      sortable: true,
      render: (row) => row.category ?? "-",
    },
    {
      key: "reorder_point",
      label: "จุดสั่งซื้อซ้ำ / คงเหลือ",
      sortable: true,
      render: (row) => {
        const qty = stockMap[row.id] ?? 0;
        return (
          <div className="flex items-center gap-2">
            <span className={cn(
              "tabular-nums",
              qty <= row.reorder_point && "font-semibold text-red-600"
            )}>
              {qty.toLocaleString()}
            </span>
            <span className="text-xs text-gray-400">/</span>
            <span className="tabular-nums text-gray-500">{row.reorder_point.toLocaleString()}</span>
          </div>
        );
      },
    },
    {
      key: "is_active",
      label: "สถานะ",
      render: () => (
        <Badge variant="success" className="gap-1">
          <CheckCircle className="h-3 w-3" />
          ใช้งาน
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      className: "w-32 text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setShowQrProduct(row.id);
            }}
            title="แสดง QR Code"
          >
            <QrCode className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(row);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteConfirm(row.id);
            }}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">สินค้า</h1>
          <p className="text-sm text-gray-500">จัดการข้อมูลสินค้าทั้งหมด</p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handlePrintAll} disabled={loading}>
              <Printer className="h-4 w-4" />
              พิมพ์ป้ายทั้งหมด
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={loading}>
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </Button>
            <Button onClick={openAddModal}>
              <Plus className="h-4 w-4" />
              เพิ่มสินค้า
            </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="ค้นหาด้วยชื่อหรือ SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <Package className="h-12 w-12 text-gray-300" />
              <p className="text-sm text-gray-400">
                {search
                  ? "ไม่พบสินค้าที่ค้นหา"
                  : "ยังไม่มีสินค้า — กด \"เพิ่มสินค้า\" เพื่อเริ่มต้น"}
              </p>
              {!search && (
                <Button variant="outline" size="sm" onClick={openAddModal}>
                  <Plus className="h-4 w-4" />
                  เพิ่มสินค้า
                </Button>
              )}
            </div>
          ) : (
            <DataTable<Product>
              columns={columns}
              data={filtered}
              keyField="id"
              onRowClick={openEditModal}
            />
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingId ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="flex flex-col gap-4"
        >
          <Input
            label="SKU"
            id="sku"
            name="sku"
            value={form.sku}
            onChange={handleChange}
            placeholder="SKU-XXXX"
            disabled={saving}
          />

          <Input
            label="ชื่อสินค้า *"
            id="name"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="ระบุชื่อสินค้า"
            disabled={saving}
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="description" className="text-sm font-medium text-gray-700">
              คำอธิบาย
            </label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              placeholder="รายละเอียดสินค้า (ถ้ามี)"
              disabled={saving}
              className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <Input
            label="หมวดหมู่"
            id="category"
            name="category"
            value={form.category}
            onChange={handleChange}
            placeholder="เช่น อุปกรณ์อิเล็กทรอนิกส์"
            disabled={saving}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="หน่วยนับ"
              id="unit"
              name="unit"
              value={form.unit}
              onChange={handleChange}
              disabled={saving}
            />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="tracking_mode" className="text-sm font-medium text-gray-700">
                รูปแบบติดตาม
              </label>
              <select
                id="tracking_mode"
                name="tracking_mode"
                value={form.tracking_mode}
                onChange={handleChange}
                disabled={saving}
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {trackingModeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="จุดสั่งซื้อซ้ำ"
              id="reorder_point"
              name="reorder_point"
              type="number"
              min={0}
              value={form.reorder_point}
              onChange={handleChange}
              disabled={saving}
            />

            <Input
              label="ราคา"
              id="price"
              name="price"
              type="number"
              step="0.01"
              min={0}
              value={form.price}
              onChange={handleChange}
              placeholder="0.00"
              disabled={saving}
            />
          </div>

          <div>
            <Input
              label={editingId ? "จำนวนในสต็อก" : "จำนวนสต๊อกเริ่มต้น"}
              id="initial_quantity"
              name="initial_quantity"
              type="number"
              min={0}
              value={form.initial_quantity}
              onChange={(e) => setForm((p) => ({ ...p, initial_quantity: parseInt(e.target.value) || 0 }))}
              disabled={saving}
            />
            <p className="mt-1 text-xs text-gray-400">
              {editingId ? "ปรับจำนวนตรงนี้เพื่อแก้ไขสต๊อก" : "ถ้าไม่ใส่ จะเริ่มต้นที่ 0"}
            </p>
          </div>

          {formError && (
            <p className="text-sm text-red-500">{formError}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              ยกเลิก
            </Button>
            <Button type="submit" loading={saving}>
              {editingId ? "บันทึกการเปลี่ยนแปลง" : "เพิ่มสินค้า"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteConfirm !== null}
        onClose={() => !deleting && setDeleteConfirm(null)}
        title="ยืนยันการลบ"
      >
        <p className="text-sm text-gray-600 mb-4">
          คุณแน่ใจหรือไม่ว่าต้องการลบสินค้านี้? การดำเนินการนี้จะเปลี่ยนสถานะสินค้าเป็นไม่ใช้งาน
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => setDeleteConfirm(null)}
            disabled={deleting}
          >
            ยกเลิก
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            loading={deleting}
          >
            ยืนยันการลบ
          </Button>
        </div>
      </Modal>

      {/* QR Code Modal */}
      <Modal
        open={showQrProduct !== null}
        onClose={() => setShowQrProduct(null)}
        title="QR Code สินค้า"
      >
        {(() => {
          const product = products.find((p) => p.id === showQrProduct);
          if (!product) return null;

          if (product.tracking_mode === "per_lot") {
            return (
              <div className="flex flex-col gap-5 py-4">
                <div className="flex flex-col items-center gap-4">
                  <QrDisplay
                    data={generateQrPayload({ productId: product.id })}
                    size={160}
                  />
                  <div className="text-xs text-gray-400 break-all text-center max-w-[200px]">
                    SKU: {product.sku} | {product.name}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handlePrintProduct(product)}>
                    <Printer className="h-4 w-4" />
                    พิมพ์ป้ายสินค้า
                  </Button>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">
                      ป้าย QR ตามล็อต ({productLots.length})
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePrintAllLots(product)}
                      disabled={productLots.length === 0}
                    >
                      <Printer className="h-4 w-4" />
                      พิมพ์ทุกล็อต
                    </Button>
                  </div>

                  {lotLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                    </div>
                  ) : productLots.length === 0 ? (
                    <p className="text-sm text-gray-400">
                      ยังไม่มีล็อต — รับสินค้าเข้าที่หน้า “รับเข้า” เพื่อสร้างป้าย QR ต่อล็อต
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {productLots.map((lot) => (
                        <div
                          key={lot.id}
                          className="flex items-center gap-4 rounded-lg border border-gray-200 p-3"
                        >
                          <QrDisplay
                            data={
                              lot.qr_code ??
                              generateQrPayload({
                                productId: product.id,
                                lotId: lot.id,
                                lotNumber: lot.lot_number,
                                location: lot.location ?? undefined,
                              })
                            }
                            size={80}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900">
                              ล็อต {lot.lot_number}
                            </p>
                            <p className="flex items-center gap-1 text-xs text-gray-500">
                              <MapPin className="h-3 w-3" />
                              {lot.location ?? "ไม่ระบุตำแหน่ง"}
                            </p>
                            <p className="text-xs text-gray-500">
                              คงเหลือ: {lot.quantity.toLocaleString()} หน่วย
                              {lot.expiry_date
                                ? ` | หมดอายุ: ${new Date(lot.expiry_date).toLocaleDateString("th-TH")}`
                                : ""}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePrintLot(product, lot)}
                          >
                            <Printer className="h-4 w-4" />
                            พิมพ์
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div className="flex flex-col items-center gap-4 py-4">
              <QrDisplay
                data={generateQrPayload({ productId: product.id })}
                size={160}
              />
              <div className="text-xs text-gray-400 break-all text-center max-w-[200px]">
                SKU: {product.sku} | {product.name}
              </div>
              <Button size="sm" variant="outline" onClick={() => handlePrintProduct(product)}>
                <Printer className="h-4 w-4" />
                พิมพ์ป้ายสินค้า
              </Button>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
