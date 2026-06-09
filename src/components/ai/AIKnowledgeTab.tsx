import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Download, FileText, Plus, Zap, Check, Trash2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type KnowledgeDoc } from "./aiPageShared";

export default function AIKnowledgeTab({ orgId }: { orgId: string }) {
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
