"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthShell } from "@/components/auth/AuthShell";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
          : error.message
      );
      setLoading(false);
      return;
    }

    router.push(redirect);
  };

  return (
    <form onSubmit={handleLogin} className="flex flex-col gap-4">
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
      <div className="flex flex-col gap-1.5">
        <Input
          id="password"
          label="รหัสผ่าน"
          type="password"
          placeholder="········"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
        <div className="flex justify-end">
          <Link href="/auth/forgot-password" className="text-xs text-indigo-600 hover:underline">
            ลืมรหัสผ่าน?
          </Link>
        </div>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" loading={loading} className="w-full">
        เข้าสู่ระบบ
      </Button>
      <p className="text-center text-xs text-slate-400">
        บัญชีผู้ใช้งานถูกสร้างโดยผู้ดูแลระบบ
        <br />
        หากยังไม่มีบัญชี กรุณาติดต่อผู้ดูแลระบบ
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell title="เข้าสู่ระบบ ARGO" description="ระบบบริหารจัดการสต็อกสินค้า">
      <Suspense
        fallback={
          <div className="animate-spin h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent" />
        }
      >
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
