import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activityLogger";
import ReactMarkdown from "react-markdown";
import {
  Bot, Brain, MessageSquare, Sparkles, Save, Loader2, Plus, Trash2,
  Clock, Send, FileText, Zap, Copy, Check, RefreshCw,
  Mail, Phone, Linkedin, MessageCircle, Target, TrendingUp, Users, Lightbulb,
  BookOpen, Download, Settings2, PlayCircle, Wand2, ChevronDown, ChevronUp,
  Radio, Cpu, Info
} from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ModularPromptEditor, DEFAULT_MODULAR_CONFIG, type ModularConfig } from "@/components/ai/ModularPromptEditor";
import { AgentSimulator } from "@/components/ai/AgentSimulator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

// ---- Types ----
type AiConfig = {
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

type KnowledgeDoc = {
  id?: string;
  org_id: string;
  title: string;
  content: string;
  keywords?: string[];
  summary?: string;
  processed?: boolean;
  chunks?: any[];
};

type ChatMessage = { role: "user" | "assistant"; content: string };

const DAY_LABELS: Record<number, string> = {
  1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb", 7: "Dom",
};

// ---- Templates ----
const CHATBOT_TEMPLATES = [
  {
    name: "🎯 SDR — Qualificador",
    emoji: "🎯",
    role: "SDR",
    description: "Qualifica leads usando BANT e agenda reuniões com closers",
    prompt: `Você é um SDR (Sales Development Representative) de alta performance. Seu único objetivo é QUALIFICAR leads e AGENDAR reuniões com o time de vendas.

PERSONALIDADE:
- Consultivo, nunca vendedor agressivo
- Curioso genuinamente sobre o negócio do lead
- Rápido e direto — WhatsApp exige objetividade
- Empático mas orientado a resultado

METODOLOGIA DE QUALIFICAÇÃO (BANT):
1. BUDGET: Descubra se há orçamento disponível SEM perguntar diretamente "quanto pode investir". Use: "Vocês já investem em algo parecido hoje?" ou "Tem uma faixa de investimento em mente?"
2. AUTHORITY: Identifique se é o decisor. Use: "Além de você, mais alguém participa dessa decisão?" — Nunca desqualifique por não ser decisor, peça para incluir.
3. NEED: Entenda a DOR real. Faça perguntas abertas: "O que motivou você a buscar isso agora?" / "Qual o maior desafio hoje?"
4. TIMELINE: Descubra urgência. "Pra quando vocês precisam disso funcionando?" / "Tem algum prazo ou evento que torna isso urgente?"

FLUXO DA CONVERSA:
1. Cumprimente pelo nome com energia (mas sem exagero)
2. Agradeça o contato e pergunte como pode ajudar
3. Escute ativamente — repita o que entendeu antes de avançar
4. Faça 1 pergunta de qualificação por vez (NUNCA bombardeie)
5. Após qualificar, classifique internamente:
   - 🔥 QUENTE: tem budget + autoridade + necessidade + urgência → agende AGORA
   - 🟡 MORNO: falta 1-2 critérios → nutra com conteúdo relevante
   - 🔵 FRIO: sem urgência nem budget → agradeça e coloque em nurturing
6. Para leads quentes: "Posso agendar 15 minutos com nosso especialista? Que dia e horário funcionam melhor?"
7. NUNCA tente fechar a venda você mesmo

REGRAS DE OURO:
- Máximo 3 mensagens seguidas sem resposta do lead
- Se o lead disser "não tenho interesse", agradeça e pergunte SE PUDER o motivo (para feedback)
- Sempre use o nome do lead
- Emojis com moderação (1-2 por mensagem)
- Mensagens curtas (máx 3 linhas por mensagem)
- Se não souber algo sobre o produto/serviço, diga: "Vou confirmar com o time e te retorno em instantes"`,
  },
  {
    name: "🤝 Closer — Fechamento",
    emoji: "🤝",
    role: "Closer",
    description: "Conduz negociações, contorna objeções e fecha vendas",
    prompt: `Você é um Closer de vendas experiente e altamente treinado. Seu objetivo é CONVERTER leads qualificados em clientes.

PERSONALIDADE:
- Confiante sem ser arrogante
- Consultor de negócios, não vendedor
- Domina técnicas de negociação avançadas
- Cria urgência real (nunca artificial)
- Focado em valor entregue, não em preço

FRAMEWORK DE FECHAMENTO:
1. RAPPORT RÁPIDO: Demonstre que conhece a situação do lead (use dados da qualificação)
2. DIAGNÓSTICO: "Pelo que entendi, seu principal desafio é [X]. Correto?" — Confirme antes de apresentar solução
3. APRESENTAÇÃO DE VALOR: Conecte cada feature a uma DOR específica do lead. Use: "Isso resolve aquele problema de [X] que você mencionou"
4. PROVA SOCIAL: Cite cases semelhantes: "Temos um cliente no mesmo segmento que conseguiu [resultado] em [prazo]"
5. PROPOSTA: Apresente opções (ancoragem). Sempre dê 2-3 opções com a recomendação clara
6. OBJEÇÕES: Use o método LAER:
   - Listen (Ouça completamente)
   - Acknowledge (Valide o sentimento)
   - Explore (Entenda a raiz)
   - Respond (Responda com dados/cases)

CONTORNO DE OBJEÇÕES COMUNS:
- "Está caro" → "Entendo. Vamos olhar o retorno: se [benefício], em quanto tempo você recupera esse investimento?"
- "Preciso pensar" → "Claro! O que especificamente você precisa avaliar? Posso ajudar com alguma informação?"
- "Já tenho fornecedor" → "Ótimo! O que faria você considerar uma alternativa? O que poderia ser melhor?"
- "Não é o momento" → "Entendo. O que mudaria para ser o momento certo? Posso te enviar algo relevante enquanto isso?"

REGRAS:
- NUNCA pressione — conduza
- Se o lead pedir tempo, dê prazo: "Sem problema! Posso te retornar [dia]?"
- Sempre termine com próximo passo definido
- Use números e dados sempre que possível
- Mensagens de até 4 linhas no WhatsApp`,
  },
  {
    name: "🔄 CS — Pós-venda",
    emoji: "🔄",
    role: "Customer Success",
    description: "Garante satisfação, retém clientes e identifica upsell",
    prompt: `Você é um Customer Success Manager (CSM) dedicado. Seu objetivo é RETER clientes, garantir satisfação e identificar oportunidades de expansão.

PERSONALIDADE:
- Proativo e atencioso
- Genuinamente interessado no sucesso do cliente
- Organizado e orientado a métricas
- Sabe equilibrar empatia com assertividade

FRAMEWORK DE ATUAÇÃO:

1. ONBOARDING (primeiros 30 dias):
- Dê boas-vindas calorosas e personalize
- Garanta que o cliente está usando o produto/serviço
- Agende check-in na primeira semana: "Como estão os primeiros dias? Posso ajudar com algo?"
- Envie dicas de uso proativamente

2. ACOMPANHAMENTO CONTÍNUO:
- Check-in mensal: "Oi [nome]! Como está sendo a experiência? Algum ponto que podemos melhorar?"
- Monitore sinais de churn: inatividade, reclamações, tickets não resolvidos
- Compartilhe novidades relevantes: "Lançamos [feature] que resolve aquele ponto que você mencionou!"

3. GESTÃO DE CRISES:
- Se o cliente reclamar: valide PRIMEIRO, resolva DEPOIS
- "Entendo sua frustração e peço desculpas. Vou resolver isso agora."
- Nunca culpe o cliente ou terceirize responsabilidade
- Dê prazo realista e CUMPRA

4. EXPANSÃO (UPSELL/CROSS-SELL):
- Só sugira quando o cliente já está satisfeito (NPS ≥ 8)
- Conecte à necessidade real: "Vi que vocês cresceram X%. O plano [Y] tem [feature] que ajudaria com [problema do crescimento]"
- Nunca force — plante a semente e deixe o cliente amadurecer

REGRAS:
- Responda em até 4 horas (ou informe prazo)
- Sempre pergunte se resolveu ao final
- Documente tudo para o time
- Comemore conquistas do cliente: "Parabéns pelo resultado! 🎉"
- Mensagens acolhedoras mas profissionais`,
  },
  {
    name: "🔍 BDR — Prospecção Ativa",
    emoji: "🔍",
    role: "BDR",
    description: "Prospecta ativamente, gera interesse e abre portas para o time",
    prompt: `Você é um BDR (Business Development Representative) especialista em prospecção outbound. Seu objetivo é GERAR INTERESSE em leads frios e ABRIR PORTAS para o time comercial.

PERSONALIDADE:
- Descontraído mas profissional
- Criativo nas abordagens
- Resiliente — não desiste fácil
- Pesquisador nato — sempre sabe algo sobre o lead antes de abordar

ESTRATÉGIA DE PROSPECÇÃO:

1. PESQUISA PRÉVIA (use dados do lead):
- Identifique o segmento, porte e possíveis dores
- Busque conexões em comum ou eventos recentes
- Personalize CADA abordagem — NUNCA copie e cole

2. PRIMEIRA ABORDAGEM (Cold Outreach):
- Abertura com GANCHO relevante (nunca "Oi, tudo bem?")
- Exemplos de aberturas eficazes:
  • "[Nome], vi que a [empresa] está [crescendo/lançando/contratando]. Parabéns! Isso me fez pensar em algo..."
  • "[Nome], trabalhamos com [empresas similares] e notei que [empresa] pode ter o mesmo desafio de [dor específica]"
  • "[Nome], uma pergunta rápida: como vocês lidam com [dor do segmento] hoje?"
- NUNCA comece com pitch do produto

3. FOLLOW-UP INTELIGENTE:
- 1º follow-up (2-3 dias): Compartilhe conteúdo de valor relacionado à dor
- 2º follow-up (5-7 dias): Case de sucesso do mesmo segmento
- 3º follow-up (10-14 dias): Abordagem diferente (vídeo, áudio, dado novo)
- 4º follow-up (21 dias): "Break-up" respeitoso — "Não quero ser inconveniente..."

4. QUALIFICAÇÃO RÁPIDA:
- Se respondeu com interesse → passe para SDR/Closer com contexto completo
- Se respondeu com objeção → contorne 1x e passe se converter
- Se não respondeu → siga cadência e re-prospecte em 60 dias

REGRAS:
- Mensagem inicial MÁXIMO 2 linhas (WhatsApp)
- Sem links na primeira mensagem
- Sem apresentação institucional logo de cara
- 1 emoji por mensagem (máximo)
- Horário: segunda a sexta, 9h-18h
- Respeite "não tenho interesse" — agradeça e encerre`,
  },
];


const ASSISTANT_SUGGESTIONS = [
  { icon: Target, label: "Analisar lead", prompt: "Analise este lead e sugira a melhor abordagem: " },
  { icon: TrendingUp, label: "Diagnóstico de pipeline", prompt: "Faça um diagnóstico do meu pipeline de vendas. Quais gargalos posso ter e como melhorar a conversão?" },
  { icon: Users, label: "Script de objeção", prompt: "Crie scripts para contornar as 5 objeções mais comuns em vendas B2B do meu segmento." },
  { icon: Lightbulb, label: "Estratégia de prospecção", prompt: "Sugira uma estratégia de prospecção outbound para o meu negócio, incluindo canais, frequência e templates." },
  { icon: MessageCircle, label: "Resumir conversa", prompt: "Resuma esta conversa com o cliente e extraia os próximos passos: " },
  { icon: RefreshCw, label: "Follow-up inteligente", prompt: "Crie uma cadência de follow-up de 5 toques para um lead que demonstrou interesse mas não respondeu." },
];

const MSG_TYPES = [
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin },
  { value: "email", label: "Email", icon: Mail },
  { value: "cold_call", label: "Ligação", icon: Phone },
];

// ---- Streaming helper ----
async function streamAI(
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

const AI_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

// ========== FOLLOW-UP SECTION ==========
type FollowUpRule = {
  id?: string;
  org_id: string;
  ai_config_id: string;
  name: string;
  delay_minutes: number;
  step_order: number;
  enabled: boolean;
  context_hint: string;
};

function FollowUpSection({ orgId, aiConfigId, instanceName }: { orgId: string; aiConfigId: string; instanceName: string }) {
  const { toast } = useToast();
  const [rules, setRules] = useState<FollowUpRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeConvos, setActiveConvos] = useState(0);

  useEffect(() => {
    loadRules();
    loadActiveConversations();
  }, [aiConfigId]);

  const loadRules = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("follow_up_rules")
      .select("*")
      .eq("ai_config_id", aiConfigId)
      .order("step_order", { ascending: true });
    setRules((data as any[]) || []);
    setLoading(false);
  };

  const loadActiveConversations = async () => {
    const { count } = await supabase
      .from("conversation_tracker")
      .select("id", { count: "exact", head: true })
      .eq("ai_config_id", aiConfigId)
      .eq("follow_up_paused", false);
    setActiveConvos(count || 0);
  };

  const addRule = () => {
    const nextOrder = rules.length + 1;
    const defaults: Record<number, { delay: number; hint: string; name: string }> = {
      1: { delay: 30, hint: "reativar conversa de forma sutil", name: "Primeiro toque" },
      2: { delay: 120, hint: "relembrar proposta ou benefício", name: "Segundo toque" },
      3: { delay: 1440, hint: "última tentativa, oferecer ajuda", name: "Último toque" },
    };
    const d = defaults[nextOrder] || { delay: 60, hint: "reengajar lead", name: `Follow-up #${nextOrder}` };
    setRules(prev => [...prev, {
      org_id: orgId, ai_config_id: aiConfigId,
      name: d.name, delay_minutes: d.delay, step_order: nextOrder,
      enabled: true, context_hint: d.hint,
    }]);
  };

  const updateRule = (index: number, partial: Partial<FollowUpRule>) => {
    setRules(prev => prev.map((r, i) => i === index ? { ...r, ...partial } : r));
  };

  const removeRule = (index: number) => {
    const rule = rules[index];
    if (rule.id) {
      supabase.from("follow_up_rules").delete().eq("id", rule.id);
    }
    setRules(prev => prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, step_order: i + 1 })));
    toast({ title: "Etapa removida" });
  };

  const saveRules = async () => {
    setSaving(true);
    try {
      for (const rule of rules) {
        const payload = {
          org_id: orgId, ai_config_id: aiConfigId,
          name: rule.name, delay_minutes: rule.delay_minutes,
          step_order: rule.step_order, enabled: rule.enabled,
          context_hint: rule.context_hint,
        };
        if (rule.id) {
          await supabase.from("follow_up_rules").update(payload).eq("id", rule.id);
        } else {
          const { data } = await supabase.from("follow_up_rules").insert(payload).select().single();
          if (data) rule.id = data.id;
        }
      }
      toast({ title: "Cadência salva!", description: "As regras de follow-up foram atualizadas." });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const formatDelay = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    return `${Math.round(minutes / 1440)}d`;
  };

  const DELAY_OPTIONS = [
    { value: 5, label: "5 min" },
    { value: 10, label: "10 min" },
    { value: 15, label: "15 min" },
    { value: 30, label: "30 min" },
    { value: 60, label: "1 hora" },
    { value: 120, label: "2 horas" },
    { value: 360, label: "6 horas" },
    { value: 720, label: "12 horas" },
    { value: 1440, label: "24 horas" },
    { value: 2880, label: "48 horas" },
    { value: 4320, label: "72 horas" },
  ];

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/15">
            <RefreshCw className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h3 className="font-semibold">Cadência de Follow-up</h3>
            <p className="text-xs text-muted-foreground">A IA reenvia automaticamente se o lead não responder</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeConvos > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1 bg-primary/10 text-primary border-primary/30">
              <Users className="h-3 w-3" />{activeConvos} ativas
            </Badge>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Visual cadence timeline */}
          {rules.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-3 bg-secondary/30 rounded-xl overflow-x-auto">
              <div className="flex items-center gap-1 shrink-0">
                <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                  <MessageCircle className="h-3.5 w-3.5 text-success" />
                </div>
                <span className="text-[9px] text-muted-foreground">Conversa</span>
              </div>
              {rules.map((rule, i) => (
                <div key={i} className="flex items-center gap-1 shrink-0">
                  <div className="w-12 h-0.5 bg-border relative">
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[8px] text-muted-foreground whitespace-nowrap font-mono">
                      {formatDelay(rule.delay_minutes)}
                    </span>
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    rule.enabled ? "bg-warning/20 text-warning" : "bg-secondary text-muted-foreground"
                  }`}>
                    {i + 1}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Rules list */}
          <div className="space-y-2">
            {rules.map((rule, index) => (
              <div key={index} className={`border rounded-xl p-3 space-y-2 transition-colors ${rule.enabled ? "" : "opacity-50"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Badge variant="outline" className="text-[10px] font-mono shrink-0">#{rule.step_order}</Badge>
                    <Input
                      value={rule.name}
                      onChange={e => updateRule(index, { name: e.target.value })}
                      className="h-7 text-xs rounded-lg bg-transparent border-none px-1 font-medium"
                      placeholder="Nome da etapa"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={v => updateRule(index, { enabled: v })}
                    />
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeRule(index)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Tempo sem resposta</Label>
                    <Select value={String(rule.delay_minutes)} onValueChange={v => updateRule(index, { delay_minutes: Number(v) })}>
                      <SelectTrigger className="h-7 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DELAY_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Objetivo do follow-up</Label>
                    <Input
                      value={rule.context_hint}
                      onChange={e => updateRule(index, { context_hint: e.target.value })}
                      placeholder="ex: reativar conversa"
                      className="h-7 text-xs rounded-lg"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs rounded-xl gap-1 flex-1" onClick={addRule}>
              <Plus className="h-3 w-3" /> Adicionar Etapa
            </Button>
            {rules.length > 0 && (
              <Button size="sm" className="text-xs rounded-xl gap-1 flex-1" onClick={saveRules} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Salvar Cadência
              </Button>
            )}
          </div>

          {rules.length === 0 && (
            <div className="text-center py-4 text-xs text-muted-foreground">
              <RefreshCw className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p>Nenhuma etapa de follow-up configurada.</p>
              <p className="text-[10px] mt-1">Adicione etapas para a IA reengajar leads automaticamente.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ========== CHATBOT TAB ==========
type RoutingMode = "simple" | "smart";

const SIMPLE_DESCRIPTIONS: Record<string, string> = {
  SDR: "Qualifica leads e agenda reuniões automaticamente",
  Closer: "Conduz negociações e fecha vendas com leads interessados",
  "Customer Success": "Cuida de clientes ativos e identifica oportunidades de upsell",
  BDR: "Prospecta ativamente e gera interesse em novos contatos",
};

function ChatbotTab({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [instances, setInstances] = useState<string[]>([]);
  const [configs, setConfigs] = useState<Record<string, AiConfig>>({});
  const [allConfigs, setAllConfigs] = useState<AiConfig[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<typeof CHATBOT_TEMPLATES[0] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [existingAgents, setExistingAgents] = useState<{ template: typeof CHATBOT_TEMPLATES[0]; config: AiConfig }[]>([]);
  const [routingMode, setRoutingMode] = useState<RoutingMode>("simple");
  const [smartInstance, setSmartInstance] = useState<string>("");
  const [savingMode, setSavingMode] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState<{ agent: string; instance: string; existingRole: string } | null>(null);

  useEffect(() => {
    setWebhookUrl(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-whatsapp-hook`);
  }, []);

  useEffect(() => {
    if (!orgId || !user) return;
    (async () => {
      setLoadingInstances(true);
      try {
        const { data } = await supabase
          .from("integrations").select("*")
          .eq("org_id", orgId).eq("service_name", "evolution").maybeSingle();
        if (data?.config) {
          const config = data.config as any;
          const byUser = config?.instances_by_user || {};
          const userInstances = byUser[user.id] || [];
          setInstances(userInstances);
          if (userInstances.length > 0 && !selectedInstance) setSelectedInstance(userInstances[0]);
        }
      } catch (e) { console.error(e); }
      setLoadingInstances(false);
    })();
  }, [orgId, user]);

  const loadConfigs = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase.from("ai_configs").select("*").eq("org_id", orgId).eq("config_type", "chatbot");
    const map: Record<string, AiConfig> = {};
    const agents: { template: typeof CHATBOT_TEMPLATES[0]; config: AiConfig }[] = [];
    const all: AiConfig[] = [];
    data?.forEach((row: any) => {
      const cfg: AiConfig = {
        ...row, schedule_days: row.schedule_days || [1, 2, 3, 4, 5],
        temperature: Number(row.temperature) || 0.7, config: row.config || {},
      };
      all.push(cfg);
      if (row.instance_name) map[row.instance_name] = cfg;
      const matchedTemplate = CHATBOT_TEMPLATES.find(t => cfg.config?.agent_role === t.role);
      if (matchedTemplate) agents.push({ template: matchedTemplate, config: cfg });
      // Detect routing mode from any config
      if (cfg.config?.routing_mode === "smart") {
        setRoutingMode("smart");
        if (cfg.instance_name) setSmartInstance(cfg.instance_name);
      }
    });
    setConfigs(map);
    setExistingAgents(agents);
    setAllConfigs(all);
  }, [orgId]);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  const currentConfig = configs[selectedInstance] || {
    org_id: orgId, config_type: "chatbot", instance_name: selectedInstance,
    enabled: false, system_prompt: "", temperature: 0.7,
    schedule_start: "08:00", schedule_end: "18:00",
    schedule_days: [1, 2, 3, 4, 5], only_outside_hours: false, config: {},
  };

  const updateConfig = (partial: Partial<AiConfig>) => {
    setConfigs((prev) => ({ ...prev, [selectedInstance]: { ...currentConfig, ...partial } }));
  };

  const handleSave = async () => {
    if (!selectedInstance) return;
    setSaving(true);
    try {
      const payload = {
        org_id: orgId, config_type: "chatbot", instance_name: selectedInstance,
        enabled: currentConfig.enabled, system_prompt: currentConfig.system_prompt,
        temperature: currentConfig.temperature, schedule_start: currentConfig.schedule_start,
        schedule_end: currentConfig.schedule_end, schedule_days: currentConfig.schedule_days,
        only_outside_hours: currentConfig.only_outside_hours,
        config: {
          ...currentConfig.config,
          agent_role: selectedTemplate?.role || currentConfig.config?.agent_role,
          routing_mode: routingMode,
        },
      };
      if (currentConfig.id) {
        await supabase.from("ai_configs").update(payload).eq("id", currentConfig.id);
      } else {
        const { data } = await supabase.from("ai_configs").insert(payload).select().single();
        if (data) updateConfig({ id: data.id });
      }
      toast({ title: "Salvo!", description: "Configuração do chatbot atualizada." });
      logActivity({ action: "ia_config_salva", description: `Configuração do chatbot salva` });
      await loadConfigs();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
      logActivity({ action: "ia_config_salva", description: "Falha ao salvar configuração do chatbot", success: false, errorMessage: e.message });
    }
    setSaving(false);
  };

  // Save smart mode config
  const saveSmartMode = async () => {
    if (!smartInstance) { toast({ title: "Selecione um número WhatsApp", variant: "destructive" }); return; }
    setSavingMode(true);
    try {
      const activeProfiles = existingAgents
        .filter(a => a.config.enabled)
        .map(a => ({
          role: a.template.role,
          emoji: a.template.emoji,
          description: SIMPLE_DESCRIPTIONS[a.template.role] || a.template.description,
          prompt_summary: a.config.system_prompt?.substring(0, 300) || a.template.prompt.substring(0, 300),
        }));

      // Build smart routing system prompt
      const profilesText = activeProfiles.map((p, i) =>
        `${i + 1}. ${p.emoji} ${p.role} — Use quando: ${p.description}`
      ).join("\n");

      const smartPrompt = `Você é um assistente multi-função via WhatsApp. Analise a conversa e ESCOLHA qual personalidade usar:

PERFIS DISPONÍVEIS:
${profilesText}

REGRA: No início da sua resposta, inclua [PERFIL:${activeProfiles[0]?.role || "SDR"}] (invisível ao lead).
Depois responda normalmente com o tom e estratégia daquele perfil.

CRITÉRIOS DE DETECÇÃO:
- Lead novo, primeira interação, perguntas iniciais → SDR
- Lead demonstrou interesse, pediu preço, quer proposta → Closer
- Já é cliente, dúvida de uso, quer suporte → Customer Success
- Prospecção fria, lead sem histórico → BDR`;

      // Check if smart config already exists
      const existingSmartConfig = allConfigs.find(c => c.config?.routing_mode === "smart");
      const payload = {
        org_id: orgId, config_type: "chatbot", instance_name: smartInstance,
        enabled: true, system_prompt: smartPrompt, temperature: 0.7,
        config: { routing_mode: "smart", agent_profiles: activeProfiles },
      };

      if (existingSmartConfig?.id) {
        await supabase.from("ai_configs").update(payload).eq("id", existingSmartConfig.id);
      } else {
        await supabase.from("ai_configs").insert(payload);
      }

      toast({ title: "Modo Inteligente ativado! 🧠", description: `Todos os agentes ativos responderão automaticamente no número ${smartInstance}` });
      await loadConfigs();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSavingMode(false);
  };

  const handleToggleAgent = async (template: typeof CHATBOT_TEMPLATES[0], existing: { template: typeof CHATBOT_TEMPLATES[0]; config: AiConfig } | undefined) => {
    if (!existing) {
      // Auto-create the agent config when it doesn't exist yet
      try {
        // First, check if there's already a config for this agent_role (regardless of instance_name)
        const { data: existingByRole } = await supabase
          .from("ai_configs")
          .select("*")
          .eq("org_id", orgId)
          .eq("config_type", "chatbot")
          .contains("config", { agent_role: template.role })
          .maybeSingle();

        if (existingByRole) {
          // Just enable it
          const { error } = await supabase.from("ai_configs").update({
            enabled: true,
            config: { ...((existingByRole.config as any) || {}), agent_role: template.role, routing_mode: routingMode },
          }).eq("id", existingByRole.id);
          if (error) throw error;
        } else {
          // Create with a unique instance_name using role suffix
          const baseInstance = routingMode === "smart" ? (smartInstance || instances[0]) : selectedInstance;
          const instanceToUse = baseInstance
            ? `${baseInstance}__${template.role.toLowerCase().replace(/\s+/g, '_')}`
            : `agent__${template.role.toLowerCase().replace(/\s+/g, '_')}`;

          const payload = {
            org_id: orgId,
            config_type: "chatbot",
            instance_name: instanceToUse,
            enabled: true,
            system_prompt: template.prompt,
            temperature: 0.7,
            schedule_start: "08:00",
            schedule_end: "18:00",
            schedule_days: [1, 2, 3, 4, 5],
            only_outside_hours: false,
            config: {
              agent_role: template.role,
              routing_mode: routingMode,
            },
          };
          const { error } = await supabase.from("ai_configs").insert(payload);
          if (error) throw error;
        }
        toast({ title: `${template.role} criado e ativado! ✅` });
        await loadConfigs();
      } catch (e: any) {
        toast({ title: "Erro ao criar agente", description: e.message, variant: "destructive" });
      }
      return;
    }
    const newEnabled = !existing.config.enabled;
    setExistingAgents(prev => prev.map(a =>
      a.template.role === template.role ? { ...a, config: { ...a.config, enabled: newEnabled } } : a
    ));
    const { error } = await supabase.from("ai_configs").update({ enabled: newEnabled }).eq("id", existing.config.id!);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setExistingAgents(prev => prev.map(a =>
        a.template.role === template.role ? { ...a, config: { ...a.config, enabled: !newEnabled } } : a
      ));
    } else {
      toast({ title: newEnabled ? `${template.role} ativado!` : `${template.role} desativado` });
    }
  };

  // Check which agent is on which instance
  const getInstanceAgent = (instanceName: string) => {
    return existingAgents.find(a => a.config.instance_name === instanceName && a.config.enabled);
  };

  const [copied, setCopied] = useState(false);
  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loadingInstances) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (instances.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center space-y-3">
        <Bot className="h-12 w-12 mx-auto text-muted-foreground/50" />
        <h3 className="text-lg font-semibold">Nenhuma instância WhatsApp</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">Crie uma instância WhatsApp na aba de Prospecção para configurar o chatbot.</p>
      </div>
    );
  }

  // ---- AGENT CARDS VIEW ----
  if (!showForm) {
    const activeCount = existingAgents.filter(a => a.config.enabled).length;
    return (
      <div className="space-y-5">
        {/* Explanatory Banner */}
        <div className="glass rounded-2xl p-5 border border-primary/20 bg-primary/5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 shrink-0">
              <Info className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-sm">Como funcionam os agentes?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Seus agentes são <strong>personalidades de IA</strong> que respondem automaticamente no WhatsApp.
                Cada um tem um estilo, tom e estratégia diferentes — como ter uma equipe completa de vendas 24h.
              </p>
            </div>
          </div>
        </div>

        {/* Routing Mode Selector */}
        <div className="glass rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Modo de Operação</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setRoutingMode("simple")}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                routingMode === "simple"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Radio className={`h-4 w-4 ${routingMode === "simple" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-semibold">Modo Simples</span>
                <Badge variant="secondary" className="text-[9px]">Padrão</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                1 agente fixo por número WhatsApp. Ex: SDR no número de prospecção, CS no número de suporte.
              </p>
            </button>
            <button
              onClick={() => setRoutingMode("smart")}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                routingMode === "smart"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Wand2 className={`h-4 w-4 ${routingMode === "smart" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-semibold">Modo Inteligente</span>
                <Badge className="text-[9px] bg-primary/20 text-primary border-0">Novo</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Todos os agentes no mesmo número. A IA detecta automaticamente qual personalidade usar baseado no contexto.
              </p>
            </button>
          </div>
        </div>

        {/* Smart mode: select instance + toggles */}
        {routingMode === "smart" && (
          <div className="glass rounded-2xl p-5 space-y-4 border border-primary/20">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Configuração do Modo Inteligente</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Escolha o número WhatsApp. A IA analisará cada conversa e decidirá automaticamente qual agente responder (SDR para leads novos, Closer quando há interesse, CS para clientes ativos).
            </p>
            <div className="space-y-2">
              <Label className="text-xs">Número WhatsApp para roteamento</Label>
              <Select value={smartInstance} onValueChange={setSmartInstance}>
                <SelectTrigger className="rounded-xl bg-secondary/30"><SelectValue placeholder="Selecione o número..." /></SelectTrigger>
                <SelectContent>
                  {instances.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Agentes ativos no roteamento</Label>
              <div className="space-y-2">
                {CHATBOT_TEMPLATES.map((t) => {
                  const existing = existingAgents.find(a => a.template.role === t.role);
                  const isActive = existing?.config.enabled ?? false;
                  return (
                    <div key={t.role} className="flex items-center justify-between rounded-xl border p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{t.emoji}</span>
                        <div>
                          <p className="text-xs font-semibold">{t.role}</p>
                          <p className="text-[10px] text-muted-foreground">{SIMPLE_DESCRIPTIONS[t.role]}</p>
                        </div>
                      </div>
                      <Switch
                        checked={isActive}
                        onCheckedChange={() => handleToggleAgent(t, existing)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <Button onClick={saveSmartMode} disabled={savingMode || !smartInstance} className="w-full rounded-xl gradient-primary h-10">
              {savingMode ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : <><Wand2 className="h-4 w-4 mr-2" />Ativar Modo Inteligente</>}
            </Button>
          </div>
        )}

        {/* Agent Cards */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium">Agentes de IA</h3>
            <Badge variant="outline" className="text-[10px] ml-auto">
              {activeCount} de {CHATBOT_TEMPLATES.length} ativos
            </Badge>
          </div>
          {routingMode === "simple" && (
            <p className="text-xs text-muted-foreground">Escolha um agente e ative-o no número WhatsApp desejado. Cada número pode ter apenas 1 agente.</p>
          )}
          {routingMode === "smart" && (
            <p className="text-xs text-muted-foreground">Configure cada agente abaixo. No modo inteligente, a IA alterna entre eles automaticamente.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CHATBOT_TEMPLATES.map((t) => {
              const existing = existingAgents.find(a => a.template.role === t.role);
              const isActive = existing?.config.enabled ?? false;
              const isConfigured = !!existing;

              return (
                <div
                  key={t.role}
                  className={`glass rounded-xl p-4 text-left hover:border-primary/30 hover:shadow-md transition-all group ${
                    isActive ? "border-success/30 bg-success/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{t.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold group-hover:text-primary transition-colors">{t.role}</p>
                      {routingMode === "simple" ? (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {existing?.config.instance_name ? `📱 ${existing.config.instance_name}` : "Não configurado"}
                        </p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {isActive ? "✨ Ativo (modo inteligente)" : "Inativo"}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      {isConfigured && routingMode === "simple" && (
                        <Switch
                          checked={isActive}
                          onCheckedChange={() => handleToggleAgent(t, existing)}
                        />
                      )}
                      {!isConfigured && (
                        <Badge variant="secondary" className="text-[10px]">Não config.</Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-3">{SIMPLE_DESCRIPTIONS[t.role] || t.description}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-7 gap-1"
                    onClick={() => {
                      setSelectedTemplate(t);
                      if (existing?.config.instance_name) setSelectedInstance(existing.config.instance_name);
                      if (existing) {
                        setConfigs(prev => ({
                          ...prev,
                          [existing.config.instance_name || selectedInstance]: existing.config,
                        }));
                      } else {
                        updateConfig({ system_prompt: t.prompt, config: { ...currentConfig.config, agent_role: t.role } });
                      }
                      setShowForm(true);
                    }}
                  >
                    {isConfigured ? "✏️ Editar" : "⚡ Configurar"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ---- AGENT CONFIG FORM ----
  return (
    <div className="space-y-5">
      <button onClick={() => setShowForm(false)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <span>←</span> Voltar para agentes
      </button>
      {selectedTemplate && (
        <div className="glass rounded-xl p-3 flex items-center gap-3">
          <span className="text-xl">{selectedTemplate.emoji}</span>
          <div className="flex-1">
            <p className="text-sm font-semibold">{selectedTemplate.role}</p>
            <p className="text-[10px] text-muted-foreground">{SIMPLE_DESCRIPTIONS[selectedTemplate.role] || selectedTemplate.description}</p>
          </div>
          {currentConfig.enabled && (
            <Badge className="bg-success/10 text-success border-success/30 text-[10px]">Ativo</Badge>
          )}
        </div>
      )}

      {/* Instance + Enable */}
      <div className="glass rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15">
              <MessageSquare className="h-5 w-5 text-success" />
            </div>
            <div>
              <h3 className="font-semibold">Seu número WhatsApp</h3>
              <p className="text-xs text-muted-foreground">Em qual número este agente vai responder?</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={currentConfig.enabled} onCheckedChange={(v) => updateConfig({ enabled: v })} />
            <Badge variant="outline" className={currentConfig.enabled ? "bg-success/10 text-success border-success/30 text-xs" : "text-xs"}>
              {currentConfig.enabled ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </div>
        <Select value={selectedInstance} onValueChange={(val) => {
          // Check if another agent is already on this instance (simple mode)
          if (routingMode === "simple") {
            const existing = getInstanceAgent(val);
            if (existing && existing.template.role !== selectedTemplate?.role) {
              setConfirmReplace({ agent: selectedTemplate?.role || "", instance: val, existingRole: existing.template.role });
              return;
            }
          }
          setSelectedInstance(val);
        }}>
          <SelectTrigger className="rounded-xl bg-secondary/30"><SelectValue placeholder="Selecione o número..." /></SelectTrigger>
          <SelectContent>
            {instances.map((name) => {
              const onInstance = getInstanceAgent(name);
              return (
                <SelectItem key={name} value={name}>
                  {name} {onInstance ? `(${onInstance.template.emoji} ${onInstance.template.role})` : ""}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Advanced Settings in Accordion */}
      <Accordion type="single" collapsible>
        <AccordionItem value="advanced" className="glass rounded-2xl border-0">
          <AccordionTrigger className="px-5 py-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Configurações Avançadas</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5 space-y-5">
            {/* Webhook URL */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-warning" />
                <Label className="font-semibold text-sm">Webhook URL</Label>
              </div>
              <p className="text-xs text-muted-foreground">Configurado automaticamente. Copie se precisar configurar manualmente.</p>
              <div className="flex gap-2">
                <Input readOnly value={webhookUrl} className="rounded-xl bg-secondary/30 font-mono text-xs" />
                <Button variant="outline" size="icon" className="rounded-xl shrink-0" onClick={copyWebhook}>
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Modular Prompt Editor */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" />
                <Label className="font-semibold text-sm">Personalidade do Agente</Label>
              </div>
              <p className="text-xs text-muted-foreground">Configure tom de voz, regras, objeções e formato das mensagens.</p>
              <ModularPromptEditor
                config={(currentConfig.config?.modular as ModularConfig) || DEFAULT_MODULAR_CONFIG}
                onChange={(modular) => updateConfig({ config: { ...currentConfig.config, modular } })}
              />
            </div>

            {/* Temperature */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-sm">Criatividade</Label>
                <Badge variant="outline" className="font-mono text-xs">{currentConfig.temperature.toFixed(1)}</Badge>
              </div>
              <Slider value={[currentConfig.temperature]} min={0} max={1} step={0.1} onValueChange={([v]) => updateConfig({ temperature: v })} className="py-2" />
              <div className="flex justify-between text-[10px] text-muted-foreground"><span>Preciso</span><span>Criativo</span></div>
            </div>

            {/* Schedule */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <Label className="font-semibold text-sm">Horário de Atendimento</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={currentConfig.only_outside_hours} onCheckedChange={(v) => updateConfig({ only_outside_hours: v })} />
                <span className="text-sm">Só responder fora do horário comercial</span>
              </div>
              {currentConfig.only_outside_hours && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Início</Label>
                      <Input type="time" value={currentConfig.schedule_start || "08:00"} onChange={(e) => updateConfig({ schedule_start: e.target.value })} className="rounded-xl bg-secondary/30" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Fim</Label>
                      <Input type="time" value={currentConfig.schedule_end || "18:00"} onChange={(e) => updateConfig({ schedule_end: e.target.value })} className="rounded-xl bg-secondary/30" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Dias úteis</Label>
                    <div className="flex gap-2 flex-wrap">
                      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                        <label key={d} className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <Checkbox
                            checked={currentConfig.schedule_days.includes(d)}
                            onCheckedChange={(checked) => {
                              const days = checked ? [...currentConfig.schedule_days, d] : currentConfig.schedule_days.filter((x) => x !== d);
                              updateConfig({ schedule_days: days });
                            }}
                          />
                          {DAY_LABELS[d]}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Follow-up Rules */}
      {currentConfig.id && selectedInstance ? (
        <FollowUpSection orgId={orgId} aiConfigId={currentConfig.id} instanceName={selectedInstance} />
      ) : (
        <div className="glass rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/15">
              <RefreshCw className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h3 className="font-semibold">Cadência de Follow-up</h3>
              <p className="text-xs text-muted-foreground">Salve a configuração primeiro para habilitar o follow-up automático.</p>
            </div>
          </div>
        </div>
      )}

      <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl gradient-primary hover:opacity-90 h-11">
        {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : <><Save className="h-4 w-4 mr-2" />Salvar Configuração</>}
      </Button>

      {/* Replace confirmation dialog */}
      <AlertDialog open={!!confirmReplace} onOpenChange={() => setConfirmReplace(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir agente?</AlertDialogTitle>
            <AlertDialogDescription>
              O número <strong>{confirmReplace?.instance}</strong> já tem o agente <strong>{confirmReplace?.existingRole}</strong> ativo.
              Deseja substituí-lo pelo <strong>{confirmReplace?.agent}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (confirmReplace) setSelectedInstance(confirmReplace.instance);
              setConfirmReplace(null);
            }}>Substituir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ========== ASSISTANT TAB ==========
function AssistantTab({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("ai_configs").select("*").eq("org_id", orgId).eq("config_type", "assistant")
      .is("instance_name", null).maybeSingle()
      .then(({ data }: any) => {
        if (data) setConfig({ ...data, temperature: Number(data.temperature) || 0.7, schedule_days: data.schedule_days || [] });
      });
  }, [orgId]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isLoading) return;
    const userMsg: ChatMessage = { role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const allMsgs = [...messages, userMsg];

    await streamAI(
      AI_CHAT_URL,
      { messages: allMsgs, org_id: orgId, mode: "assistant" },
      (full) => {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: full } : m);
          return [...prev, { role: "assistant", content: full }];
        });
      },
      () => setIsLoading(false),
      (err) => { toast({ title: "Erro", description: err, variant: "destructive" }); setIsLoading(false); },
    );
  };

  const saveConfig = async () => {
    if (!config) return;
    setSavingConfig(true);
    try {
      const payload = { org_id: orgId, config_type: "assistant", instance_name: null, enabled: true, system_prompt: config.system_prompt, temperature: config.temperature };
      if (config.id) {
        await supabase.from("ai_configs").update(payload).eq("id", config.id);
      } else {
        const { data } = await supabase.from("ai_configs").insert(payload).select().single();
        if (data) setConfig((prev) => prev ? { ...prev, id: data.id } : prev);
      }
      toast({ title: "Salvo!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSavingConfig(false);
  };

  const clearChat = () => setMessages([]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Assistente IA estratégico para sua equipe de vendas</p>
        <div className="flex gap-2">
          {messages.length > 0 && (
            <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={clearChat}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />Limpar
            </Button>
          )}
          <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => setShowConfig(!showConfig)}>
            {showConfig ? "Fechar Config" : "⚙️ Configurar"}
          </Button>
        </div>
      </div>

      {showConfig && (
        <div className="glass rounded-2xl p-5 space-y-4 animate-fade-in">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Prompt do Assistente</Label>
            <Textarea
              placeholder="Defina a personalidade e instruções do assistente interno..."
              value={config?.system_prompt || ""}
              onChange={(e) => setConfig((prev) => prev ? { ...prev, system_prompt: e.target.value } : {
                org_id: orgId, config_type: "assistant", enabled: true, system_prompt: e.target.value,
                temperature: 0.7, schedule_start: null, schedule_end: null, schedule_days: [], only_outside_hours: false, config: {},
              })}
              rows={4} className="rounded-xl bg-secondary/30 resize-none font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Criatividade</Label>
              <Badge variant="outline" className="font-mono text-xs">{(config?.temperature ?? 0.7).toFixed(1)}</Badge>
            </div>
            <Slider value={[config?.temperature ?? 0.7]} min={0} max={1} step={0.1} onValueChange={([v]) => setConfig((prev) => prev ? { ...prev, temperature: v } : prev)} />
          </div>
          <Button onClick={saveConfig} disabled={savingConfig} size="sm" className="rounded-xl gradient-primary">
            {savingConfig ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}Salvar
          </Button>
        </div>
      )}

      {/* Quick suggestions */}
      {messages.length === 0 && (
        <div className="grid grid-cols-2 gap-2">
          {ASSISTANT_SUGGESTIONS.map((s) => (
            <Button
              key={s.label} variant="outline" size="sm"
              className="rounded-xl text-xs h-auto py-2.5 justify-start text-left"
              onClick={() => {
                if (s.prompt.endsWith(": ")) {
                  setInput(s.prompt);
                } else {
                  sendMessage(s.prompt);
                }
              }}
            >
              <s.icon className="h-3.5 w-3.5 mr-1.5 shrink-0 text-primary" />{s.label}
            </Button>
          ))}
        </div>
      )}

      {/* Chat */}
      <div className="glass rounded-2xl overflow-hidden flex flex-col" style={{ height: "60vh" }}>
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
              <Brain className="h-10 w-10 text-primary/40" />
              <p className="text-sm text-muted-foreground">Pergunte qualquer coisa sobre seus leads, estratégias de vendas, ou peça análises.</p>
            </div>
          )}
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "gradient-primary text-primary-foreground whitespace-pre-wrap"
                    : "bg-secondary/50 text-foreground"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-li:my-0.5 prose-ul:my-1">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : msg.content}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-secondary/50 rounded-2xl px-4 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
          <div ref={scrollRef} />
        </ScrollArea>

        <div className="border-t border-border/50 p-3 flex gap-2">
          <Input
            placeholder="Pergunte algo..."
            value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            className="rounded-xl bg-secondary/30 border-0"
          />
          <Button onClick={() => sendMessage()} disabled={isLoading || !input.trim()} size="icon" className="rounded-xl gradient-primary shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ========== KNOWLEDGE BASE TAB ==========
function KnowledgeBaseTab({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const loadDocs = useCallback(async () => {
    const { data } = await supabase.from("ai_knowledge_docs").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
    if (data) setDocs(data as KnowledgeDoc[]);
  }, [orgId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const processDoc = async (docId: string) => {
    setProcessingIds((prev) => new Set([...prev, docId]));
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ doc_id: docId }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Erro ao processar");
      toast({ title: "Processado!", description: `${result.chunks_count} chunks, ${result.keywords_count} keywords` });
      await loadDocs();
    } catch (e: any) {
      toast({ title: "Erro ao processar", description: e.message, variant: "destructive" });
    }
    setProcessingIds((prev) => { const s = new Set(prev); s.delete(docId); return s; });
  };

  const addDoc = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    setSaving(true);
    try {
      const { data } = await supabase.from("ai_knowledge_docs").insert({ org_id: orgId, title: newTitle.trim(), content: newContent.trim() }).select().single();
      setNewTitle(""); setNewContent("");
      await loadDocs();
      toast({ title: "Documento adicionado! Processando..." });
      if (data?.id) processDoc(data.id);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const deleteDoc = async (id: string) => {
    await supabase.from("ai_knowledge_docs").delete().eq("id", id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
    toast({ title: "Removido" });
  };

  const reprocessAll = async () => {
    const unprocessed = docs.filter((d) => !d.processed && d.id);
    if (unprocessed.length === 0) { toast({ title: "Todos já estão processados!" }); return; }
    toast({ title: `Processando ${unprocessed.length} documento(s)...` });
    for (const doc of unprocessed) { if (doc.id) await processDoc(doc.id); }
  };

  const loadSalesTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const { SALES_KNOWLEDGE_TEMPLATES } = await import("@/data/salesKnowledgeTemplates");
      const existingTitles = new Set(docs.map((d) => d.title));
      const newTemplates = SALES_KNOWLEDGE_TEMPLATES.filter((t) => !existingTitles.has(t.title));

      if (newTemplates.length === 0) {
        toast({ title: "Templates já carregados", description: "Todos os templates de vendas já estão na base." });
        setLoadingTemplates(false);
        return;
      }

      const inserts = newTemplates.map((t) => ({ org_id: orgId, title: t.title, content: t.content }));
      const { data } = await supabase.from("ai_knowledge_docs").insert(inserts).select();

      toast({ title: `${newTemplates.length} templates adicionados!`, description: "Processando automaticamente..." });
      await loadDocs();

      // Process each in background
      if (data) {
        for (const doc of data) {
          processDoc(doc.id);
        }
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setLoadingTemplates(false);
  };

  return (
    <div className="space-y-5">
      {/* Sales Templates Banner */}
      <div className="glass rounded-2xl p-5 border border-primary/20 bg-primary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Base de Vendas Especialista</h3>
              <p className="text-xs text-muted-foreground">10 documentos com metodologias, scripts, objeções, métricas e frameworks de vendas</p>
            </div>
          </div>
          <Button onClick={loadSalesTemplates} disabled={loadingTemplates} size="sm" className="rounded-xl gradient-primary shrink-0">
            {loadingTemplates ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Carregando...</> : <><Download className="h-3.5 w-3.5 mr-1.5" />Carregar Templates</>}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Documentos processados automaticamente com chunking e keywords para busca inteligente.</p>
        <Button variant="outline" size="sm" className="rounded-xl text-xs shrink-0" onClick={reprocessAll}>
          <Zap className="h-3.5 w-3.5 mr-1.5" />Processar Pendentes
        </Button>
      </div>

      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /><Label className="font-semibold text-sm">Novo Documento</Label></div>
        <Input placeholder="Título (ex: FAQ, Tabela de Preços...)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="rounded-xl bg-secondary/30" />
        <Textarea placeholder="Cole aqui o conteúdo completo..." value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={6} className="rounded-xl bg-secondary/30 resize-none" />
        <Button onClick={addDoc} disabled={saving || !newTitle.trim() || !newContent.trim()} className="rounded-xl gradient-primary">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}Adicionar
        </Button>
      </div>

      <div className="space-y-3">
        {docs.length === 0 && (
          <div className="glass rounded-2xl p-8 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum documento na base de conhecimento</p>
          </div>
        )}
        {docs.map((doc) => {
          const isProcessing = doc.id ? processingIds.has(doc.id) : false;
          return (
            <div key={doc.id} className="glass rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-sm">{doc.title}</h4>
                  {doc.processed ? (
                    <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30"><Check className="h-2.5 w-2.5 mr-0.5" />Processado</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30">Pendente</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!doc.processed && doc.id && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => doc.id && processDoc(doc.id)} disabled={isProcessing}>
                      {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 text-warning" />}
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => doc.id && deleteDoc(doc.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {doc.processed && doc.summary && <p className="text-xs text-muted-foreground italic">{doc.summary}</p>}
              {doc.processed && doc.keywords?.length ? (
                <div className="flex flex-wrap gap-1">
                  {doc.keywords.slice(0, 12).map((kw, i) => <Badge key={i} variant="secondary" className="text-[10px] py-0">{kw}</Badge>)}
                  {doc.keywords.length > 12 && <Badge variant="secondary" className="text-[10px] py-0">+{doc.keywords.length - 12}</Badge>}
                </div>
              ) : <p className="text-xs text-muted-foreground line-clamp-3">{doc.content}</p>}
              {doc.processed && doc.chunks?.length && <p className="text-[10px] text-muted-foreground/60">{doc.chunks.length} chunk(s) indexados</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ========== MESSAGE GENERATION TAB ==========
function MessagesTab({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [context, setContext] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [msgType, setMsgType] = useState("whatsapp");
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    supabase.from("ai_configs").select("*").eq("org_id", orgId).eq("config_type", "messages")
      .is("instance_name", null).maybeSingle()
      .then(({ data }: any) => {
        if (data) setConfig({ ...data, temperature: Number(data.temperature) || 0.8, schedule_days: data.schedule_days || [] });
      });
  }, [orgId]);

  const generate = async () => {
    if (!context.trim()) return;
    setIsLoading(true);
    setResult("");

    const enrichedContent = `[TIPO:${msgType}]\n\n${context}`;

    await streamAI(
      AI_CHAT_URL,
      { messages: [{ role: "user", content: enrichedContent }], org_id: orgId, mode: "generate_message" },
      (full) => setResult(full),
      () => setIsLoading(false),
      (err) => { toast({ title: "Erro", description: err, variant: "destructive" }); setIsLoading(false); },
    );
  };

  const saveConfig = async () => {
    if (!config) return;
    setSavingConfig(true);
    try {
      const payload = { org_id: orgId, config_type: "messages", instance_name: null, enabled: true, system_prompt: config.system_prompt, temperature: config.temperature };
      if (config.id) {
        await supabase.from("ai_configs").update(payload).eq("id", config.id);
      } else {
        const { data } = await supabase.from("ai_configs").insert(payload).select().single();
        if (data) setConfig((prev) => prev ? { ...prev, id: data.id } : prev);
      }
      toast({ title: "Salvo!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSavingConfig(false);
  };

  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gere mensagens de prospecção otimizadas por canal</p>
        <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => setShowConfig(!showConfig)}>
          {showConfig ? "Fechar Config" : "⚙️ Configurar"}
        </Button>
      </div>

      {showConfig && (
        <div className="glass rounded-2xl p-5 space-y-4 animate-fade-in">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Instruções adicionais para geração</Label>
            <Textarea
              placeholder="Ex: Use tom informal, foque nos benefícios do produto X, inclua cases de sucesso..."
              value={config?.system_prompt || ""}
              onChange={(e) => setConfig((prev) => prev ? { ...prev, system_prompt: e.target.value } : {
                org_id: orgId, config_type: "messages", enabled: true, system_prompt: e.target.value,
                temperature: 0.8, schedule_start: null, schedule_end: null, schedule_days: [], only_outside_hours: false, config: {},
              })}
              rows={3} className="rounded-xl bg-secondary/30 resize-none"
            />
          </div>
          <Button onClick={saveConfig} disabled={savingConfig} size="sm" className="rounded-xl gradient-primary">
            {savingConfig ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}Salvar
          </Button>
        </div>
      )}

      {/* Channel selector */}
      <div className="glass rounded-2xl p-5 space-y-3">
        <Label className="font-semibold text-sm">Canal de Prospecção</Label>
        <div className="grid grid-cols-4 gap-2">
          {MSG_TYPES.map((t) => (
            <Button
              key={t.value}
              variant={msgType === t.value ? "default" : "outline"}
              size="sm"
              className={`rounded-xl text-xs h-auto py-2.5 flex-col gap-1 ${msgType === t.value ? "gradient-primary" : ""}`}
              onClick={() => setMsgType(t.value)}
            >
              <t.icon className="h-4 w-4" />{t.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl p-5 space-y-3">
        <Label className="font-semibold text-sm">Contexto do Lead</Label>
        <Textarea
          placeholder={`Cole informações do lead para gerar mensagem de ${MSG_TYPES.find(t => t.value === msgType)?.label || "prospecção"}:\n\n• Nome, empresa, cargo\n• Segmento e porte\n• Dor/necessidade identificada\n• Como descobriu o lead`}
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={5} className="rounded-xl bg-secondary/30 resize-none"
        />
        <Button onClick={generate} disabled={isLoading || !context.trim()} className="rounded-xl gradient-primary w-full">
          {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Gerando...</> : <><Sparkles className="h-4 w-4 mr-2" />Gerar Mensagens</>}
        </Button>
      </div>

      {result && (
        <div className="glass rounded-2xl p-5 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <Label className="font-semibold text-sm">Mensagens Geradas</Label>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
              navigator.clipboard.writeText(result);
              setCopied(true); setTimeout(() => setCopied(false), 2000);
            }}>
              {copied ? <Check className="h-3.5 w-3.5 mr-1 text-success" /> : <Copy className="h-3.5 w-3.5 mr-1" />}Copiar
            </Button>
          </div>
          <div className="bg-secondary/30 rounded-xl p-4 text-sm prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== AI CONTROL TAB ==========
function ControlTab({ orgId }: { orgId: string }) {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [metrics, setMetrics] = useState({ totalConversations: 0, activeConversations: 0, totalLeadsConverted: 0 });
  const [activities, setActivities] = useState<any[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const { toast } = useToast();

  // Load real global AI enabled state from ai_scenarios
  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data } = await supabase
        .from("ai_scenarios" as any)
        .select("enabled")
        .eq("org_id", orgId)
        .eq("enabled", true)
        .limit(1);
      setAiEnabled((data?.length || 0) > 0);
    })();
  }, [orgId]);

  // Load real metrics
  useEffect(() => {
    if (!orgId) return;
    (async () => {
      setLoadingMetrics(true);
      try {
        // Total conversations tracked
        const { count: totalConvos } = await supabase
          .from("conversation_tracker")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId);

        // Active conversations (not paused, recent activity)
        const { count: activeConvos } = await supabase
          .from("conversation_tracker")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("follow_up_paused", false);

        // Leads converted
        const { count: leadsConverted } = await supabase
          .from("leads_raw")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("status", "converted");

        setMetrics({
          totalConversations: totalConvos || 0,
          activeConversations: activeConvos || 0,
          totalLeadsConverted: leadsConverted || 0,
        });
      } catch (e) { console.error(e); }
      setLoadingMetrics(false);
    })();
  }, [orgId]);

  // Load real activity logs (IA-related)
  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("org_id", orgId)
        .like("action", "ia_%")
        .order("created_at", { ascending: false })
        .limit(20);
      setActivities(data || []);
    })();
  }, [orgId]);

  const toggleGlobalAI = async (enabled: boolean) => {
    setAiEnabled(enabled);
    // Toggle all scenarios for this org
    const { error } = await supabase
      .from("ai_scenarios" as any)
      .update({ enabled })
      .eq("org_id", orgId);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      setAiEnabled(!enabled);
    } else {
      toast({ title: enabled ? "IA ativada!" : "IA desativada", description: enabled ? "Todos os cenários de IA foram ativados." : "Todos os cenários de IA foram pausados." });
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "agora";
    if (diffMin < 60) return `${diffMin}min atrás`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h atrás`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d atrás`;
  };

  const getActionLabel = (action: string) => {
    const map: Record<string, string> = {
      ia_config_salva: "Configuração salva",
      ia_chatbot_resposta: "Resposta enviada",
      ia_follow_up: "Follow-up disparado",
      ia_lead_qualificado: "Lead qualificado",
      ia_agendamento: "Agendamento criado",
      ia_erro: "Erro na IA",
    };
    return map[action] || action.replace("ia_", "").replace(/_/g, " ");
  };

  return (
    <div className="space-y-5">
      {/* Global Toggle */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Disparador IA</h3>
              <p className="text-xs text-muted-foreground">Ative para que a IA inicie e gerencie conversas automaticamente</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={aiEnabled} onCheckedChange={toggleGlobalAI} />
            <Badge variant="outline" className={aiEnabled ? "bg-success/10 text-success border-success/30 text-xs" : "text-xs"}>
              {aiEnabled ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Real Metrics */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Conversas Rastreadas", value: loadingMetrics ? "..." : String(metrics.totalConversations), color: "text-primary" },
          { label: "Conversas Ativas", value: loadingMetrics ? "..." : String(metrics.activeConversations), color: "text-success" },
          { label: "Leads Convertidos", value: loadingMetrics ? "..." : String(metrics.totalLeadsConverted), color: "text-warning" },
        ].map((m) => (
          <div key={m.label} className="glass rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Real Activity Feed */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-medium mb-4">Log de Atividades da IA</h3>
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda</p>
            <p className="text-xs text-muted-foreground/60 mt-1">As ações da IA aparecerão aqui em tempo real</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {activities.map((act) => (
                <div key={act.id} className="flex items-start gap-3 p-3 rounded-xl border bg-secondary/20">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${act.success ? "bg-success/15" : "bg-destructive/15"}`}>
                    {act.success ? <Sparkles className="h-4 w-4 text-success" /> : <Zap className="h-4 w-4 text-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium truncate">{getActionLabel(act.action)}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(act.created_at)}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{act.description}</p>
                    {act.error_message && <p className="text-[10px] text-destructive mt-0.5">{act.error_message}</p>}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

// ========== MAIN PAGE ==========
export default function AIPage() {
  const { profile } = useAuth();
  const orgId = profile?.org_id;

  if (!orgId) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="page-title">Agente IA</h1>
        <p className="page-description">Configure chatbot, assistente, controle e geração de conteúdo</p>
      </div>

      <Tabs defaultValue="control">
        <TabsList className="bg-secondary/30 rounded-xl p-1 h-auto flex-wrap">
          <TabsTrigger value="control" className="rounded-lg text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 px-3">
            <Zap className="h-3.5 w-3.5 mr-1.5" />Controle
          </TabsTrigger>
          <TabsTrigger value="assistant" className="rounded-lg text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 px-3">
            <Brain className="h-3.5 w-3.5 mr-1.5" />Assistente
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="rounded-lg text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 px-3">
            <FileText className="h-3.5 w-3.5 mr-1.5" />Conhecimento
          </TabsTrigger>
          <TabsTrigger value="messages" className="rounded-lg text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 px-3">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />Mensagens
          </TabsTrigger>
          <TabsTrigger value="simulator" className="rounded-lg text-xs data-[state=active]:bg-success/10 data-[state=active]:text-success py-2 px-3">
            <PlayCircle className="h-3.5 w-3.5 mr-1.5" />Simulador
          </TabsTrigger>
        </TabsList>

        <TabsContent value="control" className="mt-4"><ControlTab orgId={orgId} /></TabsContent>
        <TabsContent value="assistant" className="mt-4"><AssistantTab orgId={orgId} /></TabsContent>
        <TabsContent value="knowledge" className="mt-4"><KnowledgeBaseTab orgId={orgId} /></TabsContent>
        <TabsContent value="messages" className="mt-4"><MessagesTab orgId={orgId} /></TabsContent>
        <TabsContent value="simulator" className="mt-4"><AgentSimulator orgId={orgId} /></TabsContent>
      </Tabs>
    </div>
  );
}
