"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Loader2, AlertTriangle, ShieldCheck } from "lucide-react";

interface Anomaly {
  type: "unusual_pattern" | "stock_discrepancy" | "expiry_risk";
  severity: "low" | "medium" | "high";
  description: string;
  productName?: string;
}

interface ApiResult {
  success: boolean;
  data?: Anomaly[];
  analysis?: string;
  error?: string;
}

const severityVariant: Record<string, "default" | "warning" | "danger"> = {
  low: "default",
  medium: "warning",
  high: "danger",
};
const typeLabel: Record<string, string> = {
  unusual_pattern: "สต็อกต่ำ",
  stock_discrepancy: "หมดสต็อก",
  expiry_risk: "หมดอายุ",
};

export default function AnomalyPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runScan = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/agents/anomaly", { method: "POST" });
      const body: ApiResult = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        setError(body.error ?? "เกิดข้อผิดพลาดในการตรวจสอบ");
      } else {
        setResult(body);
      }
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  };

  const count = result?.data?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <AlertTriangle className="h-6 w-6 text-red-500" />
          ตรวจสอบความผิดปกติของสต็อก
        </h1>
        <p className="text-sm text-gray-500">
          ตรวจหาสินค้าสต็อกต่ำ หมดสต็อก และใกล้หมดอายุ
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ตรวจสอบตอนนี้</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">
            ระบบจะตรวจสอบสินค้าทั้งหมดในคลังและรายงานความผิดปกติที่พบ พร้อมคำแนะนำจาก AI
          </p>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div>
            <Button onClick={runScan} loading={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              {result ? "ตรวจสอบอีกครั้ง" : "เริ่มตรวจสอบ"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && result.success && (
        <>
          {count === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <ShieldCheck className="h-12 w-12 text-green-500" />
                <p className="font-medium text-green-700">ไม่พบความผิดปกติในสต็อก</p>
                <p className="text-sm text-gray-400">{result.analysis}</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>พบความผิดปกติ {count} รายการ</CardTitle>
                  <Badge variant="danger">{count} รายการ</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {result.analysis && (
                  <div className="rounded-lg border border-red-100 bg-red-50/40 p-4 text-sm text-gray-700">
                    <p className="mb-1 font-medium text-red-700">คำแนะนำจาก AI</p>
                    <p>{result.analysis}</p>
                  </div>
                )}
                {(result.data ?? []).map((a, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-3"
                  >
                    <div>
                      <Badge variant={severityVariant[a.severity]}>
                        {typeLabel[a.type] ?? a.type}
                      </Badge>
                      {a.productName && (
                        <span className="ml-2 font-medium text-gray-800">{a.productName}</span>
                      )}
                      <p className="mt-1 text-sm text-gray-600">{a.description}</p>
                    </div>
                    <Badge variant={severityVariant[a.severity]}>
                      {a.severity === "high" ? "สูง" : a.severity === "medium" ? "กลาง" : "ต่ำ"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}