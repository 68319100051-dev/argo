"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Loader2,
  Bot,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  FileText,
  MessageCircle,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface AgentActivity {
  id: string;
  agent_type: string;
  action: string;
  summary: string | null;
  requires_review: boolean;
  review_status: string | null;
  created_at: string;
  created_by: string | null;
  user_name?: string;
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  byAgent: Record<string, number>;
}

const agentConfig: Record<string, { label: string; icon: typeof Bot; color: string; bgColor: string }> = {
  forecasting: { label: "พยากรณ์", icon: TrendingUp, color: "text-purple-600", bgColor: "bg-purple-100" },
  chat: { label: "แชต", icon: MessageCircle, color: "text-indigo-600", bgColor: "bg-indigo-100" },
  anomaly: { label: "ตรวจจับ", icon: AlertTriangle, color: "text-red-600", bgColor: "bg-red-100" },
  ocr: { label: "OCR", icon: FileText, color: "text-green-600", bgColor: "bg-green-100" },
  orchestrator: { label: "ประสานงาน", icon: Bot, color: "text-gray-600", bgColor: "bg-gray-100" },
};

const statusConfig: Record<string, { label: string; variant: "default" | "warning" | "success" | "danger" }> = {
  pending: { label: "รออนุมัติ", variant: "warning" },
  approved: { label: "อนุมัติแล้ว", variant: "success" },
  rejected: { label: "ปฏิเสธ", variant: "danger" },
};

export default function OrchestratorPage() {
  const supabase = createClient();
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data: activitiesData } = await supabase
      .from("agent_activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    const activitiesList = (activitiesData ?? []) as AgentActivity[];

    // Fetch user names
    const userIds = [...new Set(activitiesList.map((a) => a.created_by).filter(Boolean))] as string[];
    let userMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase.from("users").select("id, display_name").in("id", userIds);
      for (const u of (users ?? []) as { id: string; display_name: string }[]) {
        userMap[u.id] = u.display_name;
      }
    }

    const enriched = activitiesList.map((a) => ({
      ...a,
      user_name: a.created_by ? userMap[a.created_by] ?? "ไม่ทราบ" : "ระบบ",
    }));

    setActivities(enriched);

    // Calculate stats
    const total = enriched.length;
    const pending = enriched.filter((a) => a.requires_review && !a.review_status).length;
    const approved = enriched.filter((a) => a.review_status === "approved").length;
    const rejected = enriched.filter((a) => a.review_status === "rejected").length;
    const byAgent: Record<string, number> = {};
    for (const a of enriched) {
      byAgent[a.agent_type] = (byAgent[a.agent_type] ?? 0) + 1;
    }

    setStats({ total, pending, approved, rejected, byAgent });
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filteredActivities =
    filter === "all" ? activities : activities.filter((a) => a.agent_type === filter);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Bot className="h-6 w-6 text-violet-600" />
            ศูนย์ประสานงาน AI
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            ภาพรวมกิจกรรมของ AI Agent ทั้งหมด ติดตามสถานะ และจัดการงานที่ต้องอนุมัติ
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void fetchData()} loading={loading}>
          <RefreshCw className="h-4 w-4" />
          รีเฟรช
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
                <Activity className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-violet-700">{stats.total}</p>
                <p className="text-xs text-gray-500">กิจกรรมทั้งหมด</p>
              </div>
            </CardContent>
          </Card>
          <Card className={stats.pending > 0 ? "border-amber-200 bg-amber-50/50" : ""}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{stats.pending}</p>
                <p className="text-xs text-gray-500">รออนุมัติ</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700">{stats.approved}</p>
                <p className="text-xs text-gray-500">อนุมัติแล้ว</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-700">{stats.rejected}</p>
                <p className="text-xs text-gray-500">ปฏิเสธ</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Agent Type Breakdown */}
      {stats && Object.keys(stats.byAgent).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">สถิติแยกตาม Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {Object.entries(stats.byAgent)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => {
                  const conf = agentConfig[type] ?? { label: type, icon: Bot, color: "text-gray-600", bgColor: "bg-gray-100" };
                  const Icon = conf.icon;
                  return (
                    <div key={type} className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${conf.bgColor}`}>
                        <Icon className={`h-4 w-4 ${conf.color}`} />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-800">{count}</p>
                        <p className="text-xs text-gray-500">{conf.label}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Feed with Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              กิจกรรมล่าสุด
            </CardTitle>
            <div className="flex gap-1 overflow-x-auto">
              <button
                onClick={() => setFilter("all")}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === "all" ? "bg-gray-100 text-gray-700" : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                ทั้งหมด ({activities.length})
              </button>
              {Object.entries(agentConfig).map(([type, conf]) => {
                const count = stats?.byAgent[type] ?? 0;
                if (count === 0) return null;
                return (
                  <button
                    key={type}
                    onClick={() => setFilter(type)}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      filter === type ? `${conf.bgColor} ${conf.color}` : "text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {conf.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              <p className="text-sm text-gray-400">กำลังโหลดข้อมูล...</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Bot className="h-12 w-12 text-gray-300" />
              <p className="font-medium text-gray-500">ยังไม่มีกิจกรรม</p>
              <p className="text-sm text-gray-400">AI Agent จะบันทึกกิจกรรมเมื่อมีการใช้งาน</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredActivities.map((activity) => {
                const conf = agentConfig[activity.agent_type] ?? {
                  label: activity.agent_type,
                  icon: Bot,
                  color: "text-gray-600",
                  bgColor: "bg-gray-100",
                };
                const Icon = conf.icon;
                const status = activity.requires_review
                  ? activity.review_status ?? "pending"
                  : activity.review_status ?? "approved";
                const sConf = statusConfig[status] ?? statusConfig.pending;

                return (
                  <div
                    key={activity.id}
                    className="flex items-center gap-4 rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50"
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${conf.bgColor}`}>
                      <Icon className={`h-4 w-4 ${conf.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">
                          {conf.label}
                        </span>
                        <span className="text-xs text-gray-400">|</span>
                        <span className="text-xs text-gray-500">{activity.action}</span>
                      </div>
                      {activity.summary && (
                        <p className="mt-0.5 truncate text-xs text-gray-500">{activity.summary}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="hidden items-center gap-1 sm:flex">
                        <Users className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500">{activity.user_name}</span>
                      </div>
                      <Badge variant={sConf.variant}>{sConf.label}</Badge>
                      <span className="whitespace-nowrap text-xs text-gray-400">
                        {new Date(activity.created_at).toLocaleDateString("th-TH", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
