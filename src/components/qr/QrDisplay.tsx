"use client";

import { QRCodeCanvas } from "qrcode.react";
import { cn } from "@/lib/utils/cn";

interface QrDisplayProps {
  data: string;
  size?: number;
  className?: string;
}

export function QrDisplay({ data, size = 128, className }: QrDisplayProps) {
  return (
    <div className={cn("inline-block rounded-lg bg-white p-2", className)}>
      <QRCodeCanvas value={data} size={size} level="M" />
    </div>
  );
}
