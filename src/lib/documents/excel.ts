import * as XLSX from "xlsx";

interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  columns: ExcelColumn[],
  filename: string
) {
  const wb = XLSX.utils.book_new();

  const headers = columns.map((c) => c.header);
  const rows = data.map((row) =>
    columns.map((c) => row[c.key] ?? "")
  );
  const wsData = [headers, ...rows];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  columns.forEach((c, i) => {
    if (c.width) {
      ws["!cols"] = ws["!cols"] ?? [];
      ws["!cols"][i] = { wch: c.width };
    }
  });

  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function triggerPrint() {
  window.print();
}
