"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Loader2, TrendingUp, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ProductOption {
  id: string;
  sku: string;
  name: string;
  unit: string;
  reorder_point: number;
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

const confidenceVariant: Record<string, "default" | "warning" | "success"> = {
  low: "warning",
  medium: "default",
  high: "success",
};
const confidenceLabel: Record<string, string> = {
  low: "ข้อมูลน้อย",
  medium: "ปานกลาง",
  high: "ข้อมูลเพียงพอ",
};

export default function ForecastPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    const { data } = await supabase
      .from("products")
      .select("id, sku, name, unit, reorder_point")
      .eq("is_active", true)
      .order("name");
    setProducts((data ?? []) as ProductOption[]);
    setProductsLoading(false);
  }, [supabase]);

  useEffect(() => {
    void (async () => {
      await fetchProducts();
    })();
  }, [fetchProducts]);

  const runForecast = async () => {
    if (!selected) {
      setError("กรุณาเลือกสินค้า");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/agents/forecast?productId=${encodeURIComponent(selected)}`);
      const body: ApiResult = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        setError(body.error ?? "เกิดข้อผิดพลาดในการพยากรณ์");
      } else {
        setResult(body);
      }
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <TrendingUp className="h-6 w-6 text-indigo-600" />
          พยากรณ์ความต้องการ
        </h1>
        <p className="text-sm text-gray-500">
          วิเคราะห์ยอดเบิกของสินค้าและแนะนำปริมาณสั่งซื้อ
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>เลือกสินค้า</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {productsLoading ? (
            <div className="flex h-10 items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              กำลังโหลด...
            </div>
          ) : (
            <select
              value={selected}
              onChange={(e) => { setSelected(e.target.value); setError(null); }}
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">-- เลือกสินค้า --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div>
            <Button onClick={runForecast} loading={loading} disabled={!selected}>
              <Sparkles className="h-4 w-4" />
              พยากรณ์
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && result.success && result.data && (
        <Card>
          <CardHeader>
            <CardTitle>{result.data.productName}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs text-gray-500">ยอดเบิกเฉลี่ย</p>
                <p className="mt-1 text-xl font-bold text-gray-800">
                  {result.data.avgMonthlyOut.toLocaleString()} /เดือน
                </p>
              </div>
              <div className="rounded-lg bg-indigo-50 p-4">
                <p className="text-xs text-indigo-500">แนะนำสั่งซื้อ</p>
                <p className="mt-1 text-xl font-bold text-indigo-700">
                  {result.data.suggestedOrder.toLocaleString()} ชิ้น
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs text-gray-500">ความเชื่อมั่น</p>
                <div className="mt-1.5">
                  <Badge variant={confidenceVariant[result.data.confidence]}>
                    {confidenceLabel[result.data.confidence]}
                  </Badge>
                </div>
              </div>
            </div>
            {result.insight && (
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4 text-sm text-gray-700">
                <p className="mb-1 font-medium text-indigo-700">คำแนะนำจาก AI</p>
                <p>{result.insight}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}