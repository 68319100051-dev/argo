"use client";

import { useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { QrScanner } from "@/components/scan/QrScanner";
import { ArOverlay } from "@/components/scan/ArOverlay";
import { parseQrPayload } from "@/lib/qr/generator";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2, QrCode, Search, ScanLine, CheckCircle,
} from "lucide-react";

type ScanMode = "qr" | "manual";

interface ProductInfo {
  productId: string;
  lotId: string | null;
  name: string;
  sku: string;
  category: string | null;
  unit: string;
  quantity: number;
  location: string | null;
  expiryDate: string | null;
  lotNumber: string | null;
  stockedInAt: string | null;
}

type LookupResult =
  | { status: "found"; product: ProductInfo }
  | { status: "not_found" }
  | { status: "error"; message: string };

export default function ScanPage() {
  const supabase = createClient();
  const [mode, setMode] = useState<ScanMode>("qr");
  const [manualCode, setManualCode] = useState("");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [stockOutQty, setStockOutQty] = useState("1");
  const [stockingOut, setStockingOut] = useState(false);
  const [stockOutDone, setStockOutDone] = useState(false);
  const [stockOutError, setStockOutError] = useState<string | null>(null);

  const lookupProduct = useCallback(async (data: string) => {
    setLoading(true);
    setLookupResult(null);

    try {
      const res = await fetch("/api/qr/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });

      if (!res.ok) {
        if (res.status === 404) {
          setLookupResult({ status: "not_found" });
          return;
        }
        setLookupResult({ status: "error", message: "เกิดข้อผิดพลาดในการค้นหา" });
        return;
      }

      const json = await res.json();
      setLookupResult({
        status: "found",
        product: {
          productId: json.productId,
          lotId: json.lotId ?? null,
          name: json.name,
          sku: json.sku,
          category: json.category ?? null,
          unit: json.unit ?? "ชิ้น",
          quantity: json.quantity,
          location: json.location ?? null,
          expiryDate: json.expiryDate ?? null,
          lotNumber: json.lotNumber ?? null,
          stockedInAt: json.stockedInAt ?? null,
        },
      });
    } catch {
      setLookupResult({ status: "error", message: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้" });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQrScan = useCallback(
    (data: string) => {
      const parsed = parseQrPayload(data);
      lookupProduct(parsed?.productId ?? data);
    },
    [lookupProduct]
  );

  const handleManualSearch = useCallback(() => {
    const trimmed = manualCode.trim();
    if (!trimmed) return;
    lookupProduct(trimmed);
  }, [manualCode, lookupProduct]);

  const handleStockOut = useCallback(async () => {
    if (lookupResult?.status !== "found") return;
    const p = lookupResult.product;
    const qty = parseInt(stockOutQty, 10);
    if (!qty || qty < 1) { setStockOutError("ระบุจำนวนที่ต้องเบิก"); return; }
    if (qty > p.quantity) { setStockOutError(`มีในสต็อกเพียง ${p.quantity} ${p.unit}`); return; }

    setStockingOut(true);
    setStockOutError(null);

    const { data: user } = await supabase.auth.getUser();
    if (!user?.user?.id) { setStockOutError("กรุณาเข้าสู่ระบบใหม่"); setStockingOut(false); return; }

    if (p.lotId) {
      const { data: lot } = await supabase
        .from("lots")
        .select("quantity")
        .eq("id", p.lotId)
        .single();

      if (!lot || lot.quantity < qty) {
        setStockOutError(`สต็อกในล็อตไม่เพียงพอ (มี ${lot?.quantity ?? 0} ${p.unit})`);
        setStockingOut(false);
        return;
      }

      const { error: lotError } = await supabase
        .from("lots")
        .update({ quantity: lot.quantity - qty })
        .eq("id", p.lotId);

      if (lotError) {
        setStockOutError("เบิกสินค้าล้มเหลว — " + lotError.message);
        setStockingOut(false);
        return;
      }
    }

    const movement = {
      product_id: p.productId,
      lot_id: p.lotId,
      movement_type: "stock_out" as const,
      quantity_change: -qty,
      location: p.location,
      note: "เบิกผ่านสแกน QR",
      performed_by: user.user.id,
    };

    const { error } = await supabase.from("stock_movements").insert(movement);

    if (error) {
      setStockOutError("เบิกสินค้าล้มเหลว — " + error.message);
      setStockingOut(false);
      return;
    }

    setStockOutDone(true);
    setStockingOut(false);
  }, [lookupResult, stockOutQty, supabase]);

  const product = lookupResult?.status === "found" ? lookupResult.product : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">สแกน</h1>
        <p className="text-sm text-gray-500">สแกน QR code หรือค้นหาด้วยรหัสสินค้า</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>ค้นหาสินค้า</CardTitle>
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
              <Button
                variant={mode === "qr" ? "primary" : "ghost"}
                size="sm"
                onClick={() => { setMode("qr"); setLookupResult(null); }}
              >
                <QrCode className="h-4 w-4" />
                สแกน QR
              </Button>
              <Button
                variant={mode === "manual" ? "primary" : "ghost"}
                size="sm"
                onClick={() => { setMode("manual"); setLookupResult(null); }}
              >
                <Search className="h-4 w-4" />
                ค้นหาด้วยรหัส
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {mode === "qr" ? (
            <QrScanner onScan={handleQrScan} />
          ) : (
            <div className="flex flex-col gap-3">
              <Input
                label="รหัสสินค้า (SKU) หรือ เลขล็อต"
                id="manualCode"
                placeholder="พิมพ์ SKU หรือ Lot Number"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleManualSearch();
                }}
              />
              <Button onClick={handleManualSearch} disabled={!manualCode.trim()}>
                <Search className="h-4 w-4" />
                ค้นหา
              </Button>
            </div>
          )}

          <ArOverlay
            product={product}
            loading={loading}
          />

          {product && !stockOutDone && (
            <div className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4">
              <Input
                label="จำนวนที่เบิก"
                id="stockOutQty"
                type="number"
                min={1}
                max={product.quantity}
                value={stockOutQty}
                onChange={(e) => { setStockOutQty(e.target.value); setStockOutError(null); }}
              />
              {stockOutError && (
                <p className="text-sm text-red-500">{stockOutError}</p>
              )}
              <Button
                onClick={handleStockOut}
                loading={stockingOut}
                disabled={stockingOut}
                variant={product.quantity <= 5 ? "danger" : "primary"}
              >
                เบิกออก {stockOutQty || "0"} {product.unit}
              </Button>
            </div>
          )}

          {stockOutDone && (
            <Card className="border-green-200 bg-green-50 p-4 text-center text-sm text-green-700">
              <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-400" />
              เบิกสินค้าสำเร็จ
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setLookupResult(null); setStockOutQty("1"); setStockOutDone(false); setStockOutError(null); }}
                >
                  สแกนรายการถัดไป
                </Button>
              </div>
            </Card>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-indigo-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              กำลังค้นหาข้อมูลสินค้า...
            </div>
          )}

          {lookupResult?.status === "not_found" && (
            <Card className="border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-700">
              <ScanLine className="mx-auto mb-2 h-8 w-8 text-amber-400" />
              ไม่พบสินค้าจากข้อมูลที่ระบุ — ลองตรวจสอบรหัสอีกครั้งหรือสแกน QR ใหม่
            </Card>
          )}

          {lookupResult?.status === "error" && (
            <Card className="border-red-200 bg-red-50 p-4 text-center text-sm text-red-600">
              {lookupResult.message}
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
