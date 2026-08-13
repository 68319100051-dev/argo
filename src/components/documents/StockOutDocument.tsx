"use client";

import { PrintStyles, DocHeader, DocTable, DocSignatures, DocFooter } from "./PrintStyles";
import { exportToExcel } from "@/lib/documents/excel";
import { Button } from "@/components/ui/Button";
import { Printer, FileSpreadsheet } from "lucide-react";

interface OutItem {
  number: number;
  productName: string;
  productSku: string;
  lotNumber: string | null;
  quantity: number;
  unit: string;
  location: string | null;
}

interface StockOutData {
  docNumber: string;
  date: string;
  requester: string | null;
  items: OutItem[];
  note: string | null;
}

export function StockOutDocument({ data }: { data: StockOutData }) {
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
    ], `เบิกสินค้า-${data.docNumber}`);
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
        <DocHeader title="ใบเบิกสินค้า" docNumber={data.docNumber} date={data.date} />

        {data.requester && (
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 12 }}>
            ผู้เบิก: {data.requester}
          </div>
        )}

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
            { label: "ผู้เบิก" },
            { label: "ผู้อนุมัติ" },
            { label: "ผู้จ่ายสินค้า" },
          ]}
        />

        <DocFooter text="เอกสารนี้สร้างจากระบบ ARGO Stock Management" />
      </div>
    </div>
  );
}
