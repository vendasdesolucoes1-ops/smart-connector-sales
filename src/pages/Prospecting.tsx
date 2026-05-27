import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  Search, Globe, MessageCircle, Loader2, Plus, Users2, MessageSquare,
  Contact, Smartphone, QrCode, RefreshCw, Trash2, Wifi, WifiOff,
  CheckCircle2, Tag, X, Zap, Eye,
  Sparkles, Phone, Building2, User, Upload,
  FileSpreadsheet, AlertCircle, MapPin, ArrowRight,
  ExternalLink, Compass, Target, Brain, TrendingUp, Check, Circle
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useEvolutionInstances } from "@/hooks/useEvolutionInstances";

type ScrapeResult = {
  name: string | null; phone: string | null; email: string | null;
  company: string | null; role: string | null; city: string | null;
  website: string | null; segment: string | null; company_size: string | null;
  icp_score: number; icp_reason: string | null;
};
type ScrapeJob = {
  id: string; niche: string; keywords: string; city: string;
  prospecting_intent: string;
  status: "running" | "completed" | "failed";
  results: ScrapeResult[]; results_count: number; total_found: number;
  duplicates_skipped: number; pages_searched: number;
  avg_icp_score: number; company_profile_used: boolean;
  created_at: string; error_message?: string;
};

const PRESET_SEGMENTS = [
  { label: "Bares e Restaurantes", value: "bares restaurantes", icon: "🍽️" },
  { label: "Imobiliárias", value: "imobiliárias", icon: "🏠" },
  { label: "Clínicas Médicas", value: "clínicas médicas", icon: "🏥" },
  { label: "Advocacia", value: "escritórios de advocacia", icon: "⚖️" },
  { label: "Academias", value: "academias fitness", icon: "💪" },
  { label: "E-commerces", value: "lojas online e-commerce", icon: "🛒" },
  { label: "Odontologia", value: "clínicas odontológicas", icon: "🦷" },
  { label: "Contabilidade", value: "escritórios contabilidade", icon: "📊" },
  { label: "Educação", value: "escolas cursos", icon: "📚" },
  { label: "Marketing", value: "agências marketing digital", icon: "📢" },
  { label: "Pet Shops", value: "pet shops veterinários", icon: "🐾" },
  { label: "Tecnologia", value: "empresas tecnologia SaaS", icon: "💻" },
];

const STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const PROSPECTING_STAGES = [
  { label: "Analisando perfil da empresa...", delay: 0 },
  { label: "Montando consultas de busca para o nicho...", delay: 3000 },
  { label: "Buscando leads em sites públicos...", delay: 8000 },
  { label: "Raspando páginas de contato...", delay: 15000 },
  { label: "Calculando score ICP de cada lead...", delay: 25000 },
  { label: "Salvando leads no banco de dados...", delay: 40000 },
];

function ProspectingThinkingFeed({ isRunning }: { isRunning: boolean }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!isRunning) return;
    startRef.current = Date.now();
    setCurrentStep(0);
    setElapsedMs(0);

    const timer = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      setElapsedMs(elapsed);
      const nextStep = PROSPECTING_STAGES.filter(s => elapsed >= s.delay).length - 1;
      setCurrentStep(Math.max(0, nextStep));
    }, 500);

    return () => clearInterval(timer);
  }, [isRunning]);

  if (!isRunning) return null;

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <div className="mt-3 space-y-1.5 pl-1">
      {PROSPECTING_STAGES.map((stage, i) => {
        const isComplete = i < currentStep;
        const isCurrent = i === currentStep;
        const isPending = i > currentStep;

        if (isPending) return null;

        return (
          <div
            key={i}
            className="flex items-center gap-2 animate-fade-in"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            {isComplete ? (
              <Check className="h-3.5 w-3.5 text-success shrink-0" />
            ) : isCurrent ? (
              <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
            )}
            <span className={`text-xs ${isComplete ? "text-muted-foreground line-through" : isCurrent ? "text-foreground font-medium" : "text-muted-foreground/40"}`}>
              {stage.label}
            </span>
          </div>
        );
      })}
      <p className="text-[10px] text-muted-foreground mt-2 pl-5">
        ⏱ Tempo decorrido: {formatTime(elapsedMs)}
      </p>
    </div>
  );
}

export default function Prospecting() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const {
    instances, instancesLoading, selectedInstance, setSelectedInstance,
    newInstanceName, setNewInstanceName, creatingInstance, createInstance,
    deleteInstance, getQRCode, fetchInstances,
    qrDialogOpen, setQrDialogOpen, qrCode, qrLoading, qrInstanceName, connectionStatus,
  } = useEvolutionInstances();

  const [scrapeJobs, setScrapeJobs] = useState<ScrapeJob[]>([]);
  const [scrapingLoading, setScrapingLoading] = useState(false);
  const [viewResults, setViewResults] = useState<ScrapeJob | null>(null);
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set());
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const [companyProfileLoaded, setCompanyProfileLoaded] = useState(false);

  // Wizard
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedNiche, setSelectedNiche] = useState("");
  const [customNiche, setCustomNiche] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedBairro, setSelectedBairro] = useState("");
  const [leadCount, setLeadCount] = useState(20);
  const [prospectingIntent, setProspectingIntent] = useState("");

  // WhatsApp state
  const [whatsappMode, setWhatsappMode] = useState<"group" | "conversation" | "contact">("group");
  const [evolutionLoading, setEvolutionLoading] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<{ id: string; name: string; size: number }[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupSearchFilter, setGroupSearchFilter] = useState("");
  const [extractTags, setExtractTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

  // Group search
  const [groupSearchNiche, setGroupSearchNiche] = useState("");
  const [groupSearchRegion, setGroupSearchRegion] = useState("");
  const [groupSearchLoading, setGroupSearchLoading] = useState(false);
  const [foundGroups, setFoundGroups] = useState<{ name: string; url: string; source: string }[]>([]);

  // Manual
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

  // File
  const [fileUploading, setFileUploading] = useState(false);
  const [fileParsedLeads, setFileParsedLeads] = useState<{ name: string; phone: string; email: string }[]>([]);
  const [fileError, setFileError] = useState("");

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
    if (digits.length === 11 || digits.length === 10) return `+55${digits}`;
    return phone;
  };

  const capitalizeName = (name: string) => name.replace(/\b\w/g, (c) => c.toUpperCase()).trim();

  // Load company profile once on mount
  useState(() => {
    if (!profile?.org_id || companyProfileLoaded) return;
    supabase.from("company_profiles").select("*").eq("org_id", profile.org_id).maybeSingle()
      .then(({ data }) => {
        setCompanyProfile(data || null);
        setCompanyProfileLoaded(true);
      });
  });

  // === Web Scraping ===
  const activeNiche = customNiche || selectedNiche;
  const activeLocation = [selectedCity, selectedBairro, selectedState].filter(Boolean).join(", ");

  const resetWizard = () => {
    setSelectedNiche(""); setCustomNiche("");
    setSelectedState(""); setSelectedCity(""); setSelectedBairro("");
    setLeadCount(20); setProspectingIntent("");
  };

  const icpScoreColor = (score: number) => {
    if (score >= 80) return "text-success bg-success/10 border-success/30";
    if (score >= 60) return "text-primary bg-primary/10 border-primary/30";
    if (score >= 40) return "text-warning bg-warning/10 border-warning/30";
    return "text-muted-foreground bg-secondary border-border";
  };

  const icpScoreLabel = (score: number) => {
    if (score >= 80) return "Perfeito";
    if (score >= 60) return "Bom";
    if (score >= 40) return "Médio";
    if (score >= 20) return "Fraco";
    return "Ruim";
  };

  const handleScrape = async () => {
    if (!profile?.org_id || !activeNiche) return;
    setScrapingLoading(true);
    setWizardOpen(false);

    const jobId = crypto.randomUUID();
    const newJob: ScrapeJob = {
      id: jobId, niche: activeNiche, keywords: "", city: activeLocation,
      prospecting_intent: prospectingIntent,
      status: "running", results: [], results_count: 0, total_found: 0,
      duplicates_skipped: 0, pages_searched: 0, avg_icp_score: 0,
      company_profile_used: !!companyProfile?.company_name,
      created_at: new Date().toISOString(),
    };
    setScrapeJobs(prev => [newJob, ...prev]);

    try {
      const { data, error } = await supabase.functions.invoke("scrape-leads", {
        body: {
          org_id: profile.org_id,
          niche: activeNiche,
          city: selectedCity || undefined,
          state: selectedState || undefined,
          bairro: selectedBairro || undefined,
          limit: leadCount,
          prospecting_intent: prospectingIntent || undefined,
        },
      });
      if (error) throw error;

      setScrapeJobs(prev => prev.map(j => j.id === jobId ? {
        ...j,
        status: "completed" as const,
        results_count: data?.count || 0,
        total_found: data?.total_found || 0,
        duplicates_skipped: data?.duplicates_skipped || 0,
        pages_searched: data?.pages_searched || 0,
        results: data?.results || [],
        avg_icp_score: data?.avg_icp_score || 0,
        company_profile_used: data?.company_profile_used || false,
      } : j));

      const dupMsg = data?.duplicates_skipped ? ` (${data.duplicates_skipped} duplicados ignorados)` : "";
      const icpMsg = data?.avg_icp_score ? ` · Score ICP médio: ${data.avg_icp_score}/100` : "";
      toast({ title: "Prospecção concluída! 🎯", description: `${data?.count || 0} novos leads salvos de ${data?.total_found || 0} encontrados${dupMsg}${icpMsg}` });
      resetWizard();
    } catch (error: any) {
      console.error("Erro completo na prospecção (Nicho):", error);
      setScrapeJobs(prev => prev.map(j => j.id === jobId ? {
        ...j, status: "failed" as const, error_message: error.message || "Erro desconhecido na prospecção",
      } : j));
      toast({
        title: "Erro na prospecção",
        description: error.message || "Falha ao invocar a função de busca. Verifique os logs do console.",
        variant: "destructive"
      });
    } finally { setScrapingLoading(false); }
  };

  // === WhatsApp Extract ===
  const handleFetchGroups = async () => {
    if (!profile?.org_id || !selectedInstance) return;
    setGroupsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-whatsapp", {
        body: { org_id: profile.org_id, mode: "list_groups", instance_name: selectedInstance },
      });
      if (error) throw error;
      setAvailableGroups(data?.groups || []);
      setSelectedGroupIds(new Set());
    } catch (error: any) {
      toast({ title: "Erro ao buscar grupos", description: error.message, variant: "destructive" });
    } finally { setGroupsLoading(false); }
  };

  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroupIds(prev => { const next = new Set(prev); next.has(groupId) ? next.delete(groupId) : next.add(groupId); return next; });
  };

  const selectAllGroups = () => {
    if (selectedGroupIds.size === availableGroups.length) setSelectedGroupIds(new Set());
    else setSelectedGroupIds(new Set(availableGroups.map(g => g.id)));
  };

  const handleWhatsappExtract = async () => {
    if (!profile?.org_id) return;
    setEvolutionLoading(true);
    try {
      const body: any = { org_id: profile.org_id, mode: whatsappMode, instance_name: selectedInstance || undefined };
      if (whatsappMode === "group") {
        body.group_ids = Array.from(selectedGroupIds);
        if (extractTags.length > 0) body.tags = extractTags;
      }
      const { data, error } = await supabase.functions.invoke("extract-whatsapp", { body });
      if (error) throw error;
      const desc = whatsappMode === "group"
        ? `${data?.count || 0} contatos extraídos de ${data?.groups?.length || 0} grupo(s)`
        : whatsappMode === "conversation"
        ? `${data?.count || 0} conversas extraídas`
        : `${data?.count || 0} contatos importados`;
      toast({ title: "Extração concluída!", description: desc });
      setSelectedGroupIds(new Set());
    } catch (error: any) {
      console.error("Erro completo na extração (WhatsApp):", error);
      toast({ 
        title: "Erro na extração", 
        description: error.message || "Falha na comunicação com o WhatsApp. Verifique se a instância está conectada.", 
        variant: "destructive" 
      });
  } finally { setEvolutionLoading(false); }
  };

  // === Search WhatsApp Groups ===
  const handleSearchGroups = async () => {
    if (!groupSearchNiche.trim()) return;
    setGroupSearchLoading(true);
    setFoundGroups([]);
    try {
      const { data, error } = await supabase.functions.invoke("search-whatsapp-groups", {
        body: {
          niche: groupSearchNiche.trim(),
          region: groupSearchRegion.trim() || undefined,
          limit: 20,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro na busca");
      setFoundGroups(data.groups || []);
      toast({
        title: `${data.total || 0} grupos encontrados! 🔍`,
        description: `Busca: "${groupSearchNiche}"${groupSearchRegion ? ` em ${groupSearchRegion}` : ""}`,
      });
    } catch (error: any) {
      toast({ title: "Erro na busca de grupos", description: error.message, variant: "destructive" });
    } finally { setGroupSearchLoading(false); }
  };

  // === Manual ===
  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.org_id) return;
    setManualLoading(true);
    try {
      const { error } = await supabase.from("leads_raw").insert({
        org_id: profile.org_id, name: capitalizeName(manualName),
        phone: formatPhone(manualPhone), email: manualEmail || null,
        source: "manual" as const, status: "pending" as const,
      });
      if (error) throw error;
      toast({ title: "Lead adicionado!", description: `${manualName} salvo com sucesso.` });
      setManualName(""); setManualPhone(""); setManualEmail("");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally { setManualLoading(false); }
  };

  // === File Upload ===
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(""); setFileParsedLeads([]);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "txt"].includes(ext || "")) { setFileError("Formato não suportado. Use .csv ou .txt"); return; }
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { setFileError("Arquivo vazio ou sem dados."); return; }
      const sep = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
      const header = lines[0].toLowerCase().split(sep).map(h => h.trim().replace(/"/g, ""));
      const nameIdx = header.findIndex(h => ["nome", "name", "nome completo", "full_name", "fullname"].includes(h));
      const phoneIdx = header.findIndex(h => ["telefone", "phone", "celular", "whatsapp", "tel", "fone", "numero"].includes(h));
      const emailIdx = header.findIndex(h => ["email", "e-mail", "e_mail"].includes(h));
      if (phoneIdx === -1 && nameIdx === -1) { setFileError("Não encontrei colunas de 'nome' ou 'telefone'."); return; }
      const parsed = lines.slice(1).map(line => {
        const cols = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ""));
        return { name: nameIdx >= 0 ? cols[nameIdx] || "" : "", phone: phoneIdx >= 0 ? cols[phoneIdx] || "" : "", email: emailIdx >= 0 ? cols[emailIdx] || "" : "" };
      }).filter(l => l.name || l.phone);
      if (parsed.length === 0) { setFileError("Nenhum lead válido encontrado."); return; }
      setFileParsedLeads(parsed);
    } catch { setFileError("Erro ao ler o arquivo."); }
    e.target.value = "";
  };

  const handleFileImport = async () => {
    if (!profile?.org_id || fileParsedLeads.length === 0) return;
    setFileUploading(true);
    try {
      const batch = fileParsedLeads.map(l => ({
        org_id: profile.org_id!, name: l.name ? capitalizeName(l.name) : null,
        phone: l.phone ? formatPhone(l.phone) : null, email: l.email || null,
        source: "import" as const, status: "pending" as const,
      }));
      for (let i = 0; i < batch.length; i += 500) {
        const chunk = batch.slice(i, i + 500);
        const { error } = await supabase.from("leads_raw").insert(chunk);
        if (error) throw error;
      }
      toast({ title: "Importação concluída!", description: `${batch.length} leads importados.` });
      setFileParsedLeads([]);
    } catch (error: any) {
      toast({ title: "Erro na importação", description: error.message, variant: "destructive" });
    } finally { setFileUploading(false); }
  };

  const instanceState = (state: string) => {
    if (state === "open") return <Badge className="bg-success/10 text-success border-success/30 text-[10px]" variant="outline"><Wifi className="h-3 w-3 mr-1" />Online</Badge>;
    if (state === "close" || state === "closed") return <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]" variant="outline"><WifiOff className="h-3 w-3 mr-1" />Offline</Badge>;
    return <Badge variant="outline" className="text-muted-foreground text-[10px]">Aguardando</Badge>;
  };

  const statusConfig: Record<string, { color: string; label: string }> = {
    running: { color: "bg-warning/15 text-warning", label: "Raspando..." },
    completed: { color: "bg-success/15 text-success", label: "Concluído" },
    failed: { color: "bg-destructive/15 text-destructive", label: "Falhou" },
  };

  const toggleResultSelection = (idx: number) => {
    setSelectedResults(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const selectAllResults = () => {
    if (!viewResults) return;
    if (selectedResults.size === viewResults.results.length) {
      setSelectedResults(new Set());
    } else {
      setSelectedResults(new Set(viewResults.results.map((_, i) => i)));
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Prospecção</h1>
        <p className="text-sm text-muted-foreground">Encontre leads por nicho, WhatsApp ou importação</p>
      </div>

      <Tabs defaultValue="web" className="space-y-5">
        <TabsList className="bg-secondary h-9 p-0.5 rounded-lg gap-0.5">
          {[
            { id: "web", label: "Por Nicho", icon: Globe },
            { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
            { id: "manual", label: "Manual", icon: Plus },
            { id: "file", label: "Arquivo", icon: Upload },
          ].map(tab => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5 text-xs rounded-md px-3 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <tab.icon className="h-3.5 w-3.5" />{tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ===== NICHE TAB ===== */}
        <TabsContent value="web" className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Gerador de Demanda</h3>
              <p className="text-xs text-muted-foreground">Busca real em sites com qualificação de leads por ICP</p>
            </div>
            <div className="flex items-center gap-2">
              {companyProfileLoaded && (
                companyProfile?.company_name ? (
                  <Badge variant="outline" className="text-[10px] gap-1 text-success border-success/40 bg-success/5">
                    <Brain className="h-3 w-3" /> ICP configurado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] gap-1 text-warning border-warning/40 bg-warning/5 cursor-pointer" onClick={() => navigate("/company")}>
                    <AlertCircle className="h-3 w-3" /> Configure seu ICP
                  </Badge>
                )
              )}
              <Button size="sm" className="gap-1.5 text-xs" onClick={() => { resetWizard(); setWizardOpen(true); }}>
                <Plus className="h-3.5 w-3.5" /> Nova Pesquisa
              </Button>
            </div>
          </div>

          {scrapeJobs.length === 0 ? (
            <div className="border border-dashed rounded-lg p-10 text-center">
              <Search className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium">Nenhuma pesquisa realizada</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Escolha um nicho para encontrar leads automaticamente</p>
              <Button size="sm" onClick={() => { resetWizard(); setWizardOpen(true); }} className="gap-1.5 text-xs">
                <Sparkles className="h-3.5 w-3.5" /> Iniciar Pesquisa
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {scrapeJobs.map(job => {
                const cfg = statusConfig[job.status];
                return (
                  <div key={job.id} className="border rounded-lg p-4 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-sm font-medium truncate">{job.niche}</p>
                          <Badge variant="secondary" className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                          {job.results_count > 0 && <Badge variant="outline" className="text-[10px] gap-1"><Users2 className="h-3 w-3" />{job.results_count} salvos</Badge>}
                          {job.avg_icp_score > 0 && (
                            <Badge variant="outline" className={`text-[10px] gap-1 ${icpScoreColor(job.avg_icp_score)}`}>
                              <Target className="h-3 w-3" /> ICP {job.avg_icp_score}/100
                            </Badge>
                          )}
                          {job.company_profile_used && (
                            <Badge variant="outline" className="text-[10px] gap-1 text-primary/70 border-primary/20">
                              <Brain className="h-3 w-3" /> Perfil usado
                            </Badge>
                          )}
                          {job.duplicates_skipped > 0 && <Badge variant="outline" className="text-[10px] text-muted-foreground">{job.duplicates_skipped} duplicados</Badge>}
                          {job.pages_searched > 0 && <Badge variant="outline" className="text-[10px] text-muted-foreground">{job.pages_searched} páginas</Badge>}
                        </div>
                        {job.prospecting_intent && (
                          <p className="text-[10px] text-muted-foreground italic truncate mt-0.5">"{job.prospecting_intent}"</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {job.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.city}</span>}
                          {job.keywords && <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{job.keywords}</span>}
                        </div>
                        {job.status === "running" && <ProspectingThinkingFeed isRunning={true} />}
                        {job.error_message && <p className="text-xs text-destructive mt-1">{job.error_message}</p>}
                      </div>
                      <div className="flex items-center gap-1.5">
                         {job.status === "completed" && (
                          <>
                             {job.results.length > 0 && (
                               <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => { setViewResults(job); setSelectedResults(new Set()); }}>
                                 <Eye className="h-3 w-3" /> Ver
                               </Button>
                             )}
                             <Button size="sm" className="text-xs gap-1" onClick={() => navigate("/leads")}>
                               <ArrowRight className="h-3 w-3" /> Ver em Leads
                             </Button>
                           </>
                         )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ===== WHATSAPP TAB ===== */}
        <TabsContent value="whatsapp" className="space-y-4">
          {/* === Group Search === */}
          <div className="border rounded-lg p-5 space-y-4">
            <div>
              <h3 className="text-sm font-medium flex items-center gap-2"><Compass className="h-4 w-4 text-primary" />Buscar Grupos Abertos</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Encontre links de grupos públicos do WhatsApp por nicho e região</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1 sm:col-span-1">
                <Label className="text-xs">Nicho / Interesse *</Label>
                <Input placeholder="Ex: fitness, vendas, mães, crypto..." value={groupSearchNiche}
                  onChange={e => setGroupSearchNiche(e.target.value)} className="text-sm"
                  onKeyDown={e => e.key === "Enter" && handleSearchGroups()} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Região (opcional)</Label>
                <Input placeholder="Ex: São Paulo, Curitiba..." value={groupSearchRegion}
                  onChange={e => setGroupSearchRegion(e.target.value)} className="text-sm"
                  onKeyDown={e => e.key === "Enter" && handleSearchGroups()} />
              </div>
              <div className="flex items-end">
                <Button onClick={handleSearchGroups} size="sm" disabled={groupSearchLoading || !groupSearchNiche.trim()} className="gap-1.5 text-xs w-full">
                  {groupSearchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  Buscar Grupos
                </Button>
              </div>
            </div>

            {foundGroups.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">{foundGroups.length} grupos encontrados</p>
                  <Button variant="ghost" size="sm" onClick={() => setFoundGroups([])} className="text-xs h-7"><X className="h-3 w-3 mr-1" />Limpar</Button>
                </div>
                <ScrollArea className="h-[260px] border rounded-md">
                  <div className="p-1.5 space-y-1">
                    {foundGroups.map((g, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 p-2.5 rounded-md border hover:bg-secondary/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{g.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{g.source}</p>
                        </div>
                        <a href={g.url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="text-xs gap-1 h-7 shrink-0">
                            <ExternalLink className="h-3 w-3" /> Entrar
                          </Button>
                        </a>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <p className="text-[10px] text-muted-foreground">💡 Após entrar nos grupos, volte aqui e extraia os contatos pela seção abaixo.</p>
              </div>
            )}
          </div>

          <div className="border rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium flex items-center gap-2"><Smartphone className="h-4 w-4 text-success" />Conectar WhatsApp</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Crie instâncias e extraia contatos</p>
              </div>
              {instances.length > 0 && (
                <Button variant="ghost" size="icon" onClick={fetchInstances} disabled={instancesLoading} className="h-8 w-8">
                  <RefreshCw className={`h-3.5 w-3.5 ${instancesLoading ? "animate-spin" : ""}`} />
                </Button>
              )}
            </div>

            {instances.length > 0 && (
              <div className="space-y-1.5">
                {instances.map((inst) => (
                  <div key={inst.name} className={`flex items-center justify-between p-2.5 rounded-md border transition-colors ${selectedInstance === inst.name ? "bg-primary/5 border-primary/30" : "hover:bg-secondary/50"}`}>
                    <div className="flex items-center gap-2.5 cursor-pointer flex-1" onClick={() => setSelectedInstance(inst.name)}>
                      {selectedInstance === inst.name && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                      <p className="text-sm">{inst.name}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {instanceState(inst.state)}
                      {inst.state !== "open" && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => getQRCode(inst.name)}><QrCode className="h-3.5 w-3.5" /></Button>}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteInstance(inst.name)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input placeholder="Nome da instância" value={newInstanceName} onChange={(e) => setNewInstanceName(e.target.value)}
                className="text-sm" onKeyDown={(e) => e.key === "Enter" && createInstance()} />
              <Button onClick={createInstance} disabled={creatingInstance || !newInstanceName.trim()} size="sm" className="shrink-0 gap-1.5 text-xs">
                {creatingInstance ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="h-3.5 w-3.5" />Criar</>}
              </Button>
            </div>
          </div>

          <div className="border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-medium">Extração de Contatos</h3>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { key: "group" as const, label: "Grupos", icon: Users2 },
                { key: "conversation" as const, label: "Conversas", icon: MessageSquare },
                { key: "contact" as const, label: "Contatos", icon: Contact },
              ].map((opt) => (
                <button key={opt.key} onClick={() => { setWhatsappMode(opt.key); if (opt.key === "group" && availableGroups.length === 0 && selectedInstance) handleFetchGroups(); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    whatsappMode === opt.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                  }`}>
                  <opt.icon className="h-3 w-3" />{opt.label}
                </button>
              ))}
            </div>

            {whatsappMode === "group" && (
              <div className="space-y-3">
                {/* Search filter */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar grupos por nome (ex: vendas, mães, fitness...)"
                    value={groupSearchFilter}
                    onChange={(e) => setGroupSearchFilter(e.target.value)}
                    className="text-xs pl-8 h-8"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {availableGroups.length > 0
                      ? `${availableGroups.filter(g => !groupSearchFilter || g.name.toLowerCase().includes(groupSearchFilter.toLowerCase())).length} de ${availableGroups.length} grupos`
                      : "Selecione os grupos"}
                  </p>
                  <div className="flex gap-1.5">
                    {availableGroups.length > 0 && <Button variant="ghost" size="sm" onClick={selectAllGroups} className="text-xs h-7">{selectedGroupIds.size === availableGroups.length ? "Desmarcar" : "Todos"}</Button>}
                    <Button variant="outline" size="sm" onClick={handleFetchGroups} disabled={groupsLoading || !selectedInstance} className="text-xs h-7 gap-1">
                      <RefreshCw className={`h-3 w-3 ${groupsLoading ? "animate-spin" : ""}`} />{availableGroups.length === 0 ? "Carregar" : "Atualizar"}
                    </Button>
                  </div>
                </div>
                {groupsLoading ? (
                  <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /><span className="text-xs">Buscando...</span></div>
                ) : availableGroups.length > 0 ? (
                  <ScrollArea className="h-[200px] border rounded-md">
                    <div className="p-1.5 space-y-0.5">
                      {availableGroups
                        .filter(g => !groupSearchFilter || g.name.toLowerCase().includes(groupSearchFilter.toLowerCase()))
                        .map((group) => (
                        <div key={group.id} onClick={() => toggleGroupSelection(group.id)}
                          className={`flex items-center gap-2.5 p-2 rounded-md cursor-pointer transition-colors ${selectedGroupIds.has(group.id) ? "bg-primary/10" : "hover:bg-secondary"}`}>
                          <Checkbox checked={selectedGroupIds.has(group.id)} className="pointer-events-none" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{group.name}</p>
                            <p className="text-[10px] text-muted-foreground">{group.size} membros</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : !selectedInstance ? (
                  <p className="text-xs text-warning py-3 text-center">Selecione uma instância primeiro</p>
                ) : null}

                {/* Tags de segmentação */}
                {selectedGroupIds.size > 0 && (
                  <div className="border rounded-md p-3 space-y-2 bg-secondary/30">
                    <Label className="text-xs font-medium flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" /> Tags de segmentação
                    </Label>
                    <p className="text-[10px] text-muted-foreground">Adicione tags para categorizar os leads extraídos (ex: região, interesse, perfil)</p>
                    <div className="flex gap-1.5">
                      <Input
                        placeholder="Ex: São Paulo, Fitness, Mães..."
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        className="text-xs h-7"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newTag.trim()) {
                            e.preventDefault();
                            if (!extractTags.includes(newTag.trim())) {
                              setExtractTags(prev => [...prev, newTag.trim()]);
                            }
                            setNewTag("");
                          }
                        }}
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" disabled={!newTag.trim()}
                        onClick={() => {
                          if (newTag.trim() && !extractTags.includes(newTag.trim())) {
                            setExtractTags(prev => [...prev, newTag.trim()]);
                          }
                          setNewTag("");
                        }}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {extractTags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {extractTags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-[10px] gap-1 pr-1">
                            {tag}
                            <button onClick={() => setExtractTags(prev => prev.filter(t => t !== tag))} className="hover:text-destructive">
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <Button onClick={handleWhatsappExtract} size="sm" className="gap-1.5 text-xs"
              disabled={evolutionLoading || !selectedInstance || (whatsappMode === "group" && selectedGroupIds.size === 0)}>
              {evolutionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
              {whatsappMode === "group" ? `Extrair de ${selectedGroupIds.size} grupo(s)` : whatsappMode === "conversation" ? "Extrair Conversas" : "Importar Contatos"}
            </Button>
          </div>
        </TabsContent>

        {/* ===== MANUAL TAB ===== */}
        <TabsContent value="manual">
          <div className="border rounded-lg p-5 space-y-4 max-w-lg">
            <h3 className="text-sm font-medium">Adicionar Lead Manualmente</h3>
            <form onSubmit={handleManualAdd} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome</Label>
                  <Input placeholder="João Silva" value={manualName} onChange={(e) => setManualName(e.target.value)} required className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Telefone</Label>
                  <Input placeholder="(11) 99999-9999" value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} required className="text-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email (opcional)</Label>
                <Input type="email" placeholder="joao@empresa.com" value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} className="text-sm" />
              </div>
              <Button type="submit" size="sm" disabled={manualLoading} className="gap-1.5 text-xs">
                {manualLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}Adicionar Lead
              </Button>
            </form>
          </div>
        </TabsContent>

        {/* ===== FILE TAB ===== */}
        <TabsContent value="file">
          <div className="border rounded-lg p-5 space-y-4 max-w-lg">
            <h3 className="text-sm font-medium">Importar de Arquivo</h3>
            <p className="text-xs text-muted-foreground">CSV com colunas: nome, telefone, email</p>
            <label htmlFor="file-upload" className="flex flex-col items-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-primary/50 transition-colors">
              <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
              <p className="text-xs font-medium">Clique para selecionar</p>
              <p className="text-[10px] text-muted-foreground">.csv, .txt</p>
              <input id="file-upload" type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
            </label>
            {fileError && <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-md p-2"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{fileError}</div>}
            {fileParsedLeads.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">{fileParsedLeads.length} leads encontrados</p>
                  <Button variant="ghost" size="sm" onClick={() => setFileParsedLeads([])} className="text-xs h-6"><X className="h-3 w-3 mr-1" />Limpar</Button>
                </div>
                <ScrollArea className="h-[180px] border rounded-md">
                  <div className="divide-y">
                    {fileParsedLeads.slice(0, 50).map((l, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                        <span className="text-muted-foreground w-5">{i + 1}</span>
                        <span className="flex-1 truncate font-medium">{l.name || "—"}</span>
                        <span className="text-muted-foreground">{l.phone || "—"}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <Button onClick={handleFileImport} size="sm" disabled={fileUploading} className="gap-1.5 text-xs">
                  {fileUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}Importar {fileParsedLeads.length} Leads
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== WIZARD DIALOG ===== */}
      <Dialog open={wizardOpen} onOpenChange={v => { if (!scrapingLoading) setWizardOpen(v); }}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Nova Pesquisa de Demanda
            </DialogTitle>
          <DialogDescription className="text-xs">
              A IA analisa seu perfil de empresa e qualifica cada lead pelo fit com seu ICP
          </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* ICP banner */}
            {companyProfileLoaded && (
              companyProfile?.company_name ? (
                <div className="flex items-start gap-2.5 p-3 rounded-lg border border-success/30 bg-success/5">
                  <Brain className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-success">ICP configurado — {companyProfile.company_name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      A IA vai qualificar cada lead com base no perfil da sua empresa
                      {companyProfile.b2b_target_audience || companyProfile.target_audience
                        ? ` (Público-alvo: ${(companyProfile.b2b_target_audience || companyProfile.target_audience).slice(0, 60)}...)`
                        : ""}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 p-3 rounded-lg border border-warning/30 bg-warning/5 cursor-pointer" onClick={() => { setWizardOpen(false); navigate("/company"); }}>
                  <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-warning">Configure o perfil da sua empresa para resultados melhores</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Clique para configurar → a IA usará seu ICP para qualificar leads automaticamente</p>
                  </div>
                </div>
              )
            )}

            {/* Prospecting Intent */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-primary" />
                Intenção de prospecção
                <span className="text-[10px] text-muted-foreground font-normal ml-1">(opcional mas recomendado)</span>
              </Label>
              <Textarea
                value={prospectingIntent}
                onChange={e => setProspectingIntent(e.target.value)}
                placeholder="Descreva o que você está buscando. Ex: 'Quero donos de restaurante que ainda não usam sistema de delivery' ou 'Preciso de empresas de médio porte com mais de 20 funcionários'"
                className="text-sm min-h-[70px] resize-none"
                maxLength={300}
              />
              <p className="text-[10px] text-muted-foreground">{prospectingIntent.length}/300 — Quanto mais específico, mais assertivos os leads</p>
            </div>

            {/* Segment */}
            <div>
              <Label className="text-sm font-medium">Segmento *</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {PRESET_SEGMENTS.map(n => (
                  <button key={n.value} onClick={() => { setSelectedNiche(n.value); setCustomNiche(""); }}
                    className={`text-left p-3 rounded-lg border transition-all text-xs ${
                      selectedNiche === n.value ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/30 hover:bg-secondary/50"
                    }`}>
                    <span className="text-base">{n.icon}</span>
                    <p className="font-medium mt-1.5">{n.label}</p>
                  </button>
                ))}
              </div>
              <Input value={customNiche} onChange={e => { setCustomNiche(e.target.value); setSelectedNiche(""); }}
                placeholder="Ou digite um segmento personalizado..." className="mt-2 text-sm" />
            </div>

            {/* Location */}
            <div className="border-t pt-4 space-y-3">
              <Label className="text-sm font-medium flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />Localização *</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Estado *</Label>
                  <Select value={selectedState} onValueChange={setSelectedState}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>
                      {STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Cidade *</Label>
                  <Input value={selectedCity} onChange={e => setSelectedCity(e.target.value)}
                    placeholder="Ex: Taubaté" className="text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Bairro (opcional)</Label>
                  <Input value={selectedBairro} onChange={e => setSelectedBairro(e.target.value)}
                    placeholder="Ex: Centro" className="text-sm" />
                </div>
              </div>
            </div>

            {/* Count */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />Nº de empresas</Label>
                <Badge variant="outline" className="text-sm font-semibold">{leadCount}</Badge>
              </div>
              <Slider value={[leadCount]} onValueChange={v => setLeadCount(v[0])} min={5} max={50} step={5} className="w-full" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>5</span><span>25</span><span>50</span>
              </div>
            </div>

            {/* Summary */}
            {activeNiche && selectedCity && selectedState && (
              <div className="border rounded-lg p-3 bg-secondary/30 space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Resumo da busca</p>
                <p className="text-sm"><span className="font-medium">{activeNiche}</span> em <span className="font-medium">{activeLocation}</span> — até <span className="font-medium">{leadCount}</span> empresas</p>
                {prospectingIntent && <p className="text-xs text-primary/80 italic">"{prospectingIntent.slice(0, 100)}{prospectingIntent.length > 100 ? "..." : ""}"</p>}
                <p className="text-xs text-muted-foreground">
                  {companyProfile?.company_name
                    ? "A IA vai buscar, extrair e qualificar cada lead com score de aderência ao seu ICP."
                    : "A IA vai buscar empresas reais e extrair contatos com telefone, email e dados comerciais."}
                </p>
              </div>
            )}

          </div>

          <DialogFooter>
            <Button onClick={handleScrape} size="sm" 
              disabled={scrapingLoading || !activeNiche || !selectedCity || !selectedState} 
              className="gap-1.5 text-xs w-full">
              {scrapingLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Iniciar Pesquisa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== RESULTS DIALOG ===== */}
      <Dialog open={!!viewResults} onOpenChange={() => setViewResults(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              Resultados — {viewResults?.niche}
              {viewResults?.city && <Badge variant="outline" className="text-[10px] gap-1"><MapPin className="h-3 w-3" />{viewResults.city}</Badge>}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {viewResults?.results_count || 0} salvos · {viewResults?.total_found || 0} encontrados · {viewResults?.duplicates_skipped || 0} duplicados · {viewResults?.pages_searched || 0} páginas
              {viewResults?.avg_icp_score ? ` · ICP médio: ${viewResults.avg_icp_score}/100` : ""}
            </DialogDescription>
          </DialogHeader>

          {viewResults?.results?.length ? (
            <>
               <div className="flex items-center justify-between">
                 <p className="text-xs text-muted-foreground">{viewResults.results.length} leads encontrados e salvos na base</p>
                 <Button size="sm" className="text-xs gap-1" onClick={() => { setViewResults(null); navigate("/leads"); }}>
                   <ArrowRight className="h-3 w-3" /> Ver em Leads
                 </Button>
               </div>

               {viewResults.avg_icp_score > 0 && (
                 <div className="flex items-center gap-2 p-2.5 rounded-md bg-secondary/40 border text-xs">
                   <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0" />
                   <span>Score ICP médio: <span className={`font-semibold ${icpScoreColor(viewResults.avg_icp_score).split(" ")[0]}`}>{viewResults.avg_icp_score}/100</span></span>
                   <span className="text-muted-foreground">— Leads ordenados por fit com seu ICP</span>
                 </div>
               )}
               <ScrollArea className="h-[380px]">
                <div className="space-y-1.5">
                   {viewResults.results.map((r, i) => (
                     <div key={i} className={`border rounded-md p-3 hover:bg-secondary/30 transition-colors ${r.icp_score >= 80 ? "border-success/30" : r.icp_score >= 60 ? "border-primary/20" : ""}`}>
                       <div className="flex items-start gap-2.5">
                         <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-2 flex-wrap mb-1">
                             <p className="text-sm font-medium flex items-center gap-1.5">
                               <User className="h-3 w-3 text-primary shrink-0" />
                               {r.name || `Lead ${i + 1}`}
                             </p>
                             {typeof r.icp_score === "number" && (
                               <Badge variant="outline" className={`text-[10px] gap-1 ${icpScoreColor(r.icp_score)}`}>
                                 <Target className="h-2.5 w-2.5" /> {icpScoreLabel(r.icp_score)} ({r.icp_score})
                               </Badge>
                             )}
                           </div>
                           <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                             {r.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</span>}
                             {r.email && <span>✉ {r.email}</span>}
                             {r.company && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{r.company}</span>}
                             {r.role && <span className="text-primary/80">{r.role}</span>}
                             {r.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{r.city}</span>}
                             {r.website && <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{r.website}</span>}
                             {r.segment && <Badge variant="secondary" className="text-[10px]">{r.segment}</Badge>}
                           </div>
                           {r.icp_reason && (
                             <p className="text-[10px] text-muted-foreground italic mt-1">{r.icp_reason}</p>
                           )}
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               </ScrollArea>
            </>
          ) : <p className="text-xs text-muted-foreground text-center py-4">Leads salvos na base. Confira em "Meus Leads".</p>}
        </DialogContent>
      </Dialog>

      {/* QR Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2"><QrCode className="h-4 w-4 text-primary" />Conectar WhatsApp</DialogTitle>
            <DialogDescription className="text-xs">Escaneie com o WhatsApp — <span className="text-primary font-medium">{qrInstanceName}</span></DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-4 space-y-3">
            {connectionStatus === "connected" ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <CheckCircle2 className="h-10 w-10 text-success" />
                <p className="text-sm font-medium text-success">Conectado!</p>
              </div>
            ) : qrLoading ? (
              <div className="py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : qrCode ? (
              <>
                <div className="bg-white p-3 rounded-lg"><img src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code" className="w-56 h-56" /></div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><div className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />Aguardando leitura...</div>
                <Button variant="outline" size="sm" onClick={() => getQRCode(qrInstanceName)} className="text-xs gap-1"><RefreshCw className="h-3 w-3" />Atualizar QR</Button>
              </>
            ) : <p className="text-xs text-muted-foreground py-6">Não foi possível gerar o QR Code.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
