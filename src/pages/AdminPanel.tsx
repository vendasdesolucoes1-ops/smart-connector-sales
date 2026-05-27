import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/Logo";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from "recharts";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Users, FileText, BarChart3, Settings, LogOut, Mail,
  Phone, Building2, TrendingUp, Activity, Database,
  Edit3, Save, X, Search, ShoppingCart, MessageCircle,
  CheckCircle2, XCircle, AlertCircle,
  DollarSign, RefreshCw, UserPlus, Copy,
  Loader2, Trash2, User, ArrowLeft, Package, Plus,
  Target, Lightbulb, ShieldCheck, Globe, Instagram,
  Linkedin, Facebook, MapPin, Upload, Sparkles, HelpCircle, Link2,
  ChevronRight, Calendar, Info, Clock, Terminal, Laptop
} from "lucide-react";
import { OrgDetailView } from "@/components/admin/OrgDetailView";
import ReactMarkdown from "react-markdown";

type Tab = "metrics" | "pending" | "users" | "leads" | "content" | "companies" | "logs" | "plans";

interface Organization {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  form_token: string;
}

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

interface SiteLead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  partnership_type: string | null;
  message: string | null;
  form_source: string;
  created_at: string;
  status: string;
  admin_notes: string | null;
  contacted_at: string | null;
  plan_selected: string | null;
}

interface SiteContent {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  org_id: string | null;
  provider: string;
  created_at: string;
  last_sign_in_at: string | null;
}

const CONTENT_LABELS: Record<string, string> = {
  hero_title: "Título do Hero",
  hero_subtitle: "Subtítulo do Hero",
  counter_leads: "Contador de Leads",
  counter_hours: "Contador de Horas",
  price_start: "Preço inicial (R$)",
  slots_total: "Total de vagas",
  slots_filled: "Vagas preenchidas",
};

const PLAN_PRICES: Record<string, string> = {
  Starter: "1.497",
  Pro: "2.497",
  Agency: "3.497",
};

function parsePlanFromMessage(msg: string | null): string | null {
  if (!msg) return null;
  const match = msg.match(/\[CHECKOUT - (\w+)\]/);
  return match ? match[1] : null;
}

function parseCheckoutDetails(msg: string | null) {
  if (!msg) return {};
  const details: Record<string, string> = {};
  const parts = msg.replace(/\[CHECKOUT - \w+\]\s*/, "").split(" | ");
  parts.forEach(p => {
    const [key, ...rest] = p.split(": ");
    if (key && rest.length) details[key.trim()] = rest.join(": ").trim();
  });
  return details;
}

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>("metrics");
  const [siteLeads, setSiteLeads] = useState<SiteLead[]>([]);
  const [siteContent, setSiteContent] = useState<SiteContent[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [leadFilter, setLeadFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [expandedSale, setExpandedSale] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [creatingUser, setCreatingUser] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<Record<string, { email: string; password: string }>>({});
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfileData | null>(null);
  const [savingCompany, setSavingCompany] = useState(false);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ email: "", full_name: "", password: "" });
  const [creatingNewUser, setCreatingNewUser] = useState(false);
  const [newUserCredentials, setNewUserCredentials] = useState<{ email: string; password: string } | null>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logUserFilter, setLogUserFilter] = useState<string>("all");
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [plans, setPlans] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);

  // Log Detailed View & AI Diagnosis
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [logTimeRange, setLogTimeRange] = useState<"1h" | "6h" | "24h" | "all">("1h");

  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);

  // Load activity logs
  const loadLogs = async () => {
    setLogsLoading(true);
    console.log("Iniciando carregamento de logs...");
    
    // Tenta carregar de activity_logs (tabela padrão)
    let { data, error } = await supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
      
    if (error) {
      console.error("Erro ao carregar logs:", error);
      toast({ 
        title: "Erro ao carregar logs", 
        description: error.message, 
        variant: "destructive" 
      });
    }
    
    if (data) setActivityLogs(data);
    setLogsLoading(false);
  };

  // Load logs when tab changes to logs
  useEffect(() => {
    if (tab === "logs") loadLogs();
  }, [tab]);

  const diagnoseLog = async (log: any) => {
    if (!log) return;
    setDiagnosing(true);
    setDiagnosis("");
    try {
      console.log("Iniciando diagnóstico via ai-log-diagnose para log:", log.id);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const { data, error } = await supabase.functions.invoke("ai-log-diagnose", {
        headers: { 
          Authorization: `Bearer ${token}` 
        },
        body: { 
          log_entry: log
        },
      });

      if (error) {
        console.error("Erro na invocação:", error);
        throw new Error(`Erro na conexão com a IA: ${error.message}`);
      }

      console.log("Resposta do ai-log-diagnose recebida:", data);
      
      if (data?.error) {
        throw new Error(data.error);
      }
      
      const diagnosisText = data?.diagnosis;
      
      if (!diagnosisText) {
        throw new Error("A IA não retornou um diagnóstico válido. Verifique as configurações de créditos e gateway.");
      }
      
      setDiagnosis(diagnosisText);
      
    } catch (err: any) {
      console.error("Erro fatal no diagnóstico:", err);
      const isFetchError = err.message === "Failed to fetch";
      toast({ 
        title: "Erro na análise", 
        description: isFetchError 
          ? "Erro de conexão (Failed to fetch). Isso geralmente indica bloqueio de CORS ou rede instável." 
          : (err.message || "Falha ao processar diagnóstico. Tente novamente."), 
        variant: "destructive" 
      });
    } finally {
      setDiagnosing(false);
    }
  };

  const chartData = useMemo(() => {
    if (!activityLogs.length) return [];
    
    const groups: Record<string, { time: string; success: number; failure: number; timestamp: number }> = {};
    
    activityLogs.forEach(log => {
      const date = new Date(log.created_at);
      // Grouping logic based on granularity
      const roundedDate = new Date(Math.floor(date.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000));
      const timeStr = roundedDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      
      if (!groups[timeStr]) {
        groups[timeStr] = { time: timeStr, success: 0, failure: 0, timestamp: roundedDate.getTime() };
      }
      
      if (log.success) groups[timeStr].success++;
      else groups[timeStr].failure++;
    });
    
    return Object.values(groups).sort((a, b) => a.timestamp - b.timestamp);
  }, [activityLogs]);

  const filteredLogs = useMemo(() => {
    return activityLogs.filter(log => {
      if (logUserFilter !== "all" && log.user_id !== logUserFilter) return false;
      if (logSearchQuery) {
        const q = logSearchQuery.toLowerCase();
        return (log.action || "").toLowerCase().includes(q) || 
               (log.description || "").toLowerCase().includes(q) || 
               (log.user_name || "").toLowerCase().includes(q) ||
               (log.error_message || "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [activityLogs, logUserFilter, logSearchQuery]);

  // Realtime subscription for logs
  useEffect(() => {
    if (tab !== "logs") return;
    const channel = supabase
      .channel("admin-activity-logs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_logs" }, (payload) => {
        setActivityLogs(prev => [payload.new as any, ...prev].slice(0, 200));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tab]);

  const loadData = async () => {
    setLoading(true);
    const session = (await supabase.auth.getSession()).data.session;
    const [leadsRes, contentRes, usersRes, orgsRes] = await Promise.all([
      supabase.from("site_leads").select("*").order("created_at", { ascending: false }),
      supabase.from("site_content").select("*"),
      supabase.functions.invoke("admin-list-users", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      }),
      supabase.from("organizations").select("*").order("created_at", { ascending: false }),
    ]);
    if (leadsRes.data) setSiteLeads(leadsRes.data as SiteLead[]);
    if (contentRes.data) setSiteContent(contentRes.data);
    if (usersRes.data?.users) setUsers(usersRes.data.users);
    if (orgsRes.data) setOrganizations(orgsRes.data);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin");
  };

  const saveContent = async (key: string) => {
    const { error } = await supabase
      .from("site_content")
      .update({ value: editValue, updated_at: new Date().toISOString() })
      .eq("key", key);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Salvo!", description: `"${CONTENT_LABELS[key] || key}" atualizado.` });
      setSiteContent(prev => prev.map(c => c.key === key ? { ...c, value: editValue } : c));
      setEditingKey(null);
    }
  };

  const saveSaleNotes = async (id: string) => {
    const { error } = await supabase.from("site_leads").update({ admin_notes: notesValue }).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setSiteLeads(prev => prev.map(l => l.id === id ? { ...l, admin_notes: notesValue } : l));
      setEditingNotes(null);
      toast({ title: "Anotação salva!" });
    }
  };

  const deleteLead = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;
    const { error } = await supabase.from("site_leads").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setSiteLeads(prev => prev.filter(l => l.id !== id));
      toast({ title: "Registro excluído." });
    }
  };

  const approveSale = async (sale: SiteLead) => {
    setCreatingUser(sale.id);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const planName = sale.plan_selected || parsePlanFromMessage(sale.message);
      const { data, error: fnError } = await supabase.functions.invoke("admin-create-user", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: { email: sale.email, full_name: sale.name, plan: planName },
      });

      if (fnError || data?.error) {
        toast({ title: "Erro ao criar usuário", description: data?.error || fnError?.message, variant: "destructive" });
        setCreatingUser(null);
        return;
      }

      // Update sale status to approved
      await supabase.from("site_leads").update({ status: "approved" }).eq("id", sale.id);
      setSiteLeads(prev => prev.map(l => l.id === sale.id ? { ...l, status: "approved" } : l));

      setCreatedCredentials(prev => ({
        ...prev,
        [sale.id]: { email: data.email, password: data.temp_password },
      }));

      toast({ title: "✅ Venda aprovada!", description: `Usuário ${data.email} criado com sucesso.` });
      loadData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setCreatingUser(null);
  };

  const rejectSale = async (id: string) => {
    if (!confirm("Recusar esta venda? O registro será marcado como recusado.")) return;
    const { error } = await supabase.from("site_leads").update({ status: "rejected" }).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setSiteLeads(prev => prev.map(l => l.id === id ? { ...l, status: "rejected" } : l));
      toast({ title: "Venda recusada." });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!" });
  };

  // Derived data
  const checkoutLeads = siteLeads.filter(l => l.form_source.startsWith("checkout_"));
  const nonCheckoutLeads = siteLeads.filter(l => !l.form_source.startsWith("checkout_"));
  const pendingSales = checkoutLeads.filter(l => l.status === "new");
  const approvedSales = checkoutLeads.filter(l => l.status === "approved");
  const rejectedSales = checkoutLeads.filter(l => l.status === "rejected");

  const filteredLeads = nonCheckoutLeads.filter(l => {
    if (leadFilter !== "all" && l.form_source !== leadFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || (l.company || "").toLowerCase().includes(q);
    }
    return true;
  });

  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (u.full_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
  });

  const pendingUsers = users.filter(u => !u.org_id);

  const tabs: { key: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: "metrics", label: "Métricas", icon: BarChart3 },
    { key: "pending", label: "Pendentes", icon: AlertCircle, badge: pendingSales.length + pendingUsers.length },
    { key: "companies", label: "Organizações", icon: Building2, badge: organizations.length },
    { key: "users", label: "Usuários", icon: Users },
    { key: "leads", label: "Formulários", icon: FileText },
    { key: "content", label: "Conteúdo", icon: Settings },
    { key: "plans", label: "Planos", icon: DollarSign },
    { key: "logs", label: "Logs", icon: Activity },
  ];

  // Plans management
  const loadPlans = async () => {
    setPlansLoading(true);
    const { data } = await supabase.from("plans").select("*").order("sort_order");
    if (data) setPlans(data);
    setPlansLoading(false);
  };

  useEffect(() => {
    if (tab === "plans") loadPlans();
  }, [tab]);

  const savePlan = async () => {
    if (!editingPlan) return;
    setSavingPlan(true);
    const { id, created_at, updated_at, ...payload } = editingPlan;
    // Parse features from string to array if needed
    if (typeof payload.features === "string") {
      try { payload.features = JSON.parse(payload.features); } catch { payload.features = []; }
    }
    if (id) {
      const { error } = await supabase.from("plans").update(payload).eq("id", id);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "Plano salvo!" }); setEditingPlan(null); loadPlans(); }
    } else {
      const { error } = await supabase.from("plans").insert(payload);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "Plano criado!" }); setEditingPlan(null); loadPlans(); }
    }
    setSavingPlan(false);
  };

  const deletePlan = async (id: string) => {
    if (!confirm("Excluir este plano?")) return;
    const { error } = await supabase.from("plans").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Plano excluído." }); loadPlans(); }
  };

  // Company profile management
  const loadCompanyProfile = async (orgId: string) => {
    setLoadingCompany(true);
    setSelectedOrgId(orgId);
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

  const updateCompanyField = (field: keyof CompanyProfileData, value: any) => {
    setCompanyProfile(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const saveCompanyProfile = async () => {
    if (!companyProfile || !selectedOrgId) return;
    setSavingCompany(true);
    const { id, ...rest } = companyProfile;
    const payload = { ...rest, org_id: selectedOrgId };

    if (id) {
      const { error } = await supabase.from("company_profiles").update(payload).eq("id", id);
      if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      else toast({ title: "Perfil da empresa salvo!" });
    } else {
      const { data: inserted, error } = await supabase.from("company_profiles").insert(payload).select().single();
      if (error) toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
      else {
        setCompanyProfile({ ...companyProfile, id: inserted.id } as CompanyProfileData);
        toast({ title: "Perfil da empresa criado!" });
      }
    }
    setSavingCompany(false);
  };

  const addCompanyProduct = () => {
    if (!companyProfile) return;
    updateCompanyField("products_services", [...companyProfile.products_services, { name: "", description: "", price: "" }]);
  };
  const updateCompanyProduct = (idx: number, field: string, value: string) => {
    if (!companyProfile) return;
    const updated = [...companyProfile.products_services];
    (updated[idx] as any)[field] = value;
    updateCompanyField("products_services", updated);
  };
  const removeCompanyProduct = (idx: number) => {
    if (!companyProfile) return;
    updateCompanyField("products_services", companyProfile.products_services.filter((_, i) => i !== idx));
  };
  const addCompanyFaq = () => {
    if (!companyProfile) return;
    updateCompanyField("objections_faq", [...companyProfile.objections_faq, { question: "", answer: "" }]);
  };
  const updateCompanyFaq = (idx: number, field: string, value: string) => {
    if (!companyProfile) return;
    const updated = [...companyProfile.objections_faq];
    (updated[idx] as any)[field] = value;
    updateCompanyField("objections_faq", updated);
  };
  const removeCompanyFaq = (idx: number) => {
    if (!companyProfile) return;
    updateCompanyField("objections_faq", companyProfile.objections_faq.filter((_, i) => i !== idx));
  };

  // Metrics
  const createNewUser = async () => {
    if (!newUserForm.email) {
      toast({ title: "Email obrigatório", variant: "destructive" });
      return;
    }
    setCreatingNewUser(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const { data, error: fnError } = await supabase.functions.invoke("admin-create-user", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: {
          email: newUserForm.email,
          full_name: newUserForm.full_name || undefined,
          temp_password: newUserForm.password || undefined,
        },
      });
      if (fnError || data?.error) {
        toast({ title: "Erro ao criar usuário", description: data?.error || fnError?.message, variant: "destructive" });
      } else {
        setNewUserCredentials({ email: data.email, password: data.temp_password });
        toast({ title: "✅ Usuário criado!", description: `${data.email} criado com sucesso.` });
        loadData();
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setCreatingNewUser(false);
  };

  const totalUsers = users.length;
  const usersWithOrg = users.filter(u => u.org_id).length;
  const totalSales = checkoutLeads.length;
  const totalLeads = nonCheckoutLeads.length;
  const todayLeads = siteLeads.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length;

  const revenueEstimate = approvedSales.reduce((sum, l) => {
    const plan = l.plan_selected || parsePlanFromMessage(l.message);
    if (plan === "Starter") return sum + 1497;
    if (plan === "Pro") return sum + 2497;
    if (plan === "Agency") return sum + 3497;
    return sum;
  }, 0);

  const renderSaleCard = (sale: SiteLead) => {
    const planName = sale.plan_selected || parsePlanFromMessage(sale.message);
    const details = parseCheckoutDetails(sale.message);
    const isExpanded = expandedSale === sale.id;
    const isPending = sale.status === "new";
    const isApproved = sale.status === "approved";
    const isRejected = sale.status === "rejected";
    const creds = createdCredentials[sale.id];
    const isCreating = creatingUser === sale.id;

    const statusColor = isPending ? "#FFB800" : isApproved ? "#00FF88" : "#FF4444";
    const statusLabel = isPending ? "Pendente" : isApproved ? "Aprovado" : "Recusado";
    const StatusIcon = isPending ? AlertCircle : isApproved ? CheckCircle2 : XCircle;

    return (
      <div
        key={sale.id}
        className="rounded-xl border overflow-hidden transition-all"
        style={{
          borderColor: isExpanded ? `${statusColor}30` : "#1f1612",
          background: "#0f0a08",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
          onClick={() => setExpandedSale(isExpanded ? null : sale.id)}
        >
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${statusColor}12` }}
          >
            <StatusIcon className="h-5 w-5" style={{ color: statusColor }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold text-white">{sale.name}</span>
              {planName && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF6B1A]/10 text-[#FFB366] border border-[#FFB366]/20 font-medium">
                  {planName} — R$ {PLAN_PRICES[planName] || "?"}/mês
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-gray-500">
              <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{sale.email}</span>
              {sale.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{sale.phone}</span>}
              {sale.company && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{sale.company}</span>}
            </div>
          </div>

          <span
            className="text-[10px] px-2.5 py-1 rounded-full font-semibold shrink-0"
            style={{ background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}25` }}
          >
            {statusLabel}
          </span>

          <span className="text-[10px] text-gray-600 shrink-0">
            {new Date(sale.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {/* Expanded */}
        {isExpanded && (
          <div className="border-t border-[#1f1612] p-5 space-y-5 bg-[#0a0705]/50">
            {/* Details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(details).map(([key, val]) =>
                val && val !== "undefined" ? (
                  <div key={key} className="text-xs">
                    <p className="text-gray-600 mb-0.5">{key}</p>
                    <p className="text-white font-medium">{val}</p>
                  </div>
                ) : null
              )}
            </div>

            {/* Credentials if just created */}
            {creds && (
              <div className="rounded-lg border border-[#00FF88]/20 bg-[#00FF88]/5 p-4 space-y-2">
                <p className="text-xs font-semibold text-[#00FF88] flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Credenciais de acesso criadas
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-gray-500 mb-1">Email</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-white bg-[#0a0705] px-2 py-1 rounded">{creds.email}</code>
                      <button onClick={() => copyToClipboard(creds.email)} className="text-gray-500 hover:text-[#FFB366]"><Copy className="h-3 w-3" /></button>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 mb-1">Senha temporária</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-white bg-[#0a0705] px-2 py-1 rounded">{creds.password}</code>
                      <button onClick={() => copyToClipboard(creds.password)} className="text-gray-500 hover:text-[#FFB366]"><Copy className="h-3 w-3" /></button>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">Envie essas credenciais ao cliente para ele acessar a plataforma.</p>
              </div>
            )}

            {/* Notes */}
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Anotações internas</p>
              {editingNotes === sale.id ? (
                <div className="flex gap-2">
                  <textarea
                    value={notesValue}
                    onChange={e => setNotesValue(e.target.value)}
                    rows={2}
                    className="flex-1 px-3 py-2 rounded-lg bg-[#0a0705] border border-[#1f1612] text-xs text-white placeholder:text-gray-700 focus:outline-none focus:border-[#FFB366]/30 resize-none"
                    placeholder="Ex: Cliente interessado, ligar amanhã às 14h..."
                    autoFocus
                  />
                  <div className="flex flex-col gap-1">
                    <button onClick={() => saveSaleNotes(sale.id)} className="h-8 w-8 rounded-lg bg-[#00FF88]/10 text-[#00FF88] hover:bg-[#00FF88]/20 flex items-center justify-center">
                      <Save className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setEditingNotes(null)} className="h-8 w-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => { setEditingNotes(sale.id); setNotesValue(sale.admin_notes || ""); }}
                  className="px-3 py-2 rounded-lg bg-[#0a0705] border border-[#1f1612] text-xs text-gray-500 cursor-pointer hover:border-[#FFB366]/20 transition-colors min-h-[36px]"
                >
                  {sale.admin_notes || "Clique para adicionar anotação..."}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[#1f1612]">
              <div className="flex gap-2">
                {/* Contact actions */}
                {sale.phone && (
                  <a
                    href={`https://wa.me/${sale.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#25D366]/10 text-[#25D366] text-[11px] font-medium hover:bg-[#25D366]/20 transition-colors"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                )}
                <a
                  href={`mailto:${sale.email}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FF6B1A]/10 text-[#FFB366] text-[11px] font-medium hover:bg-[#FF6B1A]/20 transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" /> Email
                </a>
              </div>

              <div className="flex gap-2">
                {/* Approve / Create User */}
                {isPending && (
                  <>
                    <button
                      onClick={() => approveSale(sale)}
                      disabled={isCreating}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#00FF88]/10 text-[#00FF88] text-[11px] font-semibold hover:bg-[#00FF88]/20 transition-colors border border-[#00FF88]/20 disabled:opacity-50"
                    >
                      {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                      {isCreating ? "Criando..." : "Aprovar e Criar Usuário"}
                    </button>
                    <button
                      onClick={() => rejectSale(sale.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 text-[11px] font-medium hover:bg-red-500/20 transition-colors border border-red-500/20"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Recusar
                    </button>
                  </>
                )}

                {/* Delete */}
                <button
                  onClick={() => deleteLead(sale.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] text-gray-600 hover:text-red-400 hover:bg-red-400/[0.05] transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#06060B", color: "#e0e0e0" }}>
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#1f1612] flex flex-col bg-[#0a0705] shrink-0">
        <div className="p-5 flex items-center gap-3 border-b border-[#1f1612]">
          <Logo className="h-8 w-auto" />
          <div>
            <p className="text-sm font-bold text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.1em" }}>VS ADMIN</p>
            <p className="text-[10px] text-gray-600">Painel Administrativo</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSearchQuery(""); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                tab === t.key
                  ? "bg-[#FF6B1A]/15 text-[#FFB366] font-medium"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {t.badge && t.badge > 0 ? (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-[#FF4444] text-white font-bold min-w-[18px] text-center">
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-[#1f1612]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:text-red-400 hover:bg-red-400/[0.05] transition-all"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <header className="h-14 border-b border-[#1f1612] flex items-center justify-between px-6 bg-[#0a0705]/50 backdrop-blur-sm sticky top-0 z-10">
          <h1 className="text-sm font-semibold text-white">{tabs.find(t => t.key === tab)?.label}</h1>
          <div className="flex items-center gap-3">
            {(tab === "users" || tab === "leads" || tab === "pending" || (tab === "companies" && !selectedOrgId)) && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-8 pl-9 pr-3 rounded-lg bg-[#0f0a08] border border-[#1f1612] text-xs text-white placeholder:text-gray-700 focus:outline-none focus:border-[#FFB366]/30 w-56"
                />
              </div>
            )}
            <button onClick={loadData} className="flex items-center gap-1.5 text-[10px] text-gray-600 hover:text-[#FFB366] transition-colors">
              <RefreshCw className="h-3 w-3" /> Atualizar
            </button>
          </div>
        </header>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#FFB366]/30 border-t-[#FFB366]" />
            </div>
          ) : (
            <>
              {/* ══════ METRICS TAB ══════ */}
              {tab === "metrics" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: "Vendas pendentes", value: pendingSales.length, icon: AlertCircle, color: "#FFB800" },
                      { label: "Vendas aprovadas", value: approvedSales.length, icon: CheckCircle2, color: "#00FF88" },
                      { label: "Vendas recusadas", value: rejectedSales.length, icon: XCircle, color: "#FF4444" },
                      { label: "MRR estimado", value: `R$ ${revenueEstimate.toLocaleString("pt-BR")}`, icon: DollarSign, color: "#00FF88" },
                      { label: "Total de Usuários", value: totalUsers, icon: Users, color: "#FF6B1A" },
                      { label: "Com Organização", value: usersWithOrg, icon: Building2, color: "#FFB366" },
                      { label: "Leads do Site", value: totalLeads, icon: FileText, color: "#FFB366" },
                      { label: "Atividades Hoje", value: todayLeads, icon: TrendingUp, color: "#FFB800" },
                    ].map(card => (
                      <div key={card.label} className="rounded-xl border border-[#1f1612] bg-[#0f0a08]/60 p-5">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] text-gray-500 uppercase tracking-wider">{card.label}</span>
                          <card.icon className="h-4 w-4" style={{ color: card.color }} />
                        </div>
                        <p className="text-2xl font-bold text-white">{card.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-[#1f1612] bg-[#0f0a08]/60 p-5">
                    <h3 className="text-xs font-semibold text-white mb-4 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-[#FFB366]" />
                      Resumo de Vendas
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Pendentes", count: pendingSales.length, color: "#FFB800" },
                        { label: "Aprovadas", count: approvedSales.length, color: "#00FF88" },
                        { label: "Recusadas", count: rejectedSales.length, color: "#FF4444" },
                      ].map(s => (
                        <button
                          key={s.label}
                          onClick={() => { setTab("pending"); }}
                          className="text-center p-4 rounded-lg border border-[#1f1612] hover:border-opacity-60 transition-all hover:bg-white/[0.02]"
                        >
                          <p className="text-2xl font-bold mb-1" style={{ color: s.color }}>{s.count}</p>
                          <p className="text-[10px] text-gray-500">{s.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#1f1612] bg-[#0f0a08]/60 p-5">
                    <h3 className="text-xs font-semibold text-white mb-4 flex items-center gap-2">
                      <Database className="h-4 w-4 text-[#00FF88]" />
                      Resumo Geral
                    </h3>
                    <div className="space-y-3">
                      {[
                        { label: "Usuários cadastrados", value: totalUsers },
                        { label: "Organizações ativas", value: usersWithOrg },
                        { label: "Pedidos de compra", value: totalSales },
                        { label: "Leads capturados (site)", value: totalLeads },
                        { label: "Atividades hoje", value: todayLeads },
                      ].map(r => (
                        <div key={r.label} className="flex items-center justify-between py-1 border-b border-[#1f1612] last:border-0">
                          <span className="text-xs text-gray-400">{r.label}</span>
                          <span className="text-xs font-semibold text-white">{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ══════ SALES TAB ══════ */}
              {tab === "pending" && (
                <div className="space-y-6">
                  {/* Pending checkout sales */}
                  {pendingSales.length > 0 && (
                    <div>
                      <h2 className="text-xs font-semibold text-white mb-3 flex items-center gap-2 uppercase tracking-wider">
                        <ShoppingCart className="h-4 w-4 text-[#FFB800]" />
                        Vendas aguardando aprovação ({pendingSales.length})
                      </h2>
                      <div className="space-y-3">
                        {pendingSales.map(sale => renderSaleCard(sale))}
                      </div>
                    </div>
                  )}

                  {/* Pending users without org */}
                  {pendingUsers.length > 0 && (
                    <div>
                      <h2 className="text-xs font-semibold text-white mb-3 flex items-center gap-2 uppercase tracking-wider">
                        <Users className="h-4 w-4 text-[#FFB366]" />
                        Usuários sem organização ({pendingUsers.length})
                      </h2>
                      <div className="space-y-3">
                        {pendingUsers.map(u => (
                          <div key={u.id} className="rounded-xl border border-[#1f1612] bg-[#0f0a08] p-4 flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-[#FFB366]/10 shrink-0">
                              <User className="h-5 w-5 text-[#FFB366]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white">{u.full_name || "Sem nome"}</p>
                              <div className="flex items-center gap-3 text-[11px] text-gray-500">
                                <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{u.email}</span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] border ${
                                  u.provider === "google"
                                    ? "bg-[#4285F4]/10 text-[#4285F4] border-[#4285F4]/20"
                                    : "bg-[#FFB366]/10 text-[#FFB366] border-[#FFB366]/20"
                                }`}>{u.provider === "google" ? "Google" : "Email"}</span>
                              </div>
                              <p className="text-[10px] text-gray-600 mt-0.5">
                                Cadastro: {new Date(u.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={async () => {
                                  setCreatingUser(u.id);
                                  try {
                                    const session = (await supabase.auth.getSession()).data.session;
                                    const { data, error: fnError } = await supabase.functions.invoke("admin-create-user", {
                                      headers: { Authorization: `Bearer ${session?.access_token}` },
                                      body: { email: u.email, full_name: u.full_name, existing_user_id: u.id },
                                    });
                                    if (fnError || data?.error) {
                                      toast({ title: "Erro", description: data?.error || fnError?.message, variant: "destructive" });
                                    } else {
                                      toast({ title: "✅ Usuário aprovado!", description: `Organização criada para ${u.email}.` });
                                      loadData();
                                    }
                                  } catch (err: any) {
                                    toast({ title: "Erro", description: err.message, variant: "destructive" });
                                  }
                                  setCreatingUser(null);
                                }}
                                disabled={creatingUser === u.id}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#00FF88]/10 text-[#00FF88] text-[11px] font-semibold hover:bg-[#00FF88]/20 transition-colors border border-[#00FF88]/20 disabled:opacity-50"
                              >
                                {creatingUser === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                {creatingUser === u.id ? "Aprovando..." : "Aprovar"}
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm(`Recusar e remover o usuário ${u.email}? Esta ação não pode ser desfeita.`)) return;
                                  try {
                                    const session = (await supabase.auth.getSession()).data.session;
                                    const { error: fnError } = await supabase.functions.invoke("admin-delete-user", {
                                      headers: { Authorization: `Bearer ${session?.access_token}` },
                                      body: { user_id: u.id },
                                    });
                                    if (fnError) {
                                      toast({ title: "Erro", description: fnError.message, variant: "destructive" });
                                    } else {
                                      toast({ title: "Usuário removido." });
                                      loadData();
                                    }
                                  } catch (err: any) {
                                    toast({ title: "Erro", description: err.message, variant: "destructive" });
                                  }
                                }}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 text-[11px] font-medium hover:bg-red-500/20 transition-colors border border-red-500/20"
                              >
                                <XCircle className="h-3.5 w-3.5" /> Recusar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Approved sales */}
                  {approvedSales.length > 0 && (
                    <div>
                      <h2 className="text-xs font-semibold text-white mb-3 flex items-center gap-2 uppercase tracking-wider">
                        <CheckCircle2 className="h-4 w-4 text-[#00FF88]" />
                        Aprovadas ({approvedSales.length})
                      </h2>
                      <div className="space-y-3">
                        {approvedSales.map(sale => renderSaleCard(sale))}
                      </div>
                    </div>
                  )}

                  {/* Rejected sales */}
                  {rejectedSales.length > 0 && (
                    <div>
                      <h2 className="text-xs font-semibold text-white mb-3 flex items-center gap-2 uppercase tracking-wider">
                        <XCircle className="h-4 w-4 text-[#FF4444]" />
                        Recusadas ({rejectedSales.length})
                      </h2>
                      <div className="space-y-3">
                        {rejectedSales.map(sale => renderSaleCard(sale))}
                      </div>
                    </div>
                  )}

                  {checkoutLeads.length === 0 && pendingUsers.length === 0 && (
                    <div className="text-center py-16 text-sm text-gray-600">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-gray-700" />
                      Nenhum item pendente. Tudo em dia! 🎉
                    </div>
                  )}
                </div>
              )}

              {/* ══════ USERS TAB ══════ */}
              {tab === "users" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">{filteredUsers.length} usuários encontrados</p>
                    <button
                      onClick={() => { setShowCreateUser(true); setNewUserForm({ email: "", full_name: "", password: "" }); setNewUserCredentials(null); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFB366]/10 text-[#FFB366] text-[11px] font-semibold hover:bg-[#FFB366]/20 transition-colors border border-[#FFB366]/20"
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Criar Usuário
                    </button>
                  </div>

                  {/* Create User Modal */}
                  {showCreateUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateUser(false)}>
                      <div className="bg-[#0f0a08] border border-[#1f1612] rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><UserPlus className="h-4 w-4 text-[#FFB366]" /> Criar Novo Usuário</h3>
                          <button onClick={() => setShowCreateUser(false)} className="text-gray-500 hover:text-white"><X className="h-4 w-4" /></button>
                        </div>

                        {newUserCredentials ? (
                          <div className="space-y-4">
                            <div className="bg-[#00FF88]/5 border border-[#00FF88]/20 rounded-xl p-4 text-center">
                              <CheckCircle2 className="h-8 w-8 text-[#00FF88] mx-auto mb-2" />
                              <p className="text-sm font-semibold text-white mb-1">Usuário criado com sucesso!</p>
                              <p className="text-[11px] text-gray-400">Copie as credenciais abaixo e envie ao usuário.</p>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between bg-[#0a0705] rounded-lg p-3 border border-[#1f1612]">
                                <div>
                                  <p className="text-[10px] text-gray-500 uppercase">Email</p>
                                  <p className="text-xs text-white font-mono">{newUserCredentials.email}</p>
                                </div>
                                <button onClick={() => copyToClipboard(newUserCredentials.email)} className="text-gray-500 hover:text-[#FFB366]"><Copy className="h-3.5 w-3.5" /></button>
                              </div>
                              <div className="flex items-center justify-between bg-[#0a0705] rounded-lg p-3 border border-[#1f1612]">
                                <div>
                                  <p className="text-[10px] text-gray-500 uppercase">Senha Temporária</p>
                                  <p className="text-xs text-white font-mono">{newUserCredentials.password}</p>
                                </div>
                                <button onClick={() => copyToClipboard(newUserCredentials.password)} className="text-gray-500 hover:text-[#FFB366]"><Copy className="h-3.5 w-3.5" /></button>
                              </div>
                            </div>
                            <button onClick={() => setShowCreateUser(false)} className="w-full py-2.5 rounded-lg bg-[#FFB366]/10 text-[#FFB366] text-xs font-semibold hover:bg-[#FFB366]/20 transition-colors">
                              Fechar
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <label className="text-[10px] uppercase text-gray-500 mb-1 block">Nome completo</label>
                              <input
                                type="text"
                                value={newUserForm.full_name}
                                onChange={e => setNewUserForm(f => ({ ...f, full_name: e.target.value }))}
                                placeholder="Ex: João Silva"
                                className="w-full h-9 px-3 rounded-lg bg-[#0a0705] border border-[#1f1612] text-xs text-white placeholder:text-gray-700 focus:outline-none focus:border-[#FFB366]/30"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] uppercase text-gray-500 mb-1 block">Email *</label>
                              <input
                                type="email"
                                value={newUserForm.email}
                                onChange={e => setNewUserForm(f => ({ ...f, email: e.target.value }))}
                                placeholder="usuario@empresa.com"
                                className="w-full h-9 px-3 rounded-lg bg-[#0a0705] border border-[#1f1612] text-xs text-white placeholder:text-gray-700 focus:outline-none focus:border-[#FFB366]/30"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] uppercase text-gray-500 mb-1 block">Senha (opcional — auto-gerada se vazio)</label>
                              <input
                                type="text"
                                value={newUserForm.password}
                                onChange={e => setNewUserForm(f => ({ ...f, password: e.target.value }))}
                                placeholder="Deixe vazio para gerar automaticamente"
                                className="w-full h-9 px-3 rounded-lg bg-[#0a0705] border border-[#1f1612] text-xs text-white placeholder:text-gray-700 focus:outline-none focus:border-[#FFB366]/30"
                              />
                            </div>
                            <button
                              onClick={createNewUser}
                              disabled={creatingNewUser || !newUserForm.email}
                              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#FF6B1A] to-[#FFB366] text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {creatingNewUser ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                              {creatingNewUser ? "Criando..." : "Criar Usuário"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="rounded-xl border border-[#1f1612] overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#0f0a08] border-b border-[#1f1612]">
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Usuário</th>
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Email</th>
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Método</th>
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Organização</th>
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Último acesso</th>
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Cadastro</th>
                          <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map(u => (
                          <tr key={u.id} className="border-b border-[#1f1612] hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#FF6B1A] to-[#FFB366] flex items-center justify-center text-[10px] font-bold text-white">
                                  {(u.full_name || u.email || "?")[0].toUpperCase()}
                                </div>
                                <span className="text-sm text-white">{u.full_name || "Sem nome"}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400">{u.email}</td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                u.provider === "google"
                                  ? "bg-[#4285F4]/10 text-[#4285F4] border-[#4285F4]/20"
                                  : "bg-[#FFB366]/10 text-[#FFB366] border-[#FFB366]/20"
                              }`}>
                                {u.provider === "google" ? "Google" : "Email/Senha"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {u.org_id ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00FF88]/10 text-[#00FF88] border border-[#00FF88]/20">Ativa</span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-500 border border-gray-700">Pendente</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {new Date(u.created_at).toLocaleDateString("pt-BR")}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={async () => {
                                    const deleteData = confirm(
                                      `⚠️ Deletar o usuário ${u.email}?\n\nClique OK para deletar o usuário E TODOS OS DADOS da organização (leads, CRM, IA, etc).\n\nEsta ação NÃO pode ser desfeita!`
                                    );
                                    if (!deleteData) return;
                                    setDeletingUser(u.id);
                                    try {
                                      const session = (await supabase.auth.getSession()).data.session;
                                      const { data, error: fnError } = await supabase.functions.invoke("admin-delete-user", {
                                        headers: { Authorization: `Bearer ${session?.access_token}` },
                                        body: { user_id: u.id, delete_org_data: true },
                                      });
                                      if (fnError || data?.error) {
                                        toast({ title: "Erro ao deletar", description: data?.error || fnError?.message, variant: "destructive" });
                                      } else {
                                        toast({ title: "✅ Usuário e dados deletados!", description: `${u.email} foi removido com sucesso.` });
                                        loadData();
                                      }
                                    } catch (err: any) {
                                      toast({ title: "Erro", description: err.message, variant: "destructive" });
                                    }
                                    setDeletingUser(null);
                                  }}
                                  disabled={deletingUser === u.id}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                  title="Deletar usuário e todos os dados"
                                >
                                  {deletingUser === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredUsers.length === 0 && (
                          <tr><td colSpan={7} className="text-center py-12 text-sm text-gray-600">Nenhum usuário encontrado.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ══════ LEADS TAB ══════ */}
              {tab === "leads" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {[
                      { key: "all", label: "Todos" },
                      { key: "early_access", label: "Acesso Antecipado" },
                      { key: "partnership", label: "Parceria" },
                    ].map(f => (
                      <button
                        key={f.key}
                        onClick={() => setLeadFilter(f.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                          leadFilter === f.key
                            ? "bg-[#FF6B1A]/15 text-[#FFB366] border border-[#FFB366]/20"
                            : "text-gray-500 hover:text-gray-300 border border-transparent"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                    <span className="text-[10px] text-gray-600 ml-auto">{filteredLeads.length} resultados</span>
                  </div>

                  <div className="rounded-xl border border-[#1f1612] overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#0f0a08] border-b border-[#1f1612]">
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Nome</th>
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Email</th>
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Telefone</th>
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Origem</th>
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Data</th>
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLeads.map(l => (
                          <tr key={l.id} className="border-b border-[#1f1612] hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 text-sm text-white">{l.name}</td>
                            <td className="px-4 py-3 text-xs text-gray-400">{l.email}</td>
                            <td className="px-4 py-3 text-xs text-gray-400">{l.phone || "—"}</td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                l.form_source === "partnership"
                                  ? "bg-[#FF6B1A]/10 text-[#FFB366] border-[#FFB366]/20"
                                  : "bg-[#00FF88]/10 text-[#00FF88] border-[#00FF88]/20"
                              }`}>
                                {l.form_source === "partnership" ? "Parceria" : "Acesso Antecipado"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {new Date(l.created_at).toLocaleDateString("pt-BR")}
                            </td>
                            <td className="px-4 py-3">
                              <button onClick={() => deleteLead(l.id)} className="text-gray-700 hover:text-red-400 transition-colors">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredLeads.length === 0 && (
                          <tr><td colSpan={6} className="text-center py-12 text-sm text-gray-600">Nenhum lead encontrado.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ══════ CONTENT TAB ══════ */}
              {tab === "content" && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 mb-4">Edite os textos e números exibidos na landing page do VS SALES.</p>
                  {siteContent.map(c => (
                    <div key={c.id} className="rounded-xl border border-[#1f1612] bg-[#0f0a08]/60 p-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">
                          {CONTENT_LABELS[c.key] || c.key}
                        </p>
                        {editingKey === c.key ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="w-full h-9 px-3 rounded-lg bg-[#0a0705] border border-[#FFB366]/30 text-sm text-white focus:outline-none"
                            autoFocus
                          />
                        ) : (
                          <p className="text-sm text-white truncate">{c.value}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {editingKey === c.key ? (
                          <>
                            <button onClick={() => saveContent(c.key)} className="h-8 w-8 rounded-lg bg-[#00FF88]/10 text-[#00FF88] hover:bg-[#00FF88]/20 flex items-center justify-center transition-colors">
                              <Save className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setEditingKey(null)} className="h-8 w-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-colors">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <button onClick={() => { setEditingKey(c.key); setEditValue(c.value); }} className="h-8 w-8 rounded-lg bg-white/[0.03] text-gray-500 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ══════ COMPANIES TAB ══════ */}
              {tab === "companies" && (
                <div className="space-y-6">
                  {!selectedOrgId ? (
                    <div className="space-y-4">
                      <p className="text-xs text-gray-500">Selecione uma organização para gerenciar.</p>
                      <div className="grid gap-3">
                        {organizations.filter(o => {
                          if (!searchQuery) return true;
                          return o.name.toLowerCase().includes(searchQuery.toLowerCase());
                        }).map(org => {
                          const ownerUser = users.find(u => u.id === org.owner_id);
                          const formUrl = `https://vssalesreal.lovable.app/forms/${org.form_token}`;
                          return (
                            <div
                              key={org.id}
                              className="rounded-xl border border-[#1f1612] bg-[#0f0a08] p-4 flex items-center gap-4 hover:border-[#FFB366]/20 transition-all"
                            >
                              <div
                                onClick={() => setSelectedOrgId(org.id)}
                                className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer hover:bg-white/[0.02] rounded-lg -m-2 p-2 transition-colors"
                              >
                                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-[#FF6B1A]/10 shrink-0">
                                  <Building2 className="h-5 w-5 text-[#FFB366]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-white">{org.name}</p>
                                  <div className="flex items-center gap-3 text-[11px] text-gray-500">
                                    {ownerUser && <span className="flex items-center gap-1"><User className="h-3 w-3" />{ownerUser.full_name || ownerUser.email}</span>}
                                    <span>Criada em {new Date(org.created_at).toLocaleDateString("pt-BR")}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(formUrl);
                                    toast({ title: "Link copiado!", description: formUrl });
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FF6B1A]/10 text-[#FFB366] text-[10px] font-semibold hover:bg-[#FF6B1A]/20 transition-colors border border-[#FFB366]/20"
                                  title="Copiar link do formulário"
                                >
                                  <Link2 className="h-3.5 w-3.5" />
                                  Link de Forms
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {organizations.length === 0 && (
                          <div className="text-center py-16 text-sm text-gray-600">
                            <Building2 className="h-8 w-8 mx-auto mb-3 text-gray-700" />
                            Nenhuma organização cadastrada.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <OrgDetailView
                      orgId={selectedOrgId}
                      orgName={organizations.find(o => o.id === selectedOrgId)?.name || "Organização"}
                      onBack={() => setSelectedOrgId(null)}
                    />
                  )}
                </div>
              )}
            </>
          )}

          {/* === PLANS TAB === */}
          {tab === "plans" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Planos & Preços</h2>
                <div className="flex gap-2">
                  <button onClick={loadPlans} className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-[#FFB366] px-3 py-2 rounded-lg border border-[#1f1612] hover:border-[#FFB366]/30 transition-colors">
                    <RefreshCw className="h-3 w-3" /> Atualizar
                  </button>
                  <button
                    onClick={() => setEditingPlan({ name: "", slug: "", description: "", price_monthly: 0, price_yearly: null, features: [], is_popular: false, is_active: true, sort_order: plans.length + 1, currency: "BRL" })}
                    className="flex items-center gap-1 text-[10px] text-white px-3 py-2 rounded-lg bg-[#FF6B1A] hover:bg-[#FF6B1A]/80 transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Novo Plano
                  </button>
                </div>
              </div>

              {/* Editing form */}
              {editingPlan && (
                <div className="rounded-xl border border-[#FFB366]/20 bg-[#0f0a08] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">{editingPlan.id ? "Editar Plano" : "Novo Plano"}</h3>
                    <button onClick={() => setEditingPlan(null)} className="text-gray-500 hover:text-white"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Nome</label>
                      <input value={editingPlan.name} onChange={e => setEditingPlan({ ...editingPlan, name: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-[#0a0705] border border-[#1f1612] text-sm text-white" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Slug</label>
                      <input value={editingPlan.slug} onChange={e => setEditingPlan({ ...editingPlan, slug: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-[#0a0705] border border-[#1f1612] text-sm text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Subtítulo / Descrição</label>
                    <input value={editingPlan.description || ""} onChange={e => setEditingPlan({ ...editingPlan, description: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[#0a0705] border border-[#1f1612] text-sm text-white" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Preço Mensal (R$)</label>
                      <input type="number" value={editingPlan.price_monthly} onChange={e => setEditingPlan({ ...editingPlan, price_monthly: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg bg-[#0a0705] border border-[#1f1612] text-sm text-white" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Preço Anual (R$)</label>
                      <input type="number" value={editingPlan.price_yearly || ""} onChange={e => setEditingPlan({ ...editingPlan, price_yearly: e.target.value ? Number(e.target.value) : null })}
                        placeholder="Opcional" className="w-full px-3 py-2 rounded-lg bg-[#0a0705] border border-[#1f1612] text-sm text-white placeholder:text-gray-600" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Ordem</label>
                      <input type="number" value={editingPlan.sort_order} onChange={e => setEditingPlan({ ...editingPlan, sort_order: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg bg-[#0a0705] border border-[#1f1612] text-sm text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Features (uma por linha)</label>
                    <textarea
                      value={Array.isArray(editingPlan.features) ? editingPlan.features.join("\n") : editingPlan.features}
                      onChange={e => setEditingPlan({ ...editingPlan, features: e.target.value.split("\n") })}
                      rows={5}
                      className="w-full px-3 py-2 rounded-lg bg-[#0a0705] border border-[#1f1612] text-sm text-white resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                      <input type="checkbox" checked={editingPlan.is_popular} onChange={e => setEditingPlan({ ...editingPlan, is_popular: e.target.checked })}
                        className="rounded" /> Destaque (Recomendado)
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                      <input type="checkbox" checked={editingPlan.is_active} onChange={e => setEditingPlan({ ...editingPlan, is_active: e.target.checked })}
                        className="rounded" /> Ativo
                    </label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingPlan(null)} className="px-4 py-2 rounded-lg text-xs text-gray-400 hover:text-white border border-[#1f1612] transition-colors">Cancelar</button>
                    <button onClick={savePlan} disabled={savingPlan} className="flex items-center gap-1 px-4 py-2 rounded-lg text-xs text-white bg-[#FF6B1A] hover:bg-[#FF6B1A]/80 transition-colors disabled:opacity-50">
                      {savingPlan ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvar
                    </button>
                  </div>
                </div>
              )}

              {/* Plans list */}
              {plansLoading ? (
                <div className="flex items-center justify-center h-48"><Loader2 className="h-5 w-5 animate-spin text-[#FFB366]" /></div>
              ) : (
                <div className="space-y-3">
                  {plans.map(plan => {
                    const features = Array.isArray(plan.features) ? plan.features : [];
                    return (
                      <div key={plan.id} className={`rounded-xl border p-5 transition-all ${plan.is_popular ? "border-[#FF6B1A]/40 bg-[#FF6B1A]/[0.04]" : "border-[#1f1612] bg-[#0f0a08]/60"}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-white">{plan.name}</h3>
                              {plan.is_popular && (
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#FF6B1A] text-white font-semibold uppercase tracking-wider">Recomendado</span>
                              )}
                              {!plan.is_active && (
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-semibold">Inativo</span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">{plan.description}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setEditingPlan({ ...plan })} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-[#FFB366] px-2 py-1.5 rounded-lg border border-[#1f1612] hover:border-[#FFB366]/30 transition-colors">
                              <Edit3 className="h-3 w-3" /> Editar
                            </button>
                            <button onClick={() => deletePlan(plan.id)} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-400 px-2 py-1.5 rounded-lg border border-[#1f1612] hover:border-red-400/30 transition-colors">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-baseline gap-1 mb-3">
                          <span className="text-xs text-gray-500">R$</span>
                          <span className="text-2xl font-black text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                            {Number(plan.price_monthly).toLocaleString("pt-BR")}
                          </span>
                          <span className="text-xs text-gray-500">/mês</span>
                          {plan.price_yearly && (
                            <span className="text-xs text-gray-500 ml-3">ou R$ {Number(plan.price_yearly).toLocaleString("pt-BR")}/ano</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {features.map((f: string, i: number) => (
                            <span key={i} className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.04] text-gray-400 border border-[#1f1612]">{f}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {plans.length === 0 && (
                    <div className="text-center py-16 text-gray-600">
                      <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Nenhum plano cadastrado.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* === LOGS TAB === */}
          {tab === "logs" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Centro de Diagnóstico</h2>
                  <p className="text-xs text-gray-500">Monitoramento e análise de atividades em tempo real.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-[#0a0705] border border-[#1f1612] rounded-lg p-1">
                    {(["1h", "6h", "24h", "all"] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setLogTimeRange(r)}
                        className={`px-3 py-1 rounded-md text-[10px] font-medium transition-all ${
                          logTimeRange === r ? "bg-[#FF6B1A] text-white shadow-lg" : "text-gray-500 hover:text-white"
                        }`}
                      >
                        {r.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <button onClick={loadLogs} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FF6B1A]/10 text-[#FFB366] text-xs font-medium hover:bg-[#FF6B1A]/20 transition-colors border border-[#FFB366]/20">
                    <RefreshCw className={`h-3.5 w-3.5 ${logsLoading ? "animate-spin" : ""}`} /> Atualizar
                  </button>
                </div>
              </div>

              {/* Activity Chart */}
              <div className="h-[200px] w-full bg-[#0f0a08] border border-[#1f1612] rounded-2xl p-4 overflow-hidden relative group">
                <div className="absolute top-4 right-4 z-10 flex gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-[#00FF88]" />
                    <span className="text-[10px] text-gray-400">Sucesso</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-[#FF4444]" />
                    <span className="text-[10px] text-gray-400">Falha</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00FF88" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#00FF88" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorFailure" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FF4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#FF4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1A1A2E" />
                    <XAxis 
                      dataKey="time" 
                      stroke="#4B5563" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis 
                      stroke="#4B5563" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      allowDecimals={false}
                    />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: "#0f0a08", border: "1px solid #1f1612", borderRadius: "12px", fontSize: "10px" }}
                      itemStyle={{ fontSize: "10px" }}
                    />
                    <Area type="monotone" dataKey="success" stroke="#00FF88" fillOpacity={1} fill="url(#colorSuccess)" strokeWidth={2} />
                    <Area type="monotone" dataKey="failure" stroke="#FF4444" fillOpacity={1} fill="url(#colorFailure)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Filters */}
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                  <input
                    value={logSearchQuery}
                    onChange={e => setLogSearchQuery(e.target.value)}
                    placeholder="Filtrar por ação, descrição, usuário ou erro..."
                    className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#0f0a08] border border-[#1f1612] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FFB366]/30 transition-all font-inter"
                  />
                </div>
                <select
                  value={logUserFilter}
                  onChange={e => setLogUserFilter(e.target.value)}
                  className="h-10 px-4 rounded-xl bg-[#0f0a08] border border-[#1f1612] text-sm text-white focus:outline-none focus:border-[#FFB366]/30 transition-all cursor-pointer"
                >
                  <option value="all">Todos os usuários</option>
                  {Array.from(new Map(activityLogs.map(l => [l.user_id, l.user_name || l.user_email])).entries()).map(([uid, name]) => (
                    <option key={uid} value={uid}>{name}</option>
                  ))}
                </select>
              </div>

              {/* Log entries */}
              {logsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-[#FFB366]" />
                    <p className="text-xs text-gray-500 animate-pulse">Carregando logs...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredLogs.map(log => {
                    const isSuccess = log.success;
                    const statusColor = isSuccess ? "#00FF88" : "#FF4444";
                    const StatusIcon = isSuccess ? CheckCircle2 : AlertCircle;
                    const orgName = organizations.find(o => o.id === log.org_id)?.name;

                    return (
                      <div
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className="group flex items-center gap-4 p-3 rounded-2xl border border-[#1f1612] bg-[#0f0a08]/60 hover:bg-[#0f0a08] hover:border-[#FFB366]/30 transition-all cursor-pointer"
                      >
                        <div
                          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                          style={{ background: `${statusColor}08`, border: `1px solid ${statusColor}15` }}
                        >
                          <StatusIcon className="h-5 w-5" style={{ color: statusColor }} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-white truncate">{log.description}</span>
                            <span
                              className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                              style={{ background: `${statusColor}12`, color: statusColor, border: `1px solid ${statusColor}20` }}
                            >
                              {isSuccess ? "Ok" : "Erro"}
                            </span>
                            {!isSuccess && <Sparkles className="h-3 w-3 text-[#FFB800] animate-pulse" />}
                          </div>

                          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
                            <span className="flex items-center gap-1.5">
                              <User className="h-3 w-3 text-gray-600" />
                              {log.user_name || log.user_email || "—"}
                            </span>
                            {orgName && (
                              <span className="flex items-center gap-1.5">
                                <Building2 className="h-3 w-3 text-gray-600" />
                                {orgName}
                              </span>
                            )}
                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#FF6B1A]/05 text-[#FFB366]/80 border border-[#FF6B1A]/10">
                              <Terminal className="h-3 w-3" />
                              {log.action}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[11px] font-medium text-gray-400">
                            {new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span className="text-[9px] text-gray-600">
                            {new Date(log.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        
                        <ChevronRight className="h-4 w-4 text-gray-700 group-hover:text-[#FFB366] group-hover:translate-x-1 transition-all" />
                      </div>
                    );
                  })}

                  {filteredLogs.length === 0 && (
                    <div className="text-center py-20 bg-[#0f0a08] rounded-3xl border border-[#1f1612] border-dashed">
                      <div className="h-16 w-16 bg-[#1f1612] rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Activity className="h-8 w-8 text-gray-600 opacity-50" />
                      </div>
                      <p className="text-sm text-white font-medium">Nenhum log encontrado</p>
                      <p className="text-xs text-gray-600 mt-1">Tente ajustar seus filtros ou busca.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Log Detail Drawer */}
              <Drawer open={!!selectedLog} onOpenChange={(open) => { if (!open) { setSelectedLog(null); setDiagnosis(null); } }}>
                <DrawerContent className="bg-[#0f0a08] border-[#1f1612] text-white max-h-[90vh]">
                  <div className="mx-auto w-full max-w-4xl overflow-y-auto overflow-x-hidden p-6">
                    <DrawerHeader className="px-0">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <DrawerTitle className="text-xl font-bold flex items-center gap-3">
                             <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${selectedLog?.success ? "bg-[#00FF88]/10 text-[#00FF88]" : "bg-[#FF4444]/10 text-[#FF4444]"}`}>
                               {selectedLog?.success ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                             </div>
                             {selectedLog?.description}
                          </DrawerTitle>
                          <DrawerDescription className="text-gray-500 flex items-center gap-4">
                            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {selectedLog && new Date(selectedLog.created_at).toLocaleString("pt-BR")}</span>
                            <span className="flex items-center gap-1.5"><Terminal className="h-3.5 w-3.5" /> ID: {selectedLog?.id}</span>
                          </DrawerDescription>
                        </div>
                        <DrawerClose className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                          <X className="h-5 w-5" />
                        </DrawerClose>
                      </div>
                    </DrawerHeader>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-6">
                      <div className="lg:col-span-2 space-y-6">
                        {/* Event Details */}
                        <div className="space-y-4">
                          <h4 className="text-sm font-bold text-[#FFB366] uppercase tracking-widest flex items-center gap-2">
                             <Info className="h-4 w-4" /> Detalhes do Evento
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                               <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Ação</p>
                               <p className="text-sm font-medium">{selectedLog?.action}</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                               <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Status</p>
                               <div className="flex items-center gap-2">
                                 <div className={`h-2 w-2 rounded-full ${selectedLog?.success ? "bg-[#00FF88]" : "bg-[#FF4444]"}`} />
                                 <p className="text-sm font-medium">{selectedLog?.success ? "Sucesso" : "Falha"}</p>
                               </div>
                            </div>
                          </div>
                        </div>

                        {/* Error Analysis / Diagnosis */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-[#FFB800] uppercase tracking-widest flex items-center gap-2">
                               <Sparkles className="h-4 w-4" /> Inteligência VS
                            </h4>
                            {!diagnosis && !selectedLog?.success && (
                              <button 
                                onClick={() => diagnoseLog(selectedLog)}
                                disabled={diagnosing}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FFB800] to-[#FF4444] text-black text-xs font-black hover:opacity-90 disabled:opacity-50 transition-all shadow-xl shadow-orange-500/20"
                              >
                                {diagnosing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="h-3.5 w-3.5" />}
                                DIAGNOSTICAR COM IA
                              </button>
                            )}
                          </div>

                          {diagnosing && (
                            <div className="bg-[#FFB800]/5 border border-[#FFB800]/20 rounded-2xl p-8 text-center space-y-3">
                               <Loader2 className="h-8 w-8 animate-spin text-[#FFB800] mx-auto" />
                               <p className="text-sm font-bold text-white">Analisando root cause e propondo solução...</p>
                               <p className="text-xs text-gray-500">Isso pode levar alguns segundos.</p>
                            </div>
                          )}

                          {diagnosis ? (
                            <div className="bg-white/5 border border-[#FFB800]/20 rounded-2xl p-6 prose prose-invert prose-sm max-w-none prose-headings:text-[#FFB800] prose-strong:text-white prose-p:text-gray-300">
                               <ReactMarkdown>{diagnosis}</ReactMarkdown>
                            </div>
                          ) : !selectedLog?.success ? (
                             <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
                               <div className="flex items-center gap-3 text-red-400 mb-3">
                                 <AlertCircle className="h-5 w-5" />
                                 <span className="font-bold text-sm">Mensagem do Sistema:</span>
                               </div>
                               <pre className="text-xs bg-black/40 p-4 rounded-xl border border-white/5 text-red-200 overflow-x-auto whitespace-pre-wrap">
                                 {selectedLog?.error_message || "Ocorreu um erro desconhecido durante esta operação."}
                               </pre>
                             </div>
                          ) : (
                             <div className="bg-[#00FF88]/5 border border-[#00FF88]/20 rounded-2xl p-6 flex items-center gap-4">
                               <CheckCircle2 className="h-10 w-10 text-[#00FF88] opacity-50" />
                               <div>
                                 <p className="text-sm font-bold text-white">Operação saudável</p>
                                 <p className="text-xs text-gray-500">Nenhuma anomalia detectada nesta atividade.</p>
                               </div>
                             </div>
                          )}
                        </div>

                        {/* Raw Metadata */}
                        <div className="space-y-4">
                          <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                             <Database className="h-4 w-4" /> Metadados Brutos
                          </h4>
                          <pre className="text-[11px] bg-black/40 p-4 rounded-3xl border border-white/5 text-[#FFB366]/80 overflow-x-auto font-mono custom-scrollbar">
                            {JSON.stringify(selectedLog?.metadata, null, 2)}
                          </pre>
                        </div>
                      </div>

                      <div className="space-y-6">
                        {/* Context Section */}
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Contexto da Sessão</h4>
                          
                          <div className="space-y-4">
                            <div className="flex items-start gap-3">
                              <User className="h-4 w-4 text-[#FFB366] mt-1" />
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] text-gray-500 uppercase font-bold">Usuário</p>
                                <p className="text-xs font-medium text-white truncate">{selectedLog?.user_name || "Anônimo"}</p>
                                <p className="text-[10px] text-gray-500 truncate">{selectedLog?.user_email}</p>
                              </div>
                            </div>

                            <div className="flex items-start gap-3">
                              <Building2 className="h-4 w-4 text-[#FFB366] mt-1" />
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] text-gray-500 uppercase font-bold">Organização</p>
                                <p className="text-xs font-medium text-white truncate">{organizations.find(o => o.id === selectedLog?.org_id)?.name || "N/A"}</p>
                              </div>
                            </div>

                            {selectedLog?.metadata?.url && (
                              <div className="flex items-start gap-3">
                                <Globe className="h-4 w-4 text-[#FFB366] mt-1" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[10px] text-gray-500 uppercase font-bold">URL de Origem</p>
                                  <p className="text-xs font-medium text-white truncate" title={selectedLog.metadata.url}>
                                    {selectedLog.metadata.url}
                                  </p>
                                </div>
                              </div>
                            )}

                            {selectedLog?.metadata?.userAgent && (
                              <div className="flex items-start gap-3">
                                <Laptop className="h-4 w-4 text-[#FFB366] mt-1" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[10px] text-gray-500 uppercase font-bold">Ambiente</p>
                                  <p className="text-[10px] font-medium text-white break-words">
                                    {selectedLog.metadata.userAgent}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Recent Activity Mini-timeline */}
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
                           <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Atividades Próximas</h4>
                           <div className="space-y-3">
                             {activityLogs
                               .filter(l => l.user_id === selectedLog?.user_id && l.id !== selectedLog?.id)
                               .slice(0, 3)
                               .map(l => (
                                 <div key={l.id} className="flex gap-3 relative pb-3 border-l border-white/10 pl-4 ml-2 last:pb-0">
                                   <div className={`absolute top-0 -left-[5px] h-2 w-2 rounded-full \${l.success ? "bg-[#00FF88]" : "bg-[#FF4444]"}`} />
                                   <div className="min-w-0">
                                     <p className="text-[11px] font-bold text-white truncate">{l.description}</p>
                                     <p className="text-[10px] text-gray-500">{new Date(l.created_at).toLocaleTimeString("pt-BR")}</p>
                                   </div>
                                 </div>
                               ))}
                             {activityLogs.filter(l => l.user_id === selectedLog?.user_id && l.id !== selectedLog?.id).length === 0 && (
                               <p className="text-[10px] text-gray-500 italic">Nenhuma outra atividade recente.</p>
                             )}
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <DrawerFooter className="p-6 pt-0 border-t border-white/5 mx-auto w-full max-w-4xl">
                    <div className="w-full flex items-center justify-between">
                       <p className="text-[10px] text-gray-600">Sistema VS SALES • Diagnostic Center v2.0</p>
                       <DrawerClose className="px-6 py-2 rounded-xl bg-white/5 text-xs text-white hover:bg-white/10 transition-all font-bold">
                         FECHAR
                       </DrawerClose>
                    </div>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
