"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useQrScanner } from "@/hooks/useQrScanner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  Scan, Camera, CameraOff, RotateCcw,
} from "lucide-react";

interface QrScannerProps {
  onScan: (data: string) => void;
}

type FacingMode = "environment" | "user";

export function QrScanner({ onScan }: QrScannerProps) {
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<FacingMode>("environment");
  const { result, startScanning, stopScanning } = useQrScanner(
    streamRef as React.RefObject<MediaStream | null>
  );

  const stopAndClean = useCallback(() => {
    stopScanning();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [stopScanning]);

  const startCamera = useCallback(async (mode: FacingMode) => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      startScanning();
    } catch {
      setError("ไม่สามารถเปิดกล้องได้ — ตรวจสอบสิทธิ์การใช้งานกล้อง");
    }
  }, [startScanning, streamRef]);

  const toggleCamera = useCallback(() => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    stopAndClean();
    startCamera(next);
  }, [facingMode, stopAndClean, startCamera]);

  const stopCamera = useCallback(() => {
    stopAndClean();
    setCameraActive(false);
  }, [stopAndClean]);

  useEffect(() => {
    if (result) {
      onScan(result.data);
    }
  }, [result, onScan]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      {!cameraActive ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-300 p-12">
          <Scan className="h-12 w-12 text-gray-300" />
          <p className="text-sm text-gray-500">กดเริ่มเพื่อเปิดกล้องสแกน QR</p>
          <Button onClick={() => startCamera(facingMode)}>
            <Camera className="h-4 w-4" />
            เปิดกล้อง
          </Button>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-80 w-full max-w-sm object-cover"
          />
          <div className="absolute inset-0 border-[3px] border-indigo-500/50" />
          {result && (
            <div className="absolute bottom-4 left-4 right-4 rounded-lg bg-green-500/90 px-4 py-2 text-center text-sm font-medium text-white">
              พบ QR code!
            </div>
          )}
          <div className="absolute right-3 top-3 flex gap-2">
            <button
              onClick={toggleCamera}
              className="rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
              title={facingMode === "environment" ? "สลับเป็นกล้องหน้า" : "สลับเป็นกล้องหลัง"}
            >
              <RotateCcw className="h-5 w-5" />
            </button>
            <button
              onClick={stopCamera}
              className="rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
            >
              <CameraOff className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <Card className="w-full max-w-sm p-4 text-sm text-red-500">{error}</Card>
      )}
    </div>
  );
}
