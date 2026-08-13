import { isGeminiAvailable, chatWithGemini } from "./groq";
import { checkRateLimit } from "./rate-limit-guard";
import {
  searchProducts,
  getStockSummary,
  getLowStockProducts,
  getRecentMovements,
} from "./tools";

export async function answerQuestion(
  question: string,
  context?: { page?: string; pageData?: Record<string, unknown> }
): Promise<{ success: boolean; answer?: string; error?: string }> {
  const { allowed, retryAfter } = checkRateLimit();
  if (!allowed) {
    return { success: false, error: `ระบบกำลังรับคำขอจำนวนมาก กรุณารอ ${retryAfter} วินาที` };
  }

  if (!isGeminiAvailable()) {
    return { success: false, error: "ยังไม่ได้ตั้งค่า GROQ_API_KEY — กรุณาเพิ่มใน .env.local" };
  }

  try {
    const query = question.toLowerCase();
    let dataContext = "";

    if (query.includes("สรุป") || query.includes("ภาพรวม") || query.includes("dashboard")) {
      const summary = await getStockSummary();
      dataContext = `ภาพรวมสต็อก: สินค้าทั้งหมด ${summary.totalProducts} รายการ, สต็อกรวม ${summary.totalStock} ชิ้น, สินค้าใกล้หมด ${summary.lowStockCount} รายการ, การเคลื่อนไหว 7 วัน ${summary.recentMovements} รายการ`;
    } else if (query.includes("ต่ำ") || query.includes("ใกล้หมด") || query.includes("low stock")) {
      const items = await getLowStockProducts();
      if (items.length === 0) {
        dataContext = "ไม่มีสินค้าที่ใกล้หมดสต็อก";
      } else {
        dataContext = `สินค้าที่ใกล้หมด:\n${items.map((i) => `- ${i.name} (${i.sku}): คงเหลือ ${i.stock} ${i.unit}`).join("\n")}`;
      }
    } else if (query.includes("เคลื่อนไหว") || query.includes("ประวัติ") || query.includes(" movement") || query.includes("รายการล่าสุด")) {
      const movements = await getRecentMovements();
      if (movements.length === 0) {
        dataContext = "ไม่พบการเคลื่อนไหวใน 7 วันที่ผ่านมา";
      } else {
        dataContext = `การเคลื่อนไหวล่าสุด:\n${movements.slice(0, 10).map((m) => `- ${m.date}: ${m.movement_type === "stock_in" ? "รับเข้า" : m.movement_type === "stock_out" ? "เบิกออก" : m.movement_type} ${Math.abs(m.quantity_change)} ชิ้น${m.note ? ` (${m.note})` : ""}`).join("\n")}`;
      }
    } else if (query.includes("ค้น") || query.includes("หา") || query.includes("search")) {
      const searchTerm = question.replace(/ค้น|หา|search|สินค้า/gi, "").trim();
      if (searchTerm) {
        const results = await searchProducts(searchTerm);
        if (results.length === 0) {
          dataContext = `ไม่พบสินค้าที่ค้นหา "${searchTerm}"`;
        } else {
          dataContext = `ผลการค้นหา "${searchTerm}":\n${results.map((r) => `- ${r.name} (${r.sku}): ${r.stock} ${r.unit}${r.category ? ` [${r.category}]` : ""}`).join("\n")}`;
        }
      } else {
        dataContext = "กรุณาระบุคำค้นหาสินค้า";
      }
    }

    const contextText = context?.page ? `(ขณะนี้หน้าจอ: ${context.page})` : "";
    const userMessage = dataContext
      ? `ข้อมูลจากระบบ:\n${dataContext}\n\nคำถาม: ${question}`
      : question;

    const result = await chatWithGemini(`${contextText}\n\n${userMessage}`, {
      agentType: "chat",
    });
    return { success: true, answer: result.text };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "เกิดข้อผิดพลาด" };
  }
}
