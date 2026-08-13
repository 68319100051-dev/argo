import { checkRateLimit, handleRateLimitError } from "./rate-limit-guard";
import { answerQuestion } from "./chat-agent";
import { forecastProduct, detectAnomalies, getLowStockProducts } from "./tools";
import type { AgentResult } from "./types";

export type Intent = "query" | "forecast" | "anomaly" | "ocr" | "write";

function detectIntent(input: string): Intent {
  const lower = input.toLowerCase();
  if (lower.includes("พยากรณ์") || lower.includes("forecast") || lower.includes("คาดการณ์") || lower.includes("แนวโน้ม")) {
    return "forecast";
  }
  if (lower.includes("ผิดปกติ") || lower.includes("anomaly") || lower.includes("ปัญหา") || lower.includes("ตรวจ")) {
    return "anomaly";
  }
  if (lower.includes("ocr") || lower.includes("รูป") || lower.includes("ภาพ") || lower.includes("เอกสาร") || lower.includes("สแกนเอกสาร")) {
    return "ocr";
  }
  if (lower.includes("เบิก") || lower.includes("สร้าง") || lower.includes("เพิ่ม") || lower.includes("ลบ") || lower.includes("แก้ไข") || lower.includes("ปรับ")) {
    return "write";
  }
  return "query";
}

export async function orchestrate(
  input: string,
  context?: { page?: string; pageData?: Record<string, unknown> }
): Promise<AgentResult> {
  const { allowed, retryAfter } = checkRateLimit();
  if (!allowed) {
    return {
      success: false,
      error: `ระบบ AI กำลังรับคำขอจำนวนมาก กรุณารอ ${retryAfter} วินาที`,
    };
  }

  try {
    const intent = detectIntent(input);

    switch (intent) {
      case "query": {
        const result = await answerQuestion(input, context);
        return {
          success: result.success,
          data: result.answer,
          error: result.error,
        };
      }

      case "forecast": {
        const allProducts = await getLowStockProducts();
        const forecasts = [];
        for (const p of allProducts.slice(0, 5)) {
          const f = await forecastProduct(p.id);
          if (f) forecasts.push(f);
        }
        return {
          success: true,
          data: forecasts.length > 0
            ? `ผลการพยากรณ์:\n${forecasts.map((f) => `- ${f.productName}: ออกเฉลี่ย ${f.avgMonthlyOut} ชิ้น/เดือน, แนะนำสั่งซื้อ ${f.suggestedOrder} ชิ้น (ความเชื่อมั่น: ${f.confidence === "high" ? "สูง" : f.confidence === "medium" ? "ปานกลาง" : "ต่ำ"})`).join("\n")}`
            : "ไม่พบข้อมูลเพียงพอสำหรับการพยากรณ์",
        };
      }

      case "anomaly": {
        const anomalies = await detectAnomalies();
        if (anomalies.length === 0) {
          return { success: true, data: "✅ ไม่พบความผิดปกติในสต็อก" };
        }
        const high = anomalies.filter((a) => a.severity === "high");
        const med = anomalies.filter((a) => a.severity === "medium");
        return {
          success: true,
          data: `พบ ${anomalies.length} รายการ:\n${high.length > 0 ? `\n🔴 สําคัญสูง (${high.length}):\n${high.map((a) => `- ${a.description}`).join("\n")}` : ""}${med.length > 0 ? `\n🟡 ปานกลาง (${med.length}):\n${med.map((a) => `- ${a.description}`).join("\n")}` : ""}`,
          requiresReview: high.length > 0,
        };
      }

      case "ocr":
        return {
          success: false,
          error: "OCR Agent: รองรับเฉพาะการอัปโหลดรูปภาพเท่านั้น — ใช้หน้ารับสินค้าเพื่อสแกนเอกสาร",
        };

      case "write": {
        return {
          success: true,
          data: `⚠️ คำสั่ง "${input}" ต้องได้รับการยืนยันก่อนดำเนินการ — ไปที่หน้า Agent Inbox เพื่อตรวจสอบ`,
          requiresReview: true,
        };
      }

      default:
        return { success: false, error: "ไม่สามารถเข้าใจคำสั่งได้ กรุณาลองใหม่" };
    }
  } catch (err) {
    handleRateLimitError();
    return {
      success: false,
      error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดจาก AI service",
    };
  }
}
