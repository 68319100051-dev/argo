import { detectAnomalies as detectAnomaliesFromTools } from "./tools";
import { chatWithGemini, isGeminiAvailable } from "./groq";
import type { AnomalyResult } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function analyzeAnomalies(client?: SupabaseClient): Promise<{
  success: boolean;
  data?: AnomalyResult[];
  analysis?: string;
  error?: string;
}> {
  try {
    const anomalies = await detectAnomaliesFromTools(client);

    if (anomalies.length === 0) {
      return {
        success: true,
        data: [],
        analysis: "✅ ไม่พบความผิดปกติในสต็อก",
      };
    }

    let analysisText = "";
    if (isGeminiAvailable()) {
      const prompt = `คุณคือผู้เชี่ยวชาญด้านสต็อกสินค้า วิเคราะห์ความผิดปกติต่อไปนี้และให้คำแนะนำ:\n${anomalies.map((a, i) => `${i + 1}. ${a.description} (ระดับ: ${a.severity})`).join("\n")}\n\nให้คำแนะนำเป็นภาษาไทย สั้น กระชับ`;
      const result = await chatWithGemini(prompt, { agentType: "anomaly" });
      analysisText = result.text;
    } else {
      const highCount = anomalies.filter((a) => a.severity === "high").length;
      analysisText = `พบ ${anomalies.length} รายการ (สำคัญสูง ${highCount} รายการ) — ตั้งค่า GROQ_API_KEY เพื่อรับคำแนะนำอัตโนมัติ`;
    }

    return { success: true, data: anomalies, analysis: analysisText };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการตรวจสอบความผิดปกติ",
    };
  }
}
