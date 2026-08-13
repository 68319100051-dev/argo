import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeAnomalies } from "@/lib/ai/anomaly-agent";
import { checkAgentBudget } from "@/lib/ai/groq";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST() {
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
    .eq("agent_type", "anomaly")
    .maybeSingle();
  if (setting && setting.is_enabled === false) {
    return NextResponse.json({ error: "Agent ตรวจจับความผิดปกติถูกปิดใช้งานโดยผู้ดูแลระบบ" }, { status: 403 });
  }

  const budget = await checkAgentBudget(supabase, "anomaly");
  if (!budget.allowed) {
    return NextResponse.json(
      { error: `Agent ตรวจจับความผิดปกติถึงขีดจำกัดงบประมาณแล้ว (${budget.used}/${budget.limit}) กรุณาติดต่อผู้ดูแลระบบ` },
      { status: 429 }
    );
  }

  try {
    const client = supabase as unknown as SupabaseClient;
    const result = await analyzeAnomalies(client);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    const count = result.data?.length ?? 0;
    await supabase.from("agent_activity_log").insert({
      agent_type: "anomaly",
      action: "analyze",
      summary: `ตรวจพบความผิดปกติ ${count} รายการ — ${result.analysis ?? ""}`,
      details: { anomalies: result.data, analysis: result.analysis },
      requires_review: count > 0,
      review_status: count > 0 ? ("pending" as const) : ("approved" as const),
      created_by: user.id,
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการตรวจสอบความผิดปกติ";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}