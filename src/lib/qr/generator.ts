export function generateQrPayload(params: {
  productId: string;
  lotId?: string;
  lotNumber?: string;
  location?: string;
}): string {
  const payload: Record<string, string> = {
    type: "argo",
    v: "1",
    pid: params.productId,
  };
  if (params.lotId) payload.lid = params.lotId;
  if (params.lotNumber) payload.lot = params.lotNumber;
  if (params.location) payload.loc = params.location;
  return JSON.stringify(payload);
}

export function parseQrPayload(data: string): {
  type: string;
  productId: string;
  lotId?: string;
  lotNumber?: string;
  location?: string;
} | null {
  try {
    const parsed = JSON.parse(data);
    if (parsed.type !== "argo") return null;
    return {
      type: parsed.type,
      productId: parsed.pid,
      lotId: parsed.lid,
      lotNumber: parsed.lot,
      location: parsed.loc,
    };
  } catch {
    return null;
  }
}
