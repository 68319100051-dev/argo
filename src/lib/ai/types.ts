export interface AgentResult {
  success: boolean;
  data?: unknown;
  error?: string;
  requiresReview?: boolean;
}

export type Intent = "query" | "forecast" | "anomaly" | "ocr" | "write";

export interface StockSummary {
  totalProducts: number;
  totalStock: number;
  lowStockCount: number;
  expiredCount: number;
  recentMovements: number;
}

export interface ProductSearchResult {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  stock: number;
  unit: string;
  reorderPoint?: number | null;
}

export interface ForecastResult {
  productId: string;
  productName: string;
  avgMonthlyOut: number;
  suggestedOrder: number;
  confidence: "low" | "medium" | "high";
}

export interface AnomalyResult {
  type: "unusual_pattern" | "stock_discrepancy" | "expiry_risk";
  severity: "low" | "medium" | "high";
  description: string;
  productId?: string;
  productName?: string;
}
