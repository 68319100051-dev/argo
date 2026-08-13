"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      const { data } = await supabase
        .from("users")
        .select("roles!inner(name)")
        .eq("id", user.id)
        .single();
      if (data && (data as unknown as { roles: { name: string } }).roles.name !== "admin") {
        router.replace("/dashboard");
        return;
      }
      setChecking(false);
    });
  }, [router]);

  if (checking) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
