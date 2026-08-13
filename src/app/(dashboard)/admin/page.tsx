"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils/formats";
import { cn } from "@/lib/utils/cn";
import { Users, Shield, Activity, ChevronRight, Loader2 } from "lucide-react";

interface AuditRow {
  id: string;
  table_name: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  record_id: string;
  changed_by: string;
  created_at: string;
}

const ACTION_VARIANT: Record<AuditRow["action"], "success" | "warning" | "danger"> = {
  INSERT: "success",
  UPDATE: "warning",
  DELETE: "danger",
};

const ACTION_LABEL: Record<AuditRow["action"], string> = {
  INSERT: "เพิ่ม",
  UPDATE: "แก้ไข",
  DELETE: "ลบ",
};

export default function AdminPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [userCount, setUserCount] = useState(0);
  const [aiEnabledCount, setAiEnabledCount] = useState(0);
  const [auditCount, setAuditCount] = useState(0);
  const [recentAudits, setRecentAudits] = useState<AuditRow[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [usersRes, aiRes, auditRes, allUsersRes] = await Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("ai_settings").select("id", { count: "exact", head: true }).eq("is_enabled", true),
      supabase.from("audit_trail").select("id", { count: "exact", head: true }),
      supabase.from("users").select("id, display_name, email"),
    ]);
    const recent = await supabase
      .from("audit_trail")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    const map: Record<string, string> = {};
    for (const u of allUsersRes.data ?? []) map[u.id] = u.display_name || u.email;

    setUserMap(map);
    setUserCount(usersRes.count ?? 0);
    setAiEnabledCount(aiRes.count ?? 0);
    setAuditCount(auditRes.count ?? 0);
    setRecentAudits(recent.data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const stats = [
    {
      href: "/admin/users",
      icon: Users,
      iconBg: "bg-indigo-100 text-indigo-600",
      title: "ผู้ใช้งาน",
      desc: "จัดการบัญชีและสิทธิ์",
      value: userCount,
    },
    {
      href: "/admin/ai-settings",
      icon: Shield,
      iconBg: "bg-purple-100 text-purple-600",
      title: "ตั้งค่า AI",
      desc: "เปิด/ปิด agent, จำกัดวงเงิน",
      value: aiEnabledCount,
    },
    {
      href: "/admin/audit",
      icon: Activity,
      iconBg: "bg-gray-100 text-gray-600",
      title: "Audit Trail",
      desc: "ดูประวัติการเปลี่ยนแปลง",
      value: auditCount,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">จัดการระบบ</h1>
        <p className="text-sm text-gray-500">ตั้งค่าระบบและจัดการผู้ใช้งาน</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((s) => (
              <Link key={s.href} href={s.href} className="group">
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className={cn("rounded-lg p-3", s.iconBg)}>
                      <s.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">{s.title}</CardTitle>
                      <p className="text-sm text-gray-500">{s.desc}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-2xl font-bold text-gray-900">{s.value}</span>
                      <ChevronRight className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>กิจกรรมล่าสุด</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {recentAudits.length === 0 ? (
                <p className="px-4 pb-8 text-sm text-gray-400">ยังไม่มีกิจกรรม</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {["เวลา", "ตาราง", "การกระทำ", "Record", "ผู้ดำเนินการ"].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {recentAudits.map((a) => (
                        <tr key={a.id} className="hover:bg-gray-50">
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                            {formatDateTime(a.created_at)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <Badge>{a.table_name}</Badge>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <Badge variant={ACTION_VARIANT[a.action]}>{ACTION_LABEL[a.action]}</Badge>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-500">
                            {a.record_id.length > 12 ? a.record_id.slice(0, 12) + "…" : a.record_id}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                            {userMap[a.changed_by] ?? "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
