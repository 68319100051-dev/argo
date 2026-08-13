import { isGeminiAvailable, chatWithGemini } from "./groq";

export interface OcrResult {
  items: Array<{ sku?: string; name?: string; quantity?: number; unit?: string }>;
  supplierName?: string;
  documentDate?: string;
}

export async function processDeliveryImage(
  imageBase64: string
): Promise<{
  success: boolean;
  data?: OcrResult;
  error?: string;
  requiresReview: boolean;
}> {
  if (!imageBase64) {
    return { success: false, error: "กรุณาแนบรูปภาพ", requiresReview: false };
  }

  if (!isGeminiAvailable()) {
    return {
      success: false,
      error: "OCR Agent ต้องใช้ GROQ_API_KEY — กรุณาเพิ่มใน .env.local",
      requiresReview: false,
    };
  }

  try {
    const prompt = `คุณคือ OCR สำหรับเอกสารใบส่งของ/ใบแจ้งหนี้ภาษาไทย สกัดข้อมูลต่อไปนี้จากภาพ:

1. รายการสินค้า: ชื่อ, SKU (ถ้ามี), จำนวน, หน่วย
2. ชื่อผู้ขาย/ซัพพลายเออร์
3. วันที่ในเอกสาร

ตอบเป็น JSON:
{
  "items": [{ "name": "...", "sku": "...", "quantity": 0, "unit": "..." }],
  "supplierName": "...",
  "documentDate": "YYYY-MM-DD"
}`;

    const stripped = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const result = await chatWithGemini(prompt, {
      imageBase64: stripped,
      responseMimeType: "application/json",
    });

    const parsed: OcrResult = JSON.parse(result.text);
    return {
      success: true,
      data: parsed,
      requiresReview: true,
    };
  } catch (err) {
    if (err instanceof SyntaxError) {
      return {
        success: false,
        error: "OCR Agent: รูปแบบข้อมูลไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง",
        requiresReview: false,
      };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการประมวลผลภาพ",
      requiresReview: false,
    };
  }
}
