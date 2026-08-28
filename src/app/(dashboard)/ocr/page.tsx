"use client";

import { useCallback, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Loader2,
  FileText,
  Upload,
  Image,
  CheckCircle,
  AlertTriangle,
  X,
  Camera,
  Package,
} from "lucide-react";

interface OcrItem {
  sku?: string;
  name?: string;
  quantity?: number;
  unit?: string;
}

interface OcrResult {
  items: OcrItem[];
  supplierName?: string;
  documentDate?: string;
}

interface ApiResult {
  success: boolean;
  data?: OcrResult;
  error?: string;
  requiresReview?: boolean;
}

export default function OcrPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const runOcr = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch("/api/agents/ocr", { method: "POST", body: formData });
      const body: ApiResult = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        setError(body.error ?? "เกิดข้อผิดพลาดในการอ่านเอกสาร");
      } else {
        setResult(body);
      }
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <FileText className="h-6 w-6 text-green-600" />
          อ่านเอกสาร (OCR)
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          ถ่ายรูปหรืออัปโหลดใบส่งของ ใบแจ้งหนี้ ระบบจะดึงข้อมูลสินค้าให้อัตโนมัติ
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upload Area */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-gray-400" />
              อัปโหลดเอกสาร
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!previewUrl ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-10 transition-colors hover:border-indigo-400 hover:bg-indigo-50/50"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
                  <Camera className="h-8 w-8 text-indigo-500" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-gray-700">ลากและวางรูปภาพที่นี่</p>
                  <p className="mt-1 text-sm text-gray-400">หรือคลิกเพื่อเลือกไฟล์</p>
                </div>
                <p className="text-xs text-gray-400">รองรับ JPG, PNG, WEBP (สูงสุด 20MB)</p>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Document preview"
                  className="w-full rounded-xl border border-gray-200 object-contain"
                  style={{ maxHeight: "400px" }}
                />
                <button
                  onClick={reset}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Image className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{selectedFile?.name}</span>
                    <span className="text-xs text-gray-400">
                      ({((selectedFile?.size ?? 0) / 1024 / 1024).toFixed(1)} MB)
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={reset}>
                    เปลี่ยนรูป
                  </Button>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              onClick={runOcr}
              loading={loading}
              disabled={!selectedFile}
              className="w-full"
              size="lg"
            >
              <FileText className="h-4 w-4" />
              {loading ? "กำลังอ่านเอกสาร..." : "เริ่มอ่านเอกสาร"}
            </Button>
          </CardContent>
        </Card>

        {/* Results Area */}
        <Card className={!result ? "flex items-center justify-center" : ""}>
          {!result && !loading ? (
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
                <FileText className="h-10 w-10 text-gray-300" />
              </div>
              <div>
                <p className="font-medium text-gray-500">ผลลัพธ์จะแสดงที่นี่</p>
                <p className="mt-1 text-sm text-gray-400">อัปโหลดเอกสารแล้วกดเริ่มอ่าน</p>
              </div>
            </CardContent>
          ) : loading ? (
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="relative">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-green-200 border-t-green-600" />
                <FileText className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-700">กำลังอ่านเอกสาร...</p>
                <p className="mt-1 text-sm text-gray-400">AI กำลังวิเคราะห์รูปภาพและดึงข้อมูล</p>
              </div>
            </CardContent>
          ) : result?.success && result.data ? (
            <CardContent className="flex flex-col gap-4">
              <CardHeader className="p-0">
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="h-5 w-5" />
                  อ่านสำเร็จ
                </CardTitle>
              </CardHeader>

              {/* Document Info */}
              <div className="grid grid-cols-2 gap-3">
                {result.data.supplierName && (
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">ผู้ขาย / ซัพพลายเออร์</p>
                    <p className="mt-0.5 text-sm font-medium text-gray-800">{result.data.supplierName}</p>
                  </div>
                )}
                {result.data.documentDate && (
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">วันที่เอกสาร</p>
                    <p className="mt-0.5 text-sm font-medium text-gray-800">{result.data.documentDate}</p>
                  </div>
                )}
              </div>

              {/* Items Table */}
              {result.data.items.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Package className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">
                      รายการสินค้า ({result.data.items.length} รายการ)
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">#</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">ชื่อสินค้า</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">SKU</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">จำนวน</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">หน่วย</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {result.data.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                            <td className="px-3 py-2 font-medium text-gray-800">{item.name || "-"}</td>
                            <td className="px-3 py-2 text-gray-500">{item.sku || "-"}</td>
                            <td className="px-3 py-2 text-right font-medium text-gray-800">
                              {item.quantity?.toLocaleString() ?? "-"}
                            </td>
                            <td className="px-3 py-2 text-gray-500">{item.unit || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Warning */}
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>กรุณาตรวจสอบความถูกต้องของข้อมูลก่อนบันทึก ไปที่หน้ารับเข้าเพื่อบันทึกรายการ</p>
              </div>
            </CardContent>
          ) : (
            <CardContent className="flex flex-col items-center gap-3 py-12">
              <AlertTriangle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-red-500">{result?.error}</p>
              <Button variant="outline" size="sm" onClick={reset}>
                ลองใหม่
              </Button>
            </CardContent>
          )}
        </Card>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
        }}
      />
    </div>
  );
}
