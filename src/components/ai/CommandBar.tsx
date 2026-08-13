"use client";

import { useState, useEffect, useRef } from "react";
import { Command, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface CommandBarProps {
  onCommand?: (command: string) => void;
}

export function CommandBar({ onCommand }: CommandBarProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onCommand?.(value.trim());
      setValue("");
      setOpen(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-colors"
        title="พิมพ์คำสั่ง (Ctrl+K)"
      >
        <Sparkles className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[15vh]"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            className={cn(
              "w-full max-w-lg rounded-xl bg-white shadow-2xl ring-1 ring-gray-200 overflow-hidden"
            )}
          >
            <form onSubmit={handleSubmit} className="flex items-center gap-2 border-b px-4">
              <Sparkles className="h-5 w-5 shrink-0 text-indigo-500" />
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="พิมพ์คำสั่ง... เช่น 'สรุปสต็อกวันนี้' หรือ 'เบิกสินค้า A ออก 10 ชิ้น'"
                className="flex-1 border-0 bg-transparent py-4 text-sm outline-none placeholder:text-gray-400"
              />
              <kbd className="hidden shrink-0 rounded border bg-gray-50 px-1.5 py-0.5 text-xs text-gray-400 sm:inline-block">
                <Command className="inline h-3 w-3" />K
              </kbd>
            </form>
            <div className="px-4 py-3">
              <p className="text-xs text-gray-400">
                พิมพ์คำถาม หรือคำสั่งเกี่ยวกับสต็อกสินค้า
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
