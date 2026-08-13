export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function generateSku(name: string, category?: string): string {
  const prefix = category ? category.substring(0, 3).toUpperCase() : "GEN";
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}${random}`;
}

export function generatePoNumber(): string {
  const date = new Date();
  const yymmdd = date
    .toISOString()
    .slice(2, 10)
    .replace(/-/g, "");
  const seq = Math.floor(Math.random() * 999)
    .toString()
    .padStart(3, "0");
  return `PO-${yymmdd}-${seq}`;
}
