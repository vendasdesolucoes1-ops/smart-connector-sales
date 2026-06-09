import { Target, TrendingUp, Users, Lightbulb, MessageCircle, RefreshCw, Linkedin, Mail, Phone } from "lucide-react";

export type AiConfig = {
  id?: string;
  org_id: string;
  config_type: string;
  instance_name?: string | null;
  enabled: boolean;
  system_prompt: string;
  temperature: number;
  schedule_start: string | null;
  schedule_end: string | null;
  schedule_days: number[];
  only_outside_hours: boolean;
  config: Record<string, any>;
};

export type KnowledgeDoc = {
  id?: string;
  org_id: string;
  title: string;
  content: string;
  keywords?: string[];
  summary?: string;
  processed?: boolean;
  chunks?: any[];
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

export const DAY_LABELS: Record<number, string> = {
  1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb", 7: "Dom",
};

export const ASSISTANT_SUGGESTIONS = [
  { icon: Target, label: "Analisar lead", prompt: "Analise este lead e sugira a melhor abordagem: " },
  { icon: TrendingUp, label: "Diagnóstico de pipeline", prompt: "Faça um diagnóstico do meu pipeline de vendas. Quais gargalos posso ter e como melhorar a conversão?" },
  { icon: Users, label: "Script de objeção", prompt: "Crie scripts para contornar as 5 objeções mais comuns em vendas B2B do meu segmento." },
  { icon: Lightbulb, label: "Estratégia de prospecção", prompt: "Sugira uma estratégia de prospecção outbound para o meu negócio, incluindo canais, frequência e templates." },
  { icon: MessageCircle, label: "Resumir conversa", prompt: "Resuma esta conversa com o cliente e extraia os próximos passos: " },
  { icon: RefreshCw, label: "Follow-up inteligente", prompt: "Crie uma cadência de follow-up de 5 toques para um lead que demonstrou interesse mas não respondeu." },
];

export const MSG_TYPES = [
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin },
  { value: "email", label: "Email", icon: Mail },
  { value: "cold_call", label: "Ligação", icon: Phone },
];

export const AI_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

export async function streamAI(
  url: string,
  body: any,
  onDelta: (text: string) => void,
  onDone: () => void,
  onError: (msg: string) => void,
) {
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      onError(errData.error || `Erro ${resp.status}`);
      return;
    }

    const reader = resp.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") break;
        try {
          const parsed = JSON.parse(json);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            full += content;
            onDelta(full);
          }
        } catch (parseErr) { console.warn("SSE chunk parse error (non-critical):", parseErr); }
      }
    }
  } catch (e: any) {
    onError(e.message);
  }
  onDone();
}
