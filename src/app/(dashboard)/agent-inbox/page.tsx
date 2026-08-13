"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loader2, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AgentActivityLog, User } from "@/lib/supabase/types";
import { AgentInboxList } from "@/components/ai/AgentInboxList";

interface LogRow extends AgentActivityLog {
  creator: Array<Pick<User, "id" | "email" | "display_name">> | null;
}

export default function AgentInboxPage() {
  const supabase = createClient();
  const [items, setItems] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canReview, setCanReview] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("agent_activity_log")
      .select(
        `
        id,
        agent_type,
        action,
        summary,
        details,
        requires_review,
        review_status,
        reviewed_by,
        reviewed_at,
        created_by,
        created_at,
        creator:users!agent_activity_log_created_by_fkey(id, email, display_name)
        `
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      setError("ไม่สามารถโหลดข้อความจาก Agent ได้");
    } else {
      setItems((data ?? []) as unknown as LogRow[]);
    }
    setLoading(false);
  }, [supabase]);

  const checkPermission = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCanReview(false);
      return;
    }
    const { data: profile } = await supabase
      .from("users")
      .select("role_id, role:roles(name)")
      .eq("id", user.id)
      .single();
    const role = (profile?.role as { name?: string } | null)?.name;
    setCanReview(role === "admin" || role === "warehouse_head");
  }, [supabase]);

  useEffect(() => {
    void (async () => {
      await Promise.all([fetchItems(), checkPermission()]);
    })();
  }, [fetchItems, checkPermission]);

  const handleReview = async (id: string, status: "approved" | "rejected") => {
    setReviewingId(id);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: updateError } = await supabase
      .from("agent_activity_log")
      .update({
        review_status: status,
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      setError(status === "approved" ? "ไม่สามารถอนุมัติรายการได้" : "ไม่สามารถปฏิเสธรายการได้");
    } else {
      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, review_status: status, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() } : i
        )
      );
    }
    setReviewingId(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Inbox</h1>
          <p className="text-sm text-gray-500">
            ข้อความและการดำเนินการที่ต้องตรวจสอบจาก Agent — อนุมัติ/ปฏิเสธได้โดยผู้ที่มีสิทธิ์
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void fetchItems()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          รีเฟรช
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {!canReview && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          คุณมีสิทธิ์ดูรายการเท่านั้น — เฉพาะ Admin หรือหัวหน้าคลังสินค้าเท่านั้นที่อนุมัติ/ปฏิเสธได้
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>รายการ Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : (
            <div className="p-4">
              <AgentInboxList
                items={items}
                onApprove={(id) => void handleReview(id, "approved")}
                onReject={(id) => void handleReview(id, "rejected")}
                loading={reviewingId !== null}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}