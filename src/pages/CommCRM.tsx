import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Users, Send, MessageSquare, CheckCircle2, Calendar,
  Trophy, Eye, Phone, Mail, ChevronRight, Sparkles, Clock,
  GripVertical, Search, Filter, TrendingUp, BarChart3, Target,
  ArrowRight, Radio, Zap, Tag, X, ExternalLink
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

// ─── Pipeline Stages (Hybrid: Broadcast + WhatsApp) ─────────────────
const COMM_STAGES = [
  {
    key: "new_lead", name: "Novo Lead", icon: Users,
    gradient: "from-slate-500 to-slate-600",
    dotColor: "bg-slate-400",
    bgAccent: "bg-slate-500/10",
    borderAccent: "border-l-slate-500",
    description: "Leads adicionados à campanha",
    statusMatch: ["pending"],
  },
  {
    key: "sent", name: "Disparado", icon: Send,
    gradient: "from-sky-500 to-sky-600",
    dotColor: "bg-sky-400",
    bgAccent: "bg-sky-500/10",
    borderAccent: "border-l-sky-500",
    description: "Mensagem enviada com sucesso",
    statusMatch: ["sent"],
  },
  {
    key: "replied", name: "Respondeu", icon: MessageSquare,
    gradient: "from-cyan-500 to-teal-600",
    dotColor: "bg-cyan-400",
    bgAccent: "bg-cyan-500/10",
    borderAccent: "border-l-cyan-500",
    description: "Lead respondeu à mensagem",
    statusMatch: ["replied"],
  },
  {
    key: "qualified", name: "Qualificado", icon: CheckCircle2,
    gradient: "from-emerald-500 to-green-600",
    dotColor: "bg-emerald-400",
    bgAccent: "bg-emerald-500/10",
    borderAccent: "border-l-emerald-500",
    description: "Lead qualificado pela IA ou manualmente",
    statusMatch: ["qualified"],
  },
  {
    key: "scheduled", name: "Agendamento", icon: Calendar,
    gradient: "from-amber-500 to-orange-600",
    dotColor: "bg-amber-400",
    bgAccent: "bg-amber-500/10",
    borderAccent: "border-l-amber-500",
    description: "Reunião ou contato agendado",
    statusMatch: ["scheduled"],
  },
  {
    key: "won", name: "Fechado", icon: Trophy,
    gradient: "from-emerald-500 to-green-600",
    dotColor: "bg-emerald-400",
    bgAccent: "bg-emerald-500/10",
    borderAccent: "border-l-emerald-500",
    description: "Deal convertido!",
    statusMatch: ["won", "converted"],
  },
];

type BroadcastLead = {
  id: string;
  broadcast_id: string;
  lead_id: string;
  status: string;
  comm_stage: string;
  sent_at: string | null;
  replied_at: string | null;
  message_sent: string | null;
  error_message: string | null;
  created_at: string;
  lead: { name: string | null; phone: string | null; email: string | null; tags: string[] | null } | null;
  broadcast: { name: string; status: string; channel: string; scenario_key: string | null } | null;
};

type ConversationInfo = {
  remote_jid: string;
  push_name: string | null;
  last_customer_msg_at: string;
  customer_msg_count: number;
  pipeline_stage_key: string | null;
};

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function getAvatarColor(name: string | null | undefined): string {
  if (!name) return "from-slate-400 to-slate-500";
  const colors = [
    "from-sky-400 to-sky-600", "from-violet-400 to-purple-600",
    "from-emerald-400 to-green-600", "from-amber-400 to-orange-600",
    "from-rose-400 to-red-600", "from-cyan-400 to-teal-600",
  ];
  const idx = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
  return colors[idx];
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function CommCRM() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedBroadcast, setSelectedBroadcast] = useState<string>("all");
  const [detailLead, setDetailLead] = useState<BroadcastLead | null>(null);
  const [conversations, setConversations] = useState<Map<string, ConversationInfo>>(new Map());

  const orgId = profile?.org_id;

  // Fetch broadcasts for filter
  const { data: broadcasts = [] } = useQuery({
    queryKey: ["comm-crm-broadcasts", orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("broadcasts")
        .select("id, name, status, channel, scenario_key")
        .eq("org_id", orgId!)
        .in("status", ["running", "completed", "paused"])
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!orgId,
  });

  // Fetch broadcast_leads with lead data
  const { data: rawLeads = [], isLoading } = useQuery({
    queryKey: ["comm-crm-leads", orgId, selectedBroadcast],
    queryFn: async () => {
      let query = supabase
        .from("broadcast_leads")
        .select(`
          id, broadcast_id, lead_id, status, sent_at, replied_at, 
          message_sent, error_message, created_at,
          lead:leads_raw(name, phone, email, tags),
          broadcast:broadcasts!inner(name, status, channel, scenario_key, org_id)
        `)
        .eq("broadcasts.org_id", orgId!);
      
      if (selectedBroadcast !== "all") {
        query = query.eq("broadcast_id", selectedBroadcast);
      }

      const { data } = await query.order("created_at", { ascending: false }).limit(500);
      return (data ?? []).map((d: any) => ({
        ...d,
        lead: Array.isArray(d.lead) ? d.lead[0] || null : d.lead,
        broadcast: Array.isArray(d.broadcast) ? d.broadcast[0] || null : d.broadcast,
        comm_stage: deriveStage(d),
      }));
    },
    enabled: !!orgId,
    refetchInterval: 10000,
  });

  // Fetch conversation data for replied leads
  useEffect(() => {
    if (!orgId || rawLeads.length === 0) return;
    const phones = rawLeads
      .filter(l => l.lead?.phone)
      .map(l => l.lead!.phone!.replace(/\D/g, "") + "@s.whatsapp.net");
    if (phones.length === 0) return;

    supabase
      .from("conversation_tracker")
      .select("remote_jid, push_name, last_customer_msg_at, customer_msg_count, pipeline_stage_key")
      .eq("org_id", orgId)
      .in("remote_jid", phones.slice(0, 100))
      .then(({ data }) => {
        const map = new Map<string, ConversationInfo>();
        (data ?? []).forEach(c => map.set(c.remote_jid, c));
        setConversations(map);
      });
  }, [orgId, rawLeads]);

  // Derive stage from broadcast_lead status + conversation data
  function deriveStage(bl: any): string {
    if (bl.status === "failed" || bl.status === "skipped") return "new_lead";
    if (bl.replied_at) return "replied";
    if (bl.sent_at || bl.status === "sent") return "sent";
    return "new_lead";
  }

  // Override stage with conversation tracker data
  const leads = useMemo(() => {
    return rawLeads.map(bl => {
      const phone = bl.lead?.phone?.replace(/\D/g, "") + "@s.whatsapp.net";
      const conv = conversations.get(phone);
      let stage = bl.comm_stage;
      
      // Upgrade stage based on conversation data
      if (conv) {
        if (conv.pipeline_stage_key === "qualified" || conv.pipeline_stage_key === "proposal") {
          stage = "qualified";
        } else if (conv.pipeline_stage_key === "scheduled") {
          stage = "scheduled";
        } else if (conv.pipeline_stage_key === "won") {
          stage = "won";
        } else if (conv.customer_msg_count > 0 && stage === "sent") {
          stage = "replied";
        }
      }

      return { ...bl, comm_stage: stage };
    });
  }, [rawLeads, conversations]);

  // Filter by search
  const filteredLeads = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(l =>
      l.lead?.name?.toLowerCase().includes(q) ||
      l.lead?.phone?.includes(q) ||
      l.lead?.email?.toLowerCase().includes(q)
    );
  }, [leads, search]);

  // Group by stage
  const stageGroups = useMemo(() => {
    const groups: Record<string, BroadcastLead[]> = {};
    COMM_STAGES.forEach(s => { groups[s.key] = []; });
    filteredLeads.forEach(l => {
      if (groups[l.comm_stage]) {
        groups[l.comm_stage].push(l);
      } else {
        groups["new_lead"].push(l);
      }
    });
    return groups;
  }, [filteredLeads]);

  // Update stage manually via drag
  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const leadId = result.draggableId;
    const newStage = result.destination.droppableId;
    
    // For now we update the broadcast_lead status mapping
    const statusMap: Record<string, Partial<any>> = {
      new_lead: { status: "pending", replied_at: null },
      sent: { status: "sent" },
      replied: { status: "sent" }, // replied_at will be set by system
      qualified: { status: "sent" },
      scheduled: { status: "sent" },
      won: { status: "sent" },
    };

    // Optimistic update
    queryClient.setQueryData(["comm-crm-leads", orgId, selectedBroadcast], (old: any[]) =>
      (old ?? []).map((l: any) => l.id === leadId ? { ...l, comm_stage: newStage } : l)
    );

    // For qualified/scheduled/won, update the conversation_tracker pipeline_stage_key
    const lead = leads.find(l => l.id === leadId);
    if (lead?.lead?.phone && ["qualified", "scheduled", "won"].includes(newStage)) {
      const phone = lead.lead.phone.replace(/\D/g, "") + "@s.whatsapp.net";
      await supabase
        .from("conversation_tracker")
        .update({ pipeline_stage_key: newStage })
        .eq("org_id", orgId!)
        .eq("remote_jid", phone);
    }

    toast({ title: `Lead movido para ${COMM_STAGES.find(s => s.key === newStage)?.name}` });
  };

  // Metrics
  const totalLeads = filteredLeads.length;
  const sentCount = stageGroups["sent"]?.length || 0;
  const repliedCount = stageGroups["replied"]?.length || 0;
  const qualifiedCount = stageGroups["qualified"]?.length || 0;
  const wonCount = stageGroups["won"]?.length || 0;
  const responseRate = sentCount + repliedCount + qualifiedCount + wonCount > 0
    ? Math.round(((repliedCount + qualifiedCount + wonCount) / (sentCount + repliedCount + qualifiedCount + wonCount)) * 100)
    : 0;
  const conversionRate = totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando pipeline de comunicação...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4 h-full flex flex-col w-full">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              CRM de Comunicação
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pipeline dos leads de disparos e WhatsApp
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Broadcast Filter */}
            <select
              value={selectedBroadcast}
              onChange={e => setSelectedBroadcast(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="all">Todas campanhas</option>
              {broadcasts.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar lead..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 w-48 h-9"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard icon={Users} label="Total Leads" value={totalLeads} color="text-slate-400" />
          <MetricCard icon={Send} label="Disparados" value={sentCount + repliedCount + qualifiedCount + wonCount} color="text-sky-400" />
          <MetricCard icon={MessageSquare} label="Taxa Resposta" value={`${responseRate}%`} color="text-cyan-400" />
          <MetricCard icon={Trophy} label="Conversão" value={`${conversionRate}%`} color="text-emerald-400" />
        </div>

        {/* Funnel Visualization */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {COMM_STAGES.map((stage, idx) => {
            const count = stageGroups[stage.key]?.length || 0;
            const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
            return (
              <div key={stage.key} className="flex items-center gap-1">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md ${stage.bgAccent} text-xs font-medium`}>
                  <stage.icon className="h-3.5 w-3.5" />
                  <span>{count}</span>
                  <span className="text-muted-foreground">({pct}%)</span>
                </div>
                {idx < COMM_STAGES.length - 1 && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* Kanban Board */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <ScrollArea className="flex-1 min-h-0">
            <div className="flex gap-3 pb-4 min-w-max">
              {COMM_STAGES.map(stage => {
                const stageLeads = stageGroups[stage.key] || [];
                return (
                  <Droppable droppableId={stage.key} key={stage.key}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`w-[280px] shrink-0 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm flex flex-col transition-colors ${
                          snapshot.isDraggingOver ? "ring-2 ring-primary/30 bg-primary/5" : ""
                        }`}
                      >
                        {/* Stage Header */}
                        <div className="p-3 border-b border-border/30">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`h-7 w-7 rounded-lg bg-gradient-to-br ${stage.gradient} flex items-center justify-center`}>
                                <stage.icon className="h-3.5 w-3.5 text-white" />
                              </div>
                              <div>
                                <h3 className="text-sm font-semibold text-foreground">{stage.name}</h3>
                                <p className="text-[10px] text-muted-foreground">{stage.description}</p>
                              </div>
                            </div>
                            <Badge variant="secondary" className="text-xs tabular-nums">
                              {stageLeads.length}
                            </Badge>
                          </div>
                        </div>

                        {/* Cards */}
                        <ScrollArea className="flex-1 max-h-[calc(100vh-380px)]">
                          <div className="p-2 space-y-2 min-h-[60px]">
                            {stageLeads.map((bl, idx) => (
                              <Draggable key={bl.id} draggableId={bl.id} index={idx}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`group relative rounded-lg border ${stage.borderAccent} border-l-2 bg-card p-3 cursor-pointer transition-all hover:shadow-md ${
                                      snapshot.isDragging ? "shadow-lg ring-2 ring-primary/20 rotate-1" : ""
                                    }`}
                                    onClick={() => setDetailLead(bl)}
                                  >
                                    <div {...provided.dragHandleProps} className="absolute right-1 top-1 opacity-0 group-hover:opacity-60 transition-opacity">
                                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                                    </div>

                                    {/* Avatar + Name */}
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className={`h-8 w-8 rounded-full bg-gradient-to-br ${getAvatarColor(bl.lead?.name)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                                        {getInitials(bl.lead?.name)}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">
                                          {bl.lead?.name || "Sem nome"}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground truncate">
                                          {bl.lead?.phone || "Sem telefone"}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Campaign badge */}
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                        <Send className="h-2.5 w-2.5 mr-0.5" />
                                        {bl.broadcast?.name?.slice(0, 18) || "—"}
                                      </Badge>
                                      {bl.sent_at && (
                                        <span className="text-[10px] text-muted-foreground">
                                          {timeAgo(bl.sent_at)}
                                        </span>
                                      )}
                                    </div>

                                    {/* Tags */}
                                    {bl.lead?.tags && bl.lead.tags.length > 0 && (
                                      <div className="flex gap-1 mt-1.5 flex-wrap">
                                        {bl.lead.tags.slice(0, 2).map(tag => (
                                          <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0 rounded-full bg-primary/10 text-primary">
                                            <Tag className="h-2 w-2" />{tag}
                                          </span>
                                        ))}
                                      </div>
                                    )}

                                    {/* Error indicator */}
                                    {bl.error_message && bl.comm_stage === "new_lead" && (
                                      <div className="mt-1.5 text-[10px] text-destructive truncate">
                                        ⚠️ {bl.error_message.slice(0, 40)}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                            {stageLeads.length === 0 && (
                              <div className="flex flex-col items-center justify-center py-8 text-center">
                                <stage.icon className="h-6 w-6 text-muted-foreground/30 mb-2" />
                                <p className="text-xs text-muted-foreground/50">Nenhum lead</p>
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </DragDropContext>

        {/* Detail Dialog */}
        <Dialog open={!!detailLead} onOpenChange={() => setDetailLead(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${getAvatarColor(detailLead?.lead?.name)} flex items-center justify-center text-white text-sm font-bold`}>
                  {getInitials(detailLead?.lead?.name)}
                </div>
                <div>
                  <p>{detailLead?.lead?.name || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground font-normal">{detailLead?.lead?.phone}</p>
                </div>
              </DialogTitle>
            </DialogHeader>

            {detailLead && (
              <div className="space-y-4">
                {/* Stage Badge */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Etapa:</span>
                  {(() => {
                    const stage = COMM_STAGES.find(s => s.key === detailLead.comm_stage);
                    if (!stage) return null;
                    return (
                      <Badge className={`bg-gradient-to-r ${stage.gradient} text-white border-0`}>
                        <stage.icon className="h-3 w-3 mr-1" />
                        {stage.name}
                      </Badge>
                    );
                  })()}
                </div>

                {/* Contact Info */}
                <div className="space-y-2 rounded-lg border border-border/50 p-3">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contato</h4>
                  {detailLead.lead?.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{detailLead.lead.phone}</span>
                    </div>
                  )}
                  {detailLead.lead?.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{detailLead.lead.email}</span>
                    </div>
                  )}
                </div>

                {/* Campaign Info */}
                <div className="space-y-2 rounded-lg border border-border/50 p-3">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Campanha</h4>
                  <p className="text-sm font-medium">{detailLead.broadcast?.name}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span>Enviado:</span>
                      <p className="text-foreground">{detailLead.sent_at ? new Date(detailLead.sent_at).toLocaleString("pt-BR") : "—"}</p>
                    </div>
                    <div>
                      <span>Respondeu:</span>
                      <p className="text-foreground">{detailLead.replied_at ? new Date(detailLead.replied_at).toLocaleString("pt-BR") : "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Message Sent */}
                {detailLead.message_sent && (
                  <div className="space-y-2 rounded-lg border border-border/50 p-3">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mensagem Enviada</h4>
                    <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded p-2 max-h-32 overflow-y-auto">
                      {detailLead.message_sent}
                    </p>
                  </div>
                )}

                {/* Error */}
                {detailLead.error_message && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-xs text-destructive font-medium">Erro: {detailLead.error_message}</p>
                  </div>
                )}

                {/* Tags */}
                {detailLead.lead?.tags && detailLead.lead.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {detailLead.lead.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        <Tag className="h-2.5 w-2.5 mr-1" />{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

// Metric Card Component
function MetricCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/50 p-3 flex items-center gap-3">
      <div className={`h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-lg font-bold text-foreground tabular-nums">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
