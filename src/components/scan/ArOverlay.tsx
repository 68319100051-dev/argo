"use client";

import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { Package, Calendar, MapPin, Clock, Tag, Hash } from "lucide-react";

interface ProductInfo {
  productId: string;
  name: string;
  sku: string;
  category: string | null;
  unit: string;
  quantity: number;
  location: string | null;
  expiryDate: string | null;
  lotNumber: string | null;
  stockedInAt: string | null;
}

interface ArOverlayProps {
  product: ProductInfo | null;
  loading?: boolean;
  onStockOut?: () => void;
  className?: string;
}

export function ArOverlay({ product, loading, onStockOut, className }: ArOverlayProps) {
  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl bg-white/95 p-6 shadow-lg backdrop-blur",
          className
        )}
      >
        <div className="animate-spin h-6 w-6 rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!product) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl bg-white/95 p-6 shadow-lg backdrop-blur",
          className
        )}
      >
        <p className="text-sm text-gray-400">สแกน QR code เพื่อดูข้อมูล</p>
      </div>
    );
  }

  const isLowStock = product.quantity <= 5;
  const isExpired = product.expiryDate && new Date(product.expiryDate) < new Date();

  return (
    <div
      className={cn(
        "rounded-xl bg-white/95 p-4 shadow-lg backdrop-blur-sm transition-all",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-indigo-100 p-2.5">
          <Package className="h-5 w-5 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="truncate text-sm font-semibold text-gray-900">
            {product.name}
          </h3>
          <p className="text-xs text-gray-500">{product.sku}</p>
          {product.category && (
            <span className="inline-flex items-center gap-1 mt-0.5 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
              <Tag className="h-2.5 w-2.5" />
              {product.category}
            </span>
          )}
        </div>
        <div
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            isLowStock
              ? "bg-red-100 text-red-700"
              : "bg-green-100 text-green-700"
          )}
        >
          {product.quantity} {product.unit}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500">
        {product.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {product.location}
          </span>
        )}
        {product.expiryDate && (
          <span
            className={cn(
              "flex items-center gap-1",
              isExpired && "text-red-500 font-medium"
            )}
          >
            <Calendar className="h-3 w-3" />
            {new Date(product.expiryDate).toLocaleDateString("th-TH")}
            {isExpired && " (หมดอายุ)"}
          </span>
        )}
        {product.lotNumber && (
          <span className="flex items-center gap-1">
            <Hash className="h-3 w-3" />
            ล็อต {product.lotNumber}
          </span>
        )}
        {product.stockedInAt && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            เพิ่มสต็อก {new Date(product.stockedInAt).toLocaleDateString("th-TH", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>

      {onStockOut && (
        <Button
          size="sm"
          variant={isLowStock ? "danger" : "primary"}
          className="mt-3 w-full"
          onClick={onStockOut}
        >
          เบิกออก
        </Button>
      )}
    </div>
  );
}
