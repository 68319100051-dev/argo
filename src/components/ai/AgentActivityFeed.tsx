"use client";

import { cn } from "@/lib/utils/cn";
import { Bot, Sparkles, AlertTriangle, FileText, MessageSquare } from "lucide-react";
import type { AgentActivityLog } from "@/lib/supabase/types";

const agentIcons: Record<string, React.ReactNode> = {
  forecasting: <Sparkles className="h-4 w-4" />,
  chat: <MessageSquare className="h-4 w-4" />,
  anomaly: <AlertTriangle className="h-4 w-4" />,
  ocr: <FileText className="h-4 w-4" />,
  orchestrator: <Bot className="h-4 w-4" />,
};

const agentColors: Record<string, string> = {
  forecasting: "text-purple-600 bg-purple-100",
  chat: "text-indigo-600 bg-indigo-100",
  anomaly: "text-red-600 bg-red-100",
  ocr: "text-green-600 bg-green-100",
  orchestrator: "text-gray-600 bg-gray-100",
};

interface AgentActivityFeedProps {
  logs: AgentActivityLog[];
  className?: string;
}

export function AgentActivityFeed({ logs, className }: AgentActivityFeedProps) {
  if (logs.length === 0) {
    return (
      <div className={cn("flex flex-col items-center gap-2 py-8 text-center", className)}>
        <Bot className="h-8 w-8 text-gray-300" />
        <p className="text-sm text-gray-400">ยังไม่มีกิจกรรมจาก AI</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {logs.map((log) => (
        <div
          key={log.id}
          className="flex items-start gap-3 rounded-lg border border-gray-100 bg-white p-3"
        >
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              agentColors[log.agent_type] ?? "bg-gray-100 text-gray-600"
            )}
          >
            {agentIcons[log.agent_type] ?? <Bot className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">{log.action}</span>
              {log.requires_review && (
                <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700">
                  รอตรวจสอบ
                </span>
              )}
            </div>
            {log.summary && (
              <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">{log.summary}</p>
            )}
            <p className="mt-1 text-xs text-gray-400">
              {new Date(log.created_at).toLocaleString("th-TH")}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
