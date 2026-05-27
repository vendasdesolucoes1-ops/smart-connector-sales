import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Kanban, Loader2, GripVertical, Trash2, Edit,
  Phone, Mail, Sparkles, Target, Settings,
  DollarSign, Percent, X, Users, Bot, Zap,
  UserCheck, Headphones, Briefcase, Eye,
  ArrowRight, CheckCircle2, XCircle, Calendar,
  MessageSquare, Search as SearchIcon, TrendingUp,
  Activity, ChevronRight, Building2, Globe, Workflow
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

// ─── Pipeline Definition ───────────────────────────────────────────
const PIPELINE_STAGES = [
  {
    key: "lead", name: "Lead", icon: Users,
    gradient: "from-slate-500 to-slate-600",
    dotColor: "bg-slate-400",
    bgAccent: "bg-slate-500/10",
    borderAccent: "border-l-slate-500",
    roles: ["sdr"], aiTemplate: null,
    description: "Leads recém-capturados",
  },
  {
    key: "enriched", name: "Enriquecidas", icon: Sparkles,
    gradient: "from-violet-500 to-purple-600",
    dotColor: "bg-violet-400",
    bgAccent: "bg-violet-500/10",
    borderAccent: "border-l-violet-500",
    roles: ["sdr"], aiTemplate: "Pesquisa & Qualificação",
    aiHint: "Pesquisa sobre empresa, cargo e dados públicos.",
    description: "Dados enriquecidos pela IA",
  },
  {
    key: "contacted", name: "Contato Feito", icon: MessageSquare,
    gradient: "from-sky-500 to-sky-600",
    dotColor: "bg-sky-400",
    bgAccent: "bg-sky-500/10",
    borderAccent: "border-l-sky-500",
    roles: ["sdr"], aiTemplate: "SDR — BANT",
    aiHint: "Qualificação rápida: Budget, Authority, Need, Timeline.",
    description: "Primeiro contato realizado",
  },
  {
    key: "prospecting", name: "Em Prospecção", icon: SearchIcon,
    gradient: "from-cyan-500 to-teal-600",
    dotColor: "bg-cyan-400",
    bgAccent: "bg-cyan-500/10",
    borderAccent: "border-l-cyan-500",
    roles: ["sdr", "bdr"], aiTemplate: "BDR — SPIN Selling",
    aiHint: "Situação, Problema, Implicação, Necessidade.",
    description: "Cadência ativa de prospecção",
  },
  {
    key: "qualified", name: "Qualificado", icon: CheckCircle2,
    gradient: "from-emerald-500 to-green-600",
    dotColor: "bg-emerald-400",
    bgAccent: "bg-emerald-500/10",
    borderAccent: "border-l-emerald-500",
    roles: ["bdr"], aiTemplate: "BDR — MEDDIC",
    aiHint: "Metrics, Economic Buyer, Decision, Pain, Champion.",
    description: "Lead qualificado",
  },
  {
    key: "scheduled", name: "Agendado", icon: Calendar,
    gradient: "from-amber-500 to-orange-600",
    dotColor: "bg-amber-400",
    bgAccent: "bg-amber-500/10",
    borderAccent: "border-l-amber-500",
    roles: ["bdr", "closer"], aiTemplate: "Prep de Reunião",
    aiHint: "Preparar pauta e proposta de valor personalizada.",
    description: "Reunião agendada",
  },
  {
    key: "proposal", name: "Reunião / Proposta", icon: Briefcase,
    gradient: "from-indigo-500 to-indigo-600",
    dotColor: "bg-indigo-400",
    bgAccent: "bg-indigo-500/10",
    borderAccent: "border-l-indigo-500",
    roles: ["closer"], aiTemplate: "Closer — LAER",
    aiHint: "Listen, Acknowledge, Explore, Respond + Negociação.",
    description: "Proposta em negociação",
  },
  {
    key: "won", name: "Ganho", icon: TrendingUp,
    gradient: "from-emerald-500 to-green-600",
    dotColor: "bg-emerald-400",
    bgAccent: "bg-emerald-500/10",
    borderAccent: "border-l-emerald-500",
    roles: ["closer", "cs"], aiTemplate: "CS — Onboarding",
    aiHint: "Plano de onboarding e marcos de sucesso.",
    description: "Deal fechado!",
  },
  {
    key: "lost", name: "Perdido", icon: XCircle,
    gradient: "from-red-500 to-rose-600",
    dotColor: "bg-red-400",
    bgAccent: "bg-red-500/10",
    borderAccent: "border-l-red-500",
    roles: ["closer"], aiTemplate: "Win-Back",
    aiHint: "Análise de perda. Cadência de reativação 30/60/90.",
    description: "Oportunidade perdida",
  },
];

const VIEW_TABS = [
  { key: "all", label: "Pipeline", icon: Eye, stageFilter: null, description: "Visão completa do funil" },
  { key: "sdr", label: "SDR", icon: Zap, stageFilter: "sdr", description: "Captação e primeiro contato" },
  { key: "bdr", label: "BDR", icon: UserCheck, stageFilter: "bdr", description: "Qualificação aprofundada" },
  { key: "closer", label: "Closer", icon: Target, stageFilter: "closer", description: "Negociação e fechamento" },
  { key: "cs", label: "CS", icon: Headphones, stageFilter: "cs", description: "Sucesso do cliente" },
];

type Stage = { id: string; name: string; stage_order: number; stage_key: string | null };
type Opportunity = {
  id: string;
  stage_id: string;
  value: number | null;
  probability: number | null;
  notes: string | null;
  automation_status: string | null;
  personalized_message: string | null;
  message_sent_at: string | null;
  lead_id: string;
  lead: { name: string | null; phone: string | null; email: string | null; enrichment_data: any } | null;
};

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function getAvatarColor(name: string | null | undefined): string {
  if (!name) return "from-slate-400 to-slate-500";
  const colors = [
    "from-sky-400 to-sky-600",
    "from-violet-400 to-purple-600",
    "from-emerald-400 to-green-600",
    "from-amber-400 to-orange-600",
    "from-rose-400 to-red-600",
    "from-cyan-400 to-teal-600",
    "from-indigo-400 to-indigo-600",
    "from-pink-400 to-pink-600",
  ];
  const idx = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
  return colors[idx];
}

const AUTOMATION_STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Activity }> = {
  idle: { label: "Aguardando", color: "text-muted-foreground", icon: Activity },
  pending_enrichment: { label: "Enriquecendo...", color: "text-violet-400", icon: Sparkles },
  enriched_no_send: { label: "Sem envio", color: "text-amber-400", icon: MessageSquare },
  awaiting_response: { label: "Aguardando resposta", color: "text-sky-400", icon: MessageSquare },
  qualifying: { label: "Qualificando...", color: "text-cyan-400", icon: SearchIcon },
  qualified: { label: "Qualificado ✓", color: "text-emerald-400", icon: CheckCircle2 },
  scheduled: { label: "Agendado", color: "text-amber-400", icon: Calendar },
  enrichment_failed: { label: "Falha no enriquecimento", color: "text-red-400", icon: XCircle },
};

export default function CRM() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [stages, setStages] = useState<Stage[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("all");
  const [aiConfigDialog, setAiConfigDialog] = useState<typeof PIPELINE_STAGES[0] | null>(null);
  const [detailOpp, setDetailOpp] = useState<Opportunity | null>(null);
  const [editingOpp, setEditingOpp] = useState(false);
  const [oppValue, setOppValue] = useState("");
  const [oppProbability, setOppProbability] = useState("");
  const [oppNotes, setOppNotes] = useState("");
  const [handoffNumber, setHandoffNumber] = useState("");
  const [handoffAutoStages, setHandoffAutoStages] = useState<string[]>([]);
  const [handoffSaving, setHandoffSaving] = useState(false);
  const [showHandoffConfig, setShowHandoffConfig] = useState(false);
  const [handoffSending, setHandoffSending] = useState(false);

  const fetchHandoffNumber = useCallback(async () => {
    if (!profile?.org_id) return;
    const { data } = await supabase.from("organizations").select("handoff_number, handoff_auto_stages").eq("id", profile.org_id).single();
    if (data?.handoff_number) setHandoffNumber(data.handoff_number);
    if (data?.handoff_auto_stages) setHandoffAutoStages(data.handoff_auto_stages);
  }, [profile?.org_id]);

  const saveHandoffNumber = async () => {
    if (!profile?.org_id) return;
    setHandoffSaving(true);
    const { error } = await supabase.from("organizations").update({
      handoff_number: handoffNumber || null,
      handoff_auto_stages: handoffAutoStages,
    }).eq("id", profile.org_id);
    setHandoffSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Configuração de handoff salva!" });
    setShowHandoffConfig(false);
  };

  const toggleAutoStage = (stageKey: string) => {
    setHandoffAutoStages(prev =>
      prev.includes(stageKey) ? prev.filter(s => s !== stageKey) : [...prev, stageKey]
    );
  };

  const sendManualHandoff = async (opp: Opportunity) => {
    if (!handoffNumber) {
      toast({ title: "Configure o número de handoff primeiro", variant: "destructive" });
      setShowHandoffConfig(true);
      return;
    }
    if (!profile?.org_id) return;
    setHandoffSending(true);

    // Get Evolution instance - check user-specific first, then global
    const { data: integration } = await supabase
      .from("integrations")
      .select("config")
      .eq("org_id", profile.org_id)
      .eq("service_name", "evolution")
      .single();

    const cfg = integration?.config as any;
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const userInstances = userId && cfg?.instances_by_user?.[userId];
    const instanceName = userInstances?.[0] || cfg?.instances?.[0] || cfg?.instanceName;
    if (!instanceName) {
      toast({ title: "Instância WhatsApp não configurada", variant: "destructive" });
      setHandoffSending(false);
      return;
    }

    const enrichment = opp.lead?.enrichment_data || {};
    const stageDef = stageMap.get(opp.stage_id);
    const lines = [
      "🤖 *HANDOFF — Ficha de Qualificação*",
      "",
      `👤 *Nome:* ${opp.lead?.name || "N/A"}`,
      `📱 *Telefone:* ${opp.lead?.phone || "N/A"}`,
      `📧 *Email:* ${opp.lead?.email || "N/A"}`,
      enrichment?.empresa ? `🏢 *Empresa:* ${enrichment.empresa}` : null,
      enrichment?.segmento ? `📊 *Segmento:* ${enrichment.segmento}` : null,
      enrichment?.cargo_estimado ? `💼 *Cargo:* ${enrichment.cargo_estimado}` : null,
      enrichment?.porte ? `📐 *Porte:* ${enrichment.porte}` : null,
      enrichment?.score_conversao ? `🎯 *Score:* ${enrichment.score_conversao}/100` : null,
      "",
      `📍 *Etapa:* ${stageDef?.name || "N/A"}`,
      opp.value ? `💰 *Valor:* R$ ${opp.value}` : null,
      opp.probability ? `📈 *Probabilidade:* ${opp.probability}%` : null,
      opp.notes ? `📝 *Notas:* ${opp.notes}` : null,
      opp.personalized_message ? `\n💬 *Última msg IA:*\n${opp.personalized_message}` : null,
    ].filter(Boolean).join("\n");

    try {
      const sendPromise = supabase.functions.invoke("manage-evolution", {
        body: {
          action: "sendText",
          instanceName,
          number: handoffNumber.replace(/\D/g, ""),
          text: lines,
        },
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT")), 10000)
      );

      const { data: result, error } = await Promise.race([sendPromise, timeoutPromise]);
      if (error) throw error;

      if (result?.error || !result?.key) {
        toast({
          title: "Falha no envio do handoff",
          description: "Verifique a instância WhatsApp",
          variant: "destructive",
        });
      } else {
        toast({ title: "Ficha enviada para handoff! ✅" });
      }
    } catch (err: any) {
      if (err.message === "TIMEOUT") {
        toast({
          title: "Handoff enviado mas entrega não confirmada",
          description: "Timeout de 10s — verifique manualmente",
          variant: "destructive",
        });
      } else {
        toast({ title: "Erro ao enviar handoff", description: err.message, variant: "destructive" });
      }
    }
    setHandoffSending(false);
  };

  const fetchData = useCallback(async () => {
    if (!profile?.org_id) return;
    setLoading(true);
    const [stagesRes, oppsRes] = await Promise.all([
      supabase.from("crm_stages").select("id, name, stage_order, stage_key").eq("org_id", profile.org_id).order("stage_order"),
      supabase.from("opportunities").select("id, stage_id, value, probability, notes, automation_status, personalized_message, message_sent_at, lead_id, lead:leads_raw(name, phone, email, enrichment_data)").eq("org_id", profile.org_id),
    ]);

    let currentStages = stagesRes.data ?? [];
    if (currentStages.length === 0) {
      const stagesToInsert = PIPELINE_STAGES.map((s, i) => ({
        org_id: profile.org_id!, name: s.name, stage_order: i,
      }));
      const { data: newStages } = await supabase.from("crm_stages").insert(stagesToInsert).select("id, name, stage_order, stage_key").order("stage_order");
      currentStages = newStages ?? [];
    }

    setStages(currentStages);
    setOpportunities(
      (oppsRes.data ?? []).map((o: any) => ({
        ...o,
        lead: Array.isArray(o.lead) ? o.lead[0] || null : o.lead,
      }))
    );
    setLoading(false);
  }, [profile?.org_id]);

  useEffect(() => { fetchData(); fetchHandoffNumber(); }, [fetchData, fetchHandoffNumber]);

  const stageMap = useMemo(() => {
    const map = new Map<string, typeof PIPELINE_STAGES[0]>();
    stages.forEach((s) => {
      const def = PIPELINE_STAGES.find(p => p.key === s.stage_key);
      if (def) map.set(s.id, def);
    });
    return map;
  }, [stages]);

  const visibleStages = useMemo(() => {
    const tab = VIEW_TABS.find(t => t.key === activeView);
    if (!tab?.stageFilter) return stages;
    return stages.filter(s => {
      const def = stageMap.get(s.id);
      return def?.roles.includes(tab.stageFilter!);
    });
  }, [stages, activeView, stageMap]);

  const getOppsByStage = (stageId: string) => opportunities.filter((o) => o.stage_id === stageId);
  const stageTotal = (stageId: string) => getOppsByStage(stageId).reduce((sum, o) => sum + (o.value || 0), 0);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStageId = destination.droppableId;
    setOpportunities((prev) => prev.map((o) => (o.id === draggableId ? { ...o, stage_id: newStageId } : o)));
    const { error } = await supabase.from("opportunities").update({ stage_id: newStageId }).eq("id", draggableId);
    if (error) { toast({ title: "Erro ao mover", description: error.message, variant: "destructive" }); fetchData(); }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);

  const saveOppDetails = async () => {
    if (!detailOpp) return;
    const { error } = await supabase.from("opportunities").update({
      value: oppValue ? parseFloat(oppValue) : null,
      probability: oppProbability ? parseInt(oppProbability) : null,
      notes: oppNotes || null,
    }).eq("id", detailOpp.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Atualizado!" });
    setEditingOpp(false);
    fetchData();
  };

  const deleteOpp = async (oppId: string) => {
    const { error } = await supabase.from("opportunities").delete().eq("id", oppId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Excluído!" });
    setDetailOpp(null);
    fetchData();
  };

  const openOppDetail = (opp: Opportunity) => {
    setDetailOpp(opp);
    setOppValue(opp.value?.toString() || "");
    setOppProbability(opp.probability?.toString() || "");
    setOppNotes(opp.notes || "");
    setEditingOpp(false);
  };

  const viewOpps = useMemo(() => {
    const visibleIds = new Set(visibleStages.map(s => s.id));
    return opportunities.filter(o => visibleIds.has(o.stage_id));
  }, [opportunities, visibleStages]);

  const totalValue = viewOpps.reduce((sum, o) => sum + (o.value || 0), 0);
  const avgProbability = viewOpps.length > 0
    ? Math.round(viewOpps.reduce((sum, o) => sum + (o.probability || 0), 0) / viewOpps.length) : 0;

  const wonStage = stages.find(s => {
    const def = stageMap.get(s.id);
    return def?.key === "won";
  });
  const wonCount = wonStage ? getOppsByStage(wonStage.id).length : 0;
  const conversionRate = opportunities.length > 0 ? Math.round((wonCount / opportunities.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando pipeline...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-5 h-full flex flex-col w-full">
        {/* ─── Header ─── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
           <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Pipeline de Vendas</h1>
              <p className="page-description">
                {opportunities.length} {opportunities.length === 1 ? "oportunidade" : "oportunidades"} ativas
              </p>
            </div>
          </div>

          {/* Quick stats inline */}
          <div className="flex items-center gap-3 flex-wrap">
            <StatPill icon={Target} label="Opps" value={viewOpps.length.toString()} />
            <StatPill icon={DollarSign} label="Valor" value={formatCurrency(totalValue)} color="text-emerald-400" />
            <StatPill icon={Percent} label="Prob" value={`${avgProbability}%`} color="text-violet-400" />
            <StatPill icon={TrendingUp} label="Conv" value={`${conversionRate}%`} color="text-amber-400" />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowHandoffConfig(true)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    handoffNumber
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  }`}
                >
                  <Headphones className="h-3.5 w-3.5" />
                  Handoff
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {handoffNumber ? `Handoff: ${handoffNumber}` : "Configurar número de handoff"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* ─── Handoff Config Dialog ─── */}
        <Dialog open={showHandoffConfig} onOpenChange={setShowHandoffConfig}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Headphones className="h-5 w-5 text-primary" />
                Configuração de Handoff
              </DialogTitle>
              <DialogDescription>
                Configure o número que receberá as fichas e as regras de transferência automática.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              {/* Number */}
              <div className="space-y-2">
                <Label htmlFor="handoff-number">Número do WhatsApp</Label>
                <Input
                  id="handoff-number"
                  placeholder="5511999999999"
                  value={handoffNumber}
                  onChange={(e) => setHandoffNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Formato: código do país + DDD + número (ex: 5511999999999)
                </p>
              </div>

              {/* Auto-handoff stages */}
              <div className="space-y-3">
                <div>
                  <Label>Handoff Automático por Etapa</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Quando um lead chegar a estas etapas, a ficha será enviada automaticamente.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {PIPELINE_STAGES.filter(s => !["won", "lost"].includes(s.key)).map(stage => {
                    const isSelected = handoffAutoStages.includes(stage.key);
                    const StageIcon = stage.icon;
                    return (
                      <button
                        key={stage.key}
                        onClick={() => toggleAutoStage(stage.key)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                          isSelected
                            ? "border-primary/40 bg-primary/10"
                            : "border-border/30 hover:border-border/60 bg-secondary/10"
                        }`}
                      >
                        <div className={`h-6 w-6 rounded-md bg-gradient-to-br ${stage.gradient} flex items-center justify-center`}>
                          <StageIcon className="h-3 w-3 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold">{stage.name}</p>
                          <p className="text-[10px] text-muted-foreground">{stage.description}</p>
                        </div>
                        <div className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${
                          isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                        }`}>
                          {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setShowHandoffConfig(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={saveHandoffNumber} disabled={handoffSaving}>
                  {handoffSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ─── View Tabs ─── */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {VIEW_TABS.map(tab => {
            const isActive = activeView === tab.key;
            const count = tab.stageFilter
              ? stages.filter(s => stageMap.get(s.id)?.roles.includes(tab.stageFilter!))
                  .reduce((sum, s) => sum + getOppsByStage(s.id).length, 0)
              : opportunities.length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveView(tab.key)}
                className={`group flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
                <span className={`text-[10px] font-mono tabular-nums rounded-md px-1.5 py-0.5 ${
                  isActive ? "bg-primary-foreground/20" : "bg-secondary"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ─── Funnel Progress Bar ─── */}
        <div className="flex items-center gap-0.5 h-2 rounded-full overflow-hidden bg-secondary/30">
          {visibleStages.map((stage, i) => {
            const def = stageMap.get(stage.id);
            const count = getOppsByStage(stage.id).length;
            const total = viewOpps.length || 1;
            const pct = Math.max((count / total) * 100, count > 0 ? 3 : 0);
            return (
              <Tooltip key={stage.id}>
                <TooltipTrigger asChild>
                  <div
                    className={`h-full bg-gradient-to-r ${def?.gradient || "from-slate-400 to-slate-500"} transition-all duration-500 ${
                      i === 0 ? "rounded-l-full" : ""
                    } ${i === visibleStages.length - 1 ? "rounded-r-full" : ""}`}
                    style={{ width: `${pct}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <span className="font-semibold">{stage.name}</span>: {count} lead{count !== 1 ? "s" : ""}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* ─── Kanban Pipeline ─── */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex-1 overflow-x-auto -mx-2 px-2">
            <div className="flex gap-3 min-h-0 pb-4" style={{ minWidth: `${visibleStages.length * 280}px` }}>
              {visibleStages.map((stage) => {
                const stageOpps = getOppsByStage(stage.id);
                const def = stageMap.get(stage.id);
                const StageIcon = def?.icon || Target;
                const total = stageTotal(stage.id);

                return (
                  <div key={stage.id} className="flex-1 min-w-[260px] max-w-[320px] flex flex-col">
                    {/* Column Header */}
                    <div className={`mb-2.5 rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm p-3`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`h-7 w-7 rounded-lg bg-gradient-to-br ${def?.gradient || "from-slate-400 to-slate-500"} flex items-center justify-center shadow-sm`}>
                            <StageIcon className="h-3.5 w-3.5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-xs font-bold leading-tight">{stage.name}</h3>
                            {total > 0 && (
                              <p className="text-[10px] text-muted-foreground font-mono">{formatCurrency(total)}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold tabular-nums bg-secondary/60 rounded-md px-2 py-0.5">
                            {stageOpps.length}
                          </span>
                          {def?.aiTemplate && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => setAiConfigDialog(def)}
                                  className="h-6 w-6 rounded-md flex items-center justify-center bg-violet-500/10 hover:bg-violet-500/20 transition-colors"
                                >
                                  <Bot className="h-3 w-3 text-violet-400" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs max-w-52">
                                <p className="font-semibold">{def.aiTemplate}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Droppable Area */}
                    <Droppable droppableId={stage.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 space-y-2 rounded-xl p-2 transition-all duration-200 min-h-[140px] ${
                            snapshot.isDraggingOver
                              ? "bg-primary/5 ring-2 ring-primary/20 ring-dashed"
                              : "bg-secondary/10"
                          }`}
                        >
                          {stageOpps.length === 0 && !snapshot.isDraggingOver && (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                              <div className={`h-10 w-10 rounded-xl ${def?.bgAccent || "bg-secondary/20"} flex items-center justify-center mb-2`}>
                                <StageIcon className="h-4 w-4 text-muted-foreground/40" />
                              </div>
                              <p className="text-[11px] text-muted-foreground/50 font-medium">
                                Sem leads aqui
                              </p>
                              <p className="text-[10px] text-muted-foreground/30 mt-0.5">
                                Arraste para mover
                              </p>
                            </div>
                          )}

                          {stageOpps.map((opp, index) => (
                            <Draggable key={opp.id} draggableId={opp.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                >
                                  <OppCard
                                    opp={opp}
                                    def={def}
                                    isDragging={snapshot.isDragging}
                                    onClick={() => openOppDetail(opp)}
                                    formatCurrency={formatCurrency}
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </div>
        </DragDropContext>

        {/* ─── AI Config Dialog ─── */}
        <Dialog open={!!aiConfigDialog} onOpenChange={() => setAiConfigDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${aiConfigDialog?.gradient} flex items-center justify-center`}>
                  {aiConfigDialog && <aiConfigDialog.icon className="h-4 w-4 text-white" />}
                </div>
                {aiConfigDialog?.name}
              </DialogTitle>
              <DialogDescription>{aiConfigDialog?.description}</DialogDescription>
            </DialogHeader>
            {aiConfigDialog && (
              <div className="space-y-4 pt-2">
                <div className="rounded-xl border border-border/50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-violet-400" />
                    <p className="text-sm font-bold">{aiConfigDialog.aiTemplate}</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed bg-secondary/30 rounded-lg p-3">
                    {aiConfigDialog.aiHint}
                  </p>
                </div>

                <div className="rounded-xl border border-border/50 p-4 space-y-2">
                  <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Papéis</h4>
                  <div className="flex gap-1.5">
                    {aiConfigDialog.roles.map(role => (
                      <Badge key={role} variant="secondary" className="rounded-md text-[10px] uppercase font-bold tracking-wider">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border/50 p-4 space-y-2">
                  <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Funcionamento</h4>
                  <ul className="text-xs text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                      Lead entra neste estágio → IA ativa <strong>{aiConfigDialog.aiTemplate}</strong>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                      Respostas via WhatsApp seguem a estratégia
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                      Contexto da empresa injetado automaticamente
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ─── Opportunity Detail Dialog ─── */}
        <Dialog open={!!detailOpp} onOpenChange={() => setDetailOpp(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${getAvatarColor(detailOpp?.lead?.name)} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
                  {getInitials(detailOpp?.lead?.name)}
                </div>
                <div>
                  <span className="text-base">{detailOpp?.lead?.name || "Lead sem nome"}</span>
                  {detailOpp && (() => {
                    const def = stageMap.get(detailOpp.stage_id);
                    return def ? (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${def.dotColor}`} />
                        <span className="text-xs text-muted-foreground">{def.name}</span>
                      </div>
                    ) : null;
                  })()}
                </div>
              </DialogTitle>
            </DialogHeader>

            {detailOpp && (
              <div className="space-y-4 pt-2">
                {/* Automation status */}
                {detailOpp.automation_status && detailOpp.automation_status !== "idle" && (
                  <div className="flex items-center gap-2 rounded-lg bg-secondary/30 border border-border/30 px-3 py-2">
                    <Activity className="h-3.5 w-3.5 text-violet-400" />
                    <span className="text-xs font-medium">
                      {AUTOMATION_STATUS_MAP[detailOpp.automation_status]?.label || detailOpp.automation_status}
                    </span>
                    {detailOpp.message_sent_at && (
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        Enviado {new Date(detailOpp.message_sent_at).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                )}

                {/* Contact info */}
                <div className="rounded-xl border border-border/50 p-4 space-y-2.5">
                  <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Contato</h4>
                  {detailOpp.lead?.phone && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-xs">{detailOpp.lead.phone}</span>
                    </div>
                  )}
                  {detailOpp.lead?.email && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs">{detailOpp.lead.email}</span>
                    </div>
                  )}
                  {detailOpp.lead?.enrichment_data?.empresa && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs">{detailOpp.lead.enrichment_data.empresa}</span>
                    </div>
                  )}
                  {detailOpp.lead?.enrichment_data?.website && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs truncate">{detailOpp.lead.enrichment_data.website}</span>
                    </div>
                  )}
                </div>

                {/* Opportunity data */}
                <div className="rounded-xl border border-border/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Dados</h4>
                    <Button variant="ghost" size="sm" className="rounded-lg h-6 text-[10px] px-2"
                      onClick={() => setEditingOpp(!editingOpp)}>
                      <Edit className="h-3 w-3 mr-1" />{editingOpp ? "Cancelar" : "Editar"}
                    </Button>
                  </div>

                  {editingOpp ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px]">Valor (R$)</Label>
                          <Input value={oppValue} onChange={e => setOppValue(e.target.value)} type="number" placeholder="10000" className="h-8 text-xs rounded-lg" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Probabilidade (%)</Label>
                          <Input value={oppProbability} onChange={e => setOppProbability(e.target.value)} type="number" placeholder="50" min="0" max="100" className="h-8 text-xs rounded-lg" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Observações</Label>
                        <Textarea value={oppNotes} onChange={e => setOppNotes(e.target.value)} rows={3}
                          placeholder="Anotações..." className="text-xs rounded-lg resize-none" />
                      </div>
                      <Button onClick={saveOppDetails} size="sm" className="rounded-lg w-full text-xs h-8">
                        Salvar
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-secondary/30 p-3">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Valor</p>
                        <p className="text-sm font-bold text-emerald-400 mt-0.5 font-mono">
                          {detailOpp.value ? formatCurrency(detailOpp.value) : "—"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-secondary/30 p-3">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Probabilidade</p>
                        <p className="text-sm font-bold mt-0.5 font-mono">
                          {detailOpp.probability ? `${detailOpp.probability}%` : "—"}
                        </p>
                      </div>
                    </div>
                  )}

                  {!editingOpp && detailOpp.notes && (
                    <div className="rounded-lg bg-secondary/30 p-3">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Notas</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{detailOpp.notes}</p>
                    </div>
                  )}
                </div>

                {/* Personalized message */}
                {detailOpp.personalized_message && (
                  <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-3.5 w-3.5 text-violet-400" />
                      <h4 className="text-[10px] font-semibold text-violet-300 uppercase tracking-wider">Mensagem Enviada</h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed italic">
                      "{detailOpp.personalized_message}"
                    </p>
                  </div>
                )}

                {/* Enrichment */}
                {detailOpp.lead?.enrichment_data && Object.keys(detailOpp.lead.enrichment_data).length > 1 && (
                  <div className="rounded-xl border border-border/50 p-4 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                      <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Enriquecimento IA</h4>
                    </div>
                    {(detailOpp.lead.enrichment_data.score_conversao || detailOpp.lead.enrichment_data.score) && (
                      <div className="flex items-center gap-3 p-2.5 rounded-lg bg-primary/10 border border-primary/20">
                        <div className="text-xl font-bold text-primary font-mono">
                          {detailOpp.lead.enrichment_data.score_conversao || detailOpp.lead.enrichment_data.score}
                        </div>
                        <p className="text-xs text-muted-foreground">Score de Conversão</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {detailOpp.lead.enrichment_data.segmento && (
                        <div><span className="text-muted-foreground">Segmento:</span> <strong>{detailOpp.lead.enrichment_data.segmento}</strong></div>
                      )}
                      {(detailOpp.lead.enrichment_data.cargo_estimado || detailOpp.lead.enrichment_data.role) && (
                        <div><span className="text-muted-foreground">Cargo:</span> <strong>{detailOpp.lead.enrichment_data.cargo_estimado || detailOpp.lead.enrichment_data.role}</strong></div>
                      )}
                      {detailOpp.lead.enrichment_data.porte && (
                        <div><span className="text-muted-foreground">Porte:</span> <strong>{detailOpp.lead.enrichment_data.porte}</strong></div>
                      )}
                      {detailOpp.lead.enrichment_data.localizacao && (
                        <div><span className="text-muted-foreground">Local:</span> <strong>{detailOpp.lead.enrichment_data.localizacao}</strong></div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg gap-2 flex-1 text-xs h-8 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    onClick={() => sendManualHandoff(detailOpp)}
                    disabled={handoffSending}
                  >
                    {handoffSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Headphones className="h-3.5 w-3.5" />}
                    Fazer Handoff
                  </Button>
                  <Button variant="destructive" size="sm" className="rounded-lg gap-2 flex-1 text-xs h-8"
                    onClick={() => deleteOpp(detailOpp.id)}>
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function StatPill({ icon: Icon, label, value, color }: {
  icon: typeof Target; label: string; value: string; color?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/50 backdrop-blur-sm px-3 py-1.5">
      <Icon className={`h-3.5 w-3.5 ${color || "text-muted-foreground"}`} />
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs font-bold tabular-nums">{value}</span>
        <span className="text-[10px] text-muted-foreground hidden sm:inline">{label}</span>
      </div>
    </div>
  );
}

function OppCard({ opp, def, isDragging, onClick, formatCurrency }: {
  opp: Opportunity;
  def: typeof PIPELINE_STAGES[0] | undefined;
  isDragging: boolean;
  onClick: () => void;
  formatCurrency: (v: number) => string;
}) {
  const enrichment = opp.lead?.enrichment_data;
  const hasEnrichment = enrichment && Object.keys(enrichment).length > 1;
  const automationStatus = opp.automation_status && opp.automation_status !== "idle"
    ? AUTOMATION_STATUS_MAP[opp.automation_status] : null;

  return (
    <div
      onClick={onClick}
      className={`group relative rounded-xl border bg-card/80 backdrop-blur-sm p-3 space-y-2 cursor-grab active:cursor-grabbing transition-all duration-200 ${
        isDragging
          ? "shadow-2xl ring-2 ring-primary/30 scale-[1.03] border-primary/30"
          : "border-border/30 hover:border-border/60 hover:shadow-md"
      }`}
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-gradient-to-b ${def?.gradient || "from-slate-400 to-slate-500"}`} />

      <div className="pl-2">
        {/* Top row: avatar + name + grip */}
        <div className="flex items-center gap-2">
          <div className={`h-7 w-7 rounded-lg bg-gradient-to-br ${getAvatarColor(opp.lead?.name)} flex items-center justify-center text-[10px] font-bold text-white shadow-sm shrink-0`}>
            {getInitials(opp.lead?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold leading-tight truncate">{opp.lead?.name || "Sem nome"}</p>
            {enrichment?.empresa && (
              <p className="text-[10px] text-muted-foreground truncate">{enrichment.empresa}</p>
            )}
          </div>
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors shrink-0" />
        </div>

        {/* Contact */}
        {opp.lead?.phone && (
          <p className="text-[10px] text-muted-foreground font-mono truncate mt-1">{opp.lead.phone}</p>
        )}

        {/* Badges row */}
        <div className="flex items-center gap-1 flex-wrap mt-1.5">
          {opp.value ? (
            <span className="inline-flex items-center text-[10px] font-mono font-medium text-emerald-400 bg-emerald-500/10 rounded-md px-1.5 py-0.5">
              {formatCurrency(opp.value)}
            </span>
          ) : null}
          {opp.probability ? (
            <span className="inline-flex items-center text-[10px] font-mono text-muted-foreground bg-secondary/50 rounded-md px-1.5 py-0.5">
              {opp.probability}%
            </span>
          ) : null}
          {hasEnrichment && (
            <Sparkles className="h-3 w-3 text-violet-400" />
          )}
          {automationStatus && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`inline-flex items-center gap-0.5 text-[9px] ${automationStatus.color}`}>
                  <automationStatus.icon className="h-2.5 w-2.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">
                {automationStatus.label}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Score bar */}
        {(enrichment?.score_conversao || enrichment?.score) && (
          <div className="mt-1.5">
            <Progress
              value={enrichment.score_conversao || enrichment.score}
              className="h-1 rounded-full"
            />
          </div>
        )}
      </div>
    </div>
  );
}
