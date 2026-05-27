import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activityLogger";
import * as XLSX from "xlsx";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users, Search, Sparkles, Trash2, Loader2, Download,
  Upload, Plus, Eye, MoreVertical, Target, Phone, Mail,
  X, User, Zap, Shield, AlertTriangle, CheckCircle2,
  RefreshCw, ArrowUpDown, ChevronLeft, ChevronRight,
  Building2, MapPin, Globe, ExternalLink, TrendingUp,
  Tag, Calendar, Hash, FileWarning, Merge, Copy
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

type Lead = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string;
  status: string;
  tags: string[] | null;
  created_at: string;
  enrichment_data: any;
};

const statusConfig: Record<string, { label: string; color: string; dotColor: string }> = {
  pending: { label: "Prospectado", color: "bg-chart-4/10 text-chart-4 border-chart-4/30", dotColor: "bg-chart-4" },
  enriched: { label: "Enriquecido", color: "bg-primary/10 text-primary border-primary/30", dotColor: "bg-primary" },
  converted: { label: "Em Comercial", color: "bg-success/10 text-success border-success/30", dotColor: "bg-success" },
  discarded: { label: "Descartado", color: "bg-destructive/10 text-destructive border-destructive/30", dotColor: "bg-destructive" },
};

const sourceLabels: Record<string, string> = {
  web: "Web", whatsapp: "WhatsApp", manual: "Manual", import: "Importação",
};

const sourceIcons: Record<string, typeof Globe> = {
  web: Globe, whatsapp: Phone, manual: User, import: Upload,
};

export default function Leads() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState("all");
  const [enriching, setEnriching] = useState(false);
  const [converting, setConverting] = useState(false);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState({ pending: 0, enriched: 0, converted: 0, discarded: 0 });
  const PAGE_SIZE = 50;

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setCurrentPage(0);
    }, 400);
  };

  const [addOpen, setAddOpen] = useState(false);
  const [newLead, setNewLead] = useState({ name: "", phone: "", email: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityResults, setSecurityResults] = useState<{
    duplicatePhones: { phone: string; leads: Lead[] }[];
    duplicateNames: { name: string; leads: Lead[] }[];
    noPhone: Lead[];
    noName: Lead[];
  } | null>(null);

  // Fetch real status counts
  const fetchStatusCounts = async () => {
    if (!profile?.org_id) return;
    const counts = { pending: 0, enriched: 0, converted: 0, discarded: 0 };
    const { count: p } = await supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", profile.org_id).eq("status", "pending");
    const { count: e } = await supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", profile.org_id).eq("status", "enriched");
    const { count: c } = await supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", profile.org_id).eq("status", "converted");
    const { count: d } = await supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", profile.org_id).eq("status", "discarded");
    counts.pending = p || 0;
    counts.enriched = e || 0;
    counts.converted = c || 0;
    counts.discarded = d || 0;
    setStatusCounts(counts);
  };

  const fetchLeads = async () => {
    if (!profile?.org_id) return;
    setLoading(true);

    let query = supabase
      .from("leads_raw")
      .select("id, name, phone, email, source, status, tags, created_at, enrichment_data", { count: "exact" })
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: false })
      .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

    if (debouncedSearch) {
      query = query.or(`name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`);
    }
    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter as any);
    }
    if (sourceFilter !== "all") {
      query = query.eq("source", sourceFilter as any);
    }
    if (quickFilter !== "all") {
      query = query.eq("status", quickFilter as any);
    }

    const { data, count } = await query;
    setLeads(data || []);
    setTotalCount(count || 0);
    setLoading(false);
  };

  useEffect(() => { fetchLeads(); }, [profile?.org_id, currentPage, debouncedSearch, statusFilter, sourceFilter, quickFilter]);
  useEffect(() => { fetchStatusCounts(); }, [profile?.org_id]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const allStatusTotal = statusCounts.pending + statusCounts.enriched + statusCounts.converted + statusCounts.discarded;
  const enrichmentRate = allStatusTotal > 0 ? Math.round((statusCounts.enriched / allStatusTotal) * 100) : 0;
  const conversionRate = allStatusTotal > 0 ? Math.round((statusCounts.converted / allStatusTotal) * 100) : 0;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === leads.length) setSelected(new Set());
    else setSelected(new Set(leads.map((l) => l.id)));
  };

  const handleEnrich = async () => {
    if (selected.size === 0) return;
    // Filter out already enriched leads
    const eligibleIds = Array.from(selected).filter(id => {
      const lead = leads.find(l => l.id === id);
      return lead && lead.status !== "enriched" && lead.status !== "converted";
    });
    if (eligibleIds.length === 0) {
      toast({ title: "Nenhum lead elegível", description: "Os leads selecionados já foram enriquecidos.", variant: "destructive" });
      return;
    }
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke("enrich-lead", {
        body: { lead_ids: eligibleIds, org_id: profile?.org_id },
      });
      if (error) throw error;
      const skippedMsg = data?.skipped > 0 ? ` (${data.skipped} já enriquecidos, ignorados)` : "";
      toast({ title: "Enriquecimento concluído!", description: `${data?.enriched || 0} leads enriquecidos.${skippedMsg}` });
      logActivity({ action: "leads_enriquecidos", description: `${data?.enriched || 0} leads enriquecidos com sucesso` });
      setSelected(new Set());
      fetchLeads();
      fetchStatusCounts();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally { setEnriching(false); }
  };

  const isLeadEnriched = (lead: Lead) => lead.status === "enriched" || lead.status === "converted";

  const handleEnrichSingle = async (lead: Lead) => {
    if (isLeadEnriched(lead)) {
      toast({ title: "Lead já enriquecido", description: "Este lead já foi enriquecido anteriormente.", variant: "destructive" });
      return;
    }
    setEnrichingId(lead.id);
    try {
      const { data, error } = await supabase.functions.invoke("enrich-lead", {
        body: { lead_ids: [lead.id], org_id: profile?.org_id },
      });
      if (error) throw error;
      toast({ title: "Lead enriquecido!" });
      fetchLeads();
      fetchStatusCounts();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally { setEnrichingId(null); }
  };

  const handleActivateCommercial = async () => {
    if (!profile?.org_id || selected.size === 0) return;
    setConverting(true);
    try {
      const { data: stages } = await supabase
        .from("crm_stages").select("id").eq("org_id", profile.org_id).order("stage_order").limit(1);
      if (!stages?.length) throw new Error("Crie estágios no CRM primeiro.");

      const selectedLeads = leads.filter(l => selected.has(l.id) && l.status !== "converted" && l.status !== "discarded");
      if (selectedLeads.length === 0) {
        toast({ title: "Nenhum lead disponível", description: "Os leads selecionados já estão em comercial ou descartados.", variant: "destructive" });
        return;
      }

      const opportunities = selectedLeads.map((lead) => ({
        org_id: profile.org_id!, lead_id: lead.id, stage_id: stages[0].id,
      }));

      const { error: oppError } = await supabase.from("opportunities").insert(opportunities);
      if (oppError) throw oppError;

      await supabase.from("leads_raw").update({ status: "converted" as const }).in("id", selectedLeads.map(l => l.id));

      toast({ title: "Comercial ativado! 🚀", description: `${selectedLeads.length} leads entraram no pipeline.` });
      logActivity({ action: "leads_comercial_ativado", description: `${selectedLeads.length} leads com comercial ativado` });
      setSelected(new Set());
      fetchLeads();
      fetchStatusCounts();

      supabase.functions.invoke("crm-pipeline-automation").then(({ error }) => {
        if (error) console.error("Pipeline automation error:", error);
        else toast({ title: "Automação concluída ✅", description: "Leads estão sendo enriquecidos e contatados." });
      });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally { setConverting(false); }
  };

  const handleDiscard = async () => {
    if (selected.size === 0) return;
    await supabase.from("leads_raw").update({ status: "discarded" as const }).in("id", Array.from(selected));
    toast({ title: "Leads descartados." });
    setSelected(new Set());
    fetchLeads();
    fetchStatusCounts();
  };

  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    const ids = Array.from(selected);
    const BATCH_SIZE = 500;
    let deletedCount = 0;
    try {
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from("leads_raw").delete().in("id", batch);
        if (!error) deletedCount += batch.length;
      }
      toast({ title: `${deletedCount} leads excluídos.` });
      setSelected(new Set());
      fetchLeads();
      fetchStatusCounts();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally { setDeleting(false); }
  };

  // --- File Import Logic (preserved) ---
  const normalizeHeader = (h: string) =>
    h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\s]+/g, " ").trim().replace(/^"|"$/g, "");

  const findCol = (headers: string[], possibleNames: string[]): number => {
    const normalized = possibleNames.map(normalizeHeader);
    for (const n of normalized) { const i = headers.indexOf(n); if (i !== -1) return i; }
    for (const n of normalized) { const i = headers.findIndex(h => h.startsWith(n)); if (i !== -1) return i; }
    for (const n of normalized) { const i = headers.findIndex(h => h.includes(n)); if (i !== -1) return i; }
    return -1;
  };

  const parseRowsFromHeaders = (headers: string[], dataRows: Record<string, any>[]) => {
    const nameIdx = findCol(headers, ["nome", "name", "nome completo", "full name", "contato", "contact", "cliente", "razao social", "empresa"]);
    const emailIdx = findCol(headers, ["email", "e-mail", "correio"]);
    const phoneNames = ["celular", "whatsapp", "telefone", "phone", "tel", "fone", "numero"];
    const phoneIdxList = phoneNames.map(n => findCol(headers, [n])).filter(i => i !== -1);
    const uniquePhoneIdxs = [...new Set(phoneIdxList)];

    const formatPhone = (phone: string) => {
      const digits = phone.replace(/\D/g, "");
      if (!digits) return "";
      if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
      if (digits.length === 11 || digits.length === 10) return `+55${digits}`;
      return phone;
    };

    const capitalizeName = (name: string) =>
      name.replace(/\b\w/g, c => c.toUpperCase()).trim();

    return dataRows.map(row => {
      const values = headers.map(h => {
        const val = row[h];
        return val != null ? String(val).trim() : "";
      });
      const obj: any = { org_id: profile!.org_id, source: "import" as const, status: "pending" as const };
      if (nameIdx !== -1 && values[nameIdx]) obj.name = capitalizeName(values[nameIdx]);
      for (const pi of uniquePhoneIdxs) {
        if (values[pi]) { obj.phone = formatPhone(values[pi]); break; }
      }
      if (emailIdx !== -1 && values[emailIdx]) obj.email = values[emailIdx];
      return obj;
    }).filter(r => r.name || r.phone || r.email);
  };

  const importLeads = async (rows: any[], fileType: string, inputEl?: HTMLInputElement) => {
    if (rows.length === 0) {
      toast({ title: "Arquivo vazio ou inválido", description: "Verifique se o arquivo possui colunas como 'Nome', 'Telefone', 'Celular' ou 'Email'.", variant: "destructive" });
      return;
    }
    const BATCH_SIZE = 500;
    let totalInserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase.from("leads_raw").insert(batch).select("id");
      if (error) {
        toast({ title: "Erro ao importar", description: error.message, variant: "destructive" });
        return;
      }
      totalInserted += data?.length || 0;
    }
    if (totalInserted === 0) {
      toast({ title: "Nenhum lead foi inserido", variant: "destructive" });
      return;
    }
    toast({ title: `${totalInserted} leads importados!` });
    logActivity({ action: "leads_importados", description: `${totalInserted} leads importados via ${fileType}` });
    if (inputEl) inputEl.value = "";
    fetchLeads();
    fetchStatusCounts();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.org_id) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "xlsx" || ext === "xls") {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
      if (jsonData.length === 0) { toast({ title: "Planilha vazia", variant: "destructive" }); return; }
      const headers = Object.keys(jsonData[0]).map(normalizeHeader);
      const dataRows = jsonData.map(row => {
        const mapped: Record<string, any> = {};
        Object.entries(row).forEach(([k, v]) => { mapped[normalizeHeader(k)] = v; });
        return mapped;
      });
      const rows = parseRowsFromHeaders(headers, dataRows);
      await importLeads(rows, "XLSX", e.target);
    } else {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return;
      const firstLine = lines[0];
      const separator = firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ",";
      const headers = firstLine.split(separator).map(normalizeHeader);
      const dataRows = lines.slice(1).map(line => {
        const values = line.split(separator).map(v => v.trim().replace(/^"|"$/g, ""));
        const mapped: Record<string, any> = {};
        headers.forEach((h, i) => { mapped[h] = values[i] || ""; });
        return mapped;
      });
      const rows = parseRowsFromHeaders(headers, dataRows);
      await importLeads(rows, "CSV", e.target);
    }
  };

  const handleAddLead = async () => {
    if (!profile?.org_id || !newLead.name.trim()) return;
    setAddLoading(true);
    try {
      const formatPhone = (phone: string) => {
        const digits = phone.replace(/\D/g, "");
        if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
        if (digits.length === 11 || digits.length === 10) return `+55${digits}`;
        return phone;
      };
      const { error } = await supabase.from("leads_raw").insert({
        org_id: profile.org_id,
        name: newLead.name.replace(/\b\w/g, c => c.toUpperCase()).trim(),
        phone: newLead.phone ? formatPhone(newLead.phone) : null,
        email: newLead.email || null,
        source: "manual" as const, status: "pending" as const,
      });
      if (error) throw error;
      toast({ title: "Lead adicionado!" });
      logActivity({ action: "lead_adicionado", description: `Lead "${newLead.name}" adicionado manualmente` });
      setNewLead({ name: "", phone: "", email: "" });
      setAddOpen(false);
      fetchLeads();
      fetchStatusCounts();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally { setAddLoading(false); }
  };

  const handleDeleteAll = async () => {
    if (!profile?.org_id) return;
    setDeletingAll(true);
    try {
      const { error } = await supabase.from("leads_raw").delete().eq("org_id", profile.org_id);
      if (error) throw error;
      toast({ title: "Todos os leads foram apagados!" });
      logActivity({ action: "leads_apagados_todos", description: "Todos os leads da organização foram apagados" });
      setSelected(new Set());
      fetchLeads();
      fetchStatusCounts();
    } catch (error: any) {
      toast({ title: "Erro ao apagar", description: error.message, variant: "destructive" });
    } finally {
      setDeletingAll(false);
      setDeleteAllOpen(false);
    }
  };

  const handleSecurityScan = async () => {
    if (!profile?.org_id) return;
    setSecurityLoading(true);
    setSecurityResults(null);
    try {
      const { data: allLeads } = await supabase
        .from("leads_raw")
        .select("id, name, phone, email, source, status, tags, created_at, enrichment_data")
        .eq("org_id", profile.org_id)
        .order("created_at", { ascending: false })
        .limit(5000);

      const leads = (allLeads || []) as Lead[];

      const phoneMap = new Map<string, Lead[]>();
      leads.forEach(l => {
        if (!l.phone) return;
        const existing = phoneMap.get(l.phone) || [];
        existing.push(l);
        phoneMap.set(l.phone, existing);
      });
      const duplicatePhones = Array.from(phoneMap.entries())
        .filter(([_, group]) => {
          const names = new Set(group.map(l => l.name?.toLowerCase()).filter(Boolean));
          return names.size > 1;
        })
        .map(([phone, leads]) => ({ phone, leads }));

      const nameMap = new Map<string, Lead[]>();
      leads.forEach(l => {
        if (!l.name) return;
        const key = l.name.toLowerCase().trim();
        const existing = nameMap.get(key) || [];
        existing.push(l);
        nameMap.set(key, existing);
      });
      const duplicateNames = Array.from(nameMap.entries())
        .filter(([_, group]) => {
          const phones = new Set(group.map(l => l.phone).filter(Boolean));
          return phones.size > 1;
        })
        .map(([name, leads]) => ({ name, leads }));

      const noPhone = leads.filter(l => !l.phone);
      const noName = leads.filter(l => !l.name);

      setSecurityResults({ duplicatePhones, duplicateNames, noPhone, noName });
    } catch (error: any) {
      toast({ title: "Erro na verificação", description: error.message, variant: "destructive" });
    } finally { setSecurityLoading(false); }
  };

  const handleMergeLeads = async (keepId: string, deleteIds: string[]) => {
    try {
      const { error } = await supabase.from("leads_raw").delete().in("id", deleteIds);
      if (error) throw error;
      toast({ title: `${deleteIds.length} duplicata(s) removida(s)` });
      handleSecurityScan();
      fetchLeads();
      fetchStatusCounts();
    } catch (error: any) {
      toast({ title: "Erro ao mesclar", description: error.message, variant: "destructive" });
    }
  };

  const exportCSV = () => {
    const rows = [["Nome", "Telefone", "Email", "Fonte", "Status", "Tags", "Criado em"]];
    leads.forEach((l) => rows.push([
      l.name || "", l.phone || "", l.email || "",
      sourceLabels[l.source] || l.source,
      statusConfig[l.status]?.label || l.status,
      l.tags?.join(", ") || "",
      format(new Date(l.created_at), "dd/MM/yyyy HH:mm"),
    ]));
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exportado!" });
  };

  const getLeadInitials = (lead: Lead) => {
    if (!lead.name) return "?";
    return lead.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  };

  const getEnrichmentSummary = (lead: Lead) => {
    if (!lead.enrichment_data || Object.keys(lead.enrichment_data).length <= 1) return null;
    const ed = lead.enrichment_data;
    const rawScore = ed.score_conversao ?? ed.score ?? null;
    const score = rawScore !== null ? (rawScore > 10 ? Math.round(rawScore / 10) : rawScore) : null;
    return {
      company: ed.empresa || ed.company || null,
      segment: ed.segmento || ed.segment || null,
      score,
      location: ed.localizacao || ed.location || null,
    };
  };

  const formatLocation = (loc: any) => {
    if (!loc) return null;
    if (typeof loc === "string") return loc;
    if (typeof loc === "object") return [loc.cidade, loc.estado, loc.regiao].filter(Boolean).join(", ") || JSON.stringify(loc);
    return String(loc);
  };

  const securityIssueCount = securityResults
    ? securityResults.duplicatePhones.length + securityResults.duplicateNames.length + securityResults.noPhone.length + securityResults.noName.length
    : 0;

  return (
    <TooltipProvider>
      <div className="space-y-5 w-full max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {allStatusTotal > 0 ? `${allStatusTotal.toLocaleString()} leads na base` : "Gerencie sua base de contatos"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="cursor-pointer">
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" asChild>
                <span><Upload className="h-3.5 w-3.5" /> Importar</span>
              </Button>
            </label>
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5" /> Exportar
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => { setSecurityOpen(true); handleSecurityScan(); }}>
              <Shield className="h-3.5 w-3.5" /> Integridade
              {securityResults && securityIssueCount > 0 && (
                <span className="ml-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center font-bold">
                  {securityIssueCount}
                </span>
              )}
            </Button>
            <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Novo Lead
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: "Total", value: allStatusTotal, sub: null, icon: Users, color: "text-foreground", progress: null },
            { label: "Prospectados", value: statusCounts.pending, sub: `${allStatusTotal > 0 ? Math.round((statusCounts.pending / allStatusTotal) * 100) : 0}%`, icon: Target, color: "text-chart-4", progress: null },
            { label: "Enriquecidos", value: statusCounts.enriched, sub: `${enrichmentRate}% da base`, icon: Sparkles, color: "text-primary", progress: enrichmentRate },
            { label: "Em Comercial", value: statusCounts.converted, sub: `${conversionRate}% conversão`, icon: Zap, color: "text-success", progress: conversionRate },
            { label: "Descartados", value: statusCounts.discarded, sub: null, icon: X, color: "text-muted-foreground", progress: null },
          ].map(m => (
            <div key={m.label} className="rounded-xl border border-border/40 bg-card p-4 hover:border-border/80 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <m.icon className={`h-4 w-4 ${m.color}`} />
                {m.progress !== null && m.progress > 0 && (
                  <span className={`text-[10px] font-medium ${m.color}`}>{m.progress}%</span>
                )}
              </div>
              <p className="text-2xl font-bold tracking-tight">{m.value.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{m.sub || m.label}</p>
              {m.progress !== null && (
                <Progress value={m.progress} className="h-1 mt-2" />
              )}
            </div>
          ))}
        </div>

        {/* Tabs + Search + Filters */}
        <div className="space-y-3">
          <Tabs value={quickFilter} onValueChange={(v) => { setQuickFilter(v); setCurrentPage(0); }}>
            <TabsList className="h-9 bg-secondary/30">
              <TabsTrigger value="all" className="text-xs data-[state=active]:bg-background">
                Todos <span className="ml-1 text-muted-foreground">({allStatusTotal})</span>
              </TabsTrigger>
              <TabsTrigger value="pending" className="text-xs data-[state=active]:bg-background">
                Prospectados <span className="ml-1 text-muted-foreground">({statusCounts.pending})</span>
              </TabsTrigger>
              <TabsTrigger value="enriched" className="text-xs data-[state=active]:bg-background">
                Enriquecidos <span className="ml-1 text-muted-foreground">({statusCounts.enriched})</span>
              </TabsTrigger>
              <TabsTrigger value="converted" className="text-xs data-[state=active]:bg-background">
                Em Comercial <span className="ml-1 text-muted-foreground">({statusCounts.converted})</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone ou email..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 h-9 text-sm bg-secondary/20 border-border/30"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setDebouncedSearch(""); setCurrentPage(0); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setCurrentPage(0); }}>
              <SelectTrigger className="w-[140px] h-9 text-xs bg-secondary/20 border-border/30">
                <SelectValue placeholder="Fonte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as fontes</SelectItem>
                <SelectItem value="web">Web</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="import">Importação</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selected.size > 0 && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center gap-2 flex-wrap animate-fade-in">
            <span className="text-xs font-semibold text-primary px-2.5 py-1 rounded-lg bg-primary/10">
              {selected.size} selecionado{selected.size > 1 ? "s" : ""}
            </span>
            <div className="h-4 w-px bg-border/50" />
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={handleEnrich} disabled={enriching}>
              {enriching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Enriquecer
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1.5" onClick={handleActivateCommercial} disabled={converting}>
              {converting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />} Ativar Comercial
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5 text-muted-foreground" onClick={handleDiscard}>
              <X className="h-3 w-3" /> Descartar
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Excluir
            </Button>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected(new Set())}>
              Limpar seleção
            </Button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Carregando leads...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 p-16 text-center">
            <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold">
              {allStatusTotal === 0 && !debouncedSearch ? "Nenhum lead na base" : "Nenhum resultado"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              {allStatusTotal === 0 && !debouncedSearch
                ? "Importe uma planilha, prospecte por nicho ou adicione leads manualmente."
                : "Tente ajustar os filtros ou termos de busca."}
            </p>
            {allStatusTotal === 0 && !debouncedSearch && (
              <div className="flex justify-center gap-2 mt-4">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </Button>
                <label className="cursor-pointer">
                  <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" asChild>
                    <span><Upload className="h-3.5 w-3.5" /> Importar</span>
                  </Button>
                </label>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border/40 overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="w-12 pl-4">
                    <Checkbox checked={selected.size === leads.length && leads.length > 0} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Lead</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Contato</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Empresa</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Fonte</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">Score</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">Captado</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => {
                  const enrichment = getEnrichmentSummary(lead);
                  const isEnriched = !!enrichment;
                  const status = statusConfig[lead.status];
                  const SourceIcon = sourceIcons[lead.source] || Globe;

                  return (
                    <TableRow
                      key={lead.id}
                      className={`border-border/20 transition-all group ${
                        selected.has(lead.id) ? "bg-primary/5" : "hover:bg-muted/30"
                      }`}
                    >
                      <TableCell className="pl-4">
                        <Checkbox checked={selected.has(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} />
                      </TableCell>

                      {/* Lead Name + Avatar */}
                      <TableCell>
                        <button onClick={() => setDetailLead(lead)} className="text-left group/name flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            isEnriched
                              ? "bg-gradient-to-br from-primary/20 to-primary/5 text-primary"
                              : "bg-muted/50 text-muted-foreground"
                          }`}>
                            {getLeadInitials(lead)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate max-w-[200px] group-hover/name:text-primary transition-colors">
                              {lead.name || "Sem nome"}
                            </p>
                            {lead.tags && lead.tags.length > 0 && (
                              <div className="flex gap-1 mt-0.5">
                                {lead.tags.slice(0, 2).map((tag, i) => (
                                  <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">{tag}</span>
                                ))}
                                {lead.tags.length > 2 && (
                                  <span className="text-[9px] text-muted-foreground">+{lead.tags.length - 2}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </button>
                      </TableCell>

                      {/* Contact */}
                      <TableCell className="hidden lg:table-cell">
                        <div className="space-y-0.5">
                          {lead.phone && (
                            <p className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[140px]">{lead.phone}</span>
                            </p>
                          )}
                          {lead.email && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[160px]">{lead.email}</span>
                            </p>
                          )}
                          {!lead.phone && !lead.email && (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Company */}
                      <TableCell className="hidden md:table-cell">
                        {enrichment?.company ? (
                          <div className="space-y-0.5">
                            <p className="text-xs font-medium truncate max-w-[160px]">{enrichment.company}</p>
                            {enrichment.segment && (
                              <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">{enrichment.segment}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div className={`h-1.5 w-1.5 rounded-full ${status?.dotColor || "bg-muted"}`} />
                          <span className="text-xs font-medium">{status?.label || lead.status}</span>
                        </div>
                      </TableCell>

                      {/* Source */}
                      <TableCell className="hidden sm:table-cell">
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="h-6 w-6 rounded-md bg-muted/50 flex items-center justify-center">
                              <SourceIcon className="h-3 w-3 text-muted-foreground" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">{sourceLabels[lead.source] || lead.source}</TooltipContent>
                        </Tooltip>
                      </TableCell>

                      {/* Score */}
                      <TableCell className="hidden xl:table-cell">
                        {enrichment?.score !== null && enrichment?.score !== undefined ? (
                          <div className="flex items-center gap-1.5">
                            <div className={`text-xs font-bold font-mono ${
                              enrichment.score >= 7 ? "text-success" : enrichment.score >= 4 ? "text-warning" : "text-muted-foreground"
                            }`}>
                              {enrichment.score}
                            </div>
                            <div className="w-8 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                              <div className={`h-full rounded-full ${
                                enrichment.score >= 7 ? "bg-success" : enrichment.score >= 4 ? "bg-warning" : "bg-muted-foreground"
                              }`} style={{ width: `${Math.min(enrichment.score * 10, 100)}%` }} />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </TableCell>

                      {/* Date */}
                      <TableCell className="hidden xl:table-cell">
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="text-[11px] text-muted-foreground">
                              {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {format(new Date(lead.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => setDetailLead(lead)}>
                              <Eye className="h-4 w-4 mr-2" /> Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEnrichSingle(lead)} disabled={enrichingId === lead.id || isLeadEnriched(lead)}>
                              {enrichingId === lead.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                              {isLeadEnriched(lead) ? "Já enriquecido" : "Enriquecer"}
                            </DropdownMenuItem>
                            {lead.phone && (
                              <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(lead.phone!); toast({ title: "Telefone copiado!" }); }}>
                                <Copy className="h-4 w-4 mr-2" /> Copiar Telefone
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={async () => {
                              await supabase.from("leads_raw").delete().eq("id", lead.id);
                              toast({ title: "Lead excluído" }); fetchLeads(); fetchStatusCounts();
                            }}>
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/30">
              <p className="text-xs text-muted-foreground">
                Mostrando {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, totalCount)} de {totalCount.toLocaleString()}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7"
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground px-2">{currentPage + 1} / {totalPages}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7"
                  disabled={(currentPage + 1) * PAGE_SIZE >= totalCount}
                  onClick={() => setCurrentPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Footer actions */}
        {allStatusTotal > 0 && (
          <div className="flex justify-end">
            <AlertDialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="gap-1.5 h-7 text-[11px] text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3" /> Apagar toda a base ({allStatusTotal})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Apagar todos os leads?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Essa ação irá remover permanentemente <strong>todos os {allStatusTotal.toLocaleString()} leads</strong>. Não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAll} disabled={deletingAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {deletingAll ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    Sim, apagar tudo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* Lead Detail Dialog */}
        <Dialog open={!!detailLead} onOpenChange={() => setDetailLead(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto border-border/50">
            {detailLead && (() => {
              const ed = detailLead.enrichment_data || {};
              const hasEnrichment = Object.keys(ed).length > 1;
              const company = ed.empresa || ed.company || ed.descricao_empresa || null;
              const role = ed.cargo || ed.cargo_estimado || ed.role || null;
              const segment = ed.segmento || ed.segment || null;
              const rawScore = ed.score_conversao ?? ed.score ?? null;
              const score = rawScore !== null ? (rawScore > 10 ? Math.round(rawScore / 10) : rawScore) : null;
              const website = ed.website || ed.redes_sociais?.website || null;
              const instagram = ed.instagram || ed.redes_sociais?.instagram || null;
              const linkedin = ed.linkedin || ed.redes_sociais?.linkedin || null;
              const size = ed.porte_empresa || ed.porte || ed.tamanho || null;
              const location = ed.localizacao || ed.location || null;
              const pains = ed.dores_provaveis || ed.dores || ed.necessidades_provaveis || [];
              const products = ed.produtos_servicos || ed.produtos || ed.produtos_interesse || [];
              const salesArgs = ed.argumentos_venda || ed.gatilhos_venda || [];
              const channel = ed.canal_ideal || ed.melhor_canal || null;
              const bestTime = ed.melhor_horario || null;
              const decisionLevel = ed.nivel_decisao || null;
              const objections = ed.objecoes_provaveis || [];
              const interests = ed.interesses || [];
              const socialClass = ed.classe_social || null;
              const demProfile = ed.perfil_demografico || null;
              const scoreJustification = ed.justificativa_score || null;
              const notes = ed.observacoes || ed.observacoes_importantes || ed.analysis || null;
              const sources = ed.fontes_utilizadas || [];

              return (
                <>
                  <DialogHeader>
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                        hasEnrichment ? "bg-gradient-to-br from-primary/20 to-primary/5 text-primary" : "bg-muted/50 text-muted-foreground"
                      }`}>
                        {getLeadInitials(detailLead)}
                      </div>
                      <div>
                        <DialogTitle className="text-base">{detailLead.name || "Lead sem nome"}</DialogTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Captado {formatDistanceToNow(new Date(detailLead.created_at), { addSuffix: true, locale: ptBR })}
                          {" · "}
                          {sourceLabels[detailLead.source] || detailLead.source}
                        </p>
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="space-y-4 mt-2">
                    {/* Status + Score Row */}
                    <div className="flex items-center gap-3">
                      <Badge className={`${statusConfig[detailLead.status]?.color || ""} text-xs`} variant="outline">
                        {statusConfig[detailLead.status]?.label || detailLead.status}
                      </Badge>
                    {score !== null && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20">
                          <TrendingUp className="h-3 w-3 text-primary" />
                          <span className="text-xs font-bold text-primary font-mono">{score}/10</span>
                        </div>
                      )}
                      {scoreJustification && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-[10px] text-muted-foreground cursor-help underline decoration-dotted">por quê?</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">{scoreJustification}</TooltipContent>
                        </Tooltip>
                      )}
                      {detailLead.tags && detailLead.tags.length > 0 && (
                        <div className="flex gap-1">
                          {detailLead.tags.map((tag, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px] h-5">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Contact Info */}
                    <div className="rounded-lg border border-border/40 p-3 space-y-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Contato</p>
                      <div className="grid grid-cols-1 gap-1.5">
                        {detailLead.phone && (
                          <button onClick={() => { navigator.clipboard.writeText(detailLead.phone!); toast({ title: "Copiado!" }); }}
                            className="text-sm flex items-center gap-2 hover:text-primary transition-colors text-left">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {detailLead.phone}
                            <Copy className="h-3 w-3 text-muted-foreground/50 ml-auto" />
                          </button>
                        )}
                        {detailLead.email && (
                          <button onClick={() => { navigator.clipboard.writeText(detailLead.email!); toast({ title: "Copiado!" }); }}
                            className="text-sm flex items-center gap-2 hover:text-primary transition-colors text-left">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {detailLead.email}
                            <Copy className="h-3 w-3 text-muted-foreground/50 ml-auto" />
                          </button>
                        )}
                        {!detailLead.phone && !detailLead.email && (
                          <p className="text-xs text-muted-foreground">Nenhum contato cadastrado</p>
                        )}
                      </div>
                    </div>

                    {/* Enrichment */}
                    {hasEnrichment ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <h4 className="font-semibold text-sm">Dados Enriquecidos</h4>
                          <Badge variant="secondary" className="text-[9px] h-4">
                            {ed.estrategia_enriquecimento === "conversa" ? "📱 Via Conversas" : "🏢 Via Empresa"}
                          </Badge>
                        </div>

                        {/* Conversation-based enrichment fields */}
                        {ed.estrategia_enriquecimento === "conversa" && (
                          <div className="rounded-lg border border-border/40 p-3 space-y-2 text-sm">
                            {ed.nivel_interesse && (
                              <p className="flex gap-2"><TrendingUp className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                <span><strong>Nível de Interesse:</strong>{" "}
                                  <Badge variant="secondary" className={`text-[10px] ${ed.nivel_interesse === "quente" ? "bg-success/10 text-success" : ed.nivel_interesse === "morno" ? "bg-warning/10 text-warning" : "bg-muted/50 text-muted-foreground"}`}>
                                    {ed.nivel_interesse}
                                  </Badge>
                                </span>
                              </p>
                            )}
                            {ed.interesse_detectado && <p className="flex gap-2"><Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span><strong>Interesse:</strong> {ed.interesse_detectado}</span></p>}
                            {ed.momento_compra && <p className="flex gap-2"><Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span><strong>Momento de Compra:</strong> {ed.momento_compra}</span></p>}
                            {ed.tom_conversa && <p className="flex gap-2"><User className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span><strong>Tom da Conversa:</strong> {ed.tom_conversa}</span></p>}
                            {ed.resumo_conversa && <p className="flex gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span><strong>Resumo:</strong> {ed.resumo_conversa}</span></p>}
                            {ed.proxima_acao_sugerida && <p className="flex gap-2"><Zap className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /><span><strong>Próxima Ação:</strong> {ed.proxima_acao_sugerida}</span></p>}
                            {location && <p className="flex gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span><strong>Localização:</strong> {formatLocation(location)}</span></p>}
                          </div>
                        )}

                        {ed.necessidades_expressas?.length > 0 && ed.estrategia_enriquecimento === "conversa" && (
                          <div className="rounded-lg border border-border/40 p-3">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Necessidades Expressas</p>
                            <ul className="space-y-1">
                              {ed.necessidades_expressas.map((n: string, i: number) => (
                                <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                                  <span className="text-primary mt-0.5">→</span>{n}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {ed.objecoes_levantadas?.length > 0 && ed.estrategia_enriquecimento === "conversa" && (
                          <div className="rounded-lg border border-border/40 p-3">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Objeções Levantadas na Conversa</p>
                            <ul className="space-y-1">
                              {ed.objecoes_levantadas.map((o: string, i: number) => (
                                <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                                  <AlertTriangle className="h-3 w-3 text-warning shrink-0 mt-0.5" />{o}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Company-based enrichment fields */}
                        {ed.estrategia_enriquecimento !== "conversa" && (
                          <div className="rounded-lg border border-border/40 p-3 space-y-2 text-sm">
                            {company && <p className="flex gap-2"><Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span><strong>Empresa:</strong> {company}</span></p>}
                            {role && <p className="flex gap-2"><User className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span><strong>Cargo:</strong> {role}</span></p>}
                            {segment && <p className="flex gap-2"><Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span><strong>Segmento:</strong> {segment}</span></p>}
                            {size && <p className="flex gap-2"><Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span><strong>Porte:</strong> {typeof size === 'object' ? JSON.stringify(size) : size}</span></p>}
                            {decisionLevel && <p className="flex gap-2"><TrendingUp className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span><strong>Nível de Decisão:</strong> {typeof decisionLevel === 'object' ? JSON.stringify(decisionLevel) : decisionLevel}</span></p>}
                            {demProfile && (
                              <p className="flex gap-2"><User className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span><strong>Perfil:</strong> {typeof demProfile === 'object' ? [demProfile.faixa_etaria, demProfile.genero_provavel].filter(Boolean).join(", ") : demProfile}</span></p>
                            )}
                            {socialClass && <p className="flex gap-2"><Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span><strong>Classe Social:</strong> {socialClass}</span></p>}
                            {location && <p className="flex gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span><strong>Localização:</strong> {formatLocation(location)}</span></p>}
                            {channel && <p className="flex gap-2"><Zap className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span><strong>Canal Ideal:</strong> {channel}</span></p>}
                            {bestTime && <p className="flex gap-2"><Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span><strong>Melhor Horário:</strong> {bestTime}</span></p>}
                          </div>
                        )}

                        {interests.length > 0 && (
                          <div className="rounded-lg border border-border/40 p-3">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Interesses</p>
                            <div className="flex flex-wrap gap-1.5">
                              {interests.map((int: string, i: number) => (
                                <Badge key={i} variant="secondary" className="text-[10px]">{int}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Links */}
                        {(website || instagram || linkedin) && (
                          <div className="flex gap-2 flex-wrap">
                            {website && website !== "N/A" && (
                              <a href={website.startsWith("http") ? website : `https://${website}`} target="_blank" rel="noopener noreferrer"
                                className="text-xs flex items-center gap-1 px-2 py-1 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground">
                                <Globe className="h-3 w-3" /> Website <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                            {instagram && instagram !== "N/A" && (
                              <span className="text-xs flex items-center gap-1 px-2 py-1 rounded-md bg-muted/30 text-muted-foreground">
                                Instagram: {instagram}
                              </span>
                            )}
                            {linkedin && linkedin !== "N/A" && (
                              <span className="text-xs flex items-center gap-1 px-2 py-1 rounded-md bg-muted/30 text-muted-foreground">
                                LinkedIn: {linkedin}
                              </span>
                            )}
                          </div>
                        )}

                        {products.length > 0 && (
                          <div className="rounded-lg border border-border/40 p-3">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Produtos/Serviços</p>
                            <div className="flex flex-wrap gap-1.5">
                              {products.map((p: string, i: number) => (
                                <Badge key={i} variant="secondary" className="text-[10px]">{p}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {pains.length > 0 && (
                          <div className="rounded-lg border border-border/40 p-3">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dores Prováveis</p>
                            <ul className="space-y-1">
                              {pains.map((d: string, i: number) => (
                                <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                                  <span className="text-destructive mt-0.5">•</span>{d}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {salesArgs.length > 0 && (
                          <div className="rounded-lg border border-border/40 p-3">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Argumentos de Venda</p>
                            <ul className="space-y-1">
                              {salesArgs.map((a: string, i: number) => (
                                <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                                  <CheckCircle2 className="h-3 w-3 text-success shrink-0 mt-0.5" />{a}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {objections.length > 0 && (
                          <div className="rounded-lg border border-border/40 p-3">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Objeções e Contornos</p>
                            <ul className="space-y-2">
                              {objections.map((o: any, i: number) => (
                                <li key={i} className="text-xs text-muted-foreground">
                                  {typeof o === 'object' ? (
                                    <>
                                      <span className="flex gap-1.5"><AlertTriangle className="h-3 w-3 text-warning shrink-0 mt-0.5" /><strong>{o.objecao || o.objection}</strong></span>
                                      {(o.contorno || o.response) && <p className="ml-[18px] mt-0.5 text-muted-foreground/80">↳ {o.contorno || o.response}</p>}
                                    </>
                                  ) : (
                                    <span className="flex gap-1.5"><AlertTriangle className="h-3 w-3 text-warning shrink-0 mt-0.5" />{o}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {notes && (
                          <div className="rounded-lg border border-border/40 p-3">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Observações</p>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{notes}</p>
                          </div>
                        )}

                        {sources.length > 0 && (
                          <p className="text-[10px] text-muted-foreground">Fontes: {sources.join(", ")}</p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border/40 p-6 text-center">
                        <Sparkles className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm font-medium">Sem enriquecimento</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {detailLead.source === "web"
                            ? "Enriqueça para obter empresa, segmento, score e argumentos de venda."
                            : "Enriqueça para analisar conversas e identificar interesse, necessidades e próxima ação."}
                        </p>
                        {!isLeadEnriched(detailLead) ? (
                          <Button size="sm" variant="outline" className="mt-3 gap-1.5 text-xs" onClick={() => handleEnrichSingle(detailLead)}
                            disabled={enrichingId === detailLead.id}>
                            {enrichingId === detailLead.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            Enriquecer agora
                          </Button>
                        ) : (
                          <p className="text-[10px] text-muted-foreground mt-2">Este lead já foi enriquecido.</p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Add Lead Dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="sm:max-w-md border-border/50">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> Novo Lead</DialogTitle>
              <DialogDescription>Adicione um lead manualmente à sua base.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nome *</Label>
                <Input value={newLead.name} onChange={e => setNewLead(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="João Silva" className="h-9" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Telefone</Label>
                  <Input value={newLead.phone} onChange={e => setNewLead(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(11) 99999-9999" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Email</Label>
                  <Input value={newLead.email} onChange={e => setNewLead(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@empresa.com" className="h-9" />
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)} size="sm">Cancelar</Button>
              <Button onClick={handleAddLead} disabled={addLoading || !newLead.name.trim()} size="sm" className="gap-1.5">
                {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Security Center Dialog */}
        <Dialog open={securityOpen} onOpenChange={setSecurityOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" /> Integridade da Base
              </DialogTitle>
              <DialogDescription>Análise de duplicatas, dados incompletos e inconsistências</DialogDescription>
            </DialogHeader>

            {securityLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <div className="space-y-1.5 w-full max-w-xs">
                  {["Carregando leads...", "Verificando telefones duplicados...", "Analisando nomes duplicados...", "Identificando dados incompletos..."].map((step, i) => (
                    <p key={i} className="text-xs text-muted-foreground animate-fade-in" style={{ animationDelay: `${i * 800}ms` }}>{step}</p>
                  ))}
                </div>
              </div>
            ) : securityResults ? (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Tel. Duplicados", count: securityResults.duplicatePhones.length, color: securityResults.duplicatePhones.length > 0 ? "text-destructive" : "text-success", icon: Phone },
                    { label: "Nomes Duplicados", count: securityResults.duplicateNames.length, color: securityResults.duplicateNames.length > 0 ? "text-warning" : "text-success", icon: User },
                    { label: "Sem Telefone", count: securityResults.noPhone.length, color: securityResults.noPhone.length > 0 ? "text-warning" : "text-success", icon: FileWarning },
                    { label: "Sem Nome", count: securityResults.noName.length, color: securityResults.noName.length > 0 ? "text-warning" : "text-success", icon: AlertTriangle },
                  ].map(s => (
                    <div key={s.label} className="rounded-lg border border-border/40 p-3 text-center">
                      <s.icon className={`h-4 w-4 mx-auto mb-1 ${s.color}`} />
                      <p className={`text-xl font-bold ${s.color}`}>{s.count}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                {securityIssueCount === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-10 w-10 text-success mx-auto mb-3" />
                    <p className="text-sm font-medium">Base saudável!</p>
                    <p className="text-xs text-muted-foreground">Nenhum problema de integridade encontrado.</p>
                  </div>
                )}

                {securityResults.duplicatePhones.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2 text-destructive">
                      <Phone className="h-4 w-4" /> Mesmo telefone, nomes diferentes ({securityResults.duplicatePhones.length})
                    </h4>
                    <ScrollArea className="max-h-[200px]">
                      <div className="space-y-2">
                        {securityResults.duplicatePhones.map((group, gi) => (
                          <div key={gi} className="border border-border/40 rounded-lg p-3 space-y-2">
                            <p className="text-xs font-mono text-muted-foreground">{group.phone}</p>
                            {group.leads.map((lead, li) => (
                              <div key={lead.id} className="flex items-center justify-between text-xs">
                                <span>{lead.name || "Sem nome"} · <span className="text-muted-foreground">{sourceLabels[lead.source]}</span></span>
                                {li > 0 && (
                                  <Button variant="ghost" size="sm" className="h-6 text-[10px] text-destructive" onClick={() => handleMergeLeads(group.leads[0].id, [lead.id])}>
                                    <Trash2 className="h-3 w-3 mr-1" /> Remover
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {securityResults.duplicateNames.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2 text-warning">
                      <User className="h-4 w-4" /> Mesmo nome, telefones diferentes ({securityResults.duplicateNames.length})
                    </h4>
                    <ScrollArea className="max-h-[200px]">
                      <div className="space-y-2">
                        {securityResults.duplicateNames.map((group, gi) => (
                          <div key={gi} className="border border-border/40 rounded-lg p-3 space-y-2">
                            <p className="text-xs font-medium">{group.name}</p>
                            {group.leads.map((lead) => (
                              <div key={lead.id} className="flex items-center justify-between text-xs">
                                <span className="font-mono">{lead.phone || "Sem telefone"} · <span className="text-muted-foreground">{sourceLabels[lead.source]}</span></span>
                                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-destructive" onClick={() => handleMergeLeads(group.leads[0].id, [lead.id])}>
                                  <Trash2 className="h-3 w-3 mr-1" /> Remover
                                </Button>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {securityResults.noPhone.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2 text-warning">
                      <FileWarning className="h-4 w-4" /> Leads sem telefone ({securityResults.noPhone.length})
                    </h4>
                    <p className="text-xs text-muted-foreground">Não podem receber disparos via WhatsApp.</p>
                    <Button variant="outline" size="sm" className="text-xs gap-1 text-destructive" onClick={async () => {
                      const ids = securityResults.noPhone.map(l => l.id);
                      await supabase.from("leads_raw").delete().in("id", ids);
                      toast({ title: `${ids.length} leads sem telefone removidos` });
                      handleSecurityScan();
                      fetchLeads();
                      fetchStatusCounts();
                    }}>
                      <Trash2 className="h-3 w-3" /> Remover todos sem telefone
                    </Button>
                  </div>
                )}

                {securityResults.noName.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2 text-warning">
                      <AlertTriangle className="h-4 w-4" /> Leads sem nome ({securityResults.noName.length})
                    </h4>
                    <p className="text-xs text-muted-foreground">Personalização de mensagens limitada.</p>
                  </div>
                )}

                <DialogFooter>
                  <Button variant="outline" size="sm" onClick={handleSecurityScan} className="gap-1.5 text-xs">
                    <RefreshCw className="h-3 w-3" /> Verificar novamente
                  </Button>
                </DialogFooter>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
