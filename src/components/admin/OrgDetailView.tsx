import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Building2, Bot, MessageCircle, Radio, Package,
  Plus, X, Save, Loader2, Trash2, Sparkles, Target, HelpCircle,
  Globe, Instagram, Linkedin, Facebook, MapPin, Upload, Link2,
  CheckCircle2, XCircle, AlertCircle, Users, FileText,
  TrendingUp, Zap, Eye, Power, RefreshCw, Send, Clock,
  BarChart3, Activity, Phone, Mail
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

type SubTab = "overview" | "ai" | "whatsapp" | "broadcasts" | "company";

type CompanyProfileData = {
  id: string;
  org_id: string;
  company_name: string;
  logo_url: string | null;
  segment: string | null;
  description: string;
  mission: string;
  vision: string;
  values: string;
  products_services: { name: string; description: string; price?: string }[];
  target_audience: string;
  differentials: string;
  tone_of_voice: string;
  website: string | null;
  instagram: string | null;
  linkedin: string | null;
  facebook: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  cnpj: string | null;
  founded_year: number | null;
  team_size: string | null;
  avg_ticket: string | null;
  sales_process: string;
  objections_faq: { question: string; answer: string }[];
};

const emptyCompanyProfile: Omit<CompanyProfileData, "id" | "org_id"> = {
  company_name: "", logo_url: null, segment: null, description: "", mission: "", vision: "", values: "",
  products_services: [], target_audience: "", differentials: "", tone_of_voice: "",
  website: null, instagram: null, linkedin: null, facebook: null, phone: null, email: null,
  address: null, cnpj: null, founded_year: null, team_size: null, avg_ticket: null,
  sales_process: "", objections_faq: [],
};

interface Props {
  orgId: string;
  orgName: string;
  onBack: () => void;
}

export function OrgDetailView({ orgId, orgName, onBack }: Props) {
  const [subTab, setSubTab] = useState<SubTab>("overview");
  const { toast } = useToast();

  // Overview state
  const [stats, setStats] = useState({
    leadsCount: 0, broadcastsCount: 0, aiConfigsCount: 0,
    aiEnabled: 0, whatsappInstances: 0, whatsappOnline: 0,
    opportunitiesCount: 0, appointmentsCount: 0, conversationsCount: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Owner info state
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // AI state
  const [aiConfigs, setAiConfigs] = useState<any[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [togglingAi, setTogglingAi] = useState<string | null>(null);

  // WhatsApp state
  const [instances, setInstances] = useState<{ name: string; userId: string }[]>([]);
  const [instanceStatuses, setInstanceStatuses] = useState<Record<string, string>>({});
  const [loadingWa, setLoadingWa] = useState(false);

  // Broadcasts state
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(false);

  // Company state
  const [companyProfile, setCompanyProfile] = useState<CompanyProfileData | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);

  useEffect(() => { loadStats(); loadOwnerInfo(); }, [orgId]);
  useEffect(() => {
    if (subTab === "ai") loadAiConfigs();
    if (subTab === "whatsapp") loadWhatsApp();
    if (subTab === "broadcasts") loadBroadcasts();
    if (subTab === "company") loadCompanyProfile();
  }, [subTab, orgId]);

  const loadStats = async () => {
    setLoadingStats(true);
    const [leads, broadcasts, aiConfigs, opportunities, appointments, conversations, integrations] = await Promise.all([
      supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      supabase.from("broadcasts").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      supabase.from("ai_configs").select("id, enabled", { count: "exact" }).eq("org_id", orgId),
      supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      supabase.from("conversation_tracker").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      supabase.from("integrations").select("config").eq("org_id", orgId).eq("service_name", "evolution").maybeSingle(),
    ]);

    const aiEnabledCount = (aiConfigs.data || []).filter((c: any) => c.enabled).length;
    let waInstances = 0;
    if (integrations.data) {
      const cfg = integrations.data.config as any;
      const byUser = cfg?.instances_by_user || {};
      waInstances = Object.values(byUser).flat().length;
    }

    setStats({
      leadsCount: leads.count || 0,
      broadcastsCount: broadcasts.count || 0,
      aiConfigsCount: aiConfigs.count || 0,
      aiEnabled: aiEnabledCount,
      whatsappInstances: waInstances,
      whatsappOnline: 0, // Will be checked in WA tab
      opportunitiesCount: opportunities.count || 0,
      appointmentsCount: appointments.count || 0,
      conversationsCount: conversations.count || 0,
    });
    setLoadingStats(false);
  };

  const loadOwnerInfo = async () => {
    const { data: org } = await supabase
      .from("organizations")
      .select("owner_id")
      .eq("id", orgId)
      .single();
    if (!org) return;
    setOwnerId(org.owner_id);
    // Get email from admin-list-users edge function
    const session = (await supabase.auth.getSession()).data.session;
    const { data } = await supabase.functions.invoke("admin-list-users", {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (data?.users) {
      const owner = data.users.find((u: any) => u.id === org.owner_id);
      if (owner) setOwnerEmail(owner.email);
    }
  };

  const handleChangePassword = async () => {
    if (!ownerId || !newPassword) return;
    if (newPassword.length < 6) {
      toast({ title: "Erro", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const { data, error } = await supabase.functions.invoke("admin-update-password", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: { target_user_id: ownerId, new_password: newPassword },
      });
      if (error || data?.error) {
        toast({ title: "Erro", description: data?.error || error?.message, variant: "destructive" });
      } else {
        toast({ title: "Senha alterada com sucesso!" });
        setNewPassword("");
        setShowPasswordForm(false);
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setChangingPassword(false);
  };

  const loadAiConfigs = async () => {
    setLoadingAi(true);
    const { data } = await supabase
      .from("ai_configs")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    setAiConfigs(data || []);
    setLoadingAi(false);
  };

  const toggleAiConfig = async (configId: string, currentEnabled: boolean) => {
    setTogglingAi(configId);
    const { error } = await supabase
      .from("ai_configs")
      .update({ enabled: !currentEnabled })
      .eq("id", configId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setAiConfigs(prev => prev.map(c => c.id === configId ? { ...c, enabled: !currentEnabled } : c));
      toast({ title: !currentEnabled ? "Agente ativado" : "Agente desativado" });
    }
    setTogglingAi(null);
  };

  const loadWhatsApp = async () => {
    setLoadingWa(true);
    const { data: integ } = await supabase
      .from("integrations")
      .select("config")
      .eq("org_id", orgId)
      .eq("service_name", "evolution")
      .maybeSingle();

    if (integ) {
      const cfg = integ.config as any;
      const byUser = cfg?.instances_by_user || {};
      const allInstances: { name: string; userId: string }[] = [];
      for (const [userId, names] of Object.entries(byUser)) {
        for (const name of (names as string[])) {
          allInstances.push({ name, userId });
        }
      }
      setInstances(allInstances);

      // Check status of each instance
      const statuses: Record<string, string> = {};
      for (const inst of allInstances) {
        try {
          const session = (await supabase.auth.getSession()).data.session;
          const { data } = await supabase.functions.invoke("manage-evolution", {
            headers: { Authorization: `Bearer ${session?.access_token}` },
            body: { action: "status", instance_name: inst.name, org_id: orgId },
          });
          statuses[inst.name] = data?.state || "unknown";
        } catch {
          statuses[inst.name] = "error";
        }
      }
      setInstanceStatuses(statuses);
    }
    setLoadingWa(false);
  };

  const loadBroadcasts = async () => {
    setLoadingBroadcasts(true);
    const { data } = await supabase
      .from("broadcasts")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(20);
    setBroadcasts(data || []);
    setLoadingBroadcasts(false);
  };

  const loadCompanyProfile = async () => {
    setLoadingCompany(true);
    const { data: cp } = await supabase
      .from("company_profiles")
      .select("*")
      .eq("org_id", orgId)
      .maybeSingle();
    if (cp) {
      setCompanyProfile({
        ...cp,
        products_services: (cp.products_services as any) || [],
        objections_faq: (cp.objections_faq as any) || [],
      } as CompanyProfileData);
    } else {
      setCompanyProfile({ ...emptyCompanyProfile, id: "", org_id: orgId } as CompanyProfileData);
    }
    setLoadingCompany(false);
  };

  const saveCompanyProfile = async () => {
    if (!companyProfile) return;
    setSavingCompany(true);
    const { id, ...rest } = companyProfile;
    const payload = { ...rest, org_id: orgId };
    if (id) {
      const { error } = await supabase.from("company_profiles").update(payload).eq("id", id);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else toast({ title: "Perfil salvo!" });
    } else {
      const { data: inserted, error } = await supabase.from("company_profiles").insert(payload).select().single();
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else {
        setCompanyProfile({ ...companyProfile, id: inserted.id } as CompanyProfileData);
        toast({ title: "Perfil criado!" });
      }
    }
    setSavingCompany(false);
  };

  const subTabs: { key: SubTab; label: string; icon: React.ElementType }[] = [
    { key: "overview", label: "Visão Geral", icon: BarChart3 },
    { key: "ai", label: "Agentes IA", icon: Bot },
    { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
    { key: "broadcasts", label: "Disparos", icon: Radio },
    { key: "company", label: "Perfil", icon: Building2 },
  ];

  const statusColor = (state: string) => {
    if (state === "open" || state === "connected") return "#00FF88";
    if (state === "connecting" || state === "qrcode") return "#FFB800";
    return "#FF4444";
  };

  const statusLabel = (state: string) => {
    if (state === "open" || state === "connected") return "Online";
    if (state === "connecting") return "Conectando";
    if (state === "qrcode") return "Aguardando QR";
    if (state === "close") return "Desconectado";
    return state;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="h-9 w-9 rounded-lg bg-[#1f1612] flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#2a1f1a] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-white">{orgName}</h2>
          <p className="text-[10px] text-gray-500 font-mono">{orgId.slice(0, 8)}...</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-[#0f0a08] rounded-xl p-1 border border-[#1f1612]">
        {subTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              subTab === t.key
                ? "bg-[#FF6B1A]/15 text-[#FFB366]"
                : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════ OVERVIEW ══════ */}
      {subTab === "overview" && (
        loadingStats ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-5 w-5 animate-spin text-[#FFB366]" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Leads", value: stats.leadsCount, icon: Users, color: "#FFB366" },
                { label: "Oportunidades", value: stats.opportunitiesCount, icon: TrendingUp, color: "#00FF88" },
                { label: "Agendamentos", value: stats.appointmentsCount, icon: Clock, color: "#FFB800" },
                { label: "Conversas IA", value: stats.conversationsCount, icon: MessageCircle, color: "#FF6B1A" },
                { label: "Agentes IA", value: `${stats.aiEnabled}/${stats.aiConfigsCount}`, icon: Bot, color: stats.aiEnabled > 0 ? "#00FF88" : "#FF4444" },
                { label: "WhatsApp", value: `${stats.whatsappInstances} inst.`, icon: MessageCircle, color: stats.whatsappInstances > 0 ? "#00FF88" : "#FF4444" },
                { label: "Disparos", value: stats.broadcastsCount, icon: Radio, color: "#FFB366" },
                { label: "Status Geral", value: stats.aiEnabled > 0 && stats.whatsappInstances > 0 ? "Ativo" : "Incompleto", icon: Activity, color: stats.aiEnabled > 0 && stats.whatsappInstances > 0 ? "#00FF88" : "#FFB800" },
              ].map(card => (
                <div key={card.label} className="rounded-xl border border-[#1f1612] bg-[#0f0a08]/60 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">{card.label}</span>
                    <card.icon className="h-3.5 w-3.5" style={{ color: card.color }} />
                  </div>
                  <p className="text-xl font-bold text-white">{card.value}</p>
                </div>
              ))}
            </div>

            {/* Owner info */}
            <div className="rounded-xl border border-[#1f1612] bg-[#0f0a08]/60 p-4 space-y-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Dados do Proprietário</p>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-[#FFB366]" />
                <div>
                  <p className="text-[10px] text-gray-500">E-mail de login</p>
                  <p className="text-sm text-white font-medium">{ownerEmail || "Carregando..."}</p>
                </div>
              </div>
              
              {!showPasswordForm ? (
                <button
                  onClick={() => setShowPasswordForm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FFB800]/10 text-[#FFB800] text-[11px] font-medium hover:bg-[#FFB800]/20 transition-colors border border-[#FFB800]/20"
                >
                  <Eye className="h-3.5 w-3.5" /> Alterar Senha
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Nova senha (mín. 6 caracteres)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="flex-1 h-9 px-3 rounded-lg bg-[#1f1612] border border-[#2a1f1a] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FFB366]/50"
                  />
                  <button
                    onClick={handleChangePassword}
                    disabled={changingPassword || newPassword.length < 6}
                    className="h-9 px-4 rounded-lg bg-[#00FF88]/15 text-[#00FF88] text-[11px] font-medium hover:bg-[#00FF88]/25 transition-colors border border-[#00FF88]/20 disabled:opacity-50"
                  >
                    {changingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
                  </button>
                  <button
                    onClick={() => { setShowPasswordForm(false); setNewPassword(""); }}
                    className="h-9 w-9 rounded-lg bg-white/5 text-gray-500 hover:text-white flex items-center justify-center"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="rounded-xl border border-[#1f1612] bg-[#0f0a08]/60 p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Ações rápidas</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSubTab("ai")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FF6B1A]/10 text-[#FFB366] text-[11px] font-medium hover:bg-[#FF6B1A]/20 transition-colors border border-[#FFB366]/20">
                  <Bot className="h-3.5 w-3.5" /> Gerenciar Agentes
                </button>
                <button onClick={() => setSubTab("whatsapp")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#25D366]/10 text-[#25D366] text-[11px] font-medium hover:bg-[#25D366]/20 transition-colors border border-[#25D366]/20">
                  <MessageCircle className="h-3.5 w-3.5" /> Ver WhatsApp
                </button>
                <button onClick={() => setSubTab("broadcasts")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FFB800]/10 text-[#FFB800] text-[11px] font-medium hover:bg-[#FFB800]/20 transition-colors border border-[#FFB800]/20">
                  <Radio className="h-3.5 w-3.5" /> Ver Disparos
                </button>
                <button onClick={() => setSubTab("company")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 text-gray-400 text-[11px] font-medium hover:bg-white/10 transition-colors border border-white/10">
                  <Building2 className="h-3.5 w-3.5" /> Editar Perfil
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {/* ══════ AI AGENTS ══════ */}
      {subTab === "ai" && (
        loadingAi ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-5 w-5 animate-spin text-[#FFB366]" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">{aiConfigs.length} agente(s) configurado(s)</p>
              <button onClick={loadAiConfigs} className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-[#FFB366]">
                <RefreshCw className="h-3 w-3" /> Atualizar
              </button>
            </div>

            {aiConfigs.length === 0 && (
              <div className="text-center py-12 text-sm text-gray-600">
                <Bot className="h-8 w-8 mx-auto mb-3 text-gray-700" />
                Nenhum agente de IA configurado.
              </div>
            )}

            {aiConfigs.map(config => {
              const modular = (config.config as any)?.modular;
              const isToggling = togglingAi === config.id;
              return (
                <div key={config.id} className="rounded-xl border border-[#1f1612] bg-[#0f0a08]/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${config.enabled ? "bg-[#00FF88]/10" : "bg-gray-800"}`}>
                        <Bot className={`h-4 w-4 ${config.enabled ? "text-[#00FF88]" : "text-gray-600"}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">
                            {config.instance_name || "Sem instância"}
                          </span>
                          <Badge variant="outline" className="text-[9px]">
                            {config.config_type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {modular?.business_mode && (
                            <span className="text-[10px] text-gray-500">
                              Modo: {modular.business_mode.toUpperCase()}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-600">
                            Temp: {config.temperature || 0.7}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={config.enabled}
                        onCheckedChange={() => toggleAiConfig(config.id, config.enabled)}
                        disabled={isToggling}
                      />
                    </div>
                  </div>

                  {/* Prompt preview */}
                  {config.system_prompt && (
                    <div className="bg-[#0a0705] rounded-lg p-3 border border-[#1f1612]">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Prompt</p>
                      <p className="text-xs text-gray-400 line-clamp-3">{config.system_prompt}</p>
                    </div>
                  )}

                  {/* Schedule */}
                  {config.schedule_start && config.schedule_end && (
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      <Clock className="h-3 w-3" />
                      Horário: {config.schedule_start} - {config.schedule_end}
                      {config.only_outside_hours && " (só fora do horário)"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ══════ WHATSAPP ══════ */}
      {subTab === "whatsapp" && (
        loadingWa ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-5 w-5 animate-spin text-[#25D366]" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">{instances.length} instância(s)</p>
              <button onClick={loadWhatsApp} className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-[#25D366]">
                <RefreshCw className="h-3 w-3" /> Atualizar
              </button>
            </div>

            {instances.length === 0 && (
              <div className="text-center py-12 text-sm text-gray-600">
                <MessageCircle className="h-8 w-8 mx-auto mb-3 text-gray-700" />
                Nenhuma instância de WhatsApp configurada.
              </div>
            )}

            {instances.map(inst => {
              const state = instanceStatuses[inst.name] || "checking";
              const color = state === "checking" ? "#666" : statusColor(state);
              return (
                <div key={inst.name} className="rounded-xl border border-[#1f1612] bg-[#0f0a08]/60 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: `${color}12` }}>
                        <MessageCircle className="h-4 w-4" style={{ color }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{inst.name}</p>
                        <p className="text-[10px] text-gray-600 font-mono">User: {inst.userId.slice(0, 8)}...</p>
                      </div>
                    </div>
                    <span
                      className="text-[10px] px-2.5 py-1 rounded-full font-semibold"
                      style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}
                    >
                      {state === "checking" ? "Verificando..." : statusLabel(state)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ══════ BROADCASTS ══════ */}
      {subTab === "broadcasts" && (
        loadingBroadcasts ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-5 w-5 animate-spin text-[#FFB800]" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">{broadcasts.length} disparo(s)</p>
              <button onClick={loadBroadcasts} className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-[#FFB800]">
                <RefreshCw className="h-3 w-3" /> Atualizar
              </button>
            </div>

            {broadcasts.length === 0 && (
              <div className="text-center py-12 text-sm text-gray-600">
                <Radio className="h-8 w-8 mx-auto mb-3 text-gray-700" />
                Nenhum disparo realizado.
              </div>
            )}

            {broadcasts.map(b => {
              const statusColors: Record<string, string> = {
                draft: "#666", scheduled: "#FFB800", sending: "#FFB366",
                completed: "#00FF88", paused: "#FFB800", failed: "#FF4444",
              };
              const color = statusColors[b.status] || "#666";
              const statusLabels: Record<string, string> = {
                draft: "Rascunho", scheduled: "Agendado", sending: "Enviando",
                completed: "Concluído", paused: "Pausado", failed: "Falhou",
              };

              return (
                <div key={b.id} className="rounded-xl border border-[#1f1612] bg-[#0f0a08]/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{b.name}</span>
                        <Badge variant="outline" className="text-[9px]">{b.audience_type?.toUpperCase()}</Badge>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {b.instance_name || "—"} • {new Date(b.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <span
                      className="text-[10px] px-2.5 py-1 rounded-full font-semibold"
                      style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}
                    >
                      {statusLabels[b.status] || b.status}
                    </span>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { label: "Total", value: b.total_leads || 0 },
                      { label: "Enviados", value: b.sent_count || 0 },
                      { label: "Entregues", value: b.delivered_count || 0 },
                      { label: "Lidos", value: b.read_count || 0 },
                      { label: "Respondidos", value: b.replied_count || 0 },
                    ].map(m => (
                      <div key={m.label} className="text-center bg-[#0a0705] rounded-lg p-2">
                        <p className="text-lg font-bold text-white">{m.value}</p>
                        <p className="text-[9px] text-gray-600">{m.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ══════ COMPANY PROFILE ══════ */}
      {subTab === "company" && (
        loadingCompany ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-5 w-5 animate-spin text-[#FFB366]" />
          </div>
        ) : companyProfile ? (
          <div className="space-y-6">
            {/* Save button */}
            <div className="flex justify-end">
              <button
                onClick={saveCompanyProfile}
                disabled={savingCompany}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6B1A] text-white text-sm font-semibold hover:bg-[#D9540F] transition-colors disabled:opacity-50"
              >
                {savingCompany ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Perfil
              </button>
            </div>

            {/* Completeness bar */}
            {(() => {
              const cp = companyProfile;
              const fields = [
                cp.company_name, cp.description, cp.segment, cp.mission,
                cp.target_audience, cp.differentials, cp.tone_of_voice,
                cp.phone, cp.email, cp.sales_process, cp.logo_url,
                cp.products_services.length > 0 ? "yes" : "",
                cp.objections_faq.length > 0 ? "yes" : "",
              ];
              const completeness = Math.round((fields.filter(Boolean).length / fields.length) * 100);
              return (
                <div className="rounded-xl border border-[#1f1612] bg-[#0f0a08]/60 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-white flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-[#FFB366]" /> Perfil de IA</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF6B1A]/10 text-[#FFB366] border border-[#FFB366]/20">{completeness}% completo</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#1f1612] rounded-full overflow-hidden">
                    <div className="h-full bg-[#FFB366] rounded-full transition-all duration-500" style={{ width: `${completeness}%` }} />
                  </div>
                </div>
              );
            })()}

            {/* Identity */}
            <div className="rounded-xl border border-[#1f1612] bg-[#0f0a08]/60 p-5 space-y-4">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#FFB366]" /> Identidade
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Nome da Empresa *</label>
                  <input value={companyProfile.company_name} onChange={e => setCompanyProfile(prev => prev ? { ...prev, company_name: e.target.value } : prev)} className="w-full h-9 px-3 rounded-lg bg-[#0a0705] border border-[#1f1612] text-sm text-white focus:outline-none focus:border-[#FFB366]/30" placeholder="Ex: VS Soluções" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Segmento</label>
                  <input value={companyProfile.segment || ""} onChange={e => setCompanyProfile(prev => prev ? { ...prev, segment: e.target.value } : prev)} className="w-full h-9 px-3 rounded-lg bg-[#0a0705] border border-[#1f1612] text-sm text-white focus:outline-none focus:border-[#FFB366]/30" placeholder="Ex: Tecnologia B2B" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">CNPJ</label>
                  <input value={companyProfile.cnpj || ""} onChange={e => setCompanyProfile(prev => prev ? { ...prev, cnpj: e.target.value } : prev)} className="w-full h-9 px-3 rounded-lg bg-[#0a0705] border border-[#1f1612] text-sm text-white focus:outline-none focus:border-[#FFB366]/30" placeholder="00.000.000/0000-00" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Ano de Fundação</label>
                  <input type="number" value={companyProfile.founded_year || ""} onChange={e => setCompanyProfile(prev => prev ? { ...prev, founded_year: e.target.value ? Number(e.target.value) : null } : prev)} className="w-full h-9 px-3 rounded-lg bg-[#0a0705] border border-[#1f1612] text-sm text-white focus:outline-none focus:border-[#FFB366]/30" placeholder="2020" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Descrição</label>
                <textarea rows={3} value={companyProfile.description} onChange={e => setCompanyProfile(prev => prev ? { ...prev, description: e.target.value } : prev)} className="w-full px-3 py-2 rounded-lg bg-[#0a0705] border border-[#1f1612] text-sm text-white focus:outline-none focus:border-[#FFB366]/30 resize-none" placeholder="O que a empresa faz..." />
              </div>
            </div>

            {/* Products */}
            <div className="rounded-xl border border-[#1f1612] bg-[#0f0a08]/60 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                  <Package className="h-4 w-4 text-[#00FF88]" /> Produtos & Serviços
                </h3>
                <button onClick={() => setCompanyProfile(prev => prev ? { ...prev, products_services: [...prev.products_services, { name: "", description: "", price: "" }] } : prev)} className="flex items-center gap-1 text-[10px] text-[#FFB366] hover:text-white transition-colors">
                  <Plus className="h-3 w-3" /> Adicionar
                </button>
              </div>
              {companyProfile.products_services.length === 0 && (
                <p className="text-xs text-gray-600 text-center py-4">Nenhum produto cadastrado.</p>
              )}
              {companyProfile.products_services.map((product, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-[#1f1612] bg-[#0a0705]/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Produto {idx + 1}</span>
                    <button onClick={() => setCompanyProfile(prev => prev ? { ...prev, products_services: prev.products_services.filter((_, i) => i !== idx) } : prev)} className="text-gray-600 hover:text-red-400"><X className="h-3 w-3" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={product.name} onChange={e => { const updated = [...companyProfile.products_services]; (updated[idx] as any).name = e.target.value; setCompanyProfile(prev => prev ? { ...prev, products_services: updated } : prev); }} className="h-8 px-3 rounded-lg bg-[#0a0705] border border-[#1f1612] text-xs text-white focus:outline-none focus:border-[#FFB366]/30" placeholder="Nome" />
                    <input value={product.price || ""} onChange={e => { const updated = [...companyProfile.products_services]; (updated[idx] as any).price = e.target.value; setCompanyProfile(prev => prev ? { ...prev, products_services: updated } : prev); }} className="h-8 px-3 rounded-lg bg-[#0a0705] border border-[#1f1612] text-xs text-white focus:outline-none focus:border-[#FFB366]/30" placeholder="Preço" />
                  </div>
                  <textarea rows={2} value={product.description} onChange={e => { const updated = [...companyProfile.products_services]; (updated[idx] as any).description = e.target.value; setCompanyProfile(prev => prev ? { ...prev, products_services: updated } : prev); }} className="w-full px-3 py-2 rounded-lg bg-[#0a0705] border border-[#1f1612] text-xs text-white focus:outline-none focus:border-[#FFB366]/30 resize-none" placeholder="Descrição" />
                </div>
              ))}
            </div>

            {/* Strategy */}
            <div className="rounded-xl border border-[#1f1612] bg-[#0f0a08]/60 p-5 space-y-4">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <Target className="h-4 w-4 text-[#FFB800]" /> Estratégia Comercial
              </h3>
              {[
                { label: "Público-Alvo", field: "target_audience" as const, placeholder: "Cliente ideal, segmento, porte..." },
                { label: "Diferenciais", field: "differentials" as const, placeholder: "O que diferencia da concorrência..." },
                { label: "Tom de Voz", field: "tone_of_voice" as const, placeholder: "Profissional, consultivo..." },
                { label: "Processo de Vendas", field: "sales_process" as const, placeholder: "Etapas do funil..." },
              ].map(f => (
                <div key={f.field}>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">{f.label}</label>
                  <textarea rows={2} value={(companyProfile as any)[f.field] || ""} onChange={e => setCompanyProfile(prev => prev ? { ...prev, [f.field]: e.target.value } : prev)} className="w-full px-3 py-2 rounded-lg bg-[#0a0705] border border-[#1f1612] text-sm text-white focus:outline-none focus:border-[#FFB366]/30 resize-none" placeholder={f.placeholder} />
                </div>
              ))}
            </div>

            {/* Contact */}
            <div className="rounded-xl border border-[#1f1612] bg-[#0f0a08]/60 p-5 space-y-4">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <Globe className="h-4 w-4 text-[#FF6B1A]" /> Contato & Redes
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Telefone", field: "phone" as const, placeholder: "+55 11 99999-9999" },
                  { label: "Email", field: "email" as const, placeholder: "contato@empresa.com" },
                  { label: "Website", field: "website" as const, placeholder: "https://..." },
                  { label: "Instagram", field: "instagram" as const, placeholder: "@empresa" },
                  { label: "LinkedIn", field: "linkedin" as const, placeholder: "URL do LinkedIn" },
                  { label: "Endereço", field: "address" as const, placeholder: "Rua..." },
                ].map(f => (
                  <div key={f.field}>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">{f.label}</label>
                    <input value={(companyProfile as any)[f.field] || ""} onChange={e => setCompanyProfile(prev => prev ? { ...prev, [f.field]: e.target.value } : prev)} className="w-full h-9 px-3 rounded-lg bg-[#0a0705] border border-[#1f1612] text-sm text-white focus:outline-none focus:border-[#FFB366]/30" placeholder={f.placeholder} />
                  </div>
                ))}
              </div>
            </div>

            {/* Objections */}
            <div className="rounded-xl border border-[#1f1612] bg-[#0f0a08]/60 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-[#FF4444]" /> Objeções & FAQ
                </h3>
                <button onClick={() => setCompanyProfile(prev => prev ? { ...prev, objections_faq: [...prev.objections_faq, { question: "", answer: "" }] } : prev)} className="flex items-center gap-1 text-[10px] text-[#FFB366] hover:text-white transition-colors">
                  <Plus className="h-3 w-3" /> Adicionar
                </button>
              </div>
              {companyProfile.objections_faq.length === 0 && (
                <p className="text-xs text-gray-600 text-center py-4">Nenhuma objeção cadastrada.</p>
              )}
              {companyProfile.objections_faq.map((faq, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-[#1f1612] bg-[#0a0705]/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Objeção {idx + 1}</span>
                    <button onClick={() => setCompanyProfile(prev => prev ? { ...prev, objections_faq: prev.objections_faq.filter((_, i) => i !== idx) } : prev)} className="text-gray-600 hover:text-red-400"><X className="h-3 w-3" /></button>
                  </div>
                  <input value={faq.question} onChange={e => { const updated = [...companyProfile.objections_faq]; updated[idx].question = e.target.value; setCompanyProfile(prev => prev ? { ...prev, objections_faq: updated } : prev); }} className="w-full h-8 px-3 rounded-lg bg-[#0a0705] border border-[#1f1612] text-xs text-white focus:outline-none focus:border-[#FFB366]/30" placeholder="Objeção" />
                  <textarea rows={2} value={faq.answer} onChange={e => { const updated = [...companyProfile.objections_faq]; updated[idx].answer = e.target.value; setCompanyProfile(prev => prev ? { ...prev, objections_faq: updated } : prev); }} className="w-full px-3 py-2 rounded-lg bg-[#0a0705] border border-[#1f1612] text-xs text-white focus:outline-none focus:border-[#FFB366]/30 resize-none" placeholder="Resposta" />
                </div>
              ))}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}