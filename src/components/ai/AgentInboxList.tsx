"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";
import { Inbox, Check, X, Bot, Sparkles, AlertTriangle, FileText } from "lucide-react";
import type { AgentActivityLog } from "@/lib/supabase/types";

const agentIcons: Record<string, React.ReactNode> = {
  forecasting: <Sparkles className="h-4 w-4" />,
  chat: <Bot className="h-4 w-4" />,
  anomaly: <AlertTriangle className="h-4 w-4" />,
  ocr: <FileText className="h-4 w-4" />,
  orchestrator: <Bot className="h-4 w-4" />,
};

interface AgentInboxListProps {
  items: AgentActivityLog[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  loading?: boolean;
}

export function AgentInboxList({ items, onApprove, onReject, loading }: AgentInboxListProps) {
  const [filterAgent, setFilterAgent] = useState<string | null>(null);

  const filtered = filterAgent
    ? items.filter((i) => i.agent_type === filterAgent)
    : items;

  const pendingCount = items.filter((i) => i.review_status === "pending").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Inbox className="h-4 w-4" />
          รอดำเนินการ {pendingCount} รายการ
        </div>
        <div className="flex gap-2">
          {["all", "forecasting", "anomaly", "ocr"].map((type) => (
            <button
              key={type}
              onClick={() => setFilterAgent(type === "all" ? null : type)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                filterAgent === type || (type === "all" && !filterAgent)
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              )}
            >
              {type === "all" ? "ทั้งหมด" : type === "forecasting" ? "พยากรณ์" : type === "anomaly" ? "ผิดปกติ" : "OCR"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Inbox className="h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-400">ไม่มีรายการที่รอดำเนินการ</p>
          </CardContent>
        </Card>
      ) : (
        filtered.map((item) => (
          <Card key={item.id} className={item.review_status === "pending" ? "border-yellow-200" : ""}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    item.agent_type === "forecasting" ? "bg-purple-100 text-purple-600" :
                    item.agent_type === "anomaly" ? "bg-red-100 text-red-600" :
                    item.agent_type === "ocr" ? "bg-green-100 text-green-600" :
                    "bg-indigo-100 text-indigo-600"
                  )}
                >
                  {agentIcons[item.agent_type]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{item.action}</span>
                    {item.review_status === "pending" && (
                      <Badge variant="warning">รออนุมัติ</Badge>
                    )}
                    {item.review_status === "approved" && (
                      <Badge variant="success">อนุมัติแล้ว</Badge>
                    )}
                    {item.review_status === "rejected" && (
                      <Badge variant="danger">ปฏิเสธ</Badge>
                    )}
                  </div>
                  {item.summary && (
                    <p className="mt-1 text-sm text-gray-500">{item.summary}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(item.created_at).toLocaleString("th-TH")}
                  </p>
                </div>
                {item.review_status === "pending" && (
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" onClick={() => onReject(item.id)} disabled={loading}>
                      <X className="h-4 w-4 text-red-500" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onApprove(item.id)} disabled={loading}>
                      <Check className="h-4 w-4 text-green-500" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
