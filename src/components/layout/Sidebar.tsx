"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  ClipboardCheck,
  SlidersHorizontal,
  Truck,
  FileText,
  ScanLine,
  Settings,
  Inbox,
  Shield,
  BarChart3,
  Boxes,
  TrendingUp,
  AlertTriangle,
  Bot,
} from "lucide-react";

const navSections = [
  {
    label: "คลังสินค้า",
    items: [
      { href: "/dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
      { href: "/products", label: "สินค้า", icon: Package },
      { href: "/stock-in", label: "รับเข้า", icon: ArrowDownToLine },
      { href: "/stock-out", label: "เบิกออก", icon: ArrowUpFromLine },
      { href: "/stock-transfer", label: "โอนย้าย", icon: ArrowLeftRight },
      { href: "/cycle-count", label: "นับสต็อก", icon: ClipboardCheck },
      { href: "/stock-adjust", label: "ปรับยอด", icon: SlidersHorizontal },
      { href: "/stock-trend", label: "แนวโน้มสต็อก", icon: TrendingUp },
    ],
  },
  {
    label: "การจัดซื้อ",
    items: [
      { href: "/suppliers", label: "ซัพพลายเออร์", icon: Truck },
      { href: "/purchase-orders", label: "ใบสั่งซื้อ", icon: FileText },
      { href: "/reports", label: "รายงาน", icon: BarChart3 },
      { href: "/scan", label: "สแกน QR", icon: ScanLine },
    ],
  },
  {
    label: "AI Agent",
    items: [
      { href: "/orchestrator", label: "ศูนย์ประสานงาน", icon: Bot },
      { href: "/forecast", label: "พยากรณ์ความต้องการ", icon: TrendingUp },
      { href: "/anomaly", label: "ตรวจสอบความผิดปกติ", icon: AlertTriangle },
      { href: "/ocr", label: "อ่านเอกสาร (OCR)", icon: FileText },
      { href: "/agent-inbox", label: "AI Inbox", icon: Inbox },
    ],
  },
  {
    label: "ระบบ",
    items: [
      { href: "/admin/ai-settings", label: "ตั้งค่า AI", icon: Shield },
      { href: "/admin", label: "จัดการระบบ", icon: Settings },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ collapsed, mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/10 bg-slate-900 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        collapsed ? "lg:w-[76px]" : "lg:w-64"
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
          <Boxes className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="text-base font-bold tracking-widest text-white">ARGO</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Inventory
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {navSections.map((section) => (
          <div key={section.label} className="space-y-1">
            {!collapsed && (
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                {section.label}
              </p>
            )}
            {section.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-white/10 text-white"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-indigo-400 to-violet-500" />
                  )}
                  <item.icon
                    className={cn(
                      "h-5 w-5 shrink-0 transition-colors",
                      active
                        ? "text-indigo-300"
                        : "text-slate-500 group-hover:text-slate-300"
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-white/10 px-5 py-4">
          <p className="text-xs text-slate-500">ARGO Inventory System</p>
          <p className="text-[10px] text-slate-600">เวอร์ชัน 1.0.0</p>
        </div>
      )}
    </aside>
  );
}
