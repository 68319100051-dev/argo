"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loader2, Brain, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AiSetting } from "@/lib/supabase/types";

type AgentType = "forecasting" | "chat" | "anomaly" | "ocr" | "orchestrator";

const agentTypes: { id: AgentType; label: string; description: string; unit: string }[] = [
  { id: "forecasting", label: "Agent พยากรณ์ความต้องการ", description: "วิเคราะห์ยอดเบิกและแนะนำปริมาณสั่งซื้อ", unit: "บาท/เดือน" },
  { id: "chat", label: "Agent แชตถาม-ตอบ", description: "ตอบคำถามเกี่ยวกับสต็อกผ่าน AI Chat", unit: "ครั้ง/วัน" },
  { id: "anomaly", label: "Agent ตรวจจับความผิดปกติ", description: "ตรวจสอบสต็อกต่ำ / หมด / หมดอายุ", unit: "บาท/เดือน" },
  { id: "ocr", label: "Agent อ่านเอกสาร (OCR)", description: "สแกนเอกสารใบสั่งซื้อ / ใบส่งของ", unit: "บาท/เดือน" },
  { id: "orchestrator", label: "Agent ประสานงานหลัก", description: "จัดลำดับและกระจายงานให้ Agent อื่น ๆ", unit: "บาท/เดือน" },
];

export default function AiSettingsPage() {
  const supabase = createClient();
  const [config, setConfig] = useState<Record<AgentType, { is_enabled: boolean; spending_limit: number | null }>>({
    forecasting: { is_enabled: true, spending_limit: null },
    chat: { is_enabled: true, spending_limit: null },
    anomaly: { is_enabled: true, spending_limit: null },
    ocr: { is_enabled: true, spending_limit: null },
    orchestrator: { is_enabled: true, spending_limit: null },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from("ai_settings").select("*");
      if (!active) return;
      if (data && data.length > 0) {
        const map: Record<AgentType, { is_enabled: boolean; spending_limit: number | null }> = {
          forecasting: { is_enabled: true, spending_limit: null },
          chat: { is_enabled: true, spending_limit: null },
          anomaly: { is_enabled: true, spending_limit: null },
          ocr: { is_enabled: true, spending_limit: null },
          orchestrator: { is_enabled: true, spending_limit: null },
        };
        for (const row of data as AiSetting[]) {
          const t = row.agent_type as AgentType;
          if (agentTypes.some((a) => a.id === t)) {
            map[t] = { is_enabled: row.is_enabled, spending_limit: row.spending_limit };
          }
        }
        setConfig(map);
      }
      setLoaded(true);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  const handleToggle = (id: AgentType) => {
    setConfig((prev) => ({ ...prev, [id]: { ...prev[id], is_enabled: !prev[id].is_enabled } }));
    setSaved(false);
  };

  const handleLimitChange = (id: AgentType, value: string) => {
    const num = value === "" ? null : Number(value);
    setConfig((prev) => ({ ...prev, [id]: { ...prev[id], spending_limit: Number.isNaN(num ?? 0) ? null : num } }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("ไม่สามารถระบุผู้ใช้ได้");

      for (const agent of agentTypes) {
        const { error: upsertError } = await supabase
          .from("ai_settings")
          .upsert(
            {
              agent_type: agent.id,
              is_enabled: config[agent.id].is_enabled,
              spending_limit: config[agent.id].spending_limit,
              updated_by: user.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "agent_type" }
          );
        if (upsertError) throw upsertError;
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ตั้งค่า AI</h1>
          <p className="text-sm text-gray-500">เปิด/ปิดการทำงานของ Agent แต่ละประเภท</p>
        </div>
        <Button onClick={handleSave} loading={saving}>
          <Save className="h-4 w-4" />
          บันทึกการตั้งค่า
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}
      {saved && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600">
          บันทึกการตั้งค่าเรียบร้อย
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>ประเภท Agent</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 py-6">
          {loaded &&
            agentTypes.map((agent) => (
              <div
                key={agent.id}
                className="flex flex-col gap-3 rounded-lg border border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium text-gray-700">{agent.label}</p>
                    <input
                      type="checkbox"
                      checked={config[agent.id].is_enabled}
                      onChange={() => handleToggle(agent.id)}
                      className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </div>
                  <p className="text-xs text-gray-400">{agent.description}</p>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-500">
                  งบประมาณ ({agent.unit})
                  <input
                    type="number"
                    min={0}
                    value={config[agent.id].spending_limit ?? ""}
                    onChange={(e) => handleLimitChange(agent.id, e.target.value)}
                    disabled={!config[agent.id].is_enabled}
                    placeholder="ไม่จำกัด"
                    className="h-8 w-28 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </label>
              </div>
            ))}
          {!loaded && (
            <div className="flex items-center justify-center py-8">
              <Brain className="h-10 w-10 text-gray-300" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}