import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  Users, TrendingUp, Smartphone, Loader2, MessageCircle,
  Search, Send, Kanban, Brain, Calendar,
  Zap, Clock, Bot, BarChart3, ArrowUpRight, Sparkles, ArrowRight,
  Target, PhoneCall, Activity, Megaphone
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, RadialBarChart, RadialBar
} from "recharts";

interface RecentActivity {
  id: string;
  action: string;
  description: string;
  created_at: string;
  success: boolean;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-4))",
  "hsl(var(--warning))",
  "hsl(var(--success))",
];

export default function Index() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    leads: 0, opportunities: 0, converted: 0, appointments: 0,
    activeConversations: 0, broadcasts: 0, discarded: 0, pending: 0, enriched: 0,
    leadsByWhatsapp: 0, leadsByWeb: 0, leadsByManual: 0, leadsByImport: 0,
    broadcastsSent: 0, broadcastsDelivered: 0, broadcastsRead: 0, broadcastsReplied: 0,
  });
  const [loading, setLoading] = useState(true);
  const [instanceCount, setInstanceCount] = useState(0);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [leadsChart, setLeadsChart] = useState<{ label: string; count: number }[]>([]);
  const [pipelineData, setPipelineData] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    if (!profile?.org_id) return;
    const orgId = profile.org_id;

    const fetchAll = async () => {
      try {
        const [
          leadsRes, oppsRes, convertedRes, intRes, appointRes, convosRes,
          broadcastsRes, aiRes, activityRes, discardedRes, pendingRes, enrichedRes,
          whatsappRes, webRes, manualRes, importRes, stagesRes, broadcastStatsRes
        ] = await Promise.all([
          supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", orgId),
          supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("org_id", orgId),
          supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "converted"),
          supabase.from("integrations").select("config").eq("org_id", orgId).eq("service_name", "evolution").maybeSingle(),
          supabase.from("appointments").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "scheduled"),
          supabase.from("conversation_tracker").select("id", { count: "exact", head: true }).eq("org_id", orgId),
          supabase.from("broadcasts").select("id", { count: "exact", head: true }).eq("org_id", orgId).neq("status", "draft"),
          supabase.from("ai_configs").select("enabled").eq("org_id", orgId).eq("config_type", "chatbot").eq("enabled", true),
          supabase.from("activity_logs").select("id, action, description, created_at, success").eq("org_id", orgId).order("created_at", { ascending: false }).limit(10),
          supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "discarded"),
          supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending"),
          supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "enriched"),
          supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("source", "whatsapp"),
          supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("source", "web"),
          supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("source", "manual"),
          supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("source", "import"),
          supabase.from("crm_stages").select("id, name, stage_order").eq("org_id", orgId).order("stage_order"),
          supabase.from("broadcasts").select("sent_count, delivered_count, read_count, replied_count").eq("org_id", orgId).neq("status", "draft"),
        ]);

        const bStats = { sent: 0, delivered: 0, read: 0, replied: 0 };
        if (broadcastStatsRes.data) {
          broadcastStatsRes.data.forEach((b: any) => {
            bStats.sent += b.sent_count || 0;
            bStats.delivered += b.delivered_count || 0;
            bStats.read += b.read_count || 0;
            bStats.replied += b.replied_count || 0;
          });
        }

        setStats({
          leads: leadsRes.count ?? 0,
          opportunities: oppsRes.count ?? 0,
          converted: convertedRes.count ?? 0,
          appointments: appointRes.count ?? 0,
          activeConversations: convosRes.count ?? 0,
          broadcasts: broadcastsRes.count ?? 0,
          discarded: discardedRes.count ?? 0,
          pending: pendingRes.count ?? 0,
          enriched: enrichedRes.count ?? 0,
          leadsByWhatsapp: whatsappRes.count ?? 0,
          leadsByWeb: webRes.count ?? 0,
          leadsByManual: manualRes.count ?? 0,
          leadsByImport: importRes.count ?? 0,
          broadcastsSent: bStats.sent,
          broadcastsDelivered: bStats.delivered,
          broadcastsRead: bStats.read,
          broadcastsReplied: bStats.replied,
        });

        // Pipeline data
        if (stagesRes.data && stagesRes.data.length > 0) {
          const pData = await Promise.all(
            stagesRes.data.map(async (stage) => {
              const { count } = await supabase
                .from("opportunities")
                .select("id", { count: "exact", head: true })
                .eq("org_id", orgId)
                .eq("stage_id", stage.id);
              return { name: stage.name, value: count ?? 0 };
            })
          );
          setPipelineData(pData);
        }

        setAiEnabled((aiRes.data?.length ?? 0) > 0);
        setActivities(activityRes.data ?? []);

        if (intRes.data?.config) {
          const cfg = intRes.data.config as any;
          const byUser = cfg?.instances_by_user || {};
          const total = Object.values(byUser).reduce((acc: number, arr: any) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
          setInstanceCount(total as number);
        }

        // Last 7 days chart
        const now = new Date();
        const days: { label: string; count: number }[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
          const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
          const { count } = await supabase
            .from("leads_raw")
            .select("id", { count: "exact", head: true })
            .eq("org_id", orgId)
            .gte("created_at", dayStart)
            .lt("created_at", dayEnd);
          days.push({
            label: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
            count: count ?? 0,
          });
        }
        setLeadsChart(days);
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [profile?.org_id]);

  const conversionRate = stats.leads > 0 ? ((stats.converted / stats.leads) * 100).toFixed(1) : "0";

  const kpis = [
    { title: "Total Leads", value: stats.leads, icon: Users, color: "text-primary", bg: "bg-primary/10", trend: null },
    { title: "No Pipeline", value: stats.opportunities, icon: Kanban, color: "text-chart-4", bg: "bg-chart-4/10", trend: null },
    { title: "Taxa Conversão", value: `${conversionRate}%`, icon: TrendingUp, color: "text-warning", bg: "bg-warning/10", trend: null },
    { title: "Convertidos", value: stats.converted, icon: Sparkles, color: "text-success", bg: "bg-success/10", trend: null },
    { title: "Agendamentos", value: stats.appointments, icon: Calendar, color: "text-primary", bg: "bg-primary/10", trend: null },
    { title: "Conversas Ativas", value: stats.activeConversations, icon: MessageCircle, color: "text-chart-4", bg: "bg-chart-4/10", trend: null },
  ];

  const sourceData = [
    { name: "WhatsApp", value: stats.leadsByWhatsapp },
    { name: "Web", value: stats.leadsByWeb },
    { name: "Manual", value: stats.leadsByManual },
    { name: "Importação", value: stats.leadsByImport },
  ].filter(d => d.value > 0);

  const funnelData = [
    { name: "Pendentes", value: stats.pending, fill: "hsl(var(--muted-foreground))" },
    { name: "Enriquecidos", value: stats.enriched, fill: "hsl(var(--primary))" },
    { name: "Convertidos", value: stats.converted, fill: "hsl(var(--success))" },
    { name: "Descartados", value: stats.discarded, fill: "hsl(var(--destructive))" },
  ];

  const broadcastMetrics = [
    { label: "Enviadas", value: stats.broadcastsSent, icon: Send },
    { label: "Entregues", value: stats.broadcastsDelivered, icon: PhoneCall },
    { label: "Lidas", value: stats.broadcastsRead, icon: Target },
    { label: "Respondidas", value: stats.broadcastsReplied, icon: MessageCircle },
  ];

  const statusItems = [
    { label: "WhatsApp", value: instanceCount > 0 ? `${instanceCount} número${instanceCount > 1 ? "s" : ""}` : "Desconectado", icon: Smartphone, active: instanceCount > 0, href: "/whatsapp" },
    { label: "Agente IA", value: aiEnabled ? "Ativo" : "Inativo", icon: Bot, active: aiEnabled, href: "/ai" },
    { label: "Conversas", value: `${stats.activeConversations} ativas`, icon: MessageCircle, active: stats.activeConversations > 0, href: "/crm" },
    { label: "Campanhas", value: `${stats.broadcasts} ativa${stats.broadcasts !== 1 ? "s" : ""}`, icon: Megaphone, active: stats.broadcasts > 0, href: "/broadcasts" },
  ];

  const quickActions = [
    { label: "Prospectar", desc: "Buscar novos leads", href: "/prospecting", icon: Search, color: "text-primary" },
    { label: "Pipeline", desc: "Gerenciar vendas", href: "/crm", icon: Kanban, color: "text-chart-4" },
    { label: "Agente IA", desc: "Configurar automação", href: "/ai", icon: Brain, color: "text-primary" },
    { label: "Agenda", desc: "Ver reuniões", href: "/appointments", icon: Calendar, color: "text-warning" },
  ];

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "agora";
    if (mins < 60) return `${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  const gaugeValue = parseFloat(conversionRate);
  const gaugeData = [{ name: "Conversão", value: gaugeValue, fill: "hsl(var(--primary))" }];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Dashboard</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Olá, {profile?.full_name?.split(" ")[0] || "Usuário"} 👋
          </h1>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </div>
      </div>

      {/* KPIs — 6 cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <div key={kpi.title} className="rounded-xl border border-border bg-card p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${kpi.bg}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-medium mb-1 truncate">{kpi.title}</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Row: Leads Chart + Lead Sources + Conversion Gauge */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Leads 7 days */}
        <div className="lg:col-span-5 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Leads — 7 dias</h3>
            </div>
            <Link to="/leads" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
              Ver todos <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={leadsChart} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px", padding: "6px 10px" }} />
              <Area type="monotone" dataKey="count" name="Leads" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#leadGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Lead Sources Pie */}
        <div className="lg:col-span-4 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Origem dos Leads</h3>
          </div>
          {sourceData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Sem dados</p>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={sourceData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value" stroke="none">
                    {sourceData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {sourceData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-muted-foreground flex-1">{d.name}</span>
                    <span className="text-sm font-semibold text-foreground">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Conversion Gauge */}
        <div className="lg:col-span-3 rounded-xl border border-border bg-card p-5 flex flex-col items-center justify-center">
          <h3 className="text-sm font-semibold text-foreground mb-2">Taxa de Conversão</h3>
          <ResponsiveContainer width={120} height={120}>
            <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" startAngle={90} endAngle={-270} data={gaugeData} barSize={10}>
              <RadialBar background={{ fill: "hsl(var(--muted)/0.3)" }} dataKey="value" cornerRadius={5} />
            </RadialBarChart>
          </ResponsiveContainer>
          <p className="text-3xl font-bold text-primary -mt-2">{conversionRate}%</p>
          <p className="text-xs text-muted-foreground mt-1">{stats.converted} de {stats.leads} leads</p>
        </div>
      </div>

      {/* Row: Pipeline + Lead Funnel */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pipeline Distribution */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Kanban className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Distribuição do Pipeline</h3>
            </div>
            <Link to="/crm" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
              Abrir CRM <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {pipelineData.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Configure seu pipeline no CRM</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={pipelineData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px", padding: "6px 10px" }} />
                <Bar dataKey="value" name="Oportunidades" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Lead Funnel */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Funil de Leads</h3>
          </div>
          <div className="space-y-3">
            {funnelData.map((stage) => {
              const pct = stats.leads > 0 ? (stage.value / stats.leads) * 100 : 0;
              return (
                <div key={stage.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-foreground/80 font-medium">{stage.name}</span>
                    <span className="text-sm font-semibold text-foreground">{stage.value}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted/50">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: stage.fill }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row: Broadcast Metrics + Status + Quick Actions */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Broadcast Metrics */}
        <div className="lg:col-span-4 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Métricas de Disparos</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {broadcastMetrics.map((m) => (
              <div key={m.label} className="rounded-lg bg-muted/30 p-3 text-center">
                <m.icon className="h-4 w-4 text-muted-foreground mx-auto mb-1.5" />
                <p className="text-xl font-bold text-foreground">{m.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Status Operacional */}
        <div className="lg:col-span-4 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Status Operacional</h3>
          </div>
          <div className="space-y-1">
            {statusItems.map((item) => (
              <Link
                key={item.label}
                to={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors group"
              >
                <div className={`h-2 w-2 rounded-full shrink-0 ${item.active ? "bg-success animate-pulse" : "bg-muted-foreground/30"}`} />
                <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium flex-1 text-foreground/80 group-hover:text-foreground">{item.label}</span>
                <span className={`text-xs font-medium ${item.active ? "text-primary" : "text-muted-foreground"}`}>
                  {item.value}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-4">
          <div className="grid gap-3 grid-cols-2 h-full">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                to={action.href}
                className="rounded-xl border border-border bg-card p-4 flex flex-col items-center justify-center text-center gap-2 group hover:border-primary/30 hover:shadow-md transition-all"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <action.icon className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">{action.label}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{action.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Atividade Recente</h3>
          </div>
          <span className="text-xs text-muted-foreground">{activities.length} registros</span>
        </div>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma atividade recente</p>
        ) : (
          <div className="grid gap-0 divide-y divide-border">
            {activities.map((act) => (
              <div key={act.id} className="flex items-center gap-3 py-2.5">
                <div className={`h-2 w-2 rounded-full shrink-0 ${act.success ? "bg-primary" : "bg-destructive"}`} />
                <p className="text-sm text-foreground/70 flex-1 truncate">{act.description}</p>
                <span className="text-xs text-muted-foreground shrink-0">{timeAgo(act.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
