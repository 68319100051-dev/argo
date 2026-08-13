import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_ROLES = ["warehouse_staff", "warehouse_head", "admin"] as const;
type RoleName = (typeof VALID_ROLES)[number];

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profileRaw } = await supabase
    .from("users")
    .select("roles!inner(name)")
    .eq("id", user.id)
    .single();
  const profile = profileRaw as unknown as { roles: { name: string } } | null;
  if (profile?.roles?.name !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const displayName = String(body?.display_name ?? "").trim();
  const role = String(body?.role ?? "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "อีเมลไม่ถูกต้อง" }, { status: 400 });
  }
  if (!displayName) {
    return NextResponse.json({ error: "กรุณากรอกชื่อผู้ใช้" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role as RoleName)) {
    return NextResponse.json({ error: "สิทธิ์ที่เลือกไม่ถูกต้อง" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "อีเมลนี้มีผู้ใช้อยู่แล้วในระบบ" }, { status: 409 });
  }

  const { data: roleRow, error: roleError } = await supabase
    .from("roles")
    .select("id")
    .eq("name", role as RoleName)
    .single();
  if (roleError || !roleRow) {
    return NextResponse.json({ error: "ไม่พบสิทธิ์ที่เลือก" }, { status: 500 });
  }

  const admin = createAdminClient();
  const tempPassword = crypto.randomBytes(9).toString("base64url").slice(0, 12);

  const { data: authUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (createError) {
    if (/already.*regist/i.test(createError.message)) {
      return NextResponse.json({ error: "อีเมลนี้ลงทะเบียนไว้แล้วในระบบ" }, { status: 409 });
    }
    return NextResponse.json({ error: "สร้างบัญชีไม่สำเร็จ: " + createError.message }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({ role_id: roleRow.id, display_name: displayName, is_active: true })
    .eq("id", authUser.user.id);

  if (updateError) {
    return NextResponse.json({ error: "สร้างบัญชีสำเร็จแต่ตั้งสิทธิ์ไม่สำเร็จ: " + updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    id: authUser.user.id,
    tempPassword,
  });
}
