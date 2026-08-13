export interface Database {
  public: {
    Tables: {
      roles: {
        Row: Role;
        Insert: Omit<Role, "id" | "created_at">;
        Update: Partial<Omit<Role, "id" | "created_at">>;
      };
      users: {
        Row: User;
        Insert: Omit<User, "created_at" | "updated_at">;
        Update: Partial<Omit<User, "id" | "created_at" | "updated_at">>;
      };
      products: {
        Row: Product;
        Insert: Omit<Product, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Product, "id" | "created_at" | "updated_at">>;
      };
      lots: {
        Row: Lot;
        Insert: Omit<Lot, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Lot, "id" | "created_at" | "updated_at">>;
      };
      stock_movements: {
        Row: StockMovement;
        Insert: Omit<StockMovement, "id" | "created_at">;
        Update: never;
      };
      suppliers: {
        Row: Supplier;
        Insert: Omit<Supplier, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Supplier, "id" | "created_at" | "updated_at">>;
      };
      purchase_orders: {
        Row: PurchaseOrder;
        Insert: Omit<PurchaseOrder, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<PurchaseOrder, "id" | "created_at" | "updated_at">>;
      };
      purchase_order_items: {
        Row: PurchaseOrderItem;
        Insert: Omit<PurchaseOrderItem, "id" | "created_at">;
        Update: Partial<Omit<PurchaseOrderItem, "id" | "created_at">>;
      };
      cycle_counts: {
        Row: CycleCount;
        Insert: Omit<CycleCount, "id" | "created_at">;
        Update: Partial<Omit<CycleCount, "id" | "created_at">>;
      };
      agent_activity_log: {
        Row: AgentActivityLog;
        Insert: Omit<AgentActivityLog, "id" | "created_at">;
        Update: Partial<Omit<AgentActivityLog, "id" | "created_at">>;
      };
      audit_trail: {
        Row: AuditTrail;
        Insert: Omit<AuditTrail, "id" | "created_at">;
        Update: never;
      };
      ai_settings: {
        Row: AiSetting;
        Insert: Omit<AiSetting, "id" | "updated_at">;
        Update: Partial<Omit<AiSetting, "id" | "updated_at">>;
      };
      stock_snapshots: {
        Row: StockSnapshot;
        Insert: Omit<StockSnapshot, "id" | "created_at">;
        Update: Partial<Omit<StockSnapshot, "id" | "created_at">>;
      };
    };
    Enums: {
      po_status: "draft" | "pending_approval" | "approved" | "received" | "cancelled";
    };
  };
}

export interface Role {
  id: string;
  name: "warehouse_staff" | "warehouse_head" | "admin";
  description: string | null;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  display_name: string;
  role_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  tracking_mode: "per_unit" | "per_lot";
  reorder_point: number;
  price: number | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lot {
  id: string;
  product_id: string;
  lot_number: string;
  quantity: number;
  location: string | null;
  expiry_date: string | null;
  qr_code: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  lot_id: string | null;
  movement_type: "stock_in" | "stock_out" | "transfer" | "cycle_count_adjust" | "return" | "adjustment";
  quantity_change: number;
  reference_type: "purchase_order" | "transfer_order" | "cycle_count" | "manual" | null;
  reference_id: string | null;
  note: string | null;
  performed_by: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type PoStatus = "draft" | "pending_approval" | "approved" | "received" | "cancelled";

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  status: PoStatus;
  order_date: string;
  expected_date: string | null;
  notes: string | null;
  total_amount: number | null;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  received_by: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  product_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number;
  created_at: string;
}

export interface CycleCount {
  id: string;
  product_id: string;
  lot_id: string | null;
  system_quantity: number;
  actual_quantity: number;
  variance: number;
  location: string | null;
  notes: string | null;
  status: "pending" | "verified" | "resolved";
  counted_by: string;
  verified_by: string | null;
  counted_at: string;
  verified_at: string | null;
  created_at: string;
}

export interface AgentActivityLog {
  id: string;
  agent_type: "forecasting" | "chat" | "anomaly" | "ocr" | "orchestrator";
  action: string;
  summary: string | null;
  details: Record<string, unknown> | null;
  requires_review: boolean;
  review_status: "pending" | "approved" | "rejected" | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AuditTrail {
  id: string;
  table_name: string;
  record_id: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_by: string;
  ip_address: string | null;
  created_at: string;
}

export interface AiSetting {
  id: string;
  agent_type: "forecasting" | "chat" | "anomaly" | "ocr" | "orchestrator";
  is_enabled: boolean;
  spending_limit: number | null;
  extra_config: Record<string, unknown> | null;
  updated_by: string | null;
  updated_at: string;
}

export interface StockSnapshot {
  id: string;
  snapshot_date: string;
  product_id: string;
  lot_id: string | null;
  qty: number;
  created_at: string;
}
