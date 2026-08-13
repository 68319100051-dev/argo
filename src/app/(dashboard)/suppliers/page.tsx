"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { createClient } from "@/lib/supabase/client";
import type { Supplier } from "@/lib/supabase/types";
import { cn } from "@/lib/utils/cn";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Building2,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";

function generateSupplierCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SUP-${timestamp}${random}`;
}

type FormData = {
  code: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
};

const emptyForm: FormData = {
  code: "",
  name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
};

type ToastType = "success" | "error";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let toastId = 0;

export default function SuppliersPage() {
  const supabase = createClient();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      addToast("ไม่สามารถโหลดข้อมูลซัพพลายเออร์ได้", "error");
    } else {
      setSuppliers(data ?? []);
    }
    setLoading(false);
  }, [supabase, addToast]);

  useEffect(() => {
    void (async () => {
      await fetchSuppliers();
    })();
  }, [fetchSuppliers]);

  const openAddModal = () => {
    setEditingId(null);
    setForm({ ...emptyForm, code: generateSupplierCode() });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setForm({
      code: supplier.code,
      name: supplier.name,
      contact_person: supplier.contact_person ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError("กรุณากรอกชื่อซัพพลายเออร์");
      return;
    }
    if (!form.code.trim()) {
      setFormError("กรุณากรอกรหัสซัพพลายเออร์");
      return;
    }

    setSaving(true);
    setFormError(null);

    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      contact_person: form.contact_person.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("suppliers")
        .update(payload)
        .eq("id", editingId);

      if (error) {
        setFormError(error.message);
        addToast("แก้ไขซัพพลายเออร์ไม่สำเร็จ", "error");
      } else {
        addToast("แก้ไขซัพพลายเออร์สำเร็จ", "success");
        setModalOpen(false);
        fetchSuppliers();
      }
    } else {
      const { error } = await supabase.from("suppliers").insert(payload);

      if (error) {
        setFormError(error.message);
        addToast("เพิ่มซัพพลายเออร์ไม่สำเร็จ", "error");
      } else {
        addToast("เพิ่มซัพพลายเออร์สำเร็จ", "success");
        setModalOpen(false);
        fetchSuppliers();
      }
    }

    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);

    const { error } = await supabase
      .from("suppliers")
      .update({ is_active: false })
      .eq("id", deleteConfirm);

    if (error) {
      addToast("ลบซัพพลายเออร์ไม่สำเร็จ", "error");
    } else {
      addToast("ลบซัพพลายเออร์สำเร็จ", "success");
      setSuppliers((prev) => prev.filter((p) => p.id !== deleteConfirm));
    }

    setDeleting(false);
    setDeleteConfirm(null);
  };

  const filtered = suppliers.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q)
    );
  });

  const columns: Column<Supplier>[] = [
    {
      key: "code",
      label: "รหัส",
      sortable: true,
      className: "font-mono text-xs",
    },
    {
      key: "name",
      label: "ชื่อซัพพลายเออร์",
      sortable: true,
    },
    {
      key: "contact_person",
      label: "ผู้ติดต่อ",
      render: (row) => row.contact_person ?? "-",
    },
    {
      key: "phone",
      label: "โทรศัพท์",
      render: (row) => row.phone ?? "-",
    },
    {
      key: "email",
      label: "อีเมล",
      render: (row) => row.email ?? "-",
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
      className: "w-24 text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
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

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ซัพพลายเออร์</h1>
          <p className="text-sm text-gray-500">จัดการข้อมูลซัพพลายเออร์ทั้งหมด</p>
        </div>
        <Button onClick={openAddModal}>
          <Plus className="h-4 w-4" />
          เพิ่มซัพพลายเออร์
        </Button>
      </div>

      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="ค้นหาด้วยชื่อหรือรหัส..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <Building2 className="h-12 w-12 text-gray-300" />
              <p className="text-sm text-gray-400">
                {search
                  ? "ไม่พบซัพพลายเออร์ที่ค้นหา"
                  : "ยังไม่มีซัพพลายเออร์ — กด \"เพิ่มซัพพลายเออร์\" เพื่อเริ่มต้น"}
              </p>
              {!search && (
                <Button variant="outline" size="sm" onClick={openAddModal}>
                  <Plus className="h-4 w-4" />
                  เพิ่มซัพพลายเออร์
                </Button>
              )}
            </div>
          ) : (
            <DataTable<Supplier>
              columns={columns}
              data={filtered}
              keyField="id"
              onRowClick={openEditModal}
            />
          )}
        </CardContent>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingId ? "แก้ไขซัพพลายเออร์" : "เพิ่มซัพพลายเออร์"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="flex flex-col gap-4"
        >
          <Input
            label="รหัสซัพพลายเออร์"
            id="code"
            name="code"
            value={form.code}
            onChange={handleChange}
            placeholder="SUP-XXXX"
            disabled={saving}
          />

          <Input
            label="ชื่อซัพพลายเออร์ *"
            id="name"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="ระบุชื่อซัพพลายเออร์"
            disabled={saving}
          />

          <Input
            label="ผู้ติดต่อ"
            id="contact_person"
            name="contact_person"
            value={form.contact_person}
            onChange={handleChange}
            placeholder="ชื่อผู้ติดต่อ (ถ้ามี)"
            disabled={saving}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="โทรศัพท์"
              id="phone"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="เบอร์โทรศัพท์"
              disabled={saving}
            />

            <Input
              label="อีเมล"
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="อีเมล (ถ้ามี)"
              disabled={saving}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="address" className="text-sm font-medium text-gray-700">
              ที่อยู่
            </label>
            <textarea
              id="address"
              name="address"
              value={form.address}
              onChange={handleChange}
              rows={3}
              placeholder="ที่อยู่ซัพพลายเออร์ (ถ้ามี)"
              disabled={saving}
              className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
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
              {editingId ? "บันทึกการเปลี่ยนแปลง" : "เพิ่มซัพพลายเออร์"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={deleteConfirm !== null}
        onClose={() => !deleting && setDeleteConfirm(null)}
        title="ยืนยันการลบ"
      >
        <p className="text-sm text-gray-600 mb-4">
          คุณแน่ใจหรือไม่ว่าต้องการลบซัพพลายเออร์นี้? การดำเนินการนี้จะเปลี่ยนสถานะเป็นไม่ใช้งาน
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
    </div>
  );
}
