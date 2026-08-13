import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { forecastProduct } from "@/lib/ai/forecasting-agent";
import { checkAgentBudget } from "@/lib/ai/groq";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: setting } = await supabase
    .from("ai_settings")
    .select("is_enabled")
    .eq("agent_type", "forecasting")
    .maybeSingle();
  if (setting && setting.is_enabled === false) {
    return NextResponse.json({ error: "Agent พยากรณ์ถูกปิดใช้งานโดยผู้ดูแลระบบ" }, { status: 403 });
  }

  const budget = await checkAgentBudget(supabase, "forecasting");
  if (!budget.allowed) {
    return NextResponse.json(
      { error: `Agent พยากรณ์ถึงขีดจำกัดงบประมาณแล้ว (${budget.used}/${budget.limit}) กรุณาติดต่อผู้ดูแลระบบ` },
      { status: 429 }
    );
  }

  const productId = request.nextUrl.searchParams.get("productId");
  if (!productId) {
    return NextResponse.json({ error: "กรุณาระบุ productId" }, { status: 400 });
  }

  try {
    const client = supabase as unknown as SupabaseClient;
    const result = await forecastProduct(productId, client);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    await supabase.from("agent_activity_log").insert({
      agent_type: "forecasting",
      action: "forecast",
      summary: `พยากรณ์ ${result.data?.productName ?? ""} — แนะนำสั่งซื้อ ${result.data?.suggestedOrder ?? 0} ชิ้น`,
      details: (result.data as unknown as Record<string, unknown>) ?? {},
      requires_review: false,
      review_status: "pending" as const,
      created_by: user.id,
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการพยากรณ์";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}