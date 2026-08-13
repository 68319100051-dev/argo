"use client";

import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useState } from "react";

interface AiFallbackBannerProps {
  message?: string;
  className?: string;
}

export function AiFallbackBanner({
  message = "ระบบ AI ไม่สามารถทำงานได้ในขณะนี้ — คุณยังสามารถใช้งานระบบปกติได้",
  className,
}: AiFallbackBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800",
        className
      )}
    >
      <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-500" />
      <p className="flex-1">{message}</p>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded p-1 hover:bg-yellow-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
