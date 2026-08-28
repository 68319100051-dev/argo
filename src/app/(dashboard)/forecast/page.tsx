"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Loader2,
  TrendingUp,
  Sparkles,
  Search,
  Package,
  AlertTriangle,
  RefreshCw,
  ShoppingCart,
  BarChart3,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ProductOption {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  unit: string;
  reorder_point: number;
  currentStock?: number;
}

interface ForecastResult {
  productName: string;
  avgMonthlyOut: number;
  suggestedOrder: number;
  confidence: "low" | "medium" | "high";
}

interface ApiResult {
  success: boolean;
  data?: ForecastResult;
  insight?: string;
  error?: string;
}

interface LowStockItem {
  id: string;
  name: string;
  sku: string;
  stock: number;
  unit: string;
}

const confidenceConfig: Record<string, { variant: "default" | "warning" | "success"; label: string; color: string }> = {
  low: { variant: "warning", label: "ข้อมูลน้อย", color: "text-amber-600" },
  medium: { variant: "default", label: "ปานกลาง", color: "text-blue-600" },
  high: { variant: "success", label: "เชื่อมั่นสูง", color: "text-emerald-600" },
};

export default function ForecastPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLowStock, setShowLowStock] = useState(false);

  const fetchData = useCallback(async () => {
    setProductsLoading(true);
    const [productsRes, lowStockRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, sku, name, category, unit, reorder_point")
        .eq("is_active", true)
        .order("name"),
      supabase.rpc("get_low_stock_products"),
    ]);
    setProducts((productsRes.data ?? []) as ProductOption[]);
    setLowStockProducts((lowStockRes.data ?? []) as LowStockItem[]);
    setProductsLoading(false);
  }, [supabase]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const runForecast = async (productId?: string) => {
    const targetId = productId || selected;
    if (!targetId) {
      setError("กรุณาเลือกสินค้า");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/agents/forecast?productId=${encodeURIComponent(targetId)}`);
      const body: ApiResult = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        setError(body.error ?? "เกิดข้อผิดพลาดในการพยากรณ์");
      } else {
        setResult(body);
        setSelected(targetId);
      }
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === selected);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <TrendingUp className="h-6 w-6 text-indigo-600" />
            พยากรณ์ความต้องการ
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            วิเคราะห์ยอดเบิกย้อนหลัง แนะนำปริมาณสั่งซื้อที่เหมาะสม
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void fetchData()}>
          <RefreshCw className="h-4 w-4" />
          รีเฟรช
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50 to-white">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
              <Package className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-indigo-700">{products.length}</p>
              <p className="text-xs text-gray-500">สินค้าทั้งหมด</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-100 bg-gradient-to-br from-amber-50 to-white">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700">{lowStockProducts.length}</p>
              <p className="text-xs text-gray-500">สินค้าใกล้หมด</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
              <BarChart3 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700">{result ? 1 : 0}</p>
              <p className="text-xs text-gray-500">พยากรณ์ล่าสุด</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Product Selection */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-4 w-4 text-gray-400" />
                เลือกสินค้า
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ค้นหาชื่อ, SKU, หมวด..."
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button
                  variant={showLowStock ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setShowLowStock(!showLowStock)}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  สินค้าใกล้หมด ({lowStockProducts.length})
                </Button>
              </div>

              {/* Product List */}
              <div className="max-h-[400px] space-y-1 overflow-y-auto">
                {productsLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    กำลังโหลด...
                  </div>
                ) : showLowStock ? (
                  lowStockProducts.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">ไม่มีสินค้าใกล้หมด</p>
                  ) : (
                    lowStockProducts.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => void runForecast(p.id)}
                        disabled={loading}
                        className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-all hover:border-indigo-300 hover:bg-indigo-50 ${
                          selected === p.id ? "border-indigo-500 bg-indigo-50" : "border-gray-100"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-800">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.sku}</p>
                        </div>
                        <Badge variant="danger">
                          {p.stock} {p.unit}
                        </Badge>
                      </button>
                    ))
                  )
                ) : filteredProducts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-400">ไม่พบสินค้า</p>
                ) : (
                  filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelected(p.id)}
                      className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-all hover:border-indigo-300 hover:bg-indigo-50 ${
                        selected === p.id ? "border-indigo-500 bg-indigo-50" : "border-gray-100"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-400">
                          {p.sku}
                          {p.category && <span className="ml-1 text-indigo-400">| {p.category}</span>}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-gray-400">{p.unit}</span>
                    </button>
                  ))
                )}
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button
                onClick={() => void runForecast()}
                loading={loading}
                disabled={!selected}
                className="w-full"
              >
                <Sparkles className="h-4 w-4" />
                พยากรณ์สินค้านี้
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-2">
          {!result && !loading && (
            <Card className="flex min-h-[400px] flex-col items-center justify-center">
              <CardContent className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50">
                  <TrendingUp className="h-10 w-10 text-indigo-300" />
                </div>
                <div>
                  <p className="font-medium text-gray-700">เลือกสินค้าเพื่อเริ่มพยากรณ์</p>
                  <p className="mt-1 text-sm text-gray-400">
                    ระบบจะวิเคราะห์ยอดเบิกย้อนหลังและแนะนำจำนวนสั่งซื้อ
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowLowStock(true)}>
                    <AlertTriangle className="h-3.5 w-3.5" />
                    ดูสินค้าใกล้หมด
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {loading && (
            <Card className="flex min-h-[400px] flex-col items-center justify-center">
              <CardContent className="flex flex-col items-center gap-4 text-center">
                <div className="relative">
                  <div className="h-16 w-16 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                  <Sparkles className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-indigo-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-700">กำลังวิเคราะห์ข้อมูล...</p>
                  <p className="mt-1 text-sm text-gray-400">
                    กำลังดึงข้อมูลยอดเบิกย้อนหลังและคำนวณแนวโน้ม
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {result && result.success && result.data && (
            <div className="flex flex-col gap-4">
              {/* Selected Product Header */}
              {selectedProduct && (
                <Card className="border-indigo-100 bg-gradient-to-r from-indigo-500 to-violet-600 text-white">
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20">
                      <Package className="h-7 w-7" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-bold">{result.data.productName}</h2>
                      <p className="text-sm text-indigo-100">
                        {selectedProduct.sku}
                        {selectedProduct.category && ` | ${selectedProduct.category}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void runForecast()}
                      className="text-white hover:bg-white/20"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Forecast Metrics */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="flex flex-col gap-2 p-5">
                    <div className="flex items-center gap-2 text-gray-500">
                      <BarChart3 className="h-4 w-4" />
                      <span className="text-xs font-medium">ยอดเบิกเฉลี่ย</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">
                      {result.data.avgMonthlyOut.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400">ชิ้น / เดือน</p>
                  </CardContent>
                </Card>
                <Card className="border-indigo-100 bg-indigo-50/50">
                  <CardContent className="flex flex-col gap-2 p-5">
                    <div className="flex items-center gap-2 text-indigo-600">
                      <ShoppingCart className="h-4 w-4" />
                      <span className="text-xs font-medium">แนะนำสั่งซื้อ</span>
                    </div>
                    <p className="text-3xl font-bold text-indigo-700">
                      {result.data.suggestedOrder.toLocaleString()}
                    </p>
                    <p className="text-xs text-indigo-400">ชิ้น</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col gap-2 p-5">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Sparkles className="h-4 w-4" />
                      <span className="text-xs font-medium">ความเชื่อมั่น</span>
                    </div>
                    <div className="mt-1">
                      <Badge variant={confidenceConfig[result.data.confidence].variant} className="text-sm">
                        {confidenceConfig[result.data.confidence].label}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400">
                      {result.data.confidence === "high"
                        ? "ข้อมูลเพียงพอสำหรับการพยากรณ์ที่แม่นยำ"
                        : result.data.confidence === "medium"
                        ? "ข้อมูลพอประมาณ ควรตรวจสอบก่อนสั่งซื้อ"
                        : "ข้อมูลน้อย ควรใช้วิจารณญาณ"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* AI Insight */}
              {result.insight && (
                <Card className="border-indigo-100">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Sparkles className="h-4 w-4 text-indigo-500" />
                      คำแนะนำจาก AI
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg bg-indigo-50/50 p-4 text-sm leading-relaxed text-gray-700">
                      {result.insight}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
