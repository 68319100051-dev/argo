"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  text: string;
}

export function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: `⚠️ ${data?.error ?? "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง"}` },
        ]);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", text: data.answer ?? "" }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "⚠️ เกิดข้อผิดพลาด กรุณาลองอีกครั้ง" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/30 transition-all hover:shadow-xl hover:shadow-indigo-600/40 active:scale-95"
        title="ถาม AI"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {open && (
        <div className="fixed bottom-20 right-4 left-4 z-40 flex max-h-[70dvh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 sm:bottom-24 sm:left-auto sm:right-6 sm:w-96 animate-scale-in">
          <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-white">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-semibold">ถาม ARGO AI</span>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="mt-8 text-center text-xs text-slate-400">
                พิมพ์คำถามเกี่ยวกับสต็อกสินค้าได้เลย
              </p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100">
                    <Bot className="h-4 w-4 text-indigo-600" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-gradient-to-b from-indigo-600 to-indigo-700 text-white"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {msg.text}
                </div>
                {msg.role === "user" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600">
                    <User className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100">
                  <Bot className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-500">
                  <Loader2 className="inline h-4 w-4 animate-spin" /> กำลังคิด...
                </div>
              </div>
            )}
          </div>

          <div className="border-t p-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="ถามอะไรก็ได้..."
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-b from-indigo-600 to-indigo-700 text-white transition-all hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
