import QRCode from "qrcode";

export interface QrLabelData {
  data: string;
  title: string;
  subtitle?: string;
  detail?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function printQrLabels(
  items: QrLabelData[],
  opts?: { cols?: number; size?: number }
) {
  const cols = opts?.cols ?? 2;
  const size = opts?.size ?? 140;

  const cells = await Promise.all(
    items.map(async (item) => ({
      ...item,
      url: await QRCode.toDataURL(item.data, {
        width: size,
        margin: 1,
        errorCorrectionLevel: "M",
      }),
    }))
  );

  const win = window.open("", "_blank", "width=800,height=600");
  if (!win) return;

  const labelsHtml = cells
    .map(
      (c) => `
        <div class="label">
          <div class="brand">ARGO</div>
          <img src="${c.url}" width="${size}" height="${size}" />
          <div class="name">${escapeHtml(c.title)}</div>
          ${c.subtitle ? `<div class="sub">${escapeHtml(c.subtitle)}</div>` : ""}
          ${c.detail ? `<div class="sub">${escapeHtml(c.detail)}</div>` : ""}
        </div>`
    )
    .join("");

  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>พิมพ์ป้าย QR</title>
    <style>
      @page { size: A4; margin: 10mm; }
      body { font-family: 'Sarabun', 'TH Sarabun New', Tahoma, sans-serif; margin: 0; }
      .grid { display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 8mm; }
      .label {
        border: 1px dashed #94a3b8; border-radius: 6px; padding: 4mm 3mm;
        text-align: center; display: flex; flex-direction: column; align-items: center; gap: 2mm;
        break-inside: avoid; page-break-inside: avoid;
      }
      .brand { font-size: 10px; font-weight: 700; color: #1e3a5f; letter-spacing: 2px; }
      .name { font-size: 12px; font-weight: 700; color: #1e293b; line-height: 1.3; }
      .sub { font-size: 10px; color: #64748b; }
      img { display: block; }
    </style></head><body>
    <div class="grid">${labelsHtml}</div>
    <script>window.onload = function() { window.print(); }</script>
  </body></html>`);
  win.document.close();
}
