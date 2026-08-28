import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chatWithGemini, isGeminiAvailable, checkAgentBudget } from "@/lib/ai/groq";
import { checkRateLimit } from "@/lib/ai/rate-limit-guard";
import {
  getStockSummary,
  getLowStockProducts,
  getRecentMovements,
  getAllProducts,
} from "@/lib/ai/tools";
import type { SupabaseClient } from "@supabase/supabase-js";

async function buildFullContext(client: SupabaseClient): Promise<string> {
  const parts: string[] = [];

  const summary = await getStockSummary(client);
  parts.push(`ภาพรวม: สินค้า ${summary.totalProducts} รายการ, สต็อกรวม ${summary.totalStock} ชิ้น, ใกล้หมด ${summary.lowStockCount} รายการ, หมดอายุ ${summary.expiredCount} รายการ`);

  const allItems = await getAllProducts(client);
  if (allItems.length > 0) {
    const byCategory: Record<string, typeof allItems> = {};
    for (const item of allItems) {
      const cat = item.category || "ไม่มีหมวด";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);
    }
    const categoryList = Object.entries(byCategory)
      .map(([cat, items]) => `[${cat}] ${items.map((i) => `${i.name}(${i.sku}:${i.stock}${i.unit})`).join(", ")}`)
      .join("\n");
    parts.push(`สินค้าทั้งหมด:\n${categoryList}`);
  } else {
    parts.push("ไม่มีสินค้าในระบบ");
  }

  const lowItems = await getLowStockProducts(undefined, client);
  if (lowItems.length > 0) {
    parts.push(`สินค้าใกล้หมด (${lowItems.length} รายการ): ${lowItems.map((i) => `${i.name} เหลือ ${i.stock}${i.unit}`).join(", ")}`);
  }

  const movements = await getRecentMovements(7, client);
  if (movements.length > 0) {
    parts.push(`การเคลื่อนไหว 7 วันล่าสุด:\n${movements.slice(0, 15).map((m) => `- ${m.date}: ${m.movement_type === "stock_in" ? "รับเข้า" : m.movement_type === "stock_out" ? "เบิกออก" : m.movement_type} ${Math.abs(m.quantity_change)} ชิ้น${m.note ? ` (${m.note})` : ""}`).join("\n")}`);
  }

  return parts.join("\n\n");
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
  const history: Array<{ role: "user" | "assistant"; content: string }> = Array.isArray(body?.history) ? body.history : [];
  if (!question) {
    return NextResponse.json({ error: "กรุณาระบุคำถาม" }, { status: 400 });
  }

  try {
    const client = supabase as unknown as SupabaseClient;
    const dataContext = await buildFullContext(client);

    console.log("[AI Chat] context length:", dataContext.length);
    console.log("[AI Chat] context preview:", dataContext.substring(0, 500));

    const userMessage = `ข้อมูลจากระบบ:\n${dataContext}\n\nคำถาม: ${question}`;

    const formattedHistory = history.slice(-10).map((m) => ({
      role: m.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: m.content }],
    }));

    const result = await chatWithGemini(userMessage, {
      agentType: "chat",
      history: formattedHistory,
    });

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