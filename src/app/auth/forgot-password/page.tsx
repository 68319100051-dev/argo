"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthShell } from "@/components/auth/AuthShell";
import { MailCheck } from "lucide-react";

function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/auth/callback?next=/auth/update-password",
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <MailCheck className="h-12 w-12 text-green-500" />
        <p className="text-sm text-gray-700">
          ถ้าอีเมล <span className="font-medium">{email}</span> ลงทะเบียนในระบบ
          คุณจะได้รับอีเมลพร้อมลิงก์สำหรับตั้งรหัสผ่านใหม่
        </p>
        <Link href="/auth/login" className="text-sm text-indigo-600 hover:underline">
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        id="email"
        label="อีเมล"
        type="email"
        placeholder="user@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={loading}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" loading={loading} className="w-full">
        ส่งลิงก์ตั้งรหัสผ่าน
      </Button>
      <p className="text-center text-sm text-gray-500">
        นึกออกแล้ว?{" "}
        <Link href="/auth/login" className="text-indigo-600 hover:underline">
          เข้าสู่ระบบ
        </Link>
      </p>
    </form>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="ลืมรหัสผ่าน" description="เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้ทางอีเมล">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
