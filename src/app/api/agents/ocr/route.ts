import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processDeliveryImage } from "@/lib/ai/ocr-agent";
import { checkAgentBudget } from "@/lib/ai/groq";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
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
    .eq("agent_type", "ocr")
    .maybeSingle();
  if (setting && setting.is_enabled === false) {
    return NextResponse.json({ error: "Agent OCR ถูกปิดใช้งานโดยผู้ดูแลระบบ" }, { status: 403 });
  }

  const budget = await checkAgentBudget(supabase, "ocr");
  if (!budget.allowed) {
    return NextResponse.json(
      { error: `Agent OCR ถึงขีดจำกัดงบประมาณแล้ว (${budget.used}/${budget.limit}) กรุณาติดต่อผู้ดูแลระบบ` },
      { status: 429 }
    );
  }

  let imageBase64 = "";
  let fileName = "";
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "กรุณาแนบไฟล์รูปภาพ" }, { status: 400 });
    }
    const blob = file as Blob;
    fileName = blob instanceof File ? blob.name : "image";
    const buf = Buffer.from(await blob.arrayBuffer());
    imageBase64 = buf.toString("base64");
  } catch {
    return NextResponse.json({ error: "ไม่สามารถอ่านไฟล์รูปภาพได้" }, { status: 400 });
  }

  try {
    const result = await processDeliveryImage(imageBase64);

    const logPayload: {
      agent_type: "ocr";
      action: string;
      summary: string;
      details: Record<string, unknown>;
      requires_review: boolean;
      review_status: "pending";
      created_by: string;
    } = result.success
      ? {
          agent_type: "ocr",
          action: "scan_document",
          summary: `สแกนเอกสาร ${fileName} — พบ ${result.data?.items?.length ?? 0} รายการสินค้า`,
          details: (result.data ?? {}) as Record<string, unknown>,
          requires_review: true,
          review_status: "pending",
          created_by: user.id,
        }
      : {
          agent_type: "ocr",
          action: "scan_document",
          summary: `สแกนเอกสาร ${fileName} ไม่สำเร็จ: ${result.error ?? ""}`,
          details: { success: false, error: result.error },
          requires_review: false,
          review_status: "pending",
          created_by: user.id,
        };

    await supabase.from("agent_activity_log").insert(logPayload);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการประมวลผลรูปภาพ";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}