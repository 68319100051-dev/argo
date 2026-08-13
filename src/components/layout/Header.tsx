"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PanelLeftClose, PanelLeft, LogOut, ChevronDown, Boxes, ShieldCheck } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils/cn";

interface HeaderProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
  userDisplayName?: string;
  userRole?: string;
}

export function Header({ collapsed, onToggleSidebar, userDisplayName, userRole }: HeaderProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const roleLabels: Record<string, string> = {
    warehouse_staff: "พนักงานคลัง",
    warehouse_head: "หัวหน้าคลัง",
    admin: "ผู้ดูแลระบบ",
  };

  const isAdmin = userRole === "admin";

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 active:scale-95"
          title="สลับเมนู"
        >
          {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>

        {/* Brand on mobile only */}
        <div className="flex items-center gap-2 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
            <Boxes className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-widest text-slate-900">ARGO</span>
        </div>
      </div>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={cn(
            "flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-colors hover:bg-slate-100 active:scale-[0.98]",
            menuOpen && "bg-slate-100"
          )}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white shadow-md shadow-indigo-500/20">
            {userDisplayName?.charAt(0).toUpperCase() ?? "U"}
          </div>
          <div className="hidden text-left sm:block">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              {userDisplayName ?? "ผู้ใช้"}
              {isAdmin && <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />}
            </p>
            <p className="text-xs text-slate-500">{roleLabels[userRole ?? ""] ?? userRole}</p>
          </div>
          <ChevronDown
            className={cn("h-4 w-4 text-slate-400 transition-transform", menuOpen && "rotate-180")}
          />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-56 animate-scale-in overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl shadow-slate-900/10">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{userDisplayName ?? "ผู้ใช้"}</p>
              <p className="text-xs text-slate-500">{roleLabels[userRole ?? ""] ?? userRole}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              ออกจากระบบ
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
