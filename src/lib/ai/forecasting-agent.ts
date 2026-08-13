import { forecastProduct as forecastFromTools } from "./tools";
import { chatWithGemini, isGeminiAvailable } from "./groq";
import type { ForecastResult } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function forecastProduct(
  productId: string,
  client?: SupabaseClient
): Promise<{
  success: boolean;
  data?: ForecastResult;
  insight?: string;
  error?: string;
}> {
  try {
    const result = await forecastFromTools(productId, client);
    if (!result) {
      return { success: false, error: "ไม่พบข้อมูลสินค้า" };
    }

    let insight = "";
    if (isGeminiAvailable()) {
      const prompt = `สินค้า ${result.productName} มียอดเบิกเฉลี่ย ${result.avgMonthlyOut} ชิ้น/เดือน สต็อกปัจจุบัน ${
        (await (await import("./tools")).getProductStock(productId, client))?.stock ?? 0
      } ชิ้น แนะนำสั่งซื้อ ${result.suggestedOrder} ชิ้น\nให้คำแนะนำสั้น ๆ เป็นภาษาไทย`;
      const ai = await chatWithGemini(prompt, { agentType: "forecast" });
      insight = ai.text;
    }

    return { success: true, data: result, insight };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการพยากรณ์",
    };
  }
}

export async function generateDraftPo(
  productId: string,
  client?: SupabaseClient
): Promise<{
  success: boolean;
  data?: { productName: string; suggestedOrder: number; reason: string };
  error?: string;
  requiresReview: boolean;
}> {
  try {
    const result = await forecastFromTools(productId, client);
    if (!result) {
      return { success: false, error: "ไม่พบข้อมูลสินค้า", requiresReview: false };
    }

    return {
      success: true,
      data: {
        productName: result.productName,
        suggestedOrder: result.suggestedOrder,
        reason: `ยอดเบิกเฉลี่ย ${result.avgMonthlyOut} ชิ้น/เดือน — ${
          result.confidence === "high"
            ? "ข้อมูลเพียงพอ"
            : result.confidence === "medium"
            ? "ข้อมูลปานกลาง"
            : "ข้อมูลน้อย ควรตรวจสอบก่อน"
        }`,
      },
      requiresReview: true,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "เกิดข้อผิดพลาด",
      requiresReview: false,
    };
  }
}
