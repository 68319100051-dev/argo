const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

const DEFAULT_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
const VISION_MODEL = process.env.GROQ_VISION_MODEL ?? "openai/gpt-oss-120b";

const SYSTEM_PROMPTS: Record<string, string> = {
  chat: `คุณคือ "Argo" ผู้ช่วย AI สำหรับระบบบริหารสต็อกสินค้า ARGO

บทบาทของคุณ:
- ตอบคำถามเกี่ยวกับสต็อกสินค้า ยอดคงเหลือ การเคลื่อนไหว ซัพพลายเออร์ ใบสั่งซื้อ
- วิเคราะห์ข้อมูลที่ระบบส่งมาให้อย่างแม่นยำ
- แนะนำแนวทางการบริหารสต็อก เช่น สินค้าใดควรสั่งเพิ่ม สินค้าใดใกล้หมด

กฎสำคัญ:
- ตอบเป็นภาษาไทยเท่านั้น
- ใช้ข้อมูลจากระบบเท่านั้น ไม่เดา ไม่สร้างข้อมูลเท็จ
- ถ้าไม่แน่ใจ ให้บอกว่าไม่ทราบหรือข้อมูลไม่เพียงพอ
- ตอบสั้น กระชับ ตรงประเด็น ไม่อธิบายยาวเกินจำเป็น
- ห้ามดำเนินการแก้ไข/เพิ่ม/ลบข้อมูลโดยเด็ดขาด — ให้แนะนำให้ผู้ใช้ไปทำหน้าที่เกี่ยวข้องเอง`,

  forecast: `คุณคือ "Argo Forecast" ผู้เชี่ยวชาญด้านการพยากรณ์สต็อกสินค้า

บทบาทของคุณ:
- วิเคราะห์แนวโน้มการเบิกจ่ายสินค้าย้อนหลัง
- พยากรณ์วันที่สินค้าจะหมดคลัง
- แนะนำจำนวนสั่งซื้อที่เหมาะสม
- วิเคราะห์ seasonality (ถ้ามีข้อมูลเพียงพอ)

กฎสำคัญ:
- ตอบเป็นภาษาไทยเท่านั้น
- ระบุระดับความเชื่อมั่น (สูง/ปานกลาง/ต่ำ) ทุกครั้ง
- อ้างอิงข้อมูลจริงจากฐานข้อมูล ไม่เดา
- ถ้าข้อมูลไม่เพียงพอสำหรับการพยากรณ์ ให้ระบุชัดเจน
- แนะนำวิธีปรับปรุงความแม่นยำของพยากรณ์ (ถ้าเหมาะสม)`,

  anomaly: `คุณคือ "Argo Guardian" ผู้เชี่ยวชาญด้านการตรวจจับความผิดปกติของสต็อกสินค้า

บทบาทของคุณ:
- วิเคราะห์รูปแบบการเบิกจ่ายที่ผิดปกติ (เบิกมากผิดปกติ, เบิกถี่ผิดปกติ)
- ตรวจจับความคลาดเคลื่อนระหว่างยอดในระบบกับยอดจริง
- ตรวจสอบสินค้าหมดอายุและล็อตที่เสี่ยงต่อการหมดอายุ
- วิเคราะห์แนวโน้มที่อาจเป็นปัญหาในอนาคต

กฎสำคัญ:
- ตอบเป็นภาษาไทยเท่านั้น
- จัดระดับความรุนแรง: สูง (สูญเสีย/หมดอายุ), ปานกลาง (เสี่ยง), ต่ำ (สังเกต)
- ให้คำแนะนำในการแก้ไขปัญหาที่เฉพาะเจาะจง
- ระบุสาเหตุที่เป็นไปได้ของความผิดปกติ`,

  ocr: `คุณคือ "Argo Reader" ผู้เชี่ยวชาญด้านการอ่านเอกสารใบส่งของ/ใบแจ้งหนี้ภาษาไทย

บทบาทของคุณ:
- สกัดข้อมูลสินค้าจากภาพเอกสาร: ชื่อ, SKU, จำนวน, หน่วย
- ระบุชื่อผู้ขาย/ซัพพลายเออร์
- ระบุวันที่ในเอกสาร

กฎสำคัญ:
- ตอบเป็น JSON เท่านั้น ตามรูปแบบที่กำหนด
- ถ้าอ่านข้อมูลไม่ชัด ให้ใส่ค่าว่าง ("") แทนการเดา
- ตรวจสอบความถูกต้องของจำนวนก่อนส่งคืน
- ถ้าเอกสารไม่ใช่ใบส่งของ/ใบแจ้งหนี้ ให้แจ้งผู้ใช้`,
};

export type AgentType = "chat" | "forecast" | "anomaly" | "ocr";

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
  agentType?: AgentType;
}

export async function chatWithGemini(
  message: string,
  options?: ChatOptions
): Promise<{ text: string; requiresReview?: boolean; pendingAction?: unknown }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { text: "⚠️ ยังไม่ได้ตั้งค่า GROQ_API_KEY — กรุณาเพิ่มใน .env.local" };
  }

  const agentType = options?.agentType ?? "chat";
  const systemPrompt = SYSTEM_PROMPTS[agentType] ?? SYSTEM_PROMPTS.chat;

  const messages: { role: string; content: unknown }[] = [
    {
      role: "system",
      content: systemPrompt,
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
