import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activityLogger";
import {
  Send, Play, Pause, Clock, Users, MessageCircle, Zap, Brain, Filter,
  Plus, Settings, ChevronRight, Loader2, BarChart3, Target, CheckCircle2,
  Trash2, Copy, Eye, Calendar, ArrowUpDown, Search, X, ChevronDown,
  Bot, RefreshCw, AlertCircle, Hash, Tag, Layers, Gauge, Timer,
  TrendingUp, Percent, MailOpen, MessageSquare, Radio, Archive, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// ---- Types ----
type Broadcast = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  status: string;
  type: string;
  channel: string;
  segment_source: string[];
  segment_status: string[];
  segment_tags: string[];
  segment_date_from: string | null;
  segment_date_to: string | null;
  ai_enabled: boolean;
  ai_config_id: string | null;
  scenario_key: string | null;
  instance_name: string | null;
  message_template: string | null;
  follow_up_enabled: boolean;
  follow_up_count: number;
  follow_up_interval_hours: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_leads: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  replied_count: number;
  converted_count: number;
  failed_count: number;
  send_rate_per_minute: number;
  delay_between_messages: number;
  created_at: string;
  updated_at: string;
};

type AiScenario = {
  id: string;
  scenario_key: string;
  name: string;
  description: string;
  enabled: boolean;
  system_prompt: string;
};

type LeadRaw = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string;
  status: string;
  tags: string[];
  created_at: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; bg: string }> = {
  draft: { label: "Rascunho", color: "text-muted-foreground", icon: Settings, bg: "bg-secondary" },
  scheduled: { label: "Agendado", color: "text-primary", icon: Calendar, bg: "bg-primary/10" },
  running: { label: "Em Execução", color: "text-success", icon: Play, bg: "bg-success/10" },
  paused: { label: "Pausado", color: "text-warning", icon: Pause, bg: "bg-warning/10" },
  completed: { label: "Concluído", color: "text-primary", icon: CheckCircle2, bg: "bg-primary/10" },
  cancelled: { label: "Cancelado", color: "text-destructive", icon: X, bg: "bg-destructive/10" },
};

const SCENARIO_OPTIONS = [
  { value: "outbound_prospecting", label: "Prospecção Outbound", icon: "🎯" },
  { value: "broadcast_own_base", label: "Base Própria", icon: "📋" },
  { value: "broadcast_whatsapp", label: "WhatsApp (Grupos)", icon: "💬" },
  { value: "organic_inbound", label: "Atendimento Orgânico", icon: "📥" },
];

const SOURCE_OPTIONS = [
  { value: "web", label: "Prospecção Web" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "manual", label: "Manual" },
  { value: "import", label: "Importação" },
];

const LEAD_STATUS_OPTIONS = [
  { value: "pending", label: "Pendente" },
  { value: "enriched", label: "Enriquecido" },
  { value: "converted", label: "Convertido" },
];

// ---- MAIN COMPONENT ----
export default function Broadcasts() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const orgId = profile?.org_id;
  const pollRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);

  // ---- React Query: fetch broadcasts ----
  const { data: broadcasts = [], isLoading: loadingBroadcasts } = useQuery({
    queryKey: ["broadcasts", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("broadcasts").select("*").eq("org_id", orgId!).order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Broadcast[]) || [];
    },
    enabled: !!orgId,
    refetchInterval: (query) => {
      const data = query.state.data as Broadcast[] | undefined;
      const hasRunning = data?.some(b => b.status === "running");
      return hasRunning ? 5000 : 30000;
    },
  });

  // ---- React Query: fetch scenarios ----
  const { data: scenarios = [] } = useQuery({
    queryKey: ["ai_scenarios", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_scenarios").select("id, scenario_key, name, description, enabled, system_prompt").eq("org_id", orgId!);
      if (error) throw error;
      return (data as AiScenario[]) || [];
    },
    enabled: !!orgId,
    staleTime: 60000,
  });

  // ---- React Query: fetch instances ----
  const { data: instances = [] } = useQuery({
    queryKey: ["evolution_instances", orgId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("integrations").select("config").eq("org_id", orgId!).eq("service_name", "evolution").maybeSingle();
      if (error) throw error;
      if (data?.config && user) {
        const config = data.config as any;
        const byUser = config?.instances_by_user || {};
        return (byUser[user.id] as string[]) || [];
      }
      return [];
    },
    enabled: !!orgId && !!user,
    staleTime: 60000,
  });

  // ---- React Query: fetch detail leads ----
  const { data: detailLeads = [], isLoading: detailLoading } = useQuery({
    queryKey: ["broadcast_leads", selectedBroadcast?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("broadcast_leads")
        .select("*, lead:leads_raw(name, phone, email, source)")
        .eq("broadcast_id", selectedBroadcast!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedBroadcast?.id && detailOpen,
    staleTime: 30000,
  });

  const loading = loadingBroadcasts;

  // Metrics
  const metrics = useMemo(() => {
    const active = broadcasts.filter(b => b.status === "running").length;
    const totalSent = broadcasts.reduce((a, b) => a + (b.sent_count || 0), 0);
    const totalReplied = broadcasts.reduce((a, b) => a + (b.replied_count || 0), 0);
    const totalConverted = broadcasts.reduce((a, b) => a + (b.converted_count || 0), 0);
    const replyRate = totalSent > 0 ? ((totalReplied / totalSent) * 100).toFixed(1) : "0";
    const convRate = totalSent > 0 ? ((totalConverted / totalSent) * 100).toFixed(1) : "0";
    return { total: broadcasts.length, active, totalSent, totalReplied, totalConverted, replyRate, convRate };
  }, [broadcasts]);

  // Filtered broadcasts
  const filtered = useMemo(() => {
    let list = broadcasts;
    if (activeTab === "running") list = list.filter(b => b.status === "running");
    else if (activeTab === "automated") list = list.filter(b => b.type === "automated");
    else if (activeTab === "completed") list = list.filter(b => b.status === "completed");
    else if (activeTab === "draft") list = list.filter(b => b.status === "draft" || b.status === "scheduled");
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(b => b.name.toLowerCase().includes(q) || b.instance_name?.toLowerCase().includes(q));
    }
    return list;
  }, [broadcasts, activeTab, searchQuery]);

  // ---- Mutation: update status ----
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "running") updates.started_at = new Date().toISOString();
      if (status === "completed") updates.completed_at = new Date().toISOString();
      const { error } = await supabase.from("broadcasts").update(updates).eq("id", id);
      if (error) throw error;
      return { id, updates };
    },
    onSuccess: ({ id, updates }) => {
      queryClient.setQueryData(["broadcasts", orgId], (old: Broadcast[] | undefined) =>
        (old || []).map(b => b.id === id ? { ...b, ...updates } : b)
      );
      toast({ title: "Campanha atualizada" });
      if (updates.status === "running" && orgId) {
        executeBroadcast(id);
      }
    },
  });

  const updateStatus = (id: string, status: string) => updateStatusMutation.mutate({ id, status });

  const executeBroadcast = async (broadcastId: string) => {
    if (!orgId) return;
    try {
      const { data, error } = await supabase.functions.invoke("execute-broadcast", {
        body: { broadcast_id: broadcastId, org_id: orgId },
      });
      if (error) throw error;
      if (data?.error) {
        const errorDesc = data.paused
          ? "O disparo foi pausado automaticamente. Verifique se sua instância WhatsApp está conectada e online."
          : data.error;
        toast({ 
          title: data.paused ? "⚠️ Disparo pausado" : "❌ Erro no disparo", 
          description: errorDesc, 
          variant: "destructive" 
        });
        queryClient.invalidateQueries({ queryKey: ["broadcasts", orgId] });
        return;
      }
      const sent = data?.sent || 0;
      const failed = data?.failed || 0;
      const remaining = data?.remaining || 0;
      if (remaining > 0) {
        toast({ title: "📦 Lote processado", description: `${sent} enviados, ${failed} falhas. Processando próximo lote (${remaining} restantes)...` });
      } else {
        toast({ title: "✅ Disparo concluído!", description: `${sent} enviados com sucesso, ${failed} falhas.` });
      }
      logActivity({ action: "broadcast_executado", description: `Lote: ${sent} enviados, ${failed} falhas`, metadata: { broadcast_id: broadcastId, sent, failed, remaining } });
      queryClient.invalidateQueries({ queryKey: ["broadcasts", orgId] });
      if (selectedBroadcast?.id === broadcastId) {
        queryClient.invalidateQueries({ queryKey: ["broadcast_leads", broadcastId] });
      }
    } catch (error: any) {
      const msg = error.message || "Erro desconhecido";
      let userMsg = msg;
      if (msg.includes("FunctionsFetchError") || msg.includes("Failed to fetch")) {
        userMsg = "Erro de conexão com o servidor. Verifique sua internet e tente novamente.";
      } else if (msg.includes("Unauthorized") || msg.includes("401")) {
        userMsg = "Sessão expirada. Faça login novamente.";
      }
      toast({ title: "❌ Falha no disparo", description: userMsg, variant: "destructive" });
      logActivity({ action: "broadcast_executado", description: `Falha: ${msg}`, success: false, errorMessage: msg, metadata: { broadcast_id: broadcastId } });
      queryClient.invalidateQueries({ queryKey: ["broadcasts", orgId] });
    }
  };

  // ---- Mutation: delete broadcast ----
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("broadcasts").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData(["broadcasts", orgId], (old: Broadcast[] | undefined) =>
        (old || []).filter(b => b.id !== id)
      );
      toast({ title: "Campanha excluída" });
    },
  });

  const deleteBroadcast = (id: string) => deleteMutation.mutate(id);

  // ---- Mutation: duplicate broadcast ----
  const duplicateMutation = useMutation({
    mutationFn: async (broadcast: Broadcast) => {
      const { id, created_at, updated_at, started_at, completed_at, ...rest } = broadcast;
      const newB = {
        ...rest, name: `${rest.name} (cópia)`, status: "draft",
        sent_count: 0, delivered_count: 0, read_count: 0, replied_count: 0, converted_count: 0, failed_count: 0, total_leads: 0,
      };
      const { data, error } = await supabase.from("broadcasts").insert(newB).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.setQueryData(["broadcasts", orgId], (old: Broadcast[] | undefined) =>
          [data as Broadcast, ...(old || [])]
        );
        toast({ title: "Campanha duplicada" });
      }
    },
  });

  const duplicateBroadcast = (broadcast: Broadcast) => duplicateMutation.mutate(broadcast);

  const openDetail = (broadcast: Broadcast) => {
    setSelectedBroadcast(broadcast);
    setDetailOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Disparos</h1>
          <p className="text-sm text-muted-foreground">Campanhas de disparo com segmentação avançada e IA</p>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Nova Campanha
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: metrics.total, icon: Layers, color: "text-primary" },
          { label: "Ativas", value: metrics.active, icon: Radio, color: "text-success" },
          { label: "Enviadas", value: metrics.totalSent, icon: Send, color: "text-muted-foreground" },
          { label: "Taxa Resposta", value: `${metrics.replyRate}%`, icon: MessageCircle, color: "text-warning" },
          { label: "Conversões", value: metrics.totalConverted, icon: Target, color: "text-success" },
        ].map(m => (
          <div key={m.label} className="border rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <m.icon className={`h-4 w-4 ${m.color}`} />
            </div>
            <p className="text-xl font-semibold">{m.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Search + Tabs */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar campanhas..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary h-8 p-0.5 rounded-lg gap-0.5">
          <TabsTrigger value="all" className="text-xs rounded-md px-3 h-7 data-[state=active]:bg-card data-[state=active]:shadow-sm">
            Todas <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0">{broadcasts.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="running" className="text-xs rounded-md px-3 h-7 data-[state=active]:bg-card data-[state=active]:shadow-sm">
            Ativas <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0">{broadcasts.filter(b => b.status === "running").length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="draft" className="text-xs rounded-md px-3 h-7 data-[state=active]:bg-card data-[state=active]:shadow-sm">Rascunhos</TabsTrigger>
          <TabsTrigger value="automated" className="text-xs rounded-md px-3 h-7 data-[state=active]:bg-card data-[state=active]:shadow-sm">Automatizadas</TabsTrigger>
          <TabsTrigger value="completed" className="text-xs rounded-md px-3 h-7 data-[state=active]:bg-card data-[state=active]:shadow-sm">Concluídas</TabsTrigger>
        </TabsList>

        <div className="mt-4 space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-12 border rounded-lg">
              <Send className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma campanha encontrada</p>
              <Button size="sm" variant="outline" className="mt-3 text-xs" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3 w-3 mr-1" /> Criar Campanha
              </Button>
            </div>
          )}

          {filtered.map(broadcast => {
            const cfg = STATUS_CONFIG[broadcast.status] || STATUS_CONFIG.draft;
            const StatusIcon = cfg.icon;
            const processed = (broadcast.sent_count || 0) + (broadcast.failed_count || 0);
            const total = broadcast.total_leads || 0;
            const progress = total > 0 ? (processed / total) * 100 : 0;
            const sentPct = total > 0 ? ((broadcast.sent_count || 0) / total * 100).toFixed(1) : "0";
            const failPct = total > 0 ? ((broadcast.failed_count || 0) / total * 100).toFixed(1) : "0";
            const scenarioLabel = SCENARIO_OPTIONS.find(s => s.value === broadcast.scenario_key);

            // ETA calculation
            const delayPerMsg = Math.max(5, (broadcast.delay_between_messages || 10));
            const remaining = total - processed;
            const etaSeconds = remaining * delayPerMsg;
            const etaMin = Math.ceil(etaSeconds / 60);
            const etaStr = etaMin > 60 ? `~${Math.floor(etaMin / 60)}h${etaMin % 60}m` : `~${etaMin}min`;

            return (
              <div key={broadcast.id} className="border rounded-lg p-4 hover:bg-secondary/30 transition-colors group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <p className="text-sm font-medium truncate cursor-pointer hover:text-primary" onClick={() => openDetail(broadcast)}>
                        {broadcast.name}
                      </p>
                      <Badge variant="secondary" className={`text-[10px] gap-1 ${cfg.color} ${cfg.bg}`}>
                        <StatusIcon className="h-3 w-3" />{cfg.label}
                      </Badge>
                      {broadcast.ai_enabled && (
                        <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
                          <Brain className="h-3 w-3" />IA
                        </Badge>
                      )}
                      {scenarioLabel && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          {scenarioLabel.icon} {scenarioLabel.label}
                        </Badge>
                      )}
                      {broadcast.instance_name && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <MessageSquare className="h-3 w-3" />{broadcast.instance_name}
                        </Badge>
                      )}
                    </div>

                    {/* Real-time progress for running broadcasts */}
                    {broadcast.status === "running" && total > 0 && (
                      <div className="bg-secondary/50 rounded-lg p-3 mb-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="relative h-2.5 w-2.5">
                              <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-40" />
                              <div className="absolute inset-0 rounded-full bg-green-500" />
                            </div>
                            <span className="text-xs font-medium">Processando...</span>
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">ETA: {etaStr}</span>
                        </div>
                        <div className="relative">
                          <Progress value={progress} className="h-2.5" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[9px] font-bold text-white drop-shadow-sm">{progress.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{processed}/{total}</p>
                            <p className="text-[9px] text-muted-foreground uppercase">Processados</p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-green-600">{broadcast.sent_count || 0}</p>
                            <p className="text-[9px] text-muted-foreground uppercase">Enviados ({sentPct}%)</p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-red-500">{broadcast.failed_count || 0}</p>
                            <p className="text-[9px] text-muted-foreground uppercase">Falhas ({failPct}%)</p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-muted-foreground">{remaining}</p>
                            <p className="text-[9px] text-muted-foreground uppercase">Restantes</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Compact stats for non-running */}
                    {broadcast.status !== "running" && (
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{total} leads</span>
                        <span className="flex items-center gap-1"><Send className="h-3 w-3" />{broadcast.sent_count || 0} enviadas</span>
                        <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{broadcast.replied_count || 0} respostas</span>
                        <span className="flex items-center gap-1"><Target className="h-3 w-3" />{broadcast.converted_count || 0} conversões</span>
                        {(broadcast.failed_count || 0) > 0 && (
                          <span className="flex items-center gap-1 text-destructive"><AlertCircle className="h-3 w-3" />{broadcast.failed_count} falhas</span>
                        )}
                      </div>
                    )}

                    {/* Completed progress bar */}
                    {(broadcast.status === "completed" || broadcast.status === "paused") && total > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <Progress value={progress} className="flex-1 max-w-xs h-1.5" />
                        <span className="text-[10px] text-muted-foreground font-mono">{progress.toFixed(0)}%</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {broadcast.status === "draft" && (
                      <Button size="sm" className="text-xs h-7 gap-1" onClick={() => updateStatus(broadcast.id, "running")}>
                        <Play className="h-3 w-3" />Iniciar
                      </Button>
                    )}
                    {broadcast.status === "scheduled" && (
                      <Button size="sm" className="text-xs h-7 gap-1" onClick={() => updateStatus(broadcast.id, "running")}>
                        <Play className="h-3 w-3" />Iniciar Agora
                      </Button>
                    )}
                    {broadcast.status === "running" && (
                      <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => updateStatus(broadcast.id, "paused")}>
                        <Pause className="h-3 w-3" />Pausar
                      </Button>
                    )}
                    {broadcast.status === "paused" && (
                      <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => updateStatus(broadcast.id, "running")}>
                        <Play className="h-3 w-3" />Retomar
                      </Button>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-xs">
                        <DropdownMenuItem onClick={() => openDetail(broadcast)}>
                          <Eye className="h-3 w-3 mr-2" />Ver Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicateBroadcast(broadcast)}>
                          <Copy className="h-3 w-3 mr-2" />Duplicar
                        </DropdownMenuItem>
                        {broadcast.status !== "completed" && broadcast.status !== "cancelled" && (
                          <DropdownMenuItem onClick={() => updateStatus(broadcast.id, "completed")}>
                            <CheckCircle2 className="h-3 w-3 mr-2" />Finalizar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => deleteBroadcast(broadcast.id)}>
                          <Trash2 className="h-3 w-3 mr-2" />Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Tabs>

      {/* Create Campaign Dialog */}
      <CreateCampaignDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        orgId={orgId || ""}
        scenarios={scenarios}
        instances={instances}
        onCreated={() => { queryClient.invalidateQueries({ queryKey: ["broadcasts", orgId] }); setCreateOpen(false); }}
      />

      {/* Detail Dialog */}
      <DetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        broadcast={selectedBroadcast}
        leads={detailLeads}
        loading={detailLoading}
        scenarios={scenarios}
      />
    </div>
  );
}

// ---- CREATE CAMPAIGN DIALOG ----
function CreateCampaignDialog({
  open, onOpenChange, orgId, scenarios, instances, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
  scenarios: AiScenario[];
  instances: string[];
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  // Selection mode: "segment" or "manual"
  const [selectionMode, setSelectionMode] = useState<"segment" | "manual">("segment");
  const [manualLeads, setManualLeads] = useState<LeadRaw[]>([]);
  const [manualSelected, setManualSelected] = useState<Set<string>>(new Set());
  const [manualSearch, setManualSearch] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("manual");
  const [channel, setChannel] = useState("whatsapp");
  const [segmentSources, setSegmentSources] = useState<string[]>([]);
  const [segmentStatuses, setSegmentStatuses] = useState<string[]>([]);
  const [segmentTags, setSegmentTags] = useState("");
  const [segmentDateFrom, setSegmentDateFrom] = useState("");
  const [segmentDateTo, setSegmentDateTo] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [scenarioKey, setScenarioKey] = useState("broadcast_own_base");
  const [instanceName, setInstanceName] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpCount, setFollowUpCount] = useState(3);
  const [followUpInterval, setFollowUpInterval] = useState(24);
  const [sendRate, setSendRate] = useState(5);
  const [delayBetween, setDelayBetween] = useState(10);
  const [scheduledAt, setScheduledAt] = useState("");

  // Count matching leads
  const countLeads = async () => {
    setCountLoading(true);
    let query = supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", orgId);
    if (segmentSources.length > 0) query = query.in("source", segmentSources as ("web" | "whatsapp" | "manual" | "import")[]);
    if (segmentStatuses.length > 0) query = query.in("status", segmentStatuses as ("pending" | "enriched" | "converted" | "discarded")[]);
    if (segmentDateFrom) query = query.gte("created_at", segmentDateFrom);
    if (segmentDateTo) query = query.lte("created_at", segmentDateTo);
    const { count } = await query;
    setLeadCount(count || 0);
    setCountLoading(false);
  };

  // Load leads for manual selection
  const loadManualLeads = async () => {
    if (!orgId) return;
    setManualLoading(true);
    const { data } = await supabase
      .from("leads_raw")
      .select("id, name, phone, email, source, status, tags, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(500);
    setManualLeads((data as LeadRaw[]) || []);
    setManualLoading(false);
  };

  // Keep useEffect for step-based loading (form-local, not cacheable)
  const stepEffect = useState(false);
  // Using a simple pattern to avoid lint warnings
  if (open && step === 2 && orgId && !stepEffect[0]) {
    // handled below
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useState(() => {});

  // We keep this useEffect as it controls form-local data loading
  const [prevStep, setPrevStep] = useState(0);
  const [prevMode, setPrevMode] = useState("");
  if (open && step === 2 && orgId && (step !== prevStep || selectionMode !== prevMode)) {
    setPrevStep(step);
    setPrevMode(selectionMode);
    if (selectionMode === "segment") countLeads();
    else loadManualLeads();
  }
  if (!open && prevStep !== 0) {
    setPrevStep(0);
    setPrevMode("");
  }

  const filteredManualLeads = useMemo(() => {
    if (!manualSearch) return manualLeads;
    const q = manualSearch.toLowerCase();
    return manualLeads.filter(l =>
      l.name?.toLowerCase().includes(q) ||
      l.phone?.includes(q) ||
      l.email?.toLowerCase().includes(q)
    );
  }, [manualLeads, manualSearch]);

  const toggleManualLead = (id: string) => {
    setManualSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllManualLeads = () => {
    if (manualSelected.size === filteredManualLeads.length) {
      setManualSelected(new Set());
    } else {
      setManualSelected(new Set(filteredManualLeads.map(l => l.id)));
    }
  };

  const reset = () => {
    setStep(1); setName(""); setDescription(""); setType("manual"); setChannel("whatsapp");
    setSegmentSources([]); setSegmentStatuses([]); setSegmentTags(""); setSegmentDateFrom(""); setSegmentDateTo("");
    setAiEnabled(false); setScenarioKey("broadcast_own_base"); setInstanceName(""); setMessageTemplate("");
    setFollowUpEnabled(false); setFollowUpCount(3); setFollowUpInterval(24);
    setSendRate(5); setDelayBetween(10); setScheduledAt(""); setLeadCount(null);
    setSelectionMode("segment"); setManualSelected(new Set()); setManualSearch(""); setManualLeads([]);
    setPrevStep(0); setPrevMode("");
  };

  const handleCreate = async () => {
    if (!name.trim()) { toast({ title: "Informe o nome", variant: "destructive" }); return; }
    if (selectionMode === "manual" && manualSelected.size === 0) {
      toast({ title: "Selecione pelo menos 1 lead", variant: "destructive" }); return;
    }
    if (!aiEnabled && !messageTemplate.trim()) {
      toast({ title: "Preencha a mensagem ou ative a IA para gerar automaticamente", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const tags = segmentTags.split(",").map(t => t.trim()).filter(Boolean);
      const totalCount = selectionMode === "manual" ? manualSelected.size : (leadCount || 0);

      const payload = {
        org_id: orgId, name, description: description || null,
        status: scheduledAt ? "scheduled" : "draft", type, channel,
        segment_source: selectionMode === "segment" ? segmentSources : [],
        segment_status: selectionMode === "segment" ? segmentStatuses : [],
        segment_tags: selectionMode === "segment" ? tags : [],
        segment_date_from: selectionMode === "segment" ? (segmentDateFrom || null) : null,
        segment_date_to: selectionMode === "segment" ? (segmentDateTo || null) : null,
        ai_enabled: aiEnabled, scenario_key: scenarioKey, instance_name: instanceName || null,
        message_template: messageTemplate || null,
        follow_up_enabled: followUpEnabled, follow_up_count: followUpCount, follow_up_interval_hours: followUpInterval,
        send_rate_per_minute: sendRate, delay_between_messages: delayBetween,
        scheduled_at: scheduledAt || null, total_leads: totalCount,
      };
      const { data, error } = await supabase.from("broadcasts").insert(payload).select().single();
      if (error) throw error;

      // Link leads to campaign
      if (data && totalCount > 0) {
        let leadsToLink: { id: string }[] = [];

        if (selectionMode === "manual") {
          leadsToLink = Array.from(manualSelected).map(id => ({ id }));
        } else {
          let lQuery = supabase.from("leads_raw").select("id").eq("org_id", orgId);
          if (segmentSources.length > 0) lQuery = lQuery.in("source", segmentSources as ("web" | "whatsapp" | "manual" | "import")[]);
          if (segmentStatuses.length > 0) lQuery = lQuery.in("status", segmentStatuses as ("pending" | "enriched" | "converted" | "discarded")[]);
          if (segmentDateFrom) lQuery = lQuery.gte("created_at", segmentDateFrom);
          if (segmentDateTo) lQuery = lQuery.lte("created_at", segmentDateTo);
          const { data: leadsData } = await lQuery.limit(500);
          leadsToLink = leadsData || [];
        }

        if (leadsToLink.length > 0) {
          const bLeads = leadsToLink.map(l => ({ broadcast_id: data.id, lead_id: l.id }));
          await supabase.from("broadcast_leads").insert(bLeads);
          await supabase.from("broadcasts").update({ total_leads: leadsToLink.length }).eq("id", data.id);
        }
      }

      onCreated();
      toast({ title: "Campanha criada com sucesso!" });
      logActivity({ action: "broadcast_criado", description: `Campanha "${name}" criada com ${totalCount} leads`, metadata: { broadcast_id: data?.id, total_leads: totalCount } });
      reset();
    } catch (e: any) {
      toast({ title: "Erro ao criar", description: e.message, variant: "destructive" });
      logActivity({ action: "broadcast_criado", description: `Falha ao criar campanha "${name}"`, success: false, errorMessage: e.message });
    }
    setSaving(false);
  };

  const toggleSource = (val: string) => setSegmentSources(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  const toggleStatus = (val: string) => setSegmentStatuses(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

  const selectedScenario = scenarios.find(s => s.scenario_key === scenarioKey);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Nova Campanha de Disparo</DialogTitle>
          <DialogDescription className="text-xs">
            Etapa {step} de 4 — {step === 1 ? "Informações" : step === 2 ? "Segmentação" : step === 3 ? "IA & Instância" : "Mensagem & Cadência"}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex gap-1 mb-2">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-secondary"}`} />
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome da Campanha *</Label>
              <Input placeholder="Ex: Outbound Imobiliárias SP" value={name} onChange={e => setName(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Textarea placeholder="Descreva o objetivo desta campanha..." value={description} onChange={e => setDescription(e.target.value)} rows={2} className="text-sm resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="automated">Automatizada (IA gerencia)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Canal</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Agendamento (opcional)</Label>
              <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="text-sm" />
              <p className="text-[10px] text-muted-foreground">Deixe vazio para iniciar manualmente</p>
            </div>
          </div>
        )}

        {/* Step 2: Segmentation / Manual Selection */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Mode toggle */}
            <div className="flex gap-1 p-0.5 bg-secondary rounded-lg">
              <button
                onClick={() => setSelectionMode("segment")}
                className={`flex-1 text-xs py-1.5 px-3 rounded-md transition-colors ${selectionMode === "segment" ? "bg-card shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Filter className="h-3 w-3 inline mr-1" />Segmentação
              </button>
              <button
                onClick={() => setSelectionMode("manual")}
                className={`flex-1 text-xs py-1.5 px-3 rounded-md transition-colors ${selectionMode === "manual" ? "bg-card shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Users className="h-3 w-3 inline mr-1" />Seleção Manual
              </button>
            </div>

            {selectionMode === "segment" ? (
              <>
                <div className="border rounded-lg p-3 bg-primary/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Leads encontrados</span>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono">
                      {countLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : leadCount ?? "—"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Origem do Lead</Label>
                  <div className="flex gap-2 flex-wrap">
                    {SOURCE_OPTIONS.map(opt => (
                      <label key={opt.value} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <Checkbox checked={segmentSources.includes(opt.value)} onCheckedChange={() => toggleSource(opt.value)} />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Status do Lead</Label>
                  <div className="flex gap-2 flex-wrap">
                    {LEAD_STATUS_OPTIONS.map(opt => (
                      <label key={opt.value} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <Checkbox checked={segmentStatuses.includes(opt.value)} onCheckedChange={() => toggleStatus(opt.value)} />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Tags (separadas por vírgula)</Label>
                  <Input placeholder="ex: quente, SP, imobiliária" value={segmentTags} onChange={e => setSegmentTags(e.target.value)} className="text-sm" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data de criação (de)</Label>
                    <Input type="date" value={segmentDateFrom} onChange={e => setSegmentDateFrom(e.target.value)} className="text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data de criação (até)</Label>
                    <Input type="date" value={segmentDateTo} onChange={e => setSegmentDateTo(e.target.value)} className="text-sm" />
                  </div>
                </div>

                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={countLeads} disabled={countLoading}>
                  <RefreshCw className={`h-3 w-3 ${countLoading ? "animate-spin" : ""}`} /> Recalcular Leads
                </Button>
              </>
            ) : (
              <>
                <div className="border rounded-lg p-3 bg-secondary/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Leads selecionados</span>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono">
                      {manualSelected.size} de {manualLeads.length}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Escolha manualmente quais leads incluir nesta campanha</p>
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, telefone ou email..."
                    value={manualSearch}
                    onChange={e => setManualSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>

                {manualLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <ScrollArea className="h-[280px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8 text-[10px]">
                              <Checkbox
                                checked={filteredManualLeads.length > 0 && manualSelected.size === filteredManualLeads.length}
                                onCheckedChange={toggleAllManualLeads}
                              />
                            </TableHead>
                            <TableHead className="text-[10px]">Nome</TableHead>
                            <TableHead className="text-[10px]">Contato</TableHead>
                            <TableHead className="text-[10px]">Origem</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredManualLeads.map(lead => (
                            <TableRow key={lead.id} className="cursor-pointer" onClick={() => toggleManualLead(lead.id)}>
                              <TableCell className="py-1.5">
                                <Checkbox checked={manualSelected.has(lead.id)} onCheckedChange={() => toggleManualLead(lead.id)} />
                              </TableCell>
                              <TableCell className="text-xs py-1.5">{lead.name || "—"}</TableCell>
                              <TableCell className="text-xs py-1.5 font-mono text-muted-foreground">{lead.phone || lead.email || "—"}</TableCell>
                              <TableCell className="py-1.5">
                                <Badge variant="secondary" className="text-[9px]">
                                  {SOURCE_OPTIONS.find(o => o.value === lead.source)?.label || lead.source}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                          {filteredManualLeads.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">
                                Nenhum lead encontrado
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 3: Scenario & Instance */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Brain className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Agente de IA</p>
                    <p className="text-[10px] text-muted-foreground">A IA gerencia follow-ups, qualificação e respostas</p>
                  </div>
                </div>
                <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
              </div>
            </div>

            {aiEnabled && (
              <div className="border rounded-lg p-4 bg-primary/5 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Cenário de IA</p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Selecione o cenário que define como a IA se comportará ao responder os leads desta campanha. Configure os prompts em "Meu Vendedor".
                </p>
                <Select value={scenarioKey} onValueChange={setScenarioKey}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Selecione o cenário..." /></SelectTrigger>
                  <SelectContent>
                    {SCENARIO_OPTIONS.map(opt => {
                      const sc = scenarios.find(s => s.scenario_key === opt.value);
                      return (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <span>{opt.icon}</span>
                            <span>{opt.label}</span>
                            {sc && !sc.enabled && <Badge variant="secondary" className="text-[9px] ml-1">Desativado</Badge>}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {selectedScenario && (
                  <div className="text-[10px] text-muted-foreground bg-secondary/50 rounded p-2">
                    {selectedScenario.description}
                    {!selectedScenario.system_prompt && (
                      <p className="text-warning mt-1 font-medium">⚠️ Prompt ainda não configurado. Configure em "Meu Vendedor".</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Instância WhatsApp</Label>
              <Select value={instanceName} onValueChange={setInstanceName}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Selecione a instância..." /></SelectTrigger>
                <SelectContent>
                  {instances.map(name => (
                    <SelectItem key={name} value={name}>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-3 w-3" />{name}
                      </div>
                    </SelectItem>
                  ))}
                  {instances.length === 0 && (
                    <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                      Nenhuma instância encontrada. Crie uma em WhatsApp.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Step 4: Message & Cadence */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem Inicial</Label>
              <Textarea
                placeholder={aiEnabled ? "Deixe vazio para a IA gerar automaticamente com base no cenário selecionado..." : "Olá {nome}, tudo bem? Vi que você..."}
                value={messageTemplate}
                onChange={e => setMessageTemplate(e.target.value)}
                rows={5}
                className="text-sm resize-none font-mono"
              />
              <p className="text-[10px] text-muted-foreground">Use {"{{nome}}"}, {"{{empresa}}"}, {"{{email}}"} como variáveis</p>
            </div>

            {/* Follow-up */}
            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">Follow-up Automático</p>
                  <p className="text-[10px] text-muted-foreground">Reenviar para quem não respondeu</p>
                </div>
                <Switch checked={followUpEnabled} onCheckedChange={setFollowUpEnabled} />
              </div>
              {followUpEnabled && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nº de follow-ups</Label>
                    <Select value={String(followUpCount)} onValueChange={v => setFollowUpCount(Number(v))}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n}x</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Intervalo (horas)</Label>
                    <Select value={String(followUpInterval)} onValueChange={v => setFollowUpInterval(Number(v))}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[6, 12, 24, 48, 72].map(n => <SelectItem key={n} value={String(n)}>{n}h</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Cadence */}
            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" />
                <p className="text-xs font-medium">Cadência de Envio</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Mensagens/minuto</Label>
                  <div className="flex items-center gap-2">
                    <Slider value={[sendRate]} min={1} max={20} step={1} onValueChange={([v]) => setSendRate(v)} className="flex-1" />
                    <Badge variant="outline" className="font-mono text-[10px] w-8 justify-center">{sendRate}</Badge>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Delay entre msgs (seg)</Label>
                  <div className="flex items-center gap-2">
                    <Slider value={[delayBetween]} min={3} max={60} step={1} onValueChange={([v]) => setDelayBetween(v)} className="flex-1" />
                    <Badge variant="outline" className="font-mono text-[10px] w-8 justify-center">{delayBetween}</Badge>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">⚠️ Taxas altas podem causar bloqueio no WhatsApp. Recomendado: 3-5/min</p>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setStep(s => s - 1)}>Voltar</Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
            {step < 4 ? (
              <Button size="sm" className="text-xs gap-1" onClick={() => setStep(s => s + 1)} disabled={step === 1 && !name.trim()}>
                Próximo <ChevronRight className="h-3 w-3" />
              </Button>
            ) : (
              <Button size="sm" className="text-xs gap-1" onClick={handleCreate} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                Criar Campanha
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- ERROR CATEGORIES ----
const ERROR_CATEGORIES: Record<string, { label: string; description: string; icon: string; color: string }> = {
  "Número não tem WhatsApp": {
    label: "Sem WhatsApp",
    description: "O número não possui conta no WhatsApp ativa. Verifique se o número está correto ou se o contato desativou a conta.",
    icon: "📵",
    color: "text-orange-600 bg-orange-500/10",
  },
  "Lead sem telefone": {
    label: "Sem Telefone",
    description: "O lead não possui número de telefone cadastrado. Adicione o telefone na base de leads antes de incluí-lo em campanhas.",
    icon: "📱",
    color: "text-yellow-600 bg-yellow-500/10",
  },
  "Sem mensagem para enviar": {
    label: "Sem Mensagem",
    description: "Não foi possível gerar ou definir uma mensagem para este lead. Verifique o template da campanha ou a configuração da IA.",
    icon: "💬",
    color: "text-purple-600 bg-purple-500/10",
  },
  "Em cooldown": {
    label: "Cooldown Ativo",
    description: "Este contato já foi abordado recentemente e está em período de espera para evitar spam. O envio será possível após o período configurado.",
    icon: "⏳",
    color: "text-sky-600 bg-sky-500/10",
  },
  "not registered": {
    label: "Não Registrado",
    description: "O número não está registrado no WhatsApp. Pode ser um número fixo, inválido ou desativado.",
    icon: "🚫",
    color: "text-red-600 bg-red-500/10",
  },
};

function categorizeError(errorMessage: string | null): { label: string; description: string; icon: string; color: string } {
  if (!errorMessage) return { label: "Desconhecido", description: "Erro não identificado.", icon: "❓", color: "text-muted-foreground bg-muted" };
  for (const [key, val] of Object.entries(ERROR_CATEGORIES)) {
    if (errorMessage.toLowerCase().includes(key.toLowerCase())) return val;
  }
  if (errorMessage.includes("400") || errorMessage.includes("404")) {
    return { label: "Erro API", description: `A API do WhatsApp retornou um erro: ${errorMessage}`, icon: "⚡", color: "text-red-600 bg-red-500/10" };
  }
  if (errorMessage.includes("timeout") || errorMessage.includes("TIMEOUT")) {
    return { label: "Timeout", description: "A requisição excedeu o tempo limite. Pode ser instabilidade na conexão ou sobrecarga do servidor.", icon: "⏱️", color: "text-amber-600 bg-amber-500/10" };
  }
  return { label: "Erro de Envio", description: errorMessage, icon: "⚠️", color: "text-destructive bg-destructive/10" };
}

// ---- DETAIL DIALOG ----
function DetailDialog({
  open, onOpenChange, broadcast, leads, loading, scenarios,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  broadcast: Broadcast | null;
  leads: any[];
  loading: boolean;
  scenarios: AiScenario[];
}) {
  const [activeLeadTab, setActiveLeadTab] = useState<string>("all");
  const [tick, setTick] = useState(0);

  // Live ticker for countdown
  useEffect(() => {
    if (!broadcast || broadcast.status !== "running") return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [broadcast?.status, broadcast?.id]);

  const statusCounts = useMemo(() => {
    if (!broadcast) return {};
    const counts: Record<string, number> = {};
    leads.forEach(l => { counts[l.status] = (counts[l.status] || 0) + 1; });
    return counts;
  }, [leads, broadcast]);

  // Group errors by category
  const errorBreakdown = useMemo(() => {
    const failedLeads = leads.filter(l => l.status === "failed" || l.status === "skipped");
    const groups: Record<string, { category: ReturnType<typeof categorizeError>; count: number; leads: any[] }> = {};
    failedLeads.forEach(l => {
      const cat = categorizeError(l.error_message);
      const key = cat.label;
      if (!groups[key]) groups[key] = { category: cat, count: 0, leads: [] };
      groups[key].count++;
      groups[key].leads.push(l);
    });
    return Object.values(groups).sort((a, b) => b.count - a.count);
  }, [leads]);

  const filteredLeads = useMemo(() => {
    if (activeLeadTab === "all") return leads;
    return leads.filter(l => l.status === activeLeadTab);
  }, [leads, activeLeadTab]);

  // Find next pending leads
  const nextPendingLeads = useMemo(() => {
    return leads.filter(l => l.status === "pending").slice(0, 3);
  }, [leads]);

  // Find last processed lead
  const lastProcessedLead = useMemo(() => {
    return leads.find(l => l.status === "sent" || l.status === "failed" || l.status === "skipped");
  }, [leads]);

  if (!broadcast) return null;
  const cfg = STATUS_CONFIG[broadcast.status] || STATUS_CONFIG.draft;
  const scenarioLabel = SCENARIO_OPTIONS.find(s => s.value === broadcast.scenario_key);
  const total = broadcast.total_leads || 0;
  const processed = (broadcast.sent_count || 0) + (broadcast.failed_count || 0);
  const progress = total > 0 ? (processed / total) * 100 : 0;
  const remaining = total - processed;
  const delayPerMsg = Math.max(5, (broadcast.delay_between_messages || 10));
  const etaSeconds = remaining * delayPerMsg;
  const etaMin = Math.ceil(etaSeconds / 60);
  const etaStr = etaMin > 60 ? `${Math.floor(etaMin / 60)}h ${etaMin % 60}min` : `${etaMin} min`;

  // Time elapsed (uses tick for live update)
  void tick;
  const startedAt = broadcast.started_at ? new Date(broadcast.started_at) : null;
  const endedAt = broadcast.completed_at ? new Date(broadcast.completed_at) : null;
  const elapsed = startedAt ? (endedAt || new Date()).getTime() - startedAt.getTime() : 0;
  const elapsedMin = Math.floor(elapsed / 60000);
  const elapsedSec = Math.floor((elapsed % 60000) / 1000);
  const elapsedStr = elapsedMin > 60 ? `${Math.floor(elapsedMin / 60)}h ${elapsedMin % 60}min` : `${elapsedMin}min ${elapsedSec}s`;

  const successRate = processed > 0 ? ((broadcast.sent_count || 0) / processed * 100).toFixed(1) : "0";
  const failRate = processed > 0 ? ((broadcast.failed_count || 0) / processed * 100).toFixed(1) : "0";

  // Countdown to next message
  const lastUpdateTime = broadcast.updated_at ? new Date(broadcast.updated_at).getTime() : Date.now();
  const secsSinceUpdate = Math.floor((Date.now() - lastUpdateTime) / 1000);
  const countdownToNext = Math.max(0, delayPerMsg - (secsSinceUpdate % delayPerMsg));

  // Speed
  const speed = elapsedMin > 0 ? (processed / elapsedMin).toFixed(1) : processed > 0 ? processed.toString() : "—";

  const leadStatusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: "Pendente", color: "bg-muted text-muted-foreground" },
    sent: { label: "Enviado", color: "bg-primary/10 text-primary" },
    delivered: { label: "Entregue", color: "bg-sky-500/10 text-sky-600" },
    read: { label: "Lido", color: "bg-emerald-500/10 text-emerald-600" },
    replied: { label: "Respondeu", color: "bg-amber-500/10 text-amber-600" },
    failed: { label: "Falha", color: "bg-destructive/10 text-destructive" },
    skipped: { label: "Pulado", color: "bg-muted text-muted-foreground" },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            {broadcast.name}
            <Badge variant="secondary" className={`text-[10px] gap-1 ${cfg.color} ${cfg.bg}`}>
              {cfg.label}
            </Badge>
            {broadcast.ai_enabled && (
              <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
                <Brain className="h-3 w-3" />IA
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">{broadcast.description || "Sem descrição"}</DialogDescription>
        </DialogHeader>

        {/* Live progress section */}
        {broadcast.status === "running" && total > 0 && (
          <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative h-3 w-3">
                  <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-40" />
                  <div className="absolute inset-0 rounded-full bg-primary" />
                </div>
                <span className="text-sm font-semibold">Disparo em execução</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 font-medium animate-pulse">
                  Continuando automaticamente...
                </span>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-5 gap-2 text-center text-xs">
              <div className="border rounded-md p-2 bg-background/60">
                <Timer className="h-3 w-3 mx-auto mb-1 text-muted-foreground" />
                <p className="font-bold text-foreground">{elapsedStr}</p>
                <p className="text-[9px] text-muted-foreground">Decorrido</p>
              </div>
              <div className="border rounded-md p-2 bg-background/60">
                <Clock className="h-3 w-3 mx-auto mb-1 text-muted-foreground" />
                <p className="font-bold text-foreground">{etaStr}</p>
                <p className="text-[9px] text-muted-foreground">Restante</p>
              </div>
              <div className="border rounded-md p-2 bg-background/60">
                <Gauge className="h-3 w-3 mx-auto mb-1 text-muted-foreground" />
                <p className="font-bold text-foreground">{speed}/min</p>
                <p className="text-[9px] text-muted-foreground">Velocidade</p>
              </div>
              <div className="border rounded-md p-2 bg-background/60">
                <TrendingUp className="h-3 w-3 mx-auto mb-1 text-green-600" />
                <p className="font-bold text-green-600">{successRate}%</p>
                <p className="text-[9px] text-muted-foreground">Sucesso</p>
              </div>
              <div className="border rounded-md p-2 bg-background/60">
                <AlertCircle className="h-3 w-3 mx-auto mb-1 text-destructive" />
                <p className="font-bold text-destructive">{failRate}%</p>
                <p className="text-[9px] text-muted-foreground">Falhas</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="relative">
              <Progress value={progress} className="h-5" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-white drop-shadow-md">{progress.toFixed(1)}% — {processed} de {total} processados</span>
              </div>
            </div>

            {/* Counters */}
            <div className="grid grid-cols-4 gap-3">
              <div className="border rounded-md p-2 text-center bg-background/60">
                <p className="text-lg font-bold">{processed}<span className="text-xs font-normal text-muted-foreground">/{total}</span></p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Processados</p>
              </div>
              <div className="border rounded-md p-2 text-center bg-background/60">
                <p className="text-lg font-bold text-green-600">{broadcast.sent_count || 0}</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Enviados</p>
              </div>
              <div className="border rounded-md p-2 text-center bg-background/60">
                <p className="text-lg font-bold text-destructive">{broadcast.failed_count || 0}</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Falhas</p>
              </div>
              <div className="border rounded-md p-2 text-center bg-background/60">
                <p className="text-lg font-bold text-muted-foreground">{remaining}</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Na fila</p>
              </div>
            </div>

            {/* Next lead + countdown + activity */}
            <div className="border rounded-md p-3 bg-background/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="h-3.5 w-3.5 text-primary animate-pulse" />
                  <span className="text-xs font-semibold">Atividade em tempo real</span>
                </div>
                {remaining > 0 && (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span>Próximo envio em</span>
                    <span className="font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      ~{countdownToNext}s
                    </span>
                  </div>
                )}
              </div>

              {/* Last processed */}
              {lastProcessedLead && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Último:</span>
                  <span className="font-medium">{lastProcessedLead.lead?.name || lastProcessedLead.lead?.phone || "—"}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${lastProcessedLead.status === "sent" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                    {lastProcessedLead.status === "sent" ? "✓ Enviado" : lastProcessedLead.status === "failed" ? `✗ ${categorizeError(lastProcessedLead.error_message).label}` : lastProcessedLead.status}
                  </span>
                </div>
              )}

              {/* Next in queue */}
              {nextPendingLeads.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Próximos na fila:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {nextPendingLeads.map((l, i) => (
                      <div key={l.id} className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md bg-secondary/80 border">
                        <span className="font-mono text-muted-foreground">{i + 1}.</span>
                        <span className="font-medium">{l.lead?.name || "Sem nome"}</span>
                        <span className="text-muted-foreground font-mono">{l.lead?.phone || "—"}</span>
                      </div>
                    ))}
                    {remaining > 3 && (
                      <span className="text-[10px] text-muted-foreground self-center">+{remaining - 3} restantes</span>
                    )}
                  </div>
                </div>
              )}

              {/* Error continuation notice */}
              {(broadcast.failed_count || 0) > 0 && remaining > 0 && (
                <div className="flex items-center gap-2 text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2.5 py-1.5 rounded-md border border-amber-500/20">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>
                    <strong>{broadcast.failed_count} erro{(broadcast.failed_count || 0) > 1 ? "s" : ""}</strong> encontrado{(broadcast.failed_count || 0) > 1 ? "s" : ""} — o disparo <strong>continua normalmente</strong> para os próximos {remaining} leads. Erros são pulados automaticamente.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Metrics Grid — non-running */}
        {broadcast.status !== "running" && (
          <>
            <div className="grid grid-cols-6 gap-2">
              {[
                { label: "Total", value: total, sub: "leads", color: "text-foreground" },
                { label: "Enviados", value: broadcast.sent_count || 0, sub: total > 0 ? `${((broadcast.sent_count || 0) / total * 100).toFixed(1)}%` : "0%", color: "text-primary" },
                { label: "Falhas", value: broadcast.failed_count || 0, sub: total > 0 ? `${((broadcast.failed_count || 0) / total * 100).toFixed(1)}%` : "0%", color: "text-destructive" },
                { label: "Entregues", value: broadcast.delivered_count || 0, sub: (broadcast.sent_count || 0) > 0 ? `${((broadcast.delivered_count || 0) / (broadcast.sent_count || 1) * 100).toFixed(1)}%` : "0%", color: "text-sky-500" },
                { label: "Respostas", value: broadcast.replied_count || 0, sub: (broadcast.sent_count || 0) > 0 ? `${((broadcast.replied_count || 0) / (broadcast.sent_count || 1) * 100).toFixed(1)}%` : "0%", color: "text-amber-500" },
                { label: "Conversões", value: broadcast.converted_count || 0, sub: (broadcast.sent_count || 0) > 0 ? `${((broadcast.converted_count || 0) / (broadcast.sent_count || 1) * 100).toFixed(1)}%` : "0%", color: "text-emerald-600" },
              ].map(m => (
                <div key={m.label} className="border rounded-lg p-2.5 text-center">
                  <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
                  <p className="text-[10px] text-muted-foreground">{m.label}</p>
                  <p className="text-[9px] text-muted-foreground font-mono">{m.sub}</p>
                </div>
              ))}
            </div>

            {total > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progresso: {processed}/{total} processados</span>
                  <span className="font-mono">{progress.toFixed(1)}%</span>
                </div>
                <Progress value={progress} className="h-2.5" />
                {startedAt && (
                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                    <span>📅 Início: {startedAt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    {endedAt && <span>🏁 Fim: {endedAt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
                    <span>⏱️ Duração: {elapsedStr}</span>
                    <span>✅ Taxa de sucesso: {successRate}%</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Error Diagnostics Section */}
        {errorBreakdown.length > 0 && (
          <div className="border border-destructive/20 rounded-lg overflow-hidden">
            <div className="bg-destructive/5 px-4 py-2.5 flex items-center gap-2 border-b border-destructive/10">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-semibold text-destructive">Diagnóstico de Erros</span>
              <Badge variant="outline" className="ml-auto text-[10px] border-destructive/30 text-destructive">
                {leads.filter(l => l.status === "failed" || l.status === "skipped").length} problemas
              </Badge>
              {broadcast.status === "running" && remaining > 0 && (
                <span className="text-[10px] text-green-600 font-medium">• Disparo continua</span>
              )}
            </div>
            <div className="p-3 space-y-2">
              {errorBreakdown.map((group, i) => (
                <div key={i} className="border rounded-md p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{group.category.icon}</span>
                      <div>
                        <p className="text-xs font-semibold">{group.category.label}</p>
                        <p className="text-[10px] text-muted-foreground leading-snug max-w-md">{group.category.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`text-xs font-mono ${group.category.color}`}>
                        {group.count} lead{group.count > 1 ? "s" : ""}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {total > 0 ? ((group.count / total) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>
                  {group.leads.length <= 5 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {group.leads.map(l => (
                        <span key={l.id} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                          {l.lead?.name || l.lead?.phone || "—"}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Config Summary */}
        <div className="border rounded-lg p-3 space-y-2">
          <p className="text-xs font-medium">Configuração da Campanha</p>
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <span>Tipo: <strong className="text-foreground">{broadcast.type === "automated" ? "Automatizada" : "Manual"}</strong></span>
            <span>Canal: <strong className="text-foreground capitalize">{broadcast.channel}</strong></span>
            <span>Instância: <strong className="text-foreground">{broadcast.instance_name || "Auto-detect"}</strong></span>
            <span>Cenário IA: <strong className="text-foreground">{scenarioLabel ? `${scenarioLabel.icon} ${scenarioLabel.label}` : (broadcast.ai_enabled ? "Sim" : "Não")}</strong></span>
            <span>Follow-up: <strong className="text-foreground">{broadcast.follow_up_enabled ? `${broadcast.follow_up_count}x a cada ${broadcast.follow_up_interval_hours}h` : "Desativado"}</strong></span>
            <span>Cadência: <strong className="text-foreground">{broadcast.delay_between_messages}s entre msgs</strong></span>
          </div>
        </div>

        {/* Leads Table */}
        <div className="space-y-2">
          <p className="text-xs font-medium">Leads da Campanha</p>
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setActiveLeadTab("all")}
              className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${activeLeadTab === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              Todos ({leads.length})
            </button>
            {Object.entries(statusCounts).map(([s, c]) => {
              const sc = leadStatusConfig[s] || { label: s, color: "bg-muted text-muted-foreground" };
              return (
                <button
                  key={s}
                  onClick={() => setActiveLeadTab(s)}
                  className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${activeLeadTab === s ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  {sc.label} ({c})
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filteredLeads.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              {leads.length === 0 ? "Nenhum lead vinculado a esta campanha" : "Nenhum lead com este status"}
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <ScrollArea className="max-h-[280px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] w-[30px]">#</TableHead>
                      <TableHead className="text-[10px] w-[160px]">Lead</TableHead>
                      <TableHead className="text-[10px] w-[130px]">Contato</TableHead>
                      <TableHead className="text-[10px] w-[80px]">Origem</TableHead>
                      <TableHead className="text-[10px] w-[80px]">Status</TableHead>
                      <TableHead className="text-[10px]">Diagnóstico</TableHead>
                      <TableHead className="text-[10px] w-[100px]">Enviado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((bl, idx) => {
                      const sc = leadStatusConfig[bl.status] || { label: bl.status, color: "bg-muted text-muted-foreground" };
                      const errCat = bl.error_message ? categorizeError(bl.error_message) : null;
                      const isNextUp = broadcast.status === "running" && bl.status === "pending" && nextPendingLeads[0]?.id === bl.id;
                      return (
                        <TableRow key={bl.id} className={isNextUp ? "bg-primary/5 border-l-2 border-l-primary" : ""}>
                          <TableCell className="text-[10px] py-2 text-muted-foreground font-mono">
                            {isNextUp ? <Radio className="h-3 w-3 text-primary animate-pulse" /> : idx + 1}
                          </TableCell>
                          <TableCell className="text-xs py-2 font-medium">
                            {bl.lead?.name || "—"}
                            {isNextUp && <span className="ml-1.5 text-[9px] text-primary font-normal">← próximo</span>}
                          </TableCell>
                          <TableCell className="text-xs py-2 font-mono text-muted-foreground">{bl.lead?.phone || bl.lead?.email || "—"}</TableCell>
                          <TableCell className="text-xs py-2">
                            <Badge variant="secondary" className="text-[9px]">
                              {SOURCE_OPTIONS.find(o => o.value === bl.lead?.source)?.label || bl.lead?.source || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${sc.color}`}>{sc.label}</span>
                          </TableCell>
                          <TableCell className="py-2">
                            {errCat ? (
                              <div className="flex items-center gap-1.5" title={bl.error_message}>
                                <span className="text-xs">{errCat.icon}</span>
                                <span className={`text-[10px] font-medium ${errCat.color.split(" ")[0]}`}>{errCat.label}</span>
                              </div>
                            ) : bl.status === "sent" ? (
                              <span className="text-[10px] text-green-600">✓ Enviado com sucesso</span>
                            ) : bl.status === "pending" ? (
                              <span className="text-[10px] text-muted-foreground">{isNextUp ? "Próximo a ser processado" : "Aguardando processamento"}</span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-[10px] py-2 text-muted-foreground font-mono">
                            {bl.sent_at ? new Date(bl.sent_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}