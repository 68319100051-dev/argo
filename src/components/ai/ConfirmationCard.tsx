"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AlertTriangle } from "lucide-react";

interface ActionItem {
  label: string;
  value: string;
  editable?: boolean;
  onChange?: (value: string) => void;
}

interface ConfirmationCardProps {
  title: string;
  description: string;
  items: ActionItem[];
  onConfirm: () => void;
  onReject: () => void;
  onEdit?: (key: string, value: string) => void;
  loading?: boolean;
}

export function ConfirmationCard({
  title,
  description,
  items,
  onConfirm,
  onReject,
  loading,
}: ConfirmationCardProps) {
  return (
    <Card className="border-yellow-200">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y rounded-lg border">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-500">{item.label}</span>
              <span className="text-sm font-medium text-gray-900">{item.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost" onClick={onReject} disabled={loading}>
          ยกเลิก
        </Button>
        <Button onClick={onConfirm} loading={loading}>
          ยืนยัน
        </Button>
      </CardFooter>
    </Card>
  );
}
