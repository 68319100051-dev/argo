"use client";

import { PrintStyles, DocHeader, DocTable, DocSignatures, DocFooter } from "./PrintStyles";
import { exportToExcel } from "@/lib/documents/excel";
import { Button } from "@/components/ui/Button";
import { Printer, FileSpreadsheet } from "lucide-react";

interface InItem {
  number: number;
  productName: string;
  productSku: string;
  lotNumber: string | null;
  quantity: number;
  unit: string;
  location: string | null;
}

interface StockInData {
  docNumber: string;
  date: string;
  reference: string | null;
  items: InItem[];
  note: string | null;
  receiver: string | null;
}

export function StockInDocument({ data }: { data: StockInData }) {
  const handlePrint = () => window.print();
  const handleExcel = () => {
    const rows = data.items.map((item) => ({
      "ลำดับ": item.number,
      "รหัสสินค้า": item.productSku,
      "ชื่อสินค้า": item.productName,
      "ล็อต": item.lotNumber ?? "-",
      "จำนวน": item.quantity,
      "หน่วย": item.unit,
      "ตำแหน่ง": item.location ?? "-",
    }));
    exportToExcel(rows, [
      { header: "ลำดับ", key: "ลำดับ", width: 8 },
      { header: "รหัสสินค้า", key: "รหัสสินค้า", width: 15 },
      { header: "ชื่อสินค้า", key: "ชื่อสินค้า", width: 30 },
      { header: "ล็อต", key: "ล็อต", width: 15 },
      { header: "จำนวน", key: "จำนวน", width: 10 },
      { header: "หน่วย", key: "หน่วย", width: 8 },
      { header: "ตำแหน่ง", key: "ตำแหน่ง", width: 15 },
    ], `รับสินค้า-${data.docNumber}`);
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

      <div style={{ padding: 4 }}>
        <DocHeader title="ใบรับสินค้า" docNumber={data.docNumber} date={data.date} />

        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", marginBottom: 12 }}>
          <tbody>
            {data.reference && (
              <tr>
                <td style={{ width: 120, color: "#64748b", padding: "2px 8px" }}>อ้างอิง</td>
                <td style={{ color: "#1e293b", padding: "2px 8px" }}>{data.reference}</td>
              </tr>
            )}
            {data.receiver && (
              <tr>
                <td style={{ color: "#64748b", padding: "2px 8px" }}>ผู้รับสินค้า</td>
                <td style={{ color: "#1e293b", padding: "2px 8px" }}>{data.receiver}</td>
              </tr>
            )}
          </tbody>
        </table>

        <DocTable
          headers={["ลำดับ", "รหัสสินค้า", "ชื่อสินค้า", "ล็อต", "จำนวน", "หน่วย", "ตำแหน่ง"]}
          rows={data.items.map((item) => [
            item.number,
            item.productSku,
            item.productName,
            item.lotNumber ?? "-",
            item.quantity.toLocaleString(),
            item.unit,
            item.location ?? "-",
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
          รวมจำนวน: {data.items.reduce((s, i) => s + i.quantity, 0).toLocaleString()} ชิ้น
        </div>

        {data.note && (
          <div style={{ marginTop: 12, fontSize: 11, color: "#64748b" }}>
            <div style={{ fontWeight: 600 }}>หมายเหตุ:</div>
            <div>{data.note}</div>
          </div>
        )}

        <DocSignatures
          items={[
            { label: "ผู้ส่งสินค้า" },
            { label: "ผู้รับสินค้า" },
            { label: "ผู้ตรวจสอบ" },
          ]}
        />

        <DocFooter text="เอกสารนี้สร้างจากระบบ ARGO Stock Management" />
      </div>
    </div>
  );
}
