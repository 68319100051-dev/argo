"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Loader2,
  AlertTriangle,
  ShieldCheck,
  Shield,
  Package,
  Clock,
  TrendingDown,
  RefreshCw,
  Filter,
} from "lucide-react";

interface Anomaly {
  type: "unusual_pattern" | "stock_discrepancy" | "expiry_risk";
  severity: "low" | "medium" | "high";
  description: string;
  productName?: string;
  productId?: string;
}

interface ApiResult {
  success: boolean;
  data?: Anomaly[];
  analysis?: string;
  error?: string;
}

const severityConfig: Record<
  string,
  { variant: "default" | "warning" | "danger"; label: string; icon: typeof AlertTriangle }
> = {
  low: { variant: "default", label: "ต่ำ", icon: Clock },
  medium: { variant: "warning", label: "ปานกลาง", icon: TrendingDown },
  high: { variant: "danger", label: "สูง", icon: AlertTriangle },
};

const typeConfig: Record<string, { label: string; color: string }> = {
  unusual_pattern: { label: "สต็อกต่ำ", color: "bg-amber-100 text-amber-700" },
  stock_discrepancy: { label: "หมดสต็อก", color: "bg-red-100 text-red-700" },
  expiry_risk: { label: "หมดอายุ", color: "bg-orange-100 text-orange-700" },
};

export default function AnomalyPage() {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");

  const runScan = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError(null);
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
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    void runScan(false);
  }, []);

  const anomalies = result?.data ?? [];
  const filteredAnomalies =
    filterSeverity === "all" ? anomalies : anomalies.filter((a) => a.severity === filterSeverity);

  const highCount = anomalies.filter((a) => a.severity === "high").length;
  const medCount = anomalies.filter((a) => a.severity === "medium").length;
  const lowCount = anomalies.filter((a) => a.severity === "low").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Shield className="h-6 w-6 text-red-500" />
            ตรวจสอบความผิดปกติ
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            ตรวจจับสินค้าสต็อกต่ำ หมดสต็อก ใกล้หมดอายุ ปัญหาเชิงลึกด้วย AI
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void runScan()} loading={loading}>
          <RefreshCw className="h-4 w-4" />
          สแกนอีกครั้ง
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className={highCount > 0 ? "border-red-200 bg-red-50/50" : ""}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700">{highCount}</p>
              <p className="text-xs text-gray-500">สำคัญสูง</p>
            </div>
          </CardContent>
        </Card>
        <Card className={medCount > 0 ? "border-amber-200 bg-amber-50/50" : ""}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <TrendingDown className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700">{medCount}</p>
              <p className="text-xs text-gray-500">ปานกลาง</p>
            </div>
          </CardContent>
        </Card>
        <Card className={lowCount > 0 ? "border-blue-200 bg-blue-50/50" : ""}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700">{lowCount}</p>
              <p className="text-xs text-gray-500">ควรสังเกต</p>
            </div>
          </CardContent>
        </Card>
        <Card className={anomalies.length === 0 && !initialLoading ? "border-emerald-200 bg-emerald-50/50" : ""}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
              <Package className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700">{anomalies.length}</p>
              <p className="text-xs text-gray-500">รายการทั้งหมด</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Analysis */}
      {result?.analysis && (
        <Card className="border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50">
          <CardContent className="flex items-start gap-4 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="flex-1">
              <p className="mb-1 text-sm font-semibold text-indigo-700">คำวิเคราะห์จาก AI</p>
              <p className="text-sm leading-relaxed text-gray-700">{result.analysis}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter + Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              รายการที่พบ ({filteredAnomalies.length})
            </CardTitle>
            <div className="flex gap-1">
              {["all", "high", "medium", "low"].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setFilterSeverity(sev)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    filterSeverity === sev
                      ? sev === "high"
                        ? "bg-red-100 text-red-700"
                        : sev === "medium"
                        ? "bg-amber-100 text-amber-700"
                        : sev === "low"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-700"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {sev === "all" ? "ทั้งหมด" : severityConfig[sev]?.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {initialLoading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <p className="text-sm text-gray-400">กำลังตรวจสอบสินค้าทั้งหมด...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <AlertTriangle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-red-500">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void runScan()}>
                ลองใหม่
              </Button>
            </div>
          ) : filteredAnomalies.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <ShieldCheck className="h-12 w-12 text-emerald-400" />
              <p className="font-medium text-emerald-700">
                {anomalies.length === 0 ? "ไม่พบความผิดปกติในสต็อก" : "ไม่พบตามเงื่อนไขที่เลือก"}
              </p>
              <p className="text-sm text-gray-400">ระบบตรวจสอบสินค้าทั้งหมดเรียบร้อยแล้ว</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAnomalies.map((anomaly, idx) => {
                const sevConf = severityConfig[anomaly.severity];
                const typeConf = typeConfig[anomaly.type] ?? { label: anomaly.type, color: "bg-gray-100 text-gray-700" };
                const SevIcon = sevConf.icon;
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-4 rounded-xl border p-4 transition-all hover:shadow-sm ${
                      anomaly.severity === "high"
                        ? "border-red-200 bg-red-50/30"
                        : anomaly.severity === "medium"
                        ? "border-amber-200 bg-amber-50/30"
                        : "border-gray-200"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        anomaly.severity === "high"
                          ? "bg-red-100"
                          : anomaly.severity === "medium"
                          ? "bg-amber-100"
                          : "bg-blue-100"
                      }`}
                    >
                      <SevIcon
                        className={`h-4 w-4 ${
                          anomaly.severity === "high"
                            ? "text-red-600"
                            : anomaly.severity === "medium"
                            ? "text-amber-600"
                            : "text-blue-600"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeConf.color}`}>
                          {typeConf.label}
                        </span>
                        {anomaly.productName && (
                          <span className="text-sm font-medium text-gray-800">{anomaly.productName}</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{anomaly.description}</p>
                    </div>
                    <Badge variant={sevConf.variant}>{sevConf.label}</Badge>
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
