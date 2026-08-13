"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils/formats";
import type { AuditTrail } from "@/lib/supabase/types";
import { Button } from "@/components/ui/Button";
import { Search, ScrollText, Loader2, FileSpreadsheet } from "lucide-react";

const ACTION_LABEL: Record<AuditTrail["action"], string> = {
  INSERT: "เพิ่ม",
  UPDATE: "แก้ไข",
  DELETE: "ลบ",
};

const ACTION_VARIANT: Record<AuditTrail["action"], "success" | "warning" | "danger"> = {
  INSERT: "success",
  UPDATE: "warning",
  DELETE: "danger",
};

export default function AdminAuditPage() {
  const supabase = createClient();

  const [entries, setEntries] = useState<AuditTrail[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [selected, setSelected] = useState<AuditTrail | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [usersRes, auditsRes] = await Promise.all([
      supabase.from("users").select("id, display_name, email"),
      supabase.from("audit_trail").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    const map: Record<string, string> = {};
    for (const u of usersRes.data ?? []) map[u.id] = u.display_name || u.email;
    setUserMap(map);
    setEntries(auditsRes.data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void (async () => {
      await fetchData();
    })();
  }, [fetchData]);

  const tables = useMemo(
    () => Array.from(new Set(entries.map((e) => e.table_name))).sort(),
    [entries]
  );

  const filtered = entries.filter((e) => {
    if (tableFilter !== "all" && e.table_name !== tableFilter) return false;
    if (actionFilter !== "all" && e.action !== actionFilter) return false;
    if (search.trim() && !e.record_id.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  const columns: Column<AuditTrail>[] = [
    {
      key: "created_at",
      label: "เวลา",
      sortable: true,
      render: (row) => formatDateTime(row.created_at),
    },
    {
      key: "table_name",
      label: "ตาราง",
      render: (row) => <Badge>{row.table_name}</Badge>,
    },
    {
      key: "action",
      label: "การกระทำ",
      render: (row) => <Badge variant={ACTION_VARIANT[row.action]}>{ACTION_LABEL[row.action]}</Badge>,
    },
    {
      key: "record_id",
      label: "Record ID",
      className: "font-mono text-xs text-gray-500",
      render: (row) => (row.record_id.length > 16 ? row.record_id.slice(0, 16) + "…" : row.record_id),
    },
    {
      key: "changed_by",
      label: "ผู้ดำเนินการ",
      render: (row) => userMap[row.changed_by] ?? "ผู้ใช้ที่ถูกลบ",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
        <p className="text-sm text-gray-500">ประวัติการแก้ไขข้อมูลทั้งหมดในระบบ</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาด้วย Record ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={tableFilter}
          onChange={(e) => setTableFilter(e.target.value)}
          className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">ทุกตาราง</option>
          {tables.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">ทุกการกระทำ</option>
          <option value="INSERT">เพิ่ม</option>
          <option value="UPDATE">แก้ไข</option>
          <option value="DELETE">ลบ</option>
        </select>
        <Button
          variant="outline"
          disabled={filtered.length === 0}
          onClick={async () => {
            const { exportToExcel } = await import("@/lib/documents/excel");
            const rows = filtered.map((e) => ({
              "เวลา": formatDateTime(e.created_at),
              "ตาราง": e.table_name,
              "การกระทำ": ACTION_LABEL[e.action],
              "Record ID": e.record_id,
              "ผู้ดำเนินการ": userMap[e.changed_by] ?? e.changed_by,
              "ข้อมูลก่อนแก้ไข": e.old_data ? JSON.stringify(e.old_data) : "",
              "ข้อมูลใหม่": e.new_data ? JSON.stringify(e.new_data) : "",
              "IP": e.ip_address ?? "",
            }));
            exportToExcel(rows, [
              { header: "เวลา", key: "เวลา", width: 22 },
              { header: "ตาราง", key: "ตาราง", width: 20 },
              { header: "การกระทำ", key: "การกระทำ", width: 10 },
              { header: "Record ID", key: "Record ID", width: 40 },
              { header: "ผู้ดำเนินการ", key: "ผู้ดำเนินการ", width: 20 },
              { header: "ข้อมูลก่อนแก้ไข", key: "ข้อมูลก่อนแก้ไข", width: 40 },
              { header: "ข้อมูลใหม่", key: "ข้อมูลใหม่", width: 40 },
              { header: "IP", key: "IP", width: 15 },
            ], `audit-trail-${new Date().toISOString().slice(0, 10)}`);
          }}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Export Excel
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <ScrollText className="h-12 w-12 text-gray-300" />
              <p className="text-sm text-gray-400">ไม่พบข้อมูล Audit</p>
            </div>
          ) : (
            <DataTable<AuditTrail>
              columns={columns}
              data={filtered}
              keyField="id"
              onRowClick={setSelected}
            />
          )}
        </CardContent>
      </Card>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="รายละเอียด Audit"
        className="max-w-2xl"
      >
        {selected && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={ACTION_VARIANT[selected.action]}>{ACTION_LABEL[selected.action]}</Badge>
              <Badge>{selected.table_name}</Badge>
              <span className="font-mono text-xs text-gray-500">{selected.record_id}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">เวลา</p>
                <p className="text-gray-700">{formatDateTime(selected.created_at)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">ผู้ดำเนินการ</p>
                <p className="text-gray-700">{userMap[selected.changed_by] ?? selected.changed_by}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {selected.old_data && (
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400">ข้อมูลก่อนแก้ไข</p>
                  <pre className="max-h-60 overflow-auto rounded-lg bg-gray-50 p-3 font-mono text-xs text-gray-700">
                    {JSON.stringify(selected.old_data, null, 2)}
                  </pre>
                </div>
              )}
              {selected.new_data && (
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400">ข้อมูลใหม่</p>
                  <pre className="max-h-60 overflow-auto rounded-lg bg-gray-50 p-3 font-mono text-xs text-gray-700">
                    {JSON.stringify(selected.new_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
