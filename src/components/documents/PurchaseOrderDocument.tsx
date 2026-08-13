"use client";

import { useRef } from "react";
import { PrintStyles, DocHeader, DocTable, DocSignatures, DocFooter } from "./PrintStyles";
import { exportToExcel } from "@/lib/documents/excel";
import { Button } from "@/components/ui/Button";
import { Printer, FileSpreadsheet } from "lucide-react";

interface PoItem {
  number: number;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit: string;
  price: number;
  total: number;
}

interface PoData {
  poNumber: string;
  supplierName: string;
  supplierCode: string;
  orderDate: string;
  expectedDate: string | null;
  status: string;
  items: PoItem[];
  totalAmount: number;
  notes: string | null;
  createdByName: string | null;
}

export function PurchaseOrderDocument({ data }: { data: PoData }) {
  const ref = useRef<HTMLDivElement>(null);

  const statusLabel: Record<string, string> = {
    draft: "แบบร่าง",
    pending_approval: "รออนุมัติ",
    approved: "อนุมัติแล้ว",
    received: "รับแล้ว",
    cancelled: "ยกเลิก",
  };

  const handlePrint = () => window.print();

  const handleExcel = () => {
    const items = data.items.map((item) => ({
      "ลำดับ": item.number,
      "รหัสสินค้า": item.product_sku,
      "ชื่อสินค้า": item.product_name,
      "จำนวน": item.quantity,
      "หน่วย": item.unit,
      "ราคาต่อหน่วย": item.price,
      "รวม": item.total,
    }));
    exportToExcel(items, [
      { header: "ลำดับ", key: "ลำดับ", width: 8 },
      { header: "รหัสสินค้า", key: "รหัสสินค้า", width: 15 },
      { header: "ชื่อสินค้า", key: "ชื่อสินค้า", width: 30 },
      { header: "จำนวน", key: "จำนวน", width: 10 },
      { header: "หน่วย", key: "หน่วย", width: 8 },
      { header: "ราคาต่อหน่วย", key: "ราคาต่อหน่วย", width: 15 },
      { header: "รวม", key: "รวม", width: 15 },
    ], `PO-${data.poNumber}`);
  };

  return (
    <div>
      <PrintStyles />
      <div className="no-print mb-4 flex gap-2">
        <Button size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4" />
          พิมพ์ / PDF
        </Button>
        <Button size="sm" variant="outline" onClick={handleExcel}>
          <FileSpreadsheet className="h-4 w-4" />
          Excel
        </Button>
      </div>

      <div ref={ref} style={{ padding: 4 }}>
        <DocHeader
          title="ใบสั่งซื้อ"
          docNumber={data.poNumber}
          date={data.orderDate}
        />

        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", marginBottom: 16 }}>
          <tbody>
            <tr>
              <td style={{ width: 120, color: "#64748b", padding: "2px 8px" }}>ซัพพลายเออร์</td>
              <td style={{ fontWeight: 600, color: "#1e293b", padding: "2px 8px" }}>
                {data.supplierName} ({data.supplierCode})
              </td>
              <td style={{ width: 120, color: "#64748b", padding: "2px 8px" }}>สถานะ</td>
              <td style={{ fontWeight: 600, color: "#1e293b", padding: "2px 8px" }}>
                {statusLabel[data.status] ?? data.status}
              </td>
            </tr>
            <tr>
              <td style={{ color: "#64748b", padding: "2px 8px" }}>วันที่คาดว่าได้รับ</td>
              <td style={{ color: "#1e293b", padding: "2px 8px" }}>
                {data.expectedDate ?? "-"}
              </td>
              <td style={{ color: "#64748b", padding: "2px 8px" }}>ผู้สร้าง</td>
              <td style={{ color: "#1e293b", padding: "2px 8px" }}>
                {data.createdByName ?? "-"}
              </td>
            </tr>
          </tbody>
        </table>

        <DocTable
          headers={["ลำดับ", "รหัสสินค้า", "ชื่อสินค้า", "จำนวน", "หน่วย", "ราคาต่อหน่วย", "รวม"]}
          rows={data.items.map((item) => [
            item.number,
            item.product_sku,
            item.product_name,
            item.quantity.toLocaleString(),
            item.unit,
            item.price.toLocaleString(),
            item.total.toLocaleString(),
          ])}
        />

        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: 12,
          fontSize: 14,
          fontWeight: 700,
          color: "#1e3a5f",
        }}>
          รวมทั้งสิ้น: {data.totalAmount.toLocaleString()} บาท
        </div>

        {data.notes && (
          <div style={{ marginTop: 12, fontSize: 11, color: "#64748b" }}>
            <div style={{ fontWeight: 600 }}>หมายเหตุ:</div>
            <div>{data.notes}</div>
          </div>
        )}

        <DocSignatures
          items={[
            { label: "ผู้ขอซื้อ" },
            { label: "ผู้อนุมัติ", name: undefined },
            { label: "ผู้รับสินค้า" },
          ]}
        />

        <DocFooter text="เอกสารนี้สร้างจากระบบ ARGO Stock Management" />
      </div>
    </div>
  );
}
