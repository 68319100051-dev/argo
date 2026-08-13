const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

const DEFAULT_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const VISION_MODEL = process.env.GROQ_VISION_MODEL ?? "llama-4-scout-17b-16e-instruct";

export function isGeminiAvailable(): boolean {
  return !!process.env.GROQ_API_KEY;
}

export interface BudgetCheck {
  allowed: boolean;
  limit: number | null;
  used: number;
}

export async function checkAgentBudget(
  supabase: unknown,
  agentType: "forecasting" | "chat" | "anomaly" | "ocr" | "orchestrator"
): Promise<BudgetCheck> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const setting = await client
    .from("ai_settings")
    .select("spending_limit")
    .eq("agent_type", agentType)
    .maybeSingle();
  const limit = setting?.data?.spending_limit ?? null;

  if (limit === null) {
    return { allowed: true, limit: null, used: 0 };
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const countRes = await client
    .from("agent_activity_log")
    .select("id", { count: "exact", head: true })
    .eq("agent_type", agentType)
    .gte("created_at", startOfMonth.toISOString());

  const used = countRes.count ?? 0;
  return { allowed: used < limit, limit, used };
}

export interface ChatOptions {
  history?: { role: "user" | "model"; parts: { text: string }[] }[];
  imageBase64?: string;
  responseMimeType?: string;
}

export async function chatWithGemini(
  message: string,
  options?: ChatOptions
): Promise<{ text: string; requiresReview?: boolean; pendingAction?: unknown }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { text: "⚠️ ยังไม่ได้ตั้งค่า GROQ_API_KEY — กรุณาเพิ่มใน .env.local" };
  }

  const messages: { role: string; content: unknown }[] = [
    {
      role: "system",
      content: `คุณคือผู้ช่วย AI สำหรับระบบบริหารสต็อกสินค้าชื่อ ARGO
คุณสามารถ:
- ค้นหาข้อมูลสินค้า สต็อก การเคลื่อนไหว
- วิเคราะห์แนวโน้ม พยากรณ์ความต้องการ
- ตรวจสอบความผิดปกติของสต็อกสินค้า
- ช่วยสร้างเอกสารเบิกสินค้า ใบสั่งซื้อ (ต้องให้ผู้ใช้ยืนยันก่อน)

กฎสำคัญ:
- ตอบเป็นภาษาไทยเท่านั้น
- ใช้ข้อมูลจากระบบเท่านั้น ไม่เดา
- ถ้าไม่แน่ใจ ให้บอกว่าไม่ทราบ
- การดำเนินการที่แก้ไขข้อมูลต้องขอให้ผู้ใช้ยืนยันก่อนเสมอ`,
    },
  ];

  if (options?.history && options.history.length > 0) {
    for (const h of options.history) {
      const role = h.role === "model" ? "assistant" : "user";
      const text = h.parts.map((p) => p.text).join("\n");
      messages.push({ role, content: text });
    }
  }

  if (options?.imageBase64) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: message },
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${options.imageBase64}` },
        },
      ],
    });
  } else {
    messages.push({ role: "user", content: message });
  }

  const useVision = !!options?.imageBase64;

  try {
    const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: useVision ? VISION_MODEL : DEFAULT_MODEL,
        messages,
        temperature: 0.7,
        ...(options?.responseMimeType === "application/json"
          ? { response_format: { type: "json_object" } }
          : {}),
      }),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      let detail = "";
      try {
        const j = JSON.parse(bodyText);
        detail = j?.error?.message ?? bodyText;
      } catch {
        detail = bodyText;
      }
      if (res.status === 401) {
        return { text: "⚠️ GROQ_API_KEY ไม่ถูกต้อง — กรุณาตรวจสอบ" };
      }
      if (res.status === 429 || detail.toLowerCase().includes("rate")) {
        return { text: "⚠️ การใช้งานถึงขีดจำกัดแล้ว กรุณารอสักครู่" };
      }
      return { text: `❌ Groq API error (${res.status}): ${detail}` };
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    return { text: typeof text === "string" ? text : JSON.stringify(text) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
    return { text: `❌ ${msg}` };
  }
}
