"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import type { Role, User } from "@/lib/supabase/types";
import { formatDate } from "@/lib/utils/formats";
import { cn } from "@/lib/utils/cn";
import {
  Search,
  Users,
  CheckCircle,
  XCircle,
  Loader2,
  ShieldAlert,
  UserPlus,
  Copy,
  Check,
  KeyRound,
} from "lucide-react";

interface UserRow extends User {
  roles: { name: Role["name"] };
}

const ROLE_LABEL: Record<Role["name"], string> = {
  warehouse_staff: "พนักงานคลัง",
  warehouse_head: "หัวหน้าคลัง",
  admin: "ผู้ดูแลระบบ",
};

const ROLE_VARIANT: Record<Role["name"], "default" | "primary" | "success"> = {
  warehouse_staff: "default",
  warehouse_head: "primary",
  admin: "success",
};

export default function AdminUsersPage() {
  const supabase = createClient();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", display_name: "", role: "warehouse_staff" });
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: authData }, usersRes, rolesRes] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("users").select("*, roles!inner(name)").order("created_at", { ascending: false }),
      supabase.from("roles").select("*").order("name"),
    ]);
    if (usersRes.error || rolesRes.error) {
      showToast("โหลดข้อมูลผู้ใช้ไม่สำเร็จ", "error");
    } else {
      setUsers(usersRes.data as unknown as UserRow[]);
      setRoles(rolesRes.data ?? []);
    }
    setCurrentUserId(authData.user?.id ?? null);
    setLoading(false);
  }, [supabase, showToast]);

  useEffect(() => {
    void (async () => {
      await fetchData();
    })();
  }, [fetchData]);

  const handleRoleChange = async (userId: string, roleId: string) => {
    if (userId === currentUserId) {
      showToast("ไม่สามารถเปลี่ยนสิทธิ์ของตัวเองได้", "error");
      return;
    }
    setSavingId(userId);
    const { error } = await supabase.from("users").update({ role_id: roleId }).eq("id", userId);
    setSavingId(null);
    if (error) {
      showToast("เปลี่ยนสิทธิ์ไม่สำเร็จ: " + error.message, "error");
    } else {
      showToast("เปลี่ยนสิทธิ์สำเร็จ", "success");
      fetchData();
    }
  };

  const handleToggleActive = async (userId: string, active: boolean) => {
    if (userId === currentUserId) {
      showToast("ไม่สามารถปิดใช้งานบัญชีตัวเองได้", "error");
      return;
    }
    setSavingId(userId);
    const { error } = await supabase.from("users").update({ is_active: active }).eq("id", userId);
    setSavingId(null);
    if (error) {
      showToast("อัปเดตสถานะไม่สำเร็จ: " + error.message, "error");
    } else {
      showToast(active ? "เปิดใช้งานผู้ใช้แล้ว" : "ปิดใช้งานผู้ใช้แล้ว", "success");
      fetchData();
    }
  };

  const openInvite = () => {
    setInviteForm({ email: "", display_name: "", role: "warehouse_staff" });
    setInviteError("");
    setInviteResult(null);
    setInviteOpen(true);
  };

  const handleInvite = async () => {
    setInviteError("");
    if (!inviteForm.display_name.trim() || !inviteForm.email.trim()) {
      setInviteError("กรุณากรอกชื่อและอีเมลให้ครบ");
      return;
    }
    setInviting(true);
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInviteError(data.error ?? "สร้างบัญชีไม่สำเร็จ");
        return;
      }
      setInviteResult({ email: inviteForm.email, password: data.tempPassword });
      setCopied(false);
      fetchData();
    } catch {
      setInviteError("เกิดข้อผิดพลาด กรุณาลองอีกครั้ง");
    } finally {
      setInviting(false);
    }
  };

  const handleCopyPassword = async () => {
    if (!inviteResult) return;
    try {
      await navigator.clipboard.writeText(inviteResult.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return u.display_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const columns: Column<UserRow>[] = [
    { key: "display_name", label: "ชื่อ", sortable: true },
    { key: "email", label: "อีเมล", sortable: true },
    {
      key: "role_id",
      label: "สิทธิ์",
      render: (row) => {
        if (row.id === currentUserId) {
          return <Badge variant={ROLE_VARIANT[row.roles.name]}>{ROLE_LABEL[row.roles.name]}</Badge>;
        }
        return (
          <select
            value={row.role_id}
            disabled={savingId === row.id}
            onChange={(e) => handleRoleChange(row.id, e.target.value)}
            className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {ROLE_LABEL[r.name]}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      key: "is_active",
      label: "สถานะ",
      render: (row) =>
        row.is_active ? (
          <Badge variant="success" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            ใช้งาน
          </Badge>
        ) : (
          <Badge variant="danger" className="gap-1">
            <XCircle className="h-3 w-3" />
            ปิดใช้งาน
          </Badge>
        ),
    },
    {
      key: "created_at",
      label: "สร้างเมื่อ",
      sortable: true,
      render: (row) => formatDate(row.created_at),
    },
    {
      key: "actions",
      label: "",
      className: "w-24 text-right",
      render: (row) =>
        row.id === currentUserId ? null : (
          <Button
            variant="ghost"
            size="sm"
            loading={savingId === row.id}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleActive(row.id, !row.is_active);
            }}
          >
            {row.is_active ? "ปิด" : "เปิด"}
          </Button>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
        {toast && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg",
              toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
            )}
          >
            {toast.type === "success" ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {toast.message}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">จัดการผู้ใช้งาน</h1>
          <p className="text-sm text-slate-500">ดูและจัดการสิทธิ์ผู้ใช้ในระบบ</p>
        </div>
        <Button onClick={openInvite}>
          <UserPlus className="h-4 w-4" />
          เพิ่มผู้ใช้
        </Button>
      </div>

      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="ค้นหาด้วยชื่อหรืออีเมล..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              <Users className="h-12 w-12 text-gray-300" />
              <p className="text-sm text-gray-400">
                {search ? "ไม่พบผู้ใช้ที่ค้นหา" : "ยังไม่มีผู้ใช้ในระบบ"}
              </p>
            </div>
          ) : (
            <DataTable<UserRow> columns={columns} data={filtered} keyField="id" />
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          การสมัครสมาชิกถูกปิดใช้งาน — ใช้ปุ่ม <b>เพิ่มผู้ใช้</b> เพื่อสร้างบัญชีให้พนักงาน ระบบจะแสดงรหัสผ่านชั่วคราวให้แจ้งพนักงาน 1 ครั้ง
        </p>
      </div>

      {/* Invite modal */}
      <Modal
        open={inviteOpen}
        onClose={() => !inviting && setInviteOpen(false)}
        title={inviteResult ? "สร้างบัญชีสำเร็จ" : "เพิ่มผู้ใช้ใหม่"}
      >
        {inviteResult ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                สร้างบัญชีให้ <b>{inviteResult.email}</b> เรียบร้อยแล้ว
                <br />
                แจ้งรหัสผ่านชั่วคราวนี้ให้ผู้ใช้ ครั้งเดียวเท่านั้น
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <KeyRound className="h-3.5 w-3.5" />
                รหัสผ่านชั่วคราว
              </p>
              <div className="flex items-center justify-between gap-2">
                <code className="break-all rounded-lg bg-white px-3 py-2 font-mono text-sm font-semibold text-slate-800 ring-1 ring-slate-200">
                  {inviteResult.password}
                </code>
                <Button size="sm" variant="outline" onClick={handleCopyPassword}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "คัดลอกแล้ว" : "คัดลอก"}
                </Button>
              </div>
            </div>
            <Button onClick={() => setInviteOpen(false)} className="w-full">
              เสร็จสิ้น
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4">
              <Input
                id="invite-name"
                label="ชื่อผู้ใช้ *"
                placeholder="เช่น สมชาย ใจดี"
                value={inviteForm.display_name}
                onChange={(e) => setInviteForm({ ...inviteForm, display_name: e.target.value })}
                disabled={inviting}
              />
              <Input
                id="invite-email"
                label="อีเมล *"
                type="email"
                placeholder="user@company.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                disabled={inviting}
              />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="invite-role" className="text-sm font-medium text-slate-700">
                  สิทธิ์
                </label>
                <select
                  id="invite-role"
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                  disabled={inviting}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.name}>
                      {ROLE_LABEL[r.name]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {inviteError && <p className="text-sm font-medium text-red-500">{inviteError}</p>}
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setInviteOpen(false)} disabled={inviting}>
                ยกเลิก
              </Button>
              <Button onClick={handleInvite} loading={inviting}>
                <UserPlus className="h-4 w-4" />
                สร้างบัญชี
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
