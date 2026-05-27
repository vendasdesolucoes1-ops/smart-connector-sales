import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import {
  UserCheck, Building2, Brain, BookOpen, Target, Package,
  Loader2, Send, ChevronDown, ChevronUp, Sparkles,
  CheckCircle2, XCircle, AlertTriangle, TrendingUp, Users, Zap,
  Bot, Save, Plus, X, Trash2, MessageCircle,
  Settings2, HelpCircle, Shield, Eye, ChevronsUpDown,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// ---- Types ----
type ProductItem = { name: string; description: string; price?: string };
type FaqItem = { question: string; answer: string };

type CompanyData = {
  id?: string;
  company_name: string;
  segment: string | null;
  description: string;
  mission: string;
  tone_of_voice: string;
  differentials: string;
  target_audience: string;
  sales_process: string;
  avg_ticket: string | null;
  logo_url: string | null;
  products_services: ProductItem[];
  objections_faq: FaqItem[];
  phone: string | null;
  email: string | null;
  website: string | null;
  business_models: string[];
};

type Scenario = {
  id: string;
  org_id: string;
  scenario_key: string;
  name: string;
  description: string;
  system_prompt: string;
  temperature: number;
  enabled: boolean;
  behavior: Record<string, any>;
};

type KnowledgeDoc = {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  keywords: string[];
  processed: boolean;
};

type ChatMsg = { role: "user" | "assistant"; content: string };

// ---- Scenario config ----
const SCENARIO_META: Record<string, { icon: string; color: string }> = {
  outbound_prospecting: { icon: "🎯", color: "text-chart-1" },
  broadcast_own_base: { icon: "📢", color: "text-chart-2" },
  broadcast_whatsapp: { icon: "💬", color: "text-chart-3" },
  organic_inbound: { icon: "🌱", color: "text-chart-4" },
};

// ---- Streaming helper ----
const SIMULATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/simulate-seller`;

async function streamSimulator(
  messages: ChatMsg[],
  onDelta: (full: string) => void,
  onDone: () => void,
  onError: (msg: string) => void,
) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { onError("Não autenticado"); return; }
    const resp = await fetch(SIMULATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ messages }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      onError(err.error || `Erro ${resp.status}`);
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
          if (content) { full += content; onDelta(full); }
        } catch (parseErr) { console.warn("SSE chunk parse error (non-critical):", parseErr); }
      }
    }
  } catch (e: any) { onError(e.message); }
  onDone();
}

// ---- Inline editable field ----
function EditField({ label, value, onChange, multiline, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</Label>
      {multiline ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="text-sm resize-none" />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="text-sm h-9" />
      )}
    </div>
  );
}

function ScoreBadge({ pct }: { pct: number }) {
  if (pct >= 80) return <Badge className="bg-success/15 text-success border-success/30 gap-1"><CheckCircle2 className="h-3 w-3" /> Pronto</Badge>;
  if (pct >= 50) return <Badge className="bg-warning/15 text-warning border-warning/30 gap-1"><AlertTriangle className="h-3 w-3" /> Parcial</Badge>;
  return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Incompleto</Badge>;
}

const SIM_SCENARIOS = [
  { label: "Lead frio", prompt: "Oi, vi a empresa de vocês na internet. O que fazem?" },
  { label: "Pedido de preço", prompt: "Quanto custa o serviço de vocês?" },
  { label: "Objeção", prompt: "Achei muito caro, o concorrente cobra menos." },
  { label: "Urgência", prompt: "Preciso de uma solução pra ontem, conseguem atender?" },
];

// ====== COMPONENT ======
export default function MySeller() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const ownOrgId = profile?.org_id;

  // Platform admin state
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [allOrgs, setAllOrgs] = useState<{ id: string; name: string }[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  
  // Effective org = selected (admin) or own
  const orgId = selectedOrgId || ownOrgId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [leadsCount, setLeadsCount] = useState(0);
  const [oppsCount, setOppsCount] = useState(0);
  const [pipelineValue, setPipelineValue] = useState(0);

  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const [generatingPrompt, setGeneratingPrompt] = useState<string | null>(null);
  const [promptDescriptions, setPromptDescriptions] = useState<Record<string, string>>({});

  // ---- Build final prompt preview ----
  const buildFinalPrompt = (scenario: Scenario): string => {
    const useEmoji = scenario.behavior?.use_emoji ?? true;
    const splitMessages = scenario.behavior?.split_messages ?? true;
    const maxBlocks = scenario.behavior?.max_blocks ?? 3;
    const maxCharsPerBlock = scenario.behavior?.max_chars_per_block ?? 500;
    const maxMessages = scenario.behavior?.max_messages ?? 15;
    const activeEngagement = scenario.behavior?.active_engagement ?? true;
    const hidePrices = scenario.behavior?.hide_prices ?? false;

    // Anti-hallucination prefix
    const antiHallucinationPrefix = `=== REGRA NÚMERO 1 (ACIMA DE TUDO — INVIOLÁVEL) ===
Você é um vendedor que SÓ pode falar sobre o que está EXPLICITAMENTE descrito neste prompt.
PROIBIÇÕES ABSOLUTAS:
- Se um produto, serviço, equipamento, processo ou detalhe técnico NÃO aparece LITERALMENTE nos dados abaixo, ele NÃO EXISTE. Ponto final.
- NUNCA ofereça coisas que não estão nos dados. NUNCA pergunte se o cliente quer algo que não está nos dados.
- NUNCA invente processos, equipamentos ou serviços. Se não está escrito, FINJA QUE NÃO EXISTE.
- Se o cliente perguntar algo fora dos dados, responda EXATAMENTE: "Vou verificar isso com a equipe e te retorno!"
- NUNCA repita informações que você já disse em mensagens anteriores. O cliente JÁ LIDA essas mensagens.
- NUNCA use aspas duplas na resposta. Não coloque sua resposta entre aspas.
- NUNCA comece a resposta repetindo a saudação do disparo. O cliente JÁ recebeu a saudação. Vá direto ao ponto.
${!useEmoji ? "- NUNCA use emojis. ZERO emojis. Nenhum emoji de qualquer tipo." : ""}
=== FIM DA REGRA NÚMERO 1 ===

`;

    // Behavior rules
    const behaviorParts: string[] = [];
    behaviorParts.push(`\nCONFIGURAÇÕES TÉCNICAS (aplicadas automaticamente):`);
    behaviorParts.push(`- Máximo de mensagens nesta conversa: ${maxMessages}`);

    if (splitMessages) {
      behaviorParts.push(`\nFORMATO DE RESPOSTA:`);
      behaviorParts.push(`- Divida sua resposta em NO MÁXIMO ${maxBlocks} blocos curtos (${maxCharsPerBlock} chars cada)`);
      behaviorParts.push(`- Separe cada bloco com ---BLOCO--- (numa linha isolada)`);
    } else {
      behaviorParts.push(`\nFORMATO DE RESPOSTA:`);
      behaviorParts.push(`- Responda em uma única mensagem fluida e natural`);
      behaviorParts.push(`- Máximo 600 caracteres por resposta`);
    }

    if (!useEmoji) behaviorParts.push(`- NÃO use emojis na resposta`);
    if (activeEngagement) behaviorParts.push(`- A ÚLTIMA mensagem DEVE terminar com uma PERGUNTA ABERTA ou convite para responder`);
    if (hidePrices) behaviorParts.push(`- NUNCA mencione preços ou valores. Se perguntarem, diga que precisa entender melhor a necessidade primeiro ou encaminhe para atendente`);

    behaviorParts.push(`\nCAPACIDADE DE AGENDAMENTO:`);
    behaviorParts.push(`Quando o lead quiser agendar, pergunte data e horário. Com data e hora, inclua: [AGENDAR:YYYY-MM-DD:HH:MM:NOME_DO_LEAD]`);
    behaviorParts.push(`\nResponda SEMPRE em português brasileiro.`);

    behaviorParts.push(`\nREGRA ANTI-INVENÇÃO (CRÍTICA E OBRIGATÓRIA):`);
    behaviorParts.push(`- NUNCA invente, suponha ou mencione produtos, serviços, equipamentos ou detalhes técnicos que NÃO estejam EXPLICITAMENTE descritos no seu prompt de sistema ou na base de conhecimento`);
    behaviorParts.push(`- Se você NÃO tem informação sobre algo, NÃO invente. Diga que vai verificar ou encaminhe para um atendente`);
    behaviorParts.push(`- NÃO use conhecimento geral do mundo para completar informações sobre a empresa. Use APENAS o que foi fornecido`);

    const behaviorRules = behaviorParts.join("\n");

    // Company context
    let companyContext = "";
    if (company) {
      const parts: string[] = [];
      if (company.company_name) parts.push(`Empresa: ${company.company_name}`);
      if (company.segment) parts.push(`Segmento: ${company.segment}`);
      if (company.description) parts.push(`Descrição: ${company.description}`);
      if (company.differentials) parts.push(`Diferenciais: ${company.differentials}`);
      if (company.target_audience) parts.push(`Público-alvo: ${company.target_audience}`);
      if (company.tone_of_voice) parts.push(`Tom de voz: ${company.tone_of_voice}`);
      if (company.sales_process) parts.push(`Processo de vendas: ${company.sales_process}`);
      if (company.products_services?.length) {
        parts.push(`\nProdutos/Serviços:`);
        company.products_services.forEach(p => {
          parts.push(`- ${p.name}: ${p.description}${p.price ? ` (${p.price})` : ""}`);
        });
      }
      if (company.objections_faq?.length) {
        parts.push(`\nFAQ/Objeções:`);
        company.objections_faq.forEach(f => {
          parts.push(`P: ${f.question}\nR: ${f.answer}`);
        });
      }
      if (parts.length > 0) companyContext = `\n\n--- DADOS DA EMPRESA ---\n${parts.join("\n")}\n--- FIM ---`;
    }

    // Knowledge context
    let knowledgeContext = "";
    if (docs.length > 0) {
      const docParts = docs.map(d => `## ${d.title}\n${d.summary || d.content.substring(0, 400)}`);
      knowledgeContext = `\n\n--- BASE DE CONHECIMENTO ---\n${docParts.join("\n\n")}\n--- FIM ---`;
    }

    const antiRepetitionReminder = `

=== LEMBRETE FINAL (RELEIA ANTES DE RESPONDER) ===
- NÃO invente NADA. Só fale do que está nos dados acima.
- NÃO repita produtos/serviços já mencionados nas mensagens anteriores.
- NÃO re-apresente a empresa. O cliente JÁ sabe quem você é.
- Foque em AVANÇAR a conversa conforme o processo de vendas da empresa.
${!useEmoji ? "- ZERO EMOJIS. Remova qualquer emoji antes de enviar." : ""}
===`;

    return antiHallucinationPrefix + (scenario.system_prompt || "(vazio)") + "\n" + behaviorRules + companyContext + knowledgeContext + antiRepetitionReminder;
  };

  // ---- Company updater ----
  const updateCompany = (field: keyof CompanyData, value: any) => {
    setCompany((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const saveCompany = async () => {
    if (!company || !orgId) return;
    setSaving("company");
    const { id, ...rest } = company;
    const payload = { ...rest, org_id: orgId };
    if (id) {
      const { error } = await supabase.from("company_profiles").update(payload).eq("id", id);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else toast({ title: "Perfil salvo!" });
    } else {
      const { data: inserted, error } = await supabase.from("company_profiles").insert(payload).select().single();
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { setCompany({ ...company, id: inserted.id }); toast({ title: "Perfil criado!" }); }
    }
    setSaving(null);
  };

  // ---- Scenario updater ----
  const updateScenario = (id: string, field: keyof Scenario, value: any) => {
    setScenarios(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const saveScenario = async (id: string) => {
    const sc = scenarios.find(s => s.id === id);
    if (!sc) return;
    setSaving(`scenario-${id}`);
    const { error } = await supabase.from("ai_scenarios" as any).update({
      system_prompt: sc.system_prompt,
      temperature: sc.temperature,
      enabled: sc.enabled,
      behavior: sc.behavior,
    } as any).eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: `${sc.name} salvo!` });
    setSaving(null);
  };

  const generatePrompt = async (scenarioId: string, scenarioKey: string) => {
    const desc = promptDescriptions[scenarioId];
    if (!desc?.trim()) {
      toast({ title: "Descreva o que o agente deve fazer", variant: "destructive" });
      return;
    }
    setGeneratingPrompt(scenarioId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("generate-prompt", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: { user_description: desc, prompt_type: scenarioKey, scenario_key: scenarioKey },
      });
      if (error) throw error;
      if (data?.prompt) {
        updateScenario(scenarioId, "system_prompt", data.prompt);
        toast({ title: "Prompt gerado!" });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setGeneratingPrompt(null);
  };

  // ---- Knowledge doc CRUD ----
  const addDoc = async () => {
    if (!orgId) return;
    const { data, error } = await supabase.from("ai_knowledge_docs").insert({ org_id: orgId, title: "Novo documento", content: "" }).select().single();
    if (data) setDocs(prev => [...prev, { ...data, keywords: [], processed: false } as any]);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
  };
  const updateDoc = (docId: string, field: keyof KnowledgeDoc, value: any) => {
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, [field]: value } : d));
  };
  const saveDoc = async (docId: string) => {
    const doc = docs.find(d => d.id === docId);
    if (!doc) return;
    setSaving(`doc-${docId}`);
    const { error } = await supabase.from("ai_knowledge_docs").update({ title: doc.title, content: doc.content }).eq("id", docId);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "Documento salvo!" });
    setSaving(null);
  };
  const deleteDoc = async (docId: string) => {
    const { error } = await supabase.from("ai_knowledge_docs").delete().eq("id", docId);
    if (!error) setDocs(prev => prev.filter(d => d.id !== docId));
  };

  // ---- Products CRUD ----
  const addProduct = () => { if (company) updateCompany("products_services", [...company.products_services, { name: "", description: "", price: "" }]); };
  const updateProduct = (idx: number, field: string, value: string) => {
    if (!company) return;
    const updated = [...company.products_services];
    (updated[idx] as any)[field] = value;
    updateCompany("products_services", updated);
  };
  const removeProduct = (idx: number) => { if (company) updateCompany("products_services", company.products_services.filter((_, i) => i !== idx)); };

  // ---- FAQ CRUD ----
  const addFaq = () => { if (company) updateCompany("objections_faq", [...company.objections_faq, { question: "", answer: "" }]); };
  const updateFaq = (idx: number, field: string, value: string) => {
    if (!company) return;
    const updated = [...company.objections_faq];
    (updated[idx] as any)[field] = value;
    updateCompany("objections_faq", updated);
  };
  const removeFaq = (idx: number) => { if (company) updateCompany("objections_faq", company.objections_faq.filter((_, i) => i !== idx)); };

  // ---- Check platform admin + load orgs ----
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (data) {
        setIsPlatformAdmin(true);
        const { data: orgs } = await supabase
          .from("organizations")
          .select("id, name")
          .order("name");
        setAllOrgs(orgs || []);
        // Default to own org
        setSelectedOrgId(ownOrgId || null);
      }
    })();
  }, [user, ownOrgId]);

  // ---- Fetch data for selected org ----
  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    (async () => {
      const [companyRes, scenariosRes, docsRes, leadsRes, oppsRes] = await Promise.all([
        supabase.from("company_profiles").select("*").eq("org_id", orgId).maybeSingle(),
        supabase.from("ai_scenarios" as any).select("*").eq("org_id", orgId).order("scenario_key" as any),
        supabase.from("ai_knowledge_docs").select("id, title, content, summary, keywords, processed").eq("org_id", orgId),
        supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", orgId),
        supabase.from("opportunities").select("value, probability").eq("org_id", orgId),
      ]);
      if (companyRes.data) {
        const cd = companyRes.data as any;
        setCompany({ ...cd, products_services: cd.products_services || [], objections_faq: cd.objections_faq || [], business_models: cd.business_models || [] } as CompanyData);
      } else {
        setCompany({
          company_name: "", segment: null, description: "", mission: "", tone_of_voice: "", differentials: "",
          target_audience: "", sales_process: "", avg_ticket: null, logo_url: null, products_services: [],
          objections_faq: [], phone: null, email: null, website: null, business_models: [],
        });
      }
      setScenarios((scenariosRes.data as any[]) || []);
      setDocs((docsRes.data as any[]) || []);
      setLeadsCount(leadsRes.count || 0);
      const opportunities = oppsRes.data || [];
      setOppsCount(opportunities.length);
      setPipelineValue(opportunities.reduce((s: number, o: any) => s + (Number(o.value) || 0), 0));
      setLoading(false);
    })();
  }, [orgId]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = text || chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput("");
    const userMsg: ChatMsg = { role: "user", content: msg };
    setChatMessages(prev => [...prev, userMsg]);
    setChatLoading(true);
    const allMsgs = [...chatMessages, userMsg];
    await streamSimulator(
      allMsgs,
      (full) => { setChatMessages(prev => { const last = prev[prev.length - 1]; if (last?.role === "assistant") return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: full } : m)); return [...prev, { role: "assistant", content: full }]; }); },
      () => setChatLoading(false),
      (err) => { setChatMessages(prev => [...prev, { role: "assistant", content: `⚠️ Erro: ${err}` }]); setChatLoading(false); },
    );
  }, [chatInput, chatMessages, chatLoading]);

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const activeScenarios = scenarios.filter(s => s.enabled).length;
  const totalScore = (company?.company_name ? 1 : 0) + (company?.description ? 1 : 0) + (company?.products_services?.length ? 1 : 0) + (docs.length > 0 ? 1 : 0) + (activeScenarios > 0 ? 1 : 0);
  const overallPct = Math.round((totalScore / 5) * 100);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-primary" /> Meu Vendedor
        </h1>
        <p className="page-description">Configure seus 4 cenários de IA. Cada cenário tem 1 prompt isolado e funciona de forma independente.</p>
      </div>

      {/* ====== ORG SELECTOR (Platform Admin only) ====== */}
      {isPlatformAdmin && (
        <div className="glass-card p-4 flex items-center gap-4 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-2 shrink-0">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">Admin</span>
          </div>
          <Select value={selectedOrgId || ""} onValueChange={(v) => setSelectedOrgId(v)}>
            <SelectTrigger className="flex-1 h-9 text-sm">
              <SelectValue placeholder="Selecione uma organização..." />
            </SelectTrigger>
            <SelectContent>
              {allOrgs.map(org => (
                <SelectItem key={org.id} value={org.id} className="text-sm">
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[10px] text-muted-foreground shrink-0">{allOrgs.length} orgs</span>
        </div>
      )}

      {/* ====== MAIN CARD ====== */}
      <div className="glass-card p-5 space-y-5">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground text-2xl font-bold shadow-lg">
              {company?.logo_url ? <img src={company.logo_url} alt="" className="h-full w-full rounded-2xl object-contain p-1.5" /> : <Bot className="h-8 w-8" />}
            </div>
            {activeScenarios > 0 && (
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-success border-2 border-card flex items-center justify-center">
                <Zap className="h-2.5 w-2.5 text-success-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold truncate">{company?.company_name || "Vendedor IA"}</h2>
              <ScoreBadge pct={overallPct} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeScenarios} de {scenarios.length} cenários ativos
            </p>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {leadsCount} leads</span>
              <span className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> {oppsCount} oportunidades</span>
              <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> R$ {pipelineValue.toLocaleString("pt-BR")}</span>
              <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {docs.length} docs</span>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium flex items-center gap-1.5"><Shield className="h-4 w-4 text-primary" /> Preparo do Vendedor</span>
            <span className="font-bold text-lg">{overallPct}%</span>
          </div>
          <Progress value={overallPct} className="h-3" />
        </div>
      </div>

      {/* ====== 4 SCENARIO CARDS ====== */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /> Cenários de IA</h2>
        <p className="text-[11px] text-muted-foreground">Cada cenário tem 1 prompt completo e isolado. Configure uma vez, funciona sempre igual.</p>
      </div>

      <div className="space-y-3">
        {scenarios.map(scenario => {
          const meta = SCENARIO_META[scenario.scenario_key] || { icon: "🤖", color: "text-primary" };
          const isOpen = openSections[`scenario-${scenario.id}`];
          return (
            <Collapsible key={scenario.id} open={isOpen} onOpenChange={() => toggleSection(`scenario-${scenario.id}`)}>
              <CollapsibleTrigger asChild>
                <button className="w-full glass-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center text-xl">{meta.icon}</div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{scenario.name}</p>
                        {scenario.enabled ? (
                          <Badge className="bg-success/15 text-success border-success/30 text-[9px]">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[9px]">Inativo</Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{scenario.description}</p>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="glass-card border-t-0 rounded-t-none p-4 space-y-4 animate-fade-in">
                {/* Enable toggle */}
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Cenário Ativo</Label>
                  <Switch checked={scenario.enabled} onCheckedChange={(v) => updateScenario(scenario.id, "enabled", v)} />
                </div>

                {/* Prompt */}
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Prompt do Cenário</Label>
                  <Textarea
                    value={scenario.system_prompt || ""}
                    onChange={(e) => updateScenario(scenario.id, "system_prompt", e.target.value)}
                    placeholder={`Descreva como o agente deve se comportar neste cenário (${scenario.name})...`}
                    rows={10}
                    className="text-sm resize-none font-mono text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-muted-foreground flex-1">Este prompt é exatamente o que a IA usará. Dados da empresa e base de conhecimento são injetados automaticamente.</p>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs shrink-0">
                          <Eye className="h-3 w-3" /> Ver Prompt Final
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[80vh]">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-primary" /> Prompt Final — {scenario.name}
                          </DialogTitle>
                        </DialogHeader>
                        <p className="text-xs text-muted-foreground">Este é o prompt completo que a IA recebe, incluindo regras de sistema, seu prompt, dados da empresa e base de conhecimento.</p>
                        <ScrollArea className="h-[60vh] border rounded-lg p-4 bg-secondary/20">
                          <pre className="text-xs font-mono whitespace-pre-wrap break-words text-foreground">
                            {buildFinalPrompt(scenario)}
                          </pre>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {/* Generate with AI */}
                <div className="border rounded-lg p-3 bg-secondary/30 space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" /> Gerar Prompt com IA</Label>
                  <Textarea
                    value={promptDescriptions[scenario.id] || ""}
                    onChange={(e) => setPromptDescriptions(prev => ({ ...prev, [scenario.id]: e.target.value }))}
                    placeholder="Descreva em linguagem natural o que o agente deve fazer neste cenário..."
                    rows={2}
                    className="text-sm resize-none"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => generatePrompt(scenario.id, scenario.scenario_key)}
                    disabled={generatingPrompt === scenario.id}
                  >
                    {generatingPrompt === scenario.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Gerar Prompt
                  </Button>
                </div>

                {/* Behavior accordion */}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                      <span className="text-xs font-medium flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Configurações de Comportamento</span>
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-5">
                    {/* ---- Toggles ---- */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center justify-between border rounded-lg p-3 bg-secondary/20">
                        <div>
                          <Label className="text-xs font-medium">Usar Emojis</Label>
                          <p className="text-[10px] text-muted-foreground">Agente usa emojis nas respostas</p>
                        </div>
                        <Switch
                          checked={scenario.behavior?.use_emoji ?? true}
                          onCheckedChange={(v) => updateScenario(scenario.id, "behavior", { ...scenario.behavior, use_emoji: v })}
                        />
                      </div>
                      <div className="flex items-center justify-between border rounded-lg p-3 bg-secondary/20">
                        <div>
                          <Label className="text-xs font-medium">Quebrar em Blocos</Label>
                          <p className="text-[10px] text-muted-foreground">Divide respostas longas em mensagens menores</p>
                        </div>
                        <Switch
                          checked={scenario.behavior?.split_messages ?? true}
                          onCheckedChange={(v) => updateScenario(scenario.id, "behavior", { ...scenario.behavior, split_messages: v })}
                        />
                      </div>
                      <div className="flex items-center justify-between border rounded-lg p-3 bg-secondary/20">
                        <div>
                          <Label className="text-xs font-medium">Engajamento Ativo</Label>
                          <p className="text-[10px] text-muted-foreground">Sempre termina com pergunta/gancho</p>
                        </div>
                        <Switch
                          checked={scenario.behavior?.active_engagement ?? true}
                          onCheckedChange={(v) => updateScenario(scenario.id, "behavior", { ...scenario.behavior, active_engagement: v })}
                        />
                      </div>
                      <div className="flex items-center justify-between border rounded-lg p-3 bg-secondary/20">
                        <div>
                          <Label className="text-xs font-medium">Ocultar Preços</Label>
                          <p className="text-[10px] text-muted-foreground">Omite valores e prioriza agendamento</p>
                        </div>
                        <Switch
                          checked={scenario.behavior?.hide_prices ?? false}
                          onCheckedChange={(v) => updateScenario(scenario.id, "behavior", { ...scenario.behavior, hide_prices: v })}
                        />
                      </div>
                    </div>

                    {/* ---- Sliders ---- */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Máx. mensagens na conversa</Label>
                        <span className="text-sm font-bold text-primary">{scenario.behavior?.max_messages ?? 15}</span>
                      </div>
                      <Slider
                        value={[scenario.behavior?.max_messages ?? 15]}
                        onValueChange={([v]) => updateScenario(scenario.id, "behavior", { ...scenario.behavior, max_messages: v })}
                        min={3} max={50} step={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Máx. blocos por resposta</Label>
                        <span className="text-sm font-bold text-primary">{scenario.behavior?.max_blocks ?? 3}</span>
                      </div>
                      <Slider
                        value={[scenario.behavior?.max_blocks ?? 3]}
                        onValueChange={([v]) => updateScenario(scenario.id, "behavior", { ...scenario.behavior, max_blocks: v })}
                        min={1} max={5} step={1}
                      />
                      <div className="flex justify-between text-[9px] text-muted-foreground">
                        <span>1 bloco</span><span>5 blocos</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Máx. caracteres por bloco</Label>
                        <span className="text-sm font-bold text-primary">{scenario.behavior?.max_chars_per_block ?? 500}</span>
                      </div>
                      <Slider
                        value={[scenario.behavior?.max_chars_per_block ?? 500]}
                        onValueChange={([v]) => updateScenario(scenario.id, "behavior", { ...scenario.behavior, max_chars_per_block: v })}
                        min={100} max={2000} step={50}
                      />
                      <div className="flex justify-between text-[9px] text-muted-foreground">
                        <span>Curto</span><span>Longo</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Delay de resposta</Label>
                        <span className="text-sm font-bold text-primary">{scenario.behavior?.delay_seconds ?? 5}s</span>
                      </div>
                      <Slider
                        value={[scenario.behavior?.delay_seconds ?? 5]}
                        onValueChange={([v]) => updateScenario(scenario.id, "behavior", { ...scenario.behavior, delay_seconds: v })}
                        min={0} max={30} step={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Temperatura</Label>
                        <span className="text-sm font-bold text-primary">{scenario.temperature}</span>
                      </div>
                      <Slider
                        value={[scenario.temperature]}
                        onValueChange={([v]) => updateScenario(scenario.id, "temperature", v)}
                        min={0} max={1} step={0.1}
                      />
                      <div className="flex justify-between text-[9px] text-muted-foreground">
                        <span>Preciso</span><span>Criativo</span>
                      </div>
                    </div>

                    {/* ---- Text fields ---- */}
                    <div className="space-y-3 border-t pt-4">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Mensagens Padrão</Label>
                      <div className="space-y-1">
                        <Label className="text-xs">Saudação inicial</Label>
                        <Textarea
                          value={scenario.behavior?.greeting_message || ""}
                          onChange={(e) => updateScenario(scenario.id, "behavior", { ...scenario.behavior, greeting_message: e.target.value })}
                          placeholder="Ex: Olá! 👋 Tudo bem? Sou o assistente da {empresa}..."
                          rows={2}
                          className="text-sm resize-none"
                        />
                        <p className="text-[10px] text-muted-foreground">Use {"{empresa}"} para injetar o nome. Deixe vazio para gerar automaticamente.</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Mensagem de encerramento</Label>
                        <Textarea
                          value={scenario.behavior?.farewell_message || ""}
                          onChange={(e) => updateScenario(scenario.id, "behavior", { ...scenario.behavior, farewell_message: e.target.value })}
                          placeholder="Ex: Foi um prazer conversar! Qualquer dúvida, estou por aqui 😊"
                          rows={2}
                          className="text-sm resize-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Mensagem fora do horário</Label>
                        <Textarea
                          value={scenario.behavior?.out_of_hours_message || ""}
                          onChange={(e) => updateScenario(scenario.id, "behavior", { ...scenario.behavior, out_of_hours_message: e.target.value })}
                          placeholder="Ex: Olá! Estamos fora do horário de atendimento. Retornaremos em breve!"
                          rows={2}
                          className="text-sm resize-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Palavras-chave para transferir (handoff)</Label>
                        <Input
                          value={scenario.behavior?.handoff_keywords?.join(", ") || ""}
                          onChange={(e) => updateScenario(scenario.id, "behavior", { ...scenario.behavior, handoff_keywords: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
                          placeholder="Ex: humano, atendente, gerente, cancelar"
                          className="text-sm h-9"
                        />
                        <p className="text-[10px] text-muted-foreground">Separe por vírgula. Ao detectar, a IA transfere para atendimento humano.</p>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <div className="flex justify-end">
                  <Button onClick={() => saveScenario(scenario.id)} disabled={saving === `scenario-${scenario.id}`} size="sm" className="gap-1.5">
                    {saving === `scenario-${scenario.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar Cenário
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      {/* ====== COMPANY IDENTITY ====== */}
      <Collapsible open={openSections["identity"]} onOpenChange={() => toggleSection("identity")}>
        <CollapsibleTrigger asChild>
          <button className="w-full glass-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Building2 className="h-4 w-4 text-primary" /></div>
              <div className="text-left">
                <p className="text-sm font-semibold">Identidade da Empresa</p>
                <p className="text-[11px] text-muted-foreground">{company?.company_name || "Não configurado"} · {company?.segment || "Sem segmento"}</p>
              </div>
            </div>
            {openSections["identity"] ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="glass-card border-t-0 rounded-t-none p-4 space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 gap-4">
            <EditField label="Nome da Empresa" value={company?.company_name || ""} onChange={(v) => updateCompany("company_name", v)} placeholder="Ex: VS Soluções" />
            <EditField label="Segmento" value={company?.segment || ""} onChange={(v) => updateCompany("segment", v)} placeholder="Ex: Tecnologia B2B" />
          </div>
          <EditField label="Descrição" value={company?.description || ""} onChange={(v) => updateCompany("description", v)} multiline placeholder="O que sua empresa faz?" />
          <div className="grid grid-cols-2 gap-4">
            <EditField label="Tom de Voz" value={company?.tone_of_voice || ""} onChange={(v) => updateCompany("tone_of_voice", v)} multiline placeholder="Profissional mas acessível" />
            <EditField label="Público-alvo" value={company?.target_audience || ""} onChange={(v) => updateCompany("target_audience", v)} multiline placeholder="Cliente ideal" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <EditField label="Diferenciais" value={company?.differentials || ""} onChange={(v) => updateCompany("differentials", v)} multiline placeholder="O que te diferencia?" />
            <EditField label="Processo de Vendas" value={company?.sales_process || ""} onChange={(v) => updateCompany("sales_process", v)} multiline placeholder="Como funciona sua venda?" />
          </div>
          <div className="flex justify-end">
            <Button onClick={saveCompany} disabled={saving === "company"} size="sm" className="gap-1.5">
              {saving === "company" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ---- PRODUCTS ---- */}
      <Collapsible open={openSections["products"]} onOpenChange={() => toggleSection("products")}>
        <CollapsibleTrigger asChild>
          <button className="w-full glass-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-chart-4/15 flex items-center justify-center"><Package className="h-4 w-4 text-chart-4" /></div>
              <div className="text-left">
                <p className="text-sm font-semibold">Produtos & Objeções</p>
                <p className="text-[11px] text-muted-foreground">{company?.products_services?.length || 0} produtos · {company?.objections_faq?.length || 0} objeções</p>
              </div>
            </div>
            {openSections["products"] ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="glass-card border-t-0 rounded-t-none p-4 space-y-4 animate-fade-in">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Produtos / Serviços</Label>
              <Button variant="outline" size="sm" onClick={addProduct} className="gap-1 text-xs h-7"><Plus className="h-3 w-3" /> Produto</Button>
            </div>
            {company?.products_services?.map((p, i) => (
              <div key={i} className="rounded-lg border bg-secondary/30 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input value={p.name} onChange={(e) => updateProduct(i, "name", e.target.value)} placeholder="Nome" className="text-sm h-8 flex-1" />
                  <Input value={p.price || ""} onChange={(e) => updateProduct(i, "price", e.target.value)} placeholder="Preço" className="text-sm h-8 w-32" />
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeProduct(i)}><X className="h-3.5 w-3.5" /></Button>
                </div>
                <Textarea value={p.description} onChange={(e) => updateProduct(i, "description", e.target.value)} placeholder="Descrição..." rows={2} className="text-sm resize-none" />
              </div>
            ))}
            {!company?.products_services?.length && <p className="text-sm text-muted-foreground italic text-center py-3">Nenhum produto cadastrado</p>}
          </div>
          <div className="space-y-3 pt-3 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1"><HelpCircle className="h-3 w-3" /> Objeções & Respostas</Label>
              <Button variant="outline" size="sm" onClick={addFaq} className="gap-1 text-xs h-7"><Plus className="h-3 w-3" /> Objeção</Button>
            </div>
            {company?.objections_faq?.map((faq, i) => (
              <div key={i} className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input value={faq.question} onChange={(e) => updateFaq(i, "question", e.target.value)} placeholder="Ex: Está caro..." className="text-sm h-8 flex-1" />
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeFaq(i)}><X className="h-3.5 w-3.5" /></Button>
                </div>
                <Textarea value={faq.answer} onChange={(e) => updateFaq(i, "answer", e.target.value)} placeholder="Contornar..." rows={2} className="text-sm resize-none" />
              </div>
            ))}
            {!company?.objections_faq?.length && <p className="text-sm text-muted-foreground italic text-center py-3">Nenhuma objeção mapeada</p>}
          </div>
          <div className="flex justify-end">
            <Button onClick={saveCompany} disabled={saving === "company"} size="sm" className="gap-1.5">
              {saving === "company" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ---- KNOWLEDGE DOCS ---- */}
      <Collapsible open={openSections["docs"]} onOpenChange={() => toggleSection("docs")}>
        <CollapsibleTrigger asChild>
          <button className="w-full glass-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-chart-5/15 flex items-center justify-center"><BookOpen className="h-4 w-4 text-chart-5" /></div>
              <div className="text-left">
                <p className="text-sm font-semibold">Base de Conhecimento</p>
                <p className="text-[11px] text-muted-foreground">{docs.length} documentos · {docs.filter(d => d.processed).length} processados</p>
              </div>
            </div>
            {openSections["docs"] ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="glass-card border-t-0 rounded-t-none p-4 space-y-4 animate-fade-in">
          <Button variant="outline" size="sm" onClick={addDoc} className="gap-1 text-xs"><Plus className="h-3 w-3" /> Novo Documento</Button>
          {docs.map(doc => (
            <div key={doc.id} className="rounded-lg border bg-secondary/30 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input value={doc.title} onChange={(e) => updateDoc(doc.id, "title", e.target.value)} placeholder="Título" className="text-sm h-8 flex-1" />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteDoc(doc.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
              <Textarea value={doc.content} onChange={(e) => updateDoc(doc.id, "content", e.target.value)} placeholder="Conteúdo..." rows={4} className="text-sm resize-none" />
              <div className="flex justify-end">
                <Button onClick={() => saveDoc(doc.id)} disabled={saving === `doc-${doc.id}`} size="sm" variant="outline" className="gap-1 text-xs h-7">
                  {saving === `doc-${doc.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvar
                </Button>
              </div>
            </div>
          ))}
          {docs.length === 0 && <p className="text-sm text-muted-foreground italic text-center py-4">Nenhum documento. A base de conhecimento é compartilhada entre todos os cenários.</p>}
        </CollapsibleContent>
      </Collapsible>

      {/* ---- SIMULATOR ---- */}
      <div className="glass-card p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><MessageCircle className="h-4 w-4 text-primary" /></div>
          <div>
            <p className="text-sm font-semibold">Simulador de Vendas</p>
            <p className="text-[11px] text-muted-foreground">Teste seu agente com cenários reais</p>
          </div>
        </div>

        <div className="flex gap-1 flex-wrap">
          {SIM_SCENARIOS.map(s => (
            <Button key={s.label} variant="outline" size="sm" className="text-[10px] h-6 px-2" onClick={() => sendMessage(s.prompt)}>
              {s.label}
            </Button>
          ))}
        </div>

        <ScrollArea className="h-[300px] rounded-lg border bg-secondary/20 p-3">
          <div className="space-y-3">
            {chatMessages.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Envie uma mensagem ou use um cenário acima</p>}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border"}`}>
                  {msg.role === "assistant" ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        <div className="flex gap-2">
          <Input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Simule uma mensagem de lead..."
            className="text-sm"
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          />
          <Button onClick={() => sendMessage()} disabled={chatLoading || !chatInput.trim()} size="sm" className="gap-1">
            {chatLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
