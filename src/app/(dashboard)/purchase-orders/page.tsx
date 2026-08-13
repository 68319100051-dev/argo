"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { createClient } from "@/lib/supabase/client";
import type {
  PoStatus,
  PurchaseOrder,
} from "@/lib/supabase/types";
import { generatePoNumber, formatCurrency, formatDate } from "@/lib/utils/formats";
import { cn } from "@/lib/utils/cn";
import {
  Plus,
  Search,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  Send,
  Check,
  Ban,
  ArrowDownToLine,
  Pencil,
  Eye,
  Printer,
  FileSpreadsheet,
} from "lucide-react";

const statusBadgeVariant: Record<
  PoStatus,
  "default" | "warning" | "primary" | "success" | "danger"
> = {
  draft: "default",
  pending_approval: "warning",
  approved: "primary",
  received: "success",
  cancelled: "danger",
};

const statusLabels: Record<PoStatus, string> = {
  draft: "แบบร่าง",
  pending_approval: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  received: "รับแล้ว",
  cancelled: "ยกเลิก",
};

const tabs = [
  { key: "all", label: "ทั้งหมด" },
  { key: "draft", label: "แบบร่าง" },
  { key: "pending_approval", label: "รออนุมัติ" },
  { key: "approved", label: "อนุมัติแล้ว" },
  { key: "received", label: "รับแล้ว" },
  { key: "cancelled", label: "ยกเลิก" },
];

type ToastType = "success" | "error";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let toastId = 0;
let itemTempId = 0;

interface PurchaseOrderRow extends Record<string, unknown> {
  id: string;
  po_number: string;
  supplier_name: string;
  supplier_code: string;
  status: PoStatus;
  total_amount: number | null;
  order_date: string;
  expected_date: string | null;
}

interface POItemForm {
  tempId: number;
  product_id: string;
  quantity: string;
  unit_price: string;
}

interface POViewItem {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number;
  tracking_mode: "per_unit" | "per_lot";
}

interface POViewData {
  po: PurchaseOrder;
  supplier_name: string;
  supplier_code: string;
  items: POViewItem[];
  createdByName: string | null;
}

const emptyForm = {
  supplier_id: "",
  order_date: new Date().toISOString().slice(0, 10),
  expected_date: "",
  notes: "",
};

export default function PurchaseOrdersPage() {
  const supabase = createClient();

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const [suppliers, setSuppliers] = useState<
    { id: string; code: string; name: string; contact_person: string | null; phone: string | null }[]
  >([]);
  const [products, setProducts] = useState<
    { id: string; sku: string; name: string; unit: string; tracking_mode: "per_unit" | "per_lot" }[]
  >([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState<POItemForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewData, setViewData] = useState<POViewData | null>(null);
  const [viewActionLoading, setViewActionLoading] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCurrentUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const { data: userData } = await supabase
        .from("users")
        .select("role_id")
        .eq("id", user.id)
        .single();
      if (userData) {
        const { data: role } = await supabase
          .from("roles")
          .select("name")
          .eq("id", userData.role_id)
          .single();
        if (role) {
          setCurrentUserRole(role.name as string);
        }
      }
    }
  }, [supabase]);

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, sku, name, unit, tracking_mode")
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (!error) setProducts(data ?? []);
  }, [supabase]);

  const fetchSuppliers = useCallback(async () => {
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, code, name, contact_person, phone")
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (!error) setSuppliers(data ?? []);
  }, [supabase]);

  const fetchPurchaseOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("purchase_orders")
      .select(`*, supplier:suppliers(name, code)`)
      .order("created_at", { ascending: false });

    if (error) {
      addToast("ไม่สามารถโหลดข้อมูลใบสั่งซื้อได้", "error");
    } else {
      const mapped: PurchaseOrderRow[] = (data ?? []).map(
        (item: Record<string, unknown>) => {
          const supplier = item.supplier as { name: string; code: string } | null;
          return {
            id: item.id as string,
            po_number: item.po_number as string,
            supplier_name: supplier?.name ?? "",
            supplier_code: supplier?.code ?? "",
            status: item.status as PoStatus,
            total_amount: item.total_amount as number | null,
            order_date: item.order_date as string,
            expected_date: item.expected_date as string | null,
          };
        }
      );
      setPurchaseOrders(mapped);
    }
    setLoading(false);
  }, [supabase, addToast]);

  useEffect(() => {
    void (async () => {
      await Promise.all([
        fetchCurrentUser(),
        fetchProducts(),
        fetchSuppliers(),
        fetchPurchaseOrders(),
      ]);
    })();
  }, [fetchCurrentUser, fetchProducts, fetchSuppliers, fetchPurchaseOrders]);

  const filtered = purchaseOrders.filter((po) => {
    if (activeTab !== "all" && po.status !== activeTab) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      po.po_number.toLowerCase().includes(q) ||
      po.supplier_name.toLowerCase().includes(q) ||
      po.supplier_code.toLowerCase().includes(q)
    );
  });

  const openCreateModal = () => {
    setEditingId(null);
    setForm({
      supplier_id: "",
      order_date: new Date().toISOString().slice(0, 10),
      expected_date: "",
      notes: "",
    });
    setItems([]);
    setFormError(null);
    setCreateModalOpen(true);
  };

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormError(null);
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { tempId: ++itemTempId, product_id: "", quantity: "", unit_price: "" },
    ]);
  };

  const removeItem = (tempId: number) => {
    setItems((prev) => prev.filter((i) => i.tempId !== tempId));
  };

  const handleItemChange = (tempId: number, field: keyof POItemForm, value: string) => {
    setItems((prev) =>
      prev.map((i) => (i.tempId === tempId ? { ...i, [field]: value } : i))
    );
  };

  const getItemProduct = (productId: string) =>
    products.find((p) => p.id === productId);

  const calcItemSubtotal = (item: POItemForm) => {
    const qty = Number(item.quantity);
    const price = Number(item.unit_price);
    if (!qty || !price) return 0;
    return qty * price;
  };

  const calcTotal = () =>
    items.reduce((sum, item) => sum + calcItemSubtotal(item), 0);

  const validateForm = (): boolean => {
    if (!form.supplier_id) {
      setFormError("กรุณาเลือกซัพพลายเออร์");
      return false;
    }
    if (items.length === 0) {
      setFormError("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ");
      return false;
    }
    for (const item of items) {
      if (!item.product_id) {
        setFormError("กรุณาเลือกสินค้าทุกรายการ");
        return false;
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        setFormError("กรุณากรอกจำนวนที่มากกว่า 0 ทุกรายการ");
        return false;
      }
      if (item.unit_price === "" || Number(item.unit_price) < 0) {
        setFormError("กรุณากรอกราคาต่อหน่วยทุกรายการ");
        return false;
      }
    }
    return true;
  };

  const handleCreateSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    setFormError(null);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setFormError("ไม่สามารถระบุผู้ใช้ได้");
      setSaving(false);
      return;
    }

    const poNumber = generatePoNumber();
    const totalAmount = calcTotal();

    const poPayload = {
      po_number: poNumber,
      supplier_id: form.supplier_id,
      status: "draft" as PoStatus,
      order_date: form.order_date,
      expected_date: form.expected_date || null,
      notes: form.notes.trim() || null,
      total_amount: totalAmount,
      created_by: user.id,
    };

    if (editingId) {
      const { error: poError } = await supabase
        .from("purchase_orders")
        .update(poPayload)
        .eq("id", editingId);

      if (poError) {
        setFormError(poError.message);
        addToast("แก้ไขใบสั่งซื้อไม่สำเร็จ", "error");
        setSaving(false);
        return;
      }

      await supabase.from("purchase_order_items").delete().eq("po_id", editingId);

      const itemsPayload = items.map((item) => ({
        po_id: editingId,
        product_id: item.product_id,
        quantity_ordered: Number(item.quantity),
        quantity_received: 0,
        unit_price: Number(item.unit_price),
      }));

      const { error: itemsError } = await supabase
        .from("purchase_order_items")
        .insert(itemsPayload);

      if (itemsError) {
        setFormError("ไม่สามารถบันทึกรายการสินค้าได้");
        addToast("แก้ไขใบสั่งซื้อไม่สำเร็จ", "error");
        setSaving(false);
        return;
      }

      addToast("แก้ไขใบสั่งซื้อสำเร็จ", "success");
    } else {
      const { data: newPo, error: poError } = await supabase
        .from("purchase_orders")
        .insert(poPayload)
        .select("id")
        .single();

      if (poError || !newPo) {
        setFormError(poError?.message ?? "ไม่สามารถสร้างใบสั่งซื้อได้");
        addToast("สร้างใบสั่งซื้อไม่สำเร็จ", "error");
        setSaving(false);
        return;
      }

      const itemsPayload = items.map((item) => ({
        po_id: newPo.id,
        product_id: item.product_id,
        quantity_ordered: Number(item.quantity),
        quantity_received: 0,
        unit_price: Number(item.unit_price),
      }));

      const { error: itemsError } = await supabase
        .from("purchase_order_items")
        .insert(itemsPayload);

      if (itemsError) {
        await supabase.from("purchase_orders").delete().eq("id", newPo.id);
        setFormError("ไม่สามารถบันทึกรายการสินค้าได้");
        addToast("สร้างใบสั่งซื้อไม่สำเร็จ", "error");
        setSaving(false);
        return;
      }

      addToast("สร้างใบสั่งซื้อสำเร็จ", "success");
    }

    setSaving(false);
    setCreateModalOpen(false);
    fetchPurchaseOrders();
  };

  const openViewModal = async (id: string) => {
    const { data: po, error: poError } = await supabase
      .from("purchase_orders")
      .select(`*, supplier:suppliers(name, code)`)
      .eq("id", id)
      .single();

    if (poError || !po) {
      addToast("ไม่สามารถโหลดข้อมูลใบสั่งซื้อได้", "error");
      return;
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from("purchase_order_items")
      .select(`*, product:products(id, sku, name, tracking_mode)`)
      .eq("po_id", id);

    if (itemsError) {
      addToast("ไม่สามารถโหลดรายการสินค้าได้", "error");
      return;
    }

    const { data: creator } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", po.created_by)
      .maybeSingle();

    const supplier = po.supplier as { name: string; code: string } | null;
    const mappedItems: POViewItem[] = (itemsData ?? []).map(
      (item: Record<string, unknown>) => {
        const product = item.product as {
          id: string;
          sku: string;
          name: string;
          tracking_mode: "per_unit" | "per_lot";
        } | null;
        return {
          id: item.id as string,
          product_id: item.product_id as string,
          product_name: product?.name ?? "ไม่พบสินค้า",
          product_sku: product?.sku ?? "",
          quantity_ordered: item.quantity_ordered as number,
          quantity_received: item.quantity_received as number,
          unit_price: item.unit_price as number,
          tracking_mode: product?.tracking_mode ?? "per_unit",
        };
      }
    );

    setViewData({
      po: po as PurchaseOrder,
      supplier_name: supplier?.name ?? "ไม่พบ",
      supplier_code: supplier?.code ?? "",
      items: mappedItems,
      createdByName: creator?.display_name ?? null,
    });
    setViewModalOpen(true);
  };

  const openEditFromView = () => {
    if (!viewData) return;
    setViewModalOpen(false);
    setEditingId(viewData.po.id);
    setForm({
      supplier_id: viewData.po.supplier_id,
      order_date: viewData.po.order_date.slice(0, 10),
      expected_date: viewData.po.expected_date?.slice(0, 10) ?? "",
      notes: viewData.po.notes ?? "",
    });
    setItems(
      viewData.items.map((item) => ({
        tempId: ++itemTempId,
        product_id: item.product_id,
        quantity: String(item.quantity_ordered),
        unit_price: String(item.unit_price),
      }))
    );
    setFormError(null);
    setCreateModalOpen(true);
  };

  const handleStatusUpdate = async (
    poId: string,
    newStatus: PoStatus,
    extra: Record<string, unknown> = {}
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      addToast("ไม่สามารถระบุผู้ใช้ได้", "error");
      return;
    }

    const { error } = await supabase
      .from("purchase_orders")
      .update({ status: newStatus, ...extra })
      .eq("id", poId);

    if (error) {
      addToast("อัปเดตสถานะไม่สำเร็จ", "error");
      return;
    }

    addToast("อัปเดตสถานะสำเร็จ", "success");
    setViewModalOpen(false);
    fetchPurchaseOrders();
  };

  const handleSubmitForApproval = async () => {
    if (!viewData) return;
    setViewActionLoading(true);
    await handleStatusUpdate(viewData.po.id, "pending_approval");
    setViewActionLoading(false);
  };

  const handleApprove = async () => {
    if (!viewData || !currentUserId) return;
    setViewActionLoading(true);
    await handleStatusUpdate(viewData.po.id, "approved", {
      approved_by: currentUserId,
      approved_at: new Date().toISOString(),
    });
    setViewActionLoading(false);
  };

  const handleReject = async () => {
    if (!viewData) return;
    setViewActionLoading(true);
    await handleStatusUpdate(viewData.po.id, "cancelled");
    setViewActionLoading(false);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    await handleStatusUpdate(deleteConfirm, "cancelled");
    setDeleting(false);
    setDeleteConfirm(null);
  };

  const handleReceive = async () => {
    if (!viewData) return;
    setViewActionLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        addToast("ไม่สามารถระบุผู้ใช้ได้", "error");
        return;
      }

      const poId = viewData.po.id;

      for (const item of viewData.items) {
        let lotId: string | null = null;

        if (item.tracking_mode === "per_lot") {
          const lotNumber = `PO-${poId.slice(-6)}-${item.product_sku || item.product_id.slice(-4)}`;

          const { data: existingLot } = await supabase
            .from("lots")
            .select("id, quantity")
            .eq("product_id", item.product_id)
            .eq("lot_number", lotNumber)
            .single();

          if (existingLot) {
            await supabase
              .from("lots")
              .update({ quantity: existingLot.quantity + item.quantity_ordered })
              .eq("id", existingLot.id);
            lotId = existingLot.id;
          } else {
            const { data: newLot, error: lotError } = await supabase
              .from("lots")
              .insert({
                product_id: item.product_id,
                lot_number: lotNumber,
                quantity: item.quantity_ordered,
                created_by: user.id,
              })
              .select("id")
              .single();

            if (lotError || !newLot) {
              addToast(`ไม่สามารถสร้างล็อตสำหรับ ${item.product_name}`, "error");
              continue;
            }
            lotId = newLot.id;
          }
        }

        const { error: movError } = await supabase
          .from("stock_movements")
          .insert({
            product_id: item.product_id,
            lot_id: lotId,
            movement_type: "stock_in",
            quantity_change: item.quantity_ordered,
            reference_type: "purchase_order",
            reference_id: poId,
            performed_by: user.id,
          });

        if (movError) {
          addToast(`ไม่สามารถบันทึกการเคลื่อนไหวสำหรับ ${item.product_name}`, "error");
        }

        await supabase
          .from("purchase_order_items")
          .update({ quantity_received: item.quantity_ordered })
          .eq("id", item.id);
      }

      const { error: updateError } = await supabase
        .from("purchase_orders")
        .update({
          status: "received",
          received_by: user.id,
          received_at: new Date().toISOString(),
        })
        .eq("id", poId);

      if (updateError) {
        addToast("อัปเดตสถานะ PO ไม่สำเร็จ", "error");
        return;
      }

      addToast("รับสินค้าเรียบร้อย", "success");
      setViewModalOpen(false);
      fetchPurchaseOrders();
    } catch {
      addToast("เกิดข้อผิดพลาดในการรับสินค้า", "error");
    } finally {
      setViewActionLoading(false);
    }
  };

  const columns: Column<PurchaseOrderRow>[] = [
    {
      key: "po_number",
      label: "เลขที่ PO",
      sortable: true,
      className: "font-mono text-xs",
    },
    {
      key: "supplier_name",
      label: "ซัพพลายเออร์",
      sortable: true,
      render: (row) => (
        <div className="flex flex-col">
          <span>{row.supplier_name}</span>
          <span className="text-xs text-gray-400">{row.supplier_code}</span>
        </div>
      ),
    },
    {
      key: "status",
      label: "สถานะ",
      render: (row) => (
        <Badge variant={statusBadgeVariant[row.status]}>
          {statusLabels[row.status]}
        </Badge>
      ),
    },
    {
      key: "total_amount",
      label: "ยอดรวม",
      sortable: true,
      className: "text-right",
      render: (row) =>
        row.total_amount != null ? formatCurrency(row.total_amount) : "-",
    },
    {
      key: "order_date",
      label: "วันที่สั่งซื้อ",
      sortable: true,
      render: (row) => formatDate(row.order_date),
    },
    {
      key: "expected_date",
      label: "วันที่คาดว่าจะได้รับ",
      sortable: true,
      render: (row) => (row.expected_date ? formatDate(row.expected_date) : "-"),
    },
    {
      key: "actions",
      label: "",
      className: "w-20 text-right",
      render: (row) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            openViewModal(row.id);
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ใบสั่งซื้อ</h1>
          <p className="text-sm text-gray-500">จัดการใบสั่งซื้อสินค้า (PO)</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4" />
          สร้างใบสั่งซื้อ
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="ค้นหาด้วยเลขที่ PO หรือซัพพลายเออร์..."
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
              <FileText className="h-12 w-12 text-gray-300" />
              <p className="text-sm text-gray-400">
                {search
                  ? "ไม่พบใบสั่งซื้อที่ค้นหา"
                  : "ยังไม่มีใบสั่งซื้อ — กด \"สร้างใบสั่งซื้อ\" เพื่อเริ่มต้น"}
              </p>
              {!search && (
                <Button variant="outline" size="sm" onClick={openCreateModal}>
                  <Plus className="h-4 w-4" />
                  สร้างใบสั่งซื้อ
                </Button>
              )}
            </div>
          ) : (
            <DataTable<PurchaseOrderRow>
              columns={columns}
              data={filtered}
              keyField="id"
              onRowClick={(row) => openViewModal(row.id)}
            />
          )}
        </CardContent>
      </Card>

      {/* Create / Edit PO Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => !saving && setCreateModalOpen(false)}
        title={editingId ? "แก้ไขใบสั่งซื้อ" : "สร้างใบสั่งซื้อ"}
        className="max-w-2xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateSave();
          }}
          className="flex flex-col gap-4"
        >
          {/* Supplier */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="supplier_id" className="text-sm font-medium text-gray-700">
              ซัพพลายเออร์ *
            </label>
            <select
              id="supplier_id"
              name="supplier_id"
              value={form.supplier_id}
              onChange={handleFormChange}
              disabled={saving}
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">-- เลือกซัพพลายเออร์ --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
            {(() => {
              const sel = suppliers.find((s) => s.id === form.supplier_id);
              if (!sel) return null;
              return (
                <p className="text-xs text-gray-400">
                  ผู้ติดต่อ: {sel.contact_person ?? "-"} | โทร: {sel.phone ?? "-"}
                </p>
              );
            })()}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="วันที่สั่งซื้อ *"
              id="order_date"
              name="order_date"
              type="date"
              value={form.order_date}
              onChange={handleFormChange}
              disabled={saving}
            />
            <Input
              label="วันที่คาดว่าจะได้รับ"
              id="expected_date"
              name="expected_date"
              type="date"
              value={form.expected_date}
              onChange={handleFormChange}
              disabled={saving}
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="notes" className="text-sm font-medium text-gray-700">
              หมายเหตุ
            </label>
            <textarea
              id="notes"
              name="notes"
              value={form.notes}
              onChange={handleFormChange}
              rows={2}
              placeholder="ระบุหมายเหตุ (ถ้ามี)"
              disabled={saving}
              className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* PO Items */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                รายการสินค้า *
              </label>
              <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={saving}>
                <Plus className="h-3 w-3" />
                เพิ่มรายการ
              </Button>
            </div>

            {items.length === 0 && (
              <p className="text-sm text-gray-400 py-2 text-center">
                ยังไม่มีรายการสินค้า — คลิก “เพิ่มรายการ” เพื่อเพิ่มสินค้า
              </p>
            )}

            {items.map((item) => {
              const product = getItemProduct(item.product_id);
              const subtotal = calcItemSubtotal(item);
              return (
                <div
                  key={item.tempId}
                  className="grid grid-cols-12 gap-2 items-start rounded-lg border border-gray-200 bg-gray-50 p-3"
                >
                  <div className="col-span-5 flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-500">สินค้า</label>
                    <select
                      value={item.product_id}
                      onChange={(e) => handleItemChange(item.tempId, "product_id", e.target.value)}
                      disabled={saving}
                      className="flex h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">-- เลือกสินค้า --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </select>
                    {product && (
                      <p className="text-xs text-gray-400">
                        {product.unit} |{" "}
                        {product.tracking_mode === "per_lot" ? "ต่อล็อต" : "ต่อหน่วย"}
                      </p>
                    )}
                  </div>

                  <div className="col-span-2 flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-500">จำนวน</label>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => handleItemChange(item.tempId, "quantity", e.target.value)}
                      disabled={saving}
                      placeholder="0"
                      className="flex h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>

                  <div className="col-span-2 flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-500">ราคาต่อหน่วย</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(item.tempId, "unit_price", e.target.value)}
                      disabled={saving}
                      placeholder="0.00"
                      className="flex h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>

                  <div className="col-span-2 flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-500">ราคารวม</label>
                    <div className="flex h-9 items-center text-sm font-medium text-gray-700">
                      {subtotal > 0 ? formatCurrency(subtotal) : "-"}
                    </div>
                  </div>

                  <div className="col-span-1 flex items-end justify-center pt-5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.tempId)}
                      disabled={saving}
                      className="h-9 w-9 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {items.length > 0 && (
              <div className="flex justify-end rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="text-right">
                  <span className="text-sm text-gray-500">รวมทั้งสิ้น: </span>
                  <span className="text-lg font-bold text-gray-900">
                    {formatCurrency(calcTotal())}
                  </span>
                </div>
              </div>
            )}
          </div>

          {formError && <p className="text-sm text-red-500">{formError}</p>}

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreateModalOpen(false)}
              disabled={saving}
            >
              ยกเลิก
            </Button>
            <Button type="submit" loading={saving}>
              {editingId ? "บันทึกการเปลี่ยนแปลง" : "สร้างใบสั่งซื้อ"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View PO Modal */}
      <Modal
        open={viewModalOpen}
        onClose={() => !viewActionLoading && setViewModalOpen(false)}
        title={viewData ? `ใบสั่งซื้อ #${viewData.po.po_number}` : "รายละเอียดใบสั่งซื้อ"}
        className="max-w-3xl"
      >
        {viewData && (
          <div className="flex flex-col gap-4">
            {/* PO Header Info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">ซัพพลายเออร์: </span>
                <span className="font-medium">
                  {viewData.supplier_name} ({viewData.supplier_code})
                </span>
              </div>
              <div>
                <span className="text-gray-500">สถานะ: </span>
                <Badge variant={statusBadgeVariant[viewData.po.status]}>
                  {statusLabels[viewData.po.status]}
                </Badge>
              </div>
              <div>
                <span className="text-gray-500">วันที่สั่งซื้อ: </span>
                <span>{formatDate(viewData.po.order_date)}</span>
              </div>
              <div>
                <span className="text-gray-500">วันที่คาดว่าจะได้รับ: </span>
                <span>
                  {viewData.po.expected_date ? formatDate(viewData.po.expected_date) : "-"}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">หมายเหตุ: </span>
                <span>{viewData.po.notes ?? "-"}</span>
              </div>
              <div>
                <span className="text-gray-500">ยอดรวม: </span>
                <span className="text-lg font-bold">
                  {viewData.po.total_amount != null
                    ? formatCurrency(viewData.po.total_amount)
                    : "-"}
                </span>
              </div>
              {viewData.po.approved_by && (
                <div>
                  <span className="text-gray-500">อนุมัติโดย: </span>
                  <span>{viewData.po.approved_by}</span>
                  {viewData.po.approved_at && (
                    <span className="text-gray-400 text-xs ml-1">
                      ({formatDate(viewData.po.approved_at)})
                    </span>
                  )}
                </div>
              )}
              {viewData.po.received_by && (
                <div>
                  <span className="text-gray-500">รับโดย: </span>
                  <span>{viewData.po.received_by}</span>
                  {viewData.po.received_at && (
                    <span className="text-gray-400 text-xs ml-1">
                      ({formatDate(viewData.po.received_at)})
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Document Export */}
            <div className="no-print flex items-center gap-2 border-t pt-3">
              <span className="text-xs text-gray-500">ส่งออกเอกสาร:</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const w = window.open("", "_blank");
                  if (!w) return;
                  const itemsHtml = viewData.items.map((item, idx) => `
                    <tr>
                      <td style="border:1px solid #ddd;padding:6px 10px">${idx + 1}</td>
                      <td style="border:1px solid #ddd;padding:6px 10px">${item.product_sku}</td>
                      <td style="border:1px solid #ddd;padding:6px 10px">${item.product_name}</td>
                      <td style="border:1px solid #ddd;padding:6px 10px;text-align:right">${item.quantity_ordered.toLocaleString()}</td>
                      <td style="border:1px solid #ddd;padding:6px 10px">${(viewData.items.find(i => i.id === item.id)?.tracking_mode === "per_lot" ? "ล็อต" : "ชิ้น")}</td>
                      <td style="border:1px solid #ddd;padding:6px 10px;text-align:right">${item.unit_price.toLocaleString()}</td>
                      <td style="border:1px solid #ddd;padding:6px 10px;text-align:right">${(item.quantity_ordered * item.unit_price).toLocaleString()}</td>
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
                      th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 11px; color: #1e293b; text-align: center; }
                      td { border: 1px solid #e2e8f0; padding: 6px 10px; }
                      .total { text-align: right; font-size: 14px; font-weight: 700; color: #1e3a5f; margin-top: 12px; }
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
                          <div>ใบสั่งซื้อ</div>
                          <div style="font-size:12px;color:#475569;margin-top:4px">เลขที่: ${viewData.po.po_number}</div>
                          <div style="font-size:12px;color:#475569">วันที่: ${new Date(viewData.po.order_date).toLocaleDateString("th-TH")}</div>
                        </div>
                      </div>
                      <div style="font-size:12px;margin-bottom:12px">
                        <b>ซัพพลายเออร์:</b> ${viewData.supplier_name} (${viewData.supplier_code})<br>
                        ${viewData.po.expected_date ? `<b>วันที่คาดว่าได้รับ:</b> ${new Date(viewData.po.expected_date).toLocaleDateString("th-TH")}` : ""}
                        ${viewData.createdByName ? `<br><b>ผู้สร้าง:</b> ${viewData.createdByName}` : ""}
                      </div>
                      <table>
                        <tr><th>ลำดับ</th><th>รหัสสินค้า</th><th>ชื่อสินค้า</th><th>จำนวน</th><th>หน่วย</th><th>ราคาต่อหน่วย</th><th>รวม</th></tr>
                        ${itemsHtml}
                      </table>
                      <div class="total">รวมทั้งสิ้น: ${(viewData.po.total_amount ?? 0).toLocaleString()} บาท</div>
                      ${viewData.po.notes ? `<div style="margin-top:12px;font-size:11px;color:#666"><b>หมายเหตุ:</b> ${viewData.po.notes}</div>` : ""}
                      <div class="footer">
                        <div class="sig"><div class="line"></div><div class="label">ผู้ขอซื้อ</div></div>
                        <div class="sig"><div class="line"></div><div class="label">ผู้อนุมัติ</div></div>
                        <div class="sig"><div class="line"></div><div class="label">ผู้รับสินค้า</div></div>
                      </div>
                      <div class="print-foot">เอกสารนี้สร้างจากระบบ ARGO Stock Management</div>
                      <script>window.onload = function() { window.print(); }</script>
                    </body></html>
                  `);
                  w.document.close();
                }}
              >
                <Printer className="h-4 w-4" />
                พิมพ์ / PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const rows = viewData.items.map((item, idx) => ({
                    "ลำดับ": idx + 1,
                    "รหัสสินค้า": item.product_sku,
                    "ชื่อสินค้า": item.product_name,
                    "จำนวน": item.quantity_ordered,
                    "หน่วย": item.tracking_mode === "per_lot" ? "ล็อต" : "ชิ้น",
                    "ราคาต่อหน่วย": item.unit_price,
                    "รวม": item.quantity_ordered * item.unit_price,
                  }));
                  import("@/lib/documents/excel").then(({ exportToExcel }) => {
                    exportToExcel(rows, [
                      { header: "ลำดับ", key: "ลำดับ", width: 8 },
                      { header: "รหัสสินค้า", key: "รหัสสินค้า", width: 15 },
                      { header: "ชื่อสินค้า", key: "ชื่อสินค้า", width: 30 },
                      { header: "จำนวน", key: "จำนวน", width: 10 },
                      { header: "หน่วย", key: "หน่วย", width: 8 },
                      { header: "ราคาต่อหน่วย", key: "ราคาต่อหน่วย", width: 15 },
                      { header: "รวม", key: "รวม", width: 15 },
                    ], `PO-${viewData.po.po_number}`);
                  });
                }}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Button>
            </div>

            {/* Items Table */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">รายการสินค้า</h4>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                        ลำดับ
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                        สินค้า
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">
                        จำนวน
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">
                        ราคาต่อหน่วย
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">
                        ราคารวม
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-medium uppercase text-gray-500">
                        รับแล้ว
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {viewData.items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-400">
                          ไม่มีรายการสินค้า
                        </td>
                      </tr>
                    ) : (
                      viewData.items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm text-gray-500">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col">
                              <span className="text-sm text-gray-900">{item.product_name}</span>
                              <span className="text-xs text-gray-400">{item.product_sku}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right text-sm text-gray-700">
                            {item.quantity_ordered.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right text-sm text-gray-700">
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">
                            {formatCurrency(item.quantity_ordered * item.unit_price)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {item.quantity_received > 0 ? (
                              <Badge variant="success">
                                {item.quantity_received.toLocaleString()}
                              </Badge>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              {viewData.po.status === "draft" && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setViewModalOpen(false);
                      setDeleteConfirm(viewData.po.id);
                    }}
                    disabled={viewActionLoading}
                  >
                    <Trash2 className="h-4 w-4" />
                    ลบ
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={openEditFromView}
                    disabled={viewActionLoading}
                  >
                    <Pencil className="h-4 w-4" />
                    แก้ไข
                  </Button>
                  <Button onClick={handleSubmitForApproval} loading={viewActionLoading}>
                    <Send className="h-4 w-4" />
                    ส่งขออนุมัติ
                  </Button>
                </>
              )}

              {viewData.po.status === "pending_approval" &&
                (currentUserRole === "warehouse_head" || currentUserRole === "admin") && (
                  <>
                    <Button variant="secondary" onClick={handleReject} loading={viewActionLoading}>
                      <Ban className="h-4 w-4" />
                      ปฏิเสธ
                    </Button>
                    <Button onClick={handleApprove} loading={viewActionLoading}>
                      <Check className="h-4 w-4" />
                      อนุมัติ
                    </Button>
                  </>
                )}

              {viewData.po.status === "pending_approval" &&
                currentUserRole !== "warehouse_head" &&
                currentUserRole !== "admin" && (
                  <p className="text-sm text-yellow-600 font-medium">
                    <Send className="h-4 w-4 inline mr-1" />
                    รอการอนุมัติจากหัวหน้าคลัง
                  </p>
                )}

              {viewData.po.status === "approved" && (
                <Button onClick={handleReceive} loading={viewActionLoading}>
                  <ArrowDownToLine className="h-4 w-4" />
                  รับสินค้า
                </Button>
              )}

              {viewData.po.status === "received" && (
                <p className="text-sm text-green-600 font-medium">
                  <CheckCircle className="h-4 w-4 inline mr-1" />
                  รับสินค้าเรียบร้อยแล้ว
                </p>
              )}

              {viewData.po.status === "cancelled" && (
                <p className="text-sm text-red-500 font-medium">
                  <XCircle className="h-4 w-4 inline mr-1" />
                  ใบสั่งซื้อถูกยกเลิก
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteConfirm !== null}
        onClose={() => !deleting && setDeleteConfirm(null)}
        title="ยืนยันการลบ"
      >
        <p className="text-sm text-gray-600 mb-4">
          คุณแน่ใจหรือไม่ว่าต้องการยกเลิกใบสั่งซื้อนี้? การดำเนินการนี้จะเปลี่ยนสถานะเป็นยกเลิก
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)} disabled={deleting}>
            ยกเลิก
          </Button>
          <Button variant="danger" onClick={handleDeleteConfirm} loading={deleting}>
            ยืนยันการยกเลิก
          </Button>
        </div>
      </Modal>
    </div>
  );
}
