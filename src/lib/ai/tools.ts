import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductSearchResult, ForecastResult, AnomalyResult } from "./types";

async function sb(client?: SupabaseClient) {
  return client ?? createClient();
}

export async function searchProducts(query: string, client?: SupabaseClient): Promise<ProductSearchResult[]> {
  const supabase = await sb(client);
  const { data } = await supabase
    .from("products")
    .select("id, sku, name, category, unit")
    .eq("is_active", true)
    .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
    .limit(10);

  if (!data) return [];

  const productIds = data.map((p) => p.id);
  const { data: movements } = await supabase
    .from("stock_movements")
    .select("product_id, quantity_change")
    .in("product_id", productIds)
    .in("movement_type", ["stock_in", "stock_out", "cycle_count_adjust", "return", "adjustment"]);

  const stockMap: Record<string, number> = {};
  for (const m of movements ?? []) {
    stockMap[m.product_id] = (stockMap[m.product_id] ?? 0) + (m.quantity_change ?? 0);
  }

  return data.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category,
    stock: stockMap[p.id] ?? 0,
    unit: p.unit,
  }));
}

export async function getStockSummary(client?: SupabaseClient) {
  const supabase = await sb(client);
  const { data: products } = await supabase
    .from("products")
    .select("id, reorder_point")
    .eq("is_active", true);

  const { data: movements } = await supabase
    .from("stock_movements")
    .select("product_id, quantity_change")
    .in("movement_type", ["stock_in", "stock_out", "cycle_count_adjust", "return", "adjustment"]);

  const stockMap: Record<string, number> = {};
  for (const m of movements ?? []) {
    stockMap[m.product_id] = (stockMap[m.product_id] ?? 0) + (m.quantity_change ?? 0);
  }

  const lowStockCount = (products ?? []).filter(
    (p) => (stockMap[p.id] ?? 0) <= p.reorder_point
  ).length;

  const { data: recent } = await supabase
    .from("stock_movements")
    .select("id", { count: "exact", head: true })
    .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());

  const totalStock = Object.values(stockMap).reduce((s, v) => s + Math.max(0, v), 0);

  const soonCutoff = new Date(Date.now() + 30 * 86400000).toISOString();
  const { count: expiredCount } = await supabase
    .from("lots")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .lt("expiry_date", soonCutoff);

  return {
    totalProducts: products?.length ?? 0,
    totalStock,
    lowStockCount,
    expiredCount: expiredCount ?? 0,
    recentMovements: recent?.length ?? 0,
  };
}

export interface ExpiringLot {
  id: string;
  lot_number: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  expiry_date: string;
}

export async function getExpiringLots(client?: SupabaseClient): Promise<ExpiringLot[]> {
  const supabase = await sb(client);
  const soonCutoff = new Date(Date.now() + 30 * 86400000).toISOString();
  const { data } = await supabase
    .from("lots")
    .select(
      "id, lot_number, product_id, quantity, expiry_date, product:products(id, sku, name)"
    )
    .eq("is_active", true)
    .not("expiry_date", "is", null)
    .lt("expiry_date", soonCutoff)
    .order("expiry_date", { ascending: true });

  return (data ?? []).map((r: Record<string, unknown>) => {
    const product = r.product as { id: string; sku: string; name: string } | null;
    return {
      id: r.id as string,
      lot_number: r.lot_number as string,
      product_id: r.product_id as string,
      product_name: product?.name ?? "ไม่ทราบ",
      product_sku: product?.sku ?? "-",
      quantity: Number(r.quantity ?? 0),
      expiry_date: r.expiry_date as string,
    };
  });
}

export async function getAllProducts(client?: SupabaseClient): Promise<ProductSearchResult[]> {
  const supabase = await sb(client);
  const { data: products } = await supabase
    .from("products")
    .select("id, sku, name, category, unit, reorder_point")
    .eq("is_active", true)
    .order("name");

  if (!products) return [];

  const productIds = products.map((p) => p.id);
  const { data: movements } = await supabase
    .from("stock_movements")
    .select("product_id, quantity_change")
    .in("product_id", productIds)
    .in("movement_type", ["stock_in", "stock_out", "cycle_count_adjust", "return", "adjustment"]);

  const stockMap: Record<string, number> = {};
  for (const m of movements ?? []) {
    stockMap[m.product_id] = (stockMap[m.product_id] ?? 0) + (m.quantity_change ?? 0);
  }

  return products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category,
    stock: stockMap[p.id] ?? 0,
    unit: p.unit,
    reorderPoint: p.reorder_point,
  }));
}

export async function getLowStockProducts(threshold?: number, client?: SupabaseClient): Promise<ProductSearchResult[]> {
  const supabase = await sb(client);
  const { data: products } = await supabase
    .from("products")
    .select("id, sku, name, category, unit, reorder_point")
    .eq("is_active", true);

  if (!products) return [];

  const { data: movements } = await supabase
    .from("stock_movements")
    .select("product_id, quantity_change")
    .in("movement_type", ["stock_in", "stock_out", "cycle_count_adjust", "return", "adjustment"]);

  const stockMap: Record<string, number> = {};
  for (const m of movements ?? []) {
    stockMap[m.product_id] = (stockMap[m.product_id] ?? 0) + (m.quantity_change ?? 0);
  }

  return products
    .filter((p) => {
      const stock = stockMap[p.id] ?? 0;
      return threshold ? stock <= threshold : stock <= p.reorder_point;
    })
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      stock: stockMap[p.id] ?? 0,
      unit: p.unit,
    }))
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 20);
}

export async function getRecentMovements(days = 7, client?: SupabaseClient) {
  const supabase = await sb(client);
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await supabase
    .from("stock_movements")
    .select("id, product_id, movement_type, quantity_change, created_at, note")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);

  return (data ?? []).map((m) => ({
    ...m,
    date: new Date(m.created_at).toLocaleDateString("th-TH"),
  }));
}

export async function getProductStock(productId: string, client?: SupabaseClient) {
  const supabase = await sb(client);
  const { data: product } = await supabase
    .from("products")
    .select("id, sku, name, category, unit, reorder_point")
    .eq("id", productId)
    .single();

  if (!product) return null;

  const { data: movements } = await supabase
    .from("stock_movements")
    .select("quantity_change, movement_type, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(30);

  let stock = 0;
  for (const m of movements ?? []) {
    stock += m.quantity_change ?? 0;
  }

  return {
    ...product,
    stock,
    movements: (movements ?? []).map((m) => ({
      ...m,
      date: new Date(m.created_at).toLocaleDateString("th-TH"),
    })),
  };
}

export async function detectAnomalies(client?: SupabaseClient): Promise<AnomalyResult[]> {
  const supabase = await sb(client);
  const anomalies: AnomalyResult[] = [];

  const { data: products } = await supabase
    .from("products")
    .select("id, sku, name, reorder_point")
    .eq("is_active", true);

  const { data: movements } = await supabase
    .from("stock_movements")
    .select("product_id, quantity_change, movement_type, created_at")
    .in("movement_type", ["stock_in", "stock_out", "cycle_count_adjust", "return", "adjustment"]);

  const stockMap: Record<string, number> = {};
  for (const m of movements ?? []) {
    stockMap[m.product_id] = (stockMap[m.product_id] ?? 0) + (m.quantity_change ?? 0);
  }

  for (const p of products ?? []) {
    const stock = stockMap[p.id] ?? 0;
    if (stock <= p.reorder_point && stock > 0) {
      anomalies.push({
        type: "unusual_pattern",
        severity: stock === 0 ? "high" : "medium",
        description: `สินค้า ${p.name} (${p.sku}) คงเหลือ ${stock} ชิ้น ต่ำกว่าจุดสั่งซื้อซ้ำ (${p.reorder_point})`,
        productId: p.id,
        productName: p.name,
      });
    }
    if (stock <= 0) {
      anomalies.push({
        type: "stock_discrepancy",
        severity: "high",
        description: `สินค้า ${p.name} (${p.sku}) หมดสต็อก`,
        productId: p.id,
        productName: p.name,
      });
    }
  }

  const { data: lots } = await supabase
    .from("lots")
    .select("id, product_id, lot_number, expiry_date, quantity")
    .not("expiry_date", "is", null)
    .gt("quantity", 0);

  const now = new Date();
  for (const lot of lots ?? []) {
    if (lot.expiry_date && new Date(lot.expiry_date) < now) {
      const prod = (products ?? []).find((p) => p.id === lot.product_id);
      anomalies.push({
        type: "expiry_risk",
        severity: "high",
        description: `ล็อต ${lot.lot_number} ของ${prod?.name ?? "สินค้า"}หมดอายุแล้ว (${new Date(lot.expiry_date).toLocaleDateString("th-TH")})`,
        productId: lot.product_id,
        productName: prod?.name,
      });
    }
  }

  return anomalies;
}

export async function forecastProduct(productId: string, client?: SupabaseClient): Promise<ForecastResult | null> {
  const supabase = await sb(client);
  const { data: product } = await supabase
    .from("products")
    .select("id, sku, name")
    .eq("id", productId)
    .single();

  if (!product) return null;

  const threeMonthsAgo = new Date(Date.now() - 90 * 86400000).toISOString();
  const { data: outMovements } = await supabase
    .from("stock_movements")
    .select("quantity_change, created_at")
    .eq("product_id", productId)
    .eq("movement_type", "stock_out")
    .gte("created_at", threeMonthsAgo);

  const totalOut = (outMovements ?? []).reduce((s, m) => s + Math.abs(m.quantity_change), 0);
  const avgMonthly = Math.round(totalOut / 3);

  const currentStock = await getProductStock(productId, client);
  const stock = currentStock?.stock ?? 0;

  return {
    productId,
    productName: product.name,
    avgMonthlyOut: avgMonthly,
    suggestedOrder: Math.max(0, avgMonthly - stock),
    confidence: (outMovements ?? []).length > 5 ? "high" : (outMovements ?? []).length > 2 ? "medium" : "low",
  };
}