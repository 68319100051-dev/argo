import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chatWithGemini, isGeminiAvailable, checkAgentBudget } from "@/lib/ai/groq";
import { checkRateLimit } from "@/lib/ai/rate-limit-guard";
import {
  getStockSummary,
  getLowStockProducts,
  getRecentMovements,
  searchProducts,
  getAllProducts,
} from "@/lib/ai/tools";
import type { SupabaseClient } from "@supabase/supabase-js";

function detectIntent(input: string): "summary" | "low_stock" | "movements" | "search" | "list" | "other" {
  const q = input.toLowerCase();
  if (q.includes("สรุป") || q.includes("ภาพรวม") || q.includes("dashboard")) return "summary";
  if (q.includes("ต่ำ") || q.includes("ใกล้หมด") || q.includes("low stock") || q.includes("หมดสต็อก")) return "low_stock";
  if (q.includes("เคลื่อนไหว") || q.includes("ประวัติ") || q.includes("movement") || q.includes("รายการล่าสุด") || q.includes("เบิก") || q.includes("รับเข้า")) return "movements";
  if (q.includes("มีสินค้าอะไร") || q.includes("มีอะไร") || q.includes("รายการสินค้า") || q.includes("มีของ")) return "list";
  if (q.includes("ค้น") || q.includes("หา") || q.includes("search") || q.includes("ดูข้อมูล")) return "search";
  return "other";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, retryAfter } = checkRateLimit(user.id, 30);
  if (!allowed) {
    return NextResponse.json(
      { error: `ระบบกำลังรับคำขอจำนวนมาก กรุณารอ ${retryAfter} วินาที` },
      { status: 429 }
    );
  }

  // Check AI settings: is chat enabled
  const { data: setting } = await supabase
    .from("ai_settings")
    .select("is_enabled")
    .eq("agent_type", "chat")
    .maybeSingle();
  if (setting && setting.is_enabled === false) {
    return NextResponse.json({ error: "AI Chat ถูกปิดใช้งานโดยผู้ดูแลระบบ" }, { status: 403 });
  }

  const budget = await checkAgentBudget(supabase, "chat");
  if (!budget.allowed) {
    return NextResponse.json(
      { error: `AI Chat ถึงขีดจำกัดงบประมาณแล้ว (${budget.used}/${budget.limit}) กรุณาติดต่อผู้ดูแลระบบ` },
      { status: 429 }
    );
  }

  if (!isGeminiAvailable()) {
    return NextResponse.json(
      { error: "ยังไม่ได้ตั้งค่า GROQ_API_KEY — กรุณาเพิ่มใน .env.local" },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const question = String(body?.message ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "กรุณาระบุคำถาม" }, { status: 400 });
  }

  try {
    const client = supabase as unknown as SupabaseClient;
    let dataContext = "";

    switch (detectIntent(question)) {
      case "summary": {
        const summary = await getStockSummary(client);
        dataContext = `ภาพรวมสต็อก: สินค้าทั้งหมด ${summary.totalProducts} รายการ, สต็อกรวม ${summary.totalStock} ชิ้น, สินค้าใกล้หมด ${summary.lowStockCount} รายการ, การเคลื่อนไหว 7 วัน ${summary.recentMovements} รายการ`;
        break;
      }
      case "low_stock": {
        const items = await getLowStockProducts(undefined, client);
        dataContext =
          items.length === 0
            ? "ไม่มีสินค้าที่ใกล้หมดสต็อก"
            : `สินค้าที่ใกล้หมด:\n${items.map((i) => `- ${i.name} (${i.sku}): คงเหลือ ${i.stock} ${i.unit}`).join("\n")}`;
        break;
      }
      case "movements": {
        const movements = await getRecentMovements(7, client);
        dataContext =
          movements.length === 0
            ? "ไม่พบการเคลื่อนไหวใน 7 วันที่ผ่านมา"
            : `การเคลื่อนไหวล่าสุด:\n${movements
                .slice(0, 10)
                .map(
                  (m) =>
                    `- ${m.date}: ${
                      m.movement_type === "stock_in"
                        ? "รับเข้า"
                        : m.movement_type === "stock_out"
                        ? "เบิกออก"
                        : m.movement_type
                    } ${Math.abs(m.quantity_change)} ชิ้น${m.note ? ` (${m.note})` : ""}`
                )
                .join("\n")}`;
        break;
      }
      case "search": {
        const term = question.replace(/ค้น|หา|search|สินค้า/gi, "").trim();
        if (term) {
          const results = await searchProducts(term, client);
          dataContext =
            results.length === 0
              ? `ไม่พบสินค้าที่ค้นหา "${term}"`
              : `ผลการค้นหา "${term}":\n${results
                  .map((r) => `- ${r.name} (${r.sku}): ${r.stock} ${r.unit}${r.category ? ` [${r.category}]` : ""}`)
                  .join("\n")}`;
        } else {
          dataContext = "กรุณาระบุคำค้นหาสินค้า";
        }
        break;
      }
      case "list": {
        const items = await getAllProducts(client);
        dataContext =
          items.length === 0
            ? "ไม่มีสินค้าในระบบ"
            : `รายการสินค้าทั้งหมด (${items.length} รายการ):\n${items
                .map((i) => `- ${i.name} (${i.sku}): คงเหลือ ${i.stock} ${i.unit}${i.category ? ` [${i.category}]` : ""}`)
                .join("\n")}`;
        break;
      }
      default:
        dataContext = "";
    }

    const result = await chatWithGemini(
      `ข้อมูลจากระบบ (ถ้ามี):\n${dataContext || "ไม่มี"}\n\nคำถาม: ${question}`,
      { agentType: "chat" }
    );

    // Log to agent_activity_log
    await supabase.from("agent_activity_log").insert({
      agent_type: "chat",
      action: "answer_question",
      summary: question,
      details: { question, answer: result.text },
      requires_review: false,
      created_by: user.id,
    });

    return NextResponse.json({ answer: result.text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดจาก AI service";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}