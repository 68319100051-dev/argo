export type { Role, User, Product, Lot, StockMovement, Supplier, PurchaseOrder, PurchaseOrderItem, CycleCount, AgentActivityLog, AuditTrail, AiSetting, PoStatus, } from "@/lib/supabase/types";

export type AgentType = "forecasting" | "chat" | "anomaly" | "ocr" | "orchestrator";
export type ReviewStatus = "pending" | "approved" | "rejected";

export interface PendingAction {
  id: string;
  agentType: AgentType;
  action: string;
  summary: string;
  details: Record<string, unknown>;
  createdAt: string;
  reviewStatus: ReviewStatus;
}
