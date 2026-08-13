"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils/formats";
import { Button } from "@/components/ui/Button";
import { FileSpreadsheet } from "lucide-react";
import { Loader2, Package, TrendingUp, Clock, AlertTriangle, DollarSign } from "lucide-react";
import type { Product } from "@/lib/supabase/types";

interface LowStockItem {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  reorderPoint: number;
  suggestedOrder: number;
}

interface FastMovingItem {
  id: string;
  name: string;
  sku: string;
  stockOutCount: number;
}

export default function ReportsPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [fastMoving, setFastMoving] = useState<FastMovingItem[]>([]);
  const [slowMovingCount, setSlowMovingCount] = useState(0);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const { data: productsData } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true);

      if (!productsData) {
        setLoading(false);
        return;
      }

      setProducts(productsData);

      const productMap = new Map(productsData.map((p) => [p.id, p]));

      const perUnitIds = productsData
        .filter((p) => p.tracking_mode === "per_unit")
        .map((p) => p.id);

      const perLotIds = productsData
        .filter((p) => p.tracking_mode === "per_lot")
        .map((p) => p.id);

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const [
        movementsResult,
        lotsResult,
        stockOut30Result,
        stockOut90Result,
      ] = await Promise.all([
        perUnitIds.length > 0
          ? supabase
              .from("stock_movements")
              .select("product_id, quantity_change")
              .in("product_id", perUnitIds)
              .in("movement_type", ["stock_in", "stock_out", "cycle_count_adjust", "return", "adjustment"])
          : Promise.resolve({ data: null }),
        perLotIds.length > 0
          ? supabase
              .from("lots")
              .select("product_id, quantity")
              .in("product_id", perLotIds)
              .eq("is_active", true)
          : Promise.resolve({ data: null }),
        supabase
          .from("stock_movements")
          .select("product_id")
          .eq("movement_type", "stock_out")
          .gte("created_at", thirtyDaysAgo),
        supabase
          .from("stock_movements")
          .select("product_id")
          .eq("movement_type", "stock_out")
          .gte("created_at", ninetyDaysAgo),
      ]);

      const stockMapResult: Record<string, number> = {};
      for (const m of movementsResult.data ?? []) {
        stockMapResult[m.product_id] = (stockMapResult[m.product_id] ?? 0) + m.quantity_change;
      }
      for (const l of lotsResult.data ?? []) {
        stockMapResult[l.product_id] = (stockMapResult[l.product_id] ?? 0) + l.quantity;
      }
      setStockMap(stockMapResult);

      const stockOutCount30: Record<string, number> = {};
      for (const m of stockOut30Result.data ?? []) {
        stockOutCount30[m.product_id] = (stockOutCount30[m.product_id] ?? 0) + 1;
      }
      const top5 = Object.entries(stockOutCount30)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([productId, count]) => {
          const p = productMap.get(productId);
          return {
            id: productId,
            name: p?.name ?? "ไม่พบสินค้า",
            sku: p?.sku ?? "-",
            stockOutCount: count,
          };
        });
      setFastMoving(top5);

      const productsWithStockOut90 = new Set(
        (stockOut90Result.data ?? []).map((m) => m.product_id)
      );
      setSlowMovingCount(
        productsData.filter((p) => !productsWithStockOut90.has(p.id)).length
      );

      setLoading(false);
    }

    loadData();
  }, [supabase]);

  const totalStockValue = useMemo(
    () =>
      products.reduce((sum, p) => {
        const stock = stockMap[p.id] ?? 0;
        return sum + (p.price ?? 0) * stock;
      }, 0),
    [products, stockMap]
  );

  const categorySummaries = useMemo(() => {
    const catMap = new Map<
      string,
      { skuCount: number; totalQuantity: number; totalValue: number }
    >();
    for (const p of products) {
      const cat = p.category ?? "ไม่มีหมวดหมู่";
      const stock = stockMap[p.id] ?? 0;
      const value = (p.price ?? 0) * stock;
      const prev = catMap.get(cat) ?? { skuCount: 0, totalQuantity: 0, totalValue: 0 };
      catMap.set(cat, {
        skuCount: prev.skuCount + 1,
        totalQuantity: prev.totalQuantity + stock,
        totalValue: prev.totalValue + value,
      });
    }
    return Array.from(catMap.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [products, stockMap]);

  const lowStockAlerts = useMemo(() => {
    const result: LowStockItem[] = [];
    for (const p of products) {
      const currentStock = stockMap[p.id] ?? 0;
      if (currentStock < p.reorder_point && p.reorder_point > 0) {
        result.push({
          id: p.id,
          name: p.name,
          sku: p.sku,
          currentStock,
          reorderPoint: p.reorder_point,
          suggestedOrder: Math.max(p.reorder_point - currentStock, 0),
        });
      }
    }
    return result.sort((a, b) => a.currentStock - b.currentStock);
  }, [products, stockMap]);

  const handleExport = async () => {
    const { exportToExcel } = await import("@/lib/documents/excel");

    const stockRows = products.map((p) => ({
      รหัส: p.sku,
      ชื่อสินค้า: p.name,
      หมวดหมู่: p.category ?? "",
      หน่วย: p.unit,
      สต็อกปัจจุบัน: stockMap[p.id] ?? 0,
      จุดสั่งซื้อซ้ำ: p.reorder_point,
      ราคา: p.price ?? 0,
      มูลค่าสต็อก: ((p.price ?? 0) * (stockMap[p.id] ?? 0)).toFixed(2),
    }));

    const lowStockRows = lowStockAlerts.map((item) => ({
      รหัส: item.sku,
      ชื่อสินค้า: item.name,
      สต็อกปัจจุบัน: item.currentStock,
      จุดสั่งซื้อซ้ำ: item.reorderPoint,
      จำนวนแนะนำให้สั่ง: item.suggestedOrder,
    }));

    const categoryRows = categorySummaries.map((cat) => ({
      หมวดหมู่: cat.category,
      จำนวนSKU: cat.skuCount,
      จำนวนรวม: cat.totalQuantity,
      มูลค่ารวม: cat.totalValue.toFixed(2),
    }));

    const fastMovingRows = fastMoving.map((item) => ({
      รหัส: item.sku,
      ชื่อสินค้า: item.name,
      จำนวนครั้งที่เบิก30วัน: item.stockOutCount,
    }));

    const dateStr = new Date().toISOString().slice(0, 10);

    exportToExcel(stockRows, [
      { header: "รหัส", key: "รหัส", width: 15 },
      { header: "ชื่อสินค้า", key: "ชื่อสินค้า", width: 30 },
      { header: "หมวดหมู่", key: "หมวดหมู่", width: 15 },
      { header: "หน่วย", key: "หน่วย", width: 8 },
      { header: "สต็อกปัจจุบัน", key: "สต็อกปัจจุบัน", width: 14 },
      { header: "จุดสั่งซื้อซ้ำ", key: "จุดสั่งซื้อซ้ำ", width: 14 },
      { header: "ราคา", key: "ราคา", width: 14 },
      { header: "มูลค่าสต็อก", key: "มูลค่าสต็อก", width: 14 },
    ], `รายงานสินค้า_${dateStr}`);

    exportToExcel(lowStockRows, [
      { header: "รหัส", key: "รหัส", width: 15 },
      { header: "ชื่อสินค้า", key: "ชื่อสินค้า", width: 30 },
      { header: "สต็อกปัจจุบัน", key: "สต็อกปัจจุบัน", width: 14 },
      { header: "จุดสั่งซื้อซ้ำ", key: "จุดสั่งซื้อซ้ำ", width: 14 },
      { header: "จำนวนแนะนำให้สั่ง", key: "จำนวนแนะนำให้สั่ง", width: 18 },
    ], `สินค้าต่ำกว่าเกณฑ์_${dateStr}`);

    exportToExcel(categoryRows, [
      { header: "หมวดหมู่", key: "หมวดหมู่", width: 20 },
      { header: "จำนวนSKU", key: "จำนวนSKU", width: 12 },
      { header: "จำนวนรวม", key: "จำนวนรวม", width: 12 },
      { header: "มูลค่ารวม", key: "มูลค่ารวม", width: 14 },
    ], `มูลค่าสต็อกตามหมวดหมู่_${dateStr}`);

    exportToExcel(fastMovingRows, [
      { header: "รหัส", key: "รหัส", width: 15 },
      { header: "ชื่อสินค้า", key: "ชื่อสินค้า", width: 30 },
      { header: "จำนวนครั้งที่เบิก30วัน", key: "จำนวนครั้งที่เบิก30วัน", width: 20 },
    ], `สินค้าหมุนเวียนเร็ว_${dateStr}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">รายงาน</h1>
        <p className="text-sm text-gray-500">ภาพรวมมูลค่าสต็อกและสถิติ</p>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <FileSpreadsheet className="h-4 w-4" />
          Export Excel
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-lg bg-indigo-100 p-3">
              <DollarSign className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalStockValue)}</p>
              <p className="text-sm text-gray-500">มูลค่าสต็อกรวม</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-lg bg-green-100 p-3">
              <Package className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{products.length.toLocaleString()}</p>
              <p className="text-sm text-gray-500">จำนวน SKU ทั้งหมด</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-lg bg-orange-100 p-3">
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{fastMoving.length}</p>
              <p className="text-sm text-gray-500">สินค้าหมุนเวียนเร็ว (Top 5)</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-lg bg-red-100 p-3">
              <Clock className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{slowMovingCount.toLocaleString()}</p>
              <p className="text-sm text-gray-500">สินค้าค้างนาน</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {fastMoving.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>สินค้าหมุนเวียนเร็ว (Top 5)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-6 py-3 text-left font-medium text-gray-500">ชื่อสินค้า</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">SKU</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">จำนวนครั้งที่เบิก (30 วัน)</th>
                </tr>
              </thead>
              <tbody>
                {fastMoving.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-6 py-3 font-medium">{item.name}</td>
                    <td className="px-6 py-3 font-mono text-xs text-gray-500">{item.sku}</td>
                    <td className="px-6 py-3 text-right font-semibold tabular-nums">
                      {item.stockOutCount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>มูลค่าสต็อกตามหมวดหมู่</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-6 py-3 text-left font-medium text-gray-500">หมวดหมู่</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">จำนวน SKU</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">จำนวนรวม</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">มูลค่ารวม</th>
              </tr>
            </thead>
            <tbody>
              {categorySummaries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">
                    ไม่มีข้อมูลหมวดหมู่
                  </td>
                </tr>
              ) : (
                categorySummaries.map((cat) => (
                  <tr key={cat.category} className="border-b border-gray-100 last:border-0">
                    <td className="px-6 py-3 font-medium">{cat.category}</td>
                    <td className="px-6 py-3 text-right tabular-nums">{cat.skuCount.toLocaleString()}</td>
                    <td className="px-6 py-3 text-right tabular-nums">{cat.totalQuantity.toLocaleString()}</td>
                    <td className="px-6 py-3 text-right font-semibold tabular-nums">
                      {formatCurrency(cat.totalValue)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>สินค้าคงเหลือต่ำกว่าเกณฑ์</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {lowStockAlerts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <AlertTriangle className="h-10 w-10 text-gray-300" />
              <p className="text-sm text-gray-400">ไม่มีสินค้าที่ต่ำกว่าเกณฑ์</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-6 py-3 text-left font-medium text-gray-500">สินค้า</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">SKU</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">สต็อกปัจจุบัน</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">จุดสั่งซื้อซ้ำ</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">จำนวนแนะนำให้สั่ง</th>
                </tr>
              </thead>
              <tbody>
                {lowStockAlerts.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-6 py-3 font-medium">{item.name}</td>
                    <td className="px-6 py-3 font-mono text-xs text-gray-500">{item.sku}</td>
                    <td className="px-6 py-3 text-right font-semibold text-red-600 tabular-nums">
                      {item.currentStock.toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">{item.reorderPoint.toLocaleString()}</td>
                    <td className="px-6 py-3 text-right font-semibold tabular-nums">
                      {item.suggestedOrder.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
