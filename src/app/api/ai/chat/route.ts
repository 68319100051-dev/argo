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
  if (q.includes("มีสินค้าอะไร") || q.includes("มีอะไร") || q.includes("รายการสินค้า") || q.includes("มีของ") || q.includes("มีอะไรบ้าง") || q.includes("กี่อย่าง") || q.includes("ทั้งหมด") || q.includes("list")) return "list";
  if (q.includes("ค้น") || q.includes("หา") || q.includes("search") || q.includes("ดูข้อมูล") || q.includes("เครื่องดื่ม") || q.includes("อาหาร") || q.includes("หมวด")) return "search";
  return "other";
}

async function buildFullContext(client: SupabaseClient, question: string): Promise<string> {
  const intent = detectIntent(question);
  const parts: string[] = [];

  const summary = await getStockSummary(client);
  parts.push(`ภาพรวมระบบ: สินค้า ${summary.totalProducts} รายการ, สต็อกรวม ${summary.totalStock} ชิ้น, ใกล้หมด ${summary.lowStockCount} รายการ`);

  if (intent === "low_stock") {
    const items = await getLowStockProducts(undefined, client);
    parts.push(items.length === 0 ? "ไม่มีสินค้าใกล้หมด" : `สินค้าใกล้หมด:\n${items.map((i) => `- ${i.name} (${i.sku}): คงเหลือ ${i.stock} ${i.unit}`).join("\n")}`);
  } else {
    const lowItems = await getLowStockProducts(undefined, client);
    if (lowItems.length > 0) {
      parts.push(`สินค้าใกล้หมด (${lowItems.length} รายการ): ${lowItems.map((i) => `${i.name} เหลือ ${i.stock}${i.unit}`).join(", ")}`);
    }
  }

  if (intent === "movements") {
    const movements = await getRecentMovements(7, client);
    parts.push(movements.length === 0 ? "ไม่มีการเคลื่อนไหว 7 วัน" : `การเคลื่อนไหว 7 วันล่าสุด:\n${movements.slice(0, 15).map((m) => `- ${m.date}: ${m.movement_type === "stock_in" ? "รับเข้า" : m.movement_type === "stock_out" ? "เบิกออก" : m.movement_type} ${Math.abs(m.quantity_change)} ชิ้น${m.note ? ` (${m.note})` : ""}`).join("\n")}`);
  }

  if (intent === "search") {
    const term = question.replace(/ค้น|หา|search|สินค้า|มี|อะไรบ้าง|เครื่องดื่ม|อาหาร|หมวด/gi, "").trim();
    let results = term ? await searchProducts(term, client) : [];
    if (results.length === 0 && term) {
      const allItems = await getAllProducts(client);
      results = allItems.filter((i) => i.category?.toLowerCase().includes(term.toLowerCase()));
    }
    parts.push(results.length === 0 ? `ไม่พบ "${term}"` : `ผลค้นหา "${term}" (${results.length} รายการ):\n${results.map((r) => `- ${r.name} (${r.sku}): ${r.stock} ${r.unit}${r.category ? ` [${r.category}]` : ""}`).join("\n")}`);
  }

  if (intent === "list") {
    const items = await getAllProducts(client);
    parts.push(items.length === 0 ? "ไม่มีสินค้า" : `สินค้าทั้งหมด ${items.length} รายการ:\n${items.map((i) => `- ${i.name} (${i.sku}): ${i.stock} ${i.unit}${i.category ? ` [${i.category}]` : ""}`).join("\n")}`);
  }

  const movements = await getRecentMovements(3, client);
  if (movements.length > 0 && intent !== "movements") {
    parts.push(`การเคลื่อนไหว 3 วันล่าสุด: ${movements.map((m) => `${m.movement_type === "stock_in" ? "รับ" : "เบิก"} ${Math.abs(m.quantity_change)} ชิ้น`).join(", ")}`);
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
    const dataContext = await buildFullContext(client, question);

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