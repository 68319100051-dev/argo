"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { ChatBubble } from "@/components/ai/ChatBubble";
import { createClient } from "@/lib/supabase/client";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [profile, setProfile] = useState<{ display_name: string; role_name: string } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      setIsDesktop(mq.matches);
      if (mq.matches) setMobileOpen(false);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("users")
        .select("display_name, roles!inner(name)")
        .eq("id", user.id)
        .single();
      if (data) {
        const r = data as unknown as { display_name: string; roles: { name: string } };
        setProfile({ display_name: r.display_name, role_name: r.roles.name });
      }
    });
  }, []);

  const handleToggleSidebar = () => {
    if (isDesktop) {
      setCollapsed((v) => !v);
    } else {
      setMobileOpen((v) => !v);
    }
  };

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-[#f6f7f9]">
        {/* Mobile backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm animate-fade-in lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          <Header
            collapsed={collapsed}
            onToggleSidebar={handleToggleSidebar}
            userDisplayName={profile?.display_name}
            userRole={profile?.role_name}
          />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
      <ChatBubble />
    </AuthGuard>
  );
}
