"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthShell } from "@/components/auth/AuthShell";
import { CheckCircle2 } from "lucide-react";

function UpdatePasswordForm() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      setChecking(false);
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (password !== confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <p className="text-sm text-gray-700">
          ตั้งรหัสผ่านใหม่สำเร็จ คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย
        </p>
        <Link href="/auth/login" className="text-sm text-indigo-600 hover:underline">
          ไปที่หน้าเข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        id="password"
        label="รหัสผ่านใหม่ *"
        type="password"
        placeholder="อย่างน้อย 6 ตัวอักษร"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
        disabled={loading}
      />
      <Input
        id="confirmPassword"
        label="ยืนยันรหัสผ่านใหม่ *"
        type="password"
        placeholder="········"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        minLength={6}
        disabled={loading}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" loading={loading} className="w-full">
        บันทึกรหัสผ่านใหม่
      </Button>
    </form>
  );
}

export default function UpdatePasswordPage() {
  return (
    <AuthShell title="ตั้งรหัสผ่านใหม่" description="กรอกรหัสผ่านใหม่สำหรับบัญชีของคุณ">
      <UpdatePasswordForm />
    </AuthShell>
  );
}
