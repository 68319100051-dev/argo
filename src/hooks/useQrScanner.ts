"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";

interface QrResult {
  data: string;
  location: {
    topLeftCorner: { x: number; y: number };
    topRightCorner: { x: number; y: number };
    bottomLeftCorner: { x: number; y: number };
    bottomRightCorner: { x: number; y: number };
  };
}

export function useQrScanner(streamRef: React.RefObject<MediaStream | null>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number>(0);
  const [result, setResult] = useState<QrResult | null>(null);
  const [scanning, setScanning] = useState(false);

  const startScanning = useCallback(() => {
    setScanning(true);
    setResult(null);
  }, []);

  const stopScanning = useCallback(() => {
    setScanning(false);
    cancelAnimationFrame(animRef.current);
  }, []);

  useEffect(() => {
    if (!scanning || !streamRef.current) return;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const video = document.createElement("video");
    video.srcObject = streamRef.current;
    video.setAttribute("playsinline", "");
    video.play();

    const scan = () => {
      if (!scanning) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          setResult({
            data: code.data,
            location: {
              topLeftCorner: code.location.topLeftCorner,
              topRightCorner: code.location.topRightCorner,
              bottomLeftCorner: code.location.bottomLeftCorner,
              bottomRightCorner: code.location.bottomRightCorner,
            },
          });
          setScanning(false);
          return;
        }
      }

      animRef.current = requestAnimationFrame(scan);
    };

    animRef.current = requestAnimationFrame(scan);

    return () => {
      cancelAnimationFrame(animRef.current);
      video.pause();
      video.srcObject = null;
    };
  }, [scanning, streamRef]);

  return { result, scanning, startScanning, stopScanning };
}
