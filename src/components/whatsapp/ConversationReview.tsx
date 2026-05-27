import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, ArrowRight, Loader2, Sparkles, CheckCircle2, BookOpen,
  Settings2, MessageCircle, AlertTriangle, ChevronDown, ChevronUp,
  Save, X, User, Bot, ThumbsDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Contact = {
  remote_jid: string;
  push_name: string | null;
  customer_msg_count: number;
  last_customer_msg_at: string;
  detected_audience: string | null;
};

type ChatMessage = {
  id: string;
  remote_jid: string;
  from_me: boolean;
  message_text: string;
  push_name: string | null;
  timestamp: string;
};

type Analysis = {
  summary: string;
  rules: string[];
  model_responses: { situation: string; response: string }[];
  prompt_adjustments: { scenario_key: string; action: string; text: string }[];
  knowledge_doc_title: string;
  knowledge_doc_content: string;
};

interface Props {
  contacts: Contact[];
  onClose: () => void;
  orgId: string;
  instanceName: string;
}

const formatPhone = (jid: string) => {
  const digits = jid.replace(/@.*/, "");
  if (digits.length >= 12) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  return `+${digits}`;
};

type Step = "select_conversations" | "select_messages" | "results";

export default function ConversationReview({ contacts, onClose, orgId, instanceName }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("select_conversations");
  const [selectedJids, setSelectedJids] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [applied, setApplied] = useState(false);

  // Messages step
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [flaggedMsgIds, setFlaggedMsgIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Approval toggles
  const [applyRules, setApplyRules] = useState(true);
  const [applyPromptAdj, setApplyPromptAdj] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ rules: true, responses: true, prompts: true });

  const toggleJid = (jid: string) => {
    setSelectedJids(prev => {
      const next = new Set(prev);
      next.has(jid) ? next.delete(jid) : next.add(jid);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedJids.size === contacts.length) {
      setSelectedJids(new Set());
    } else {
      setSelectedJids(new Set(contacts.map(c => c.remote_jid)));
    }
  };

  const toggleFlagMsg = (id: string) => {
    setFlaggedMsgIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Load messages when moving to step 2
  const goToMessages = async () => {
    if (!selectedJids.size) { toast({ title: "Selecione ao menos 1 conversa", variant: "destructive" }); return; }
    setStep("select_messages");
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, remote_jid, from_me, message_text, push_name, timestamp")
        .eq("org_id", orgId)
        .in("remote_jid", Array.from(selectedJids))
        .order("timestamp", { ascending: true })
        .limit(500);
      if (error) throw error;
      setMessages(data || []);
    } catch (e: any) {
      toast({ title: "Erro ao carregar mensagens", description: e.message, variant: "destructive" });
    }
    setMessagesLoading(false);
  };

  useEffect(() => {
    if (step === "select_messages" && messages.length) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [messages, step]);

  const handleAnalyze = async () => {
    if (!feedback.trim() && !flaggedMsgIds.size) {
      toast({ title: "Marque mensagens ou descreva o problema", variant: "destructive" });
      return;
    }
    setAnalyzing(true);
    setAnalysis(null);
    setStep("results");
    try {
      // Build flagged messages context
      const flaggedTexts = messages
        .filter(m => flaggedMsgIds.has(m.id))
        .map(m => {
          const contact = contacts.find(c => c.remote_jid === m.remote_jid);
          const contactName = contact?.push_name || formatPhone(m.remote_jid);
          return `[${m.from_me ? "BOT" : contactName}]: ${m.message_text}`;
        });

      const enrichedFeedback = [
        feedback.trim() ? `Feedback do usuário: ${feedback}` : "",
        flaggedTexts.length ? `\nMENSAGENS MARCADAS COMO PROBLEMÁTICAS (${flaggedTexts.length}):\n${flaggedTexts.join("\n")}` : "",
      ].filter(Boolean).join("\n");

      const { data: session } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("review-conversations", {
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
        body: {
          action: "analyze",
          remote_jids: Array.from(selectedJids),
          feedback: enrichedFeedback,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnalysis(data.analysis);
    } catch (e: any) {
      toast({ title: "Erro na análise", description: e.message, variant: "destructive" });
      setStep("select_messages");
    }
    setAnalyzing(false);
  };

  const handleApply = async () => {
    if (!analysis) return;
    setApplying(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("review-conversations", {
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
        body: { action: "apply", analysis, apply_rules: applyRules, apply_prompt_adjustments: applyPromptAdj },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setApplied(true);
      toast({ title: "Correções aplicadas!", description: (data.results || []).join(". ") });
    } catch (e: any) {
      toast({ title: "Erro ao aplicar", description: e.message, variant: "destructive" });
    }
    setApplying(false);
  };

  const toggleSection = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  // Group messages by contact for display
  const groupedByContact: Record<string, ChatMessage[]> = {};
  messages.forEach(m => {
    if (!groupedByContact[m.remote_jid]) groupedByContact[m.remote_jid] = [];
    groupedByContact[m.remote_jid].push(m);
  });

  const headerTitle = step === "select_conversations"
    ? "1. Selecionar Conversas"
    : step === "select_messages"
    ? "2. Marcar Mensagens"
    : "3. Resultados";

  const headerDesc = step === "select_conversations"
    ? "Escolha as conversas que tiveram problemas"
    : step === "select_messages"
    ? "Toque nas mensagens do bot que não ficaram boas"
    : "Revise e aplique as correções sugeridas";

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] -mx-4 -mt-2 sm:-mx-6 lg:-mx-8 rounded-2xl overflow-hidden border border-border/50 bg-card">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur shrink-0">
        <Button variant="ghost" size="icon" onClick={() => {
          if (step === "select_messages") setStep("select_conversations");
          else if (step === "results" && !applied) setStep("select_messages");
          else onClose();
        }}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="font-semibold flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" /> {headerTitle}
          </h2>
          <p className="text-xs text-muted-foreground">{headerDesc}</p>
        </div>
        {/* Step indicators */}
        <div className="flex items-center gap-1.5 shrink-0">
          {["select_conversations", "select_messages", "results"].map((s, i) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s === step ? "w-6 bg-primary" : i < ["select_conversations", "select_messages", "results"].indexOf(step) ? "w-2 bg-primary/50" : "w-2 bg-muted-foreground/20"
              }`}
            />
          ))}
        </div>
      </div>

      {/* ===== STEP 1: Select Conversations ===== */}
      {step === "select_conversations" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {selectedJids.size} de {contacts.length} selecionadas
            </span>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectAll}>
              {selectedJids.size === contacts.length ? "Desmarcar" : "Selecionar"} todas
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="divide-y divide-border/30">
              {contacts.map(c => (
                <button
                  key={c.remote_jid}
                  onClick={() => toggleJid(c.remote_jid)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                    selectedJids.has(c.remote_jid) ? "bg-primary/10" : "hover:bg-secondary/40"
                  }`}
                >
                  <div className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selectedJids.has(c.remote_jid) ? "bg-primary border-primary" : "border-muted-foreground/30"
                  }`}>
                    {selectedJids.has(c.remote_jid) && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.push_name || formatPhone(c.remote_jid)}</p>
                    <p className="text-[10px] text-muted-foreground">{formatPhone(c.remote_jid)}</p>
                  </div>
                  {c.detected_audience && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 shrink-0">{c.detected_audience.toUpperCase()}</Badge>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>

          <div className="p-3 border-t border-border/50">
            <Button
              className="w-full gap-2 rounded-xl"
              onClick={goToMessages}
              disabled={!selectedJids.size}
            >
              Carregar Mensagens <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ===== STEP 2: Select Messages ===== */}
      {step === "select_messages" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {messagesLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Flagged count bar */}
              <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <ThumbsDown className="h-3 w-3" />
                  {flaggedMsgIds.size} mensagem(ns) marcada(s)
                </span>
                {flaggedMsgIds.size > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setFlaggedMsgIds(new Set())}>
                    Limpar seleção
                  </Button>
                )}
              </div>

              <ScrollArea className="flex-1">
                <div className="px-3 py-4 space-y-6">
                  {Object.entries(groupedByContact).map(([jid, msgs]) => {
                    const contact = contacts.find(c => c.remote_jid === jid);
                    const contactName = contact?.push_name || formatPhone(jid);
                    return (
                      <div key={jid}>
                        {/* Contact separator */}
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="h-3.5 w-3.5 text-primary/60" />
                          </div>
                          <span className="text-xs font-semibold">{contactName}</span>
                          <div className="flex-1 h-px bg-border/30" />
                        </div>

                        <div className="max-w-2xl mx-auto space-y-1">
                          {msgs.map(msg => {
                            const isFlagged = flaggedMsgIds.has(msg.id);
                            return (
                              <div
                                key={msg.id}
                                className={`flex mb-1 ${msg.from_me ? "justify-end" : "justify-start"}`}
                              >
                                <button
                                  onClick={() => msg.from_me && toggleFlagMsg(msg.id)}
                                  className={`relative max-w-[80%] px-3 py-2 rounded-2xl shadow-sm text-sm text-left transition-all ${
                                    msg.from_me
                                      ? isFlagged
                                        ? "bg-destructive/90 text-destructive-foreground rounded-br-md ring-2 ring-destructive/50"
                                        : "bg-primary/90 text-primary-foreground rounded-br-md hover:ring-2 hover:ring-destructive/30 cursor-pointer"
                                      : "bg-card border border-border/50 rounded-bl-md cursor-default"
                                  }`}
                                >
                                  {/* Flag indicator */}
                                  {isFlagged && (
                                    <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive flex items-center justify-center shadow-md">
                                      <ThumbsDown className="h-2.5 w-2.5 text-destructive-foreground" />
                                    </div>
                                  )}

                                  {/* Sender label */}
                                  {!msg.from_me && (
                                    <div className="flex items-center gap-1 mb-0.5">
                                      <User className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-[10px] font-semibold text-muted-foreground">
                                        {msg.push_name || contactName}
                                      </span>
                                    </div>
                                  )}
                                  {msg.from_me && (
                                    <div className="flex items-center gap-1 mb-0.5">
                                      <Bot className={`h-3 w-3 ${isFlagged ? "text-destructive-foreground/70" : "text-primary-foreground/70"}`} />
                                      <span className={`text-[10px] font-semibold ${isFlagged ? "text-destructive-foreground/70" : "text-primary-foreground/70"}`}>
                                        IA Vendedor
                                      </span>
                                    </div>
                                  )}
                                  <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.message_text}</p>
                                  <div className={`flex justify-end mt-0.5 ${msg.from_me ? (isFlagged ? "text-destructive-foreground/50" : "text-primary-foreground/50") : "text-muted-foreground"}`}>
                                    <span className="text-[9px]">
                                      {msg.timestamp ? format(new Date(msg.timestamp), "HH:mm", { locale: ptBR }) : ""}
                                    </span>
                                  </div>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Bottom: feedback + analyze */}
              <div className="p-3 border-t border-border/50 space-y-2">
                <div className="flex items-center gap-2">
                  <Textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Descreva o que não gostou (opcional se marcou mensagens)..."
                    rows={2}
                    className="text-sm resize-none flex-1"
                  />
                </div>
                <Button
                  className="w-full gap-2 rounded-xl"
                  onClick={handleAnalyze}
                  disabled={analyzing || (!flaggedMsgIds.size && !feedback.trim())}
                >
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {analyzing ? "Analisando..." : `Analisar${flaggedMsgIds.size ? ` (${flaggedMsgIds.size} marcadas)` : ""}`}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== STEP 3: Results ===== */}
      {step === "results" && (
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {analyzing && (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
                <p className="text-sm font-medium">Analisando conversas...</p>
                <p className="text-xs text-muted-foreground mt-1">Isso pode levar alguns segundos</p>
              </div>
            )}

            {analysis && (
              <div className="p-4 space-y-4">
                {applied && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/20">
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                    <p className="text-sm text-success font-medium">Correções aplicadas com sucesso!</p>
                  </div>
                )}

                {/* Summary */}
                <div className="p-3 rounded-xl bg-secondary/40 border border-border/30">
                  <p className="text-sm font-medium mb-1">📋 Resumo</p>
                  <p className="text-sm text-muted-foreground">{analysis.summary}</p>
                </div>

                {/* Rules */}
                {analysis.rules?.length > 0 && (
                  <Collapsible open={openSections.rules} onOpenChange={() => toggleSection("rules")}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Regras de Comportamento</span>
                        <Badge variant="secondary" className="text-[10px]">{analysis.rules.length}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={applyRules} onCheckedChange={setApplyRules} />
                        {openSections.rules ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-1.5 pl-2">
                      {analysis.rules.map((rule, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-card border border-border/30">
                          <span className="text-primary text-xs font-bold mt-0.5">•</span>
                          <p className="text-sm">{rule}</p>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Model Responses */}
                {analysis.model_responses?.length > 0 && (
                  <Collapsible open={openSections.responses} onOpenChange={() => toggleSection("responses")}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-chart-2" />
                        <span className="text-sm font-medium">Respostas Modelo</span>
                        <Badge variant="secondary" className="text-[10px]">{analysis.model_responses.length}</Badge>
                      </div>
                      {openSections.responses ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-2 pl-2">
                      {analysis.model_responses.map((mr, i) => (
                        <div key={i} className="p-3 rounded-lg bg-card border border-border/30 space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">🎯 {mr.situation}</p>
                          <p className="text-sm bg-primary/5 p-2 rounded-lg border-l-2 border-primary">{mr.response}</p>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Prompt Adjustments */}
                {analysis.prompt_adjustments?.length > 0 && (
                  <Collapsible open={openSections.prompts} onOpenChange={() => toggleSection("prompts")}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <Settings2 className="h-4 w-4 text-chart-3" />
                        <span className="text-sm font-medium">Ajustes no Prompt</span>
                        <Badge variant="secondary" className="text-[10px]">{analysis.prompt_adjustments.length}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={applyPromptAdj} onCheckedChange={setApplyPromptAdj} />
                        {openSections.prompts ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-2 pl-2">
                      {analysis.prompt_adjustments.map((adj, i) => (
                        <div key={i} className="p-3 rounded-lg bg-card border border-border/30 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{adj.scenario_key}</Badge>
                            <Badge className="text-[10px] bg-chart-3/15 text-chart-3 border-chart-3/30">{adj.action}</Badge>
                          </div>
                          <p className="text-sm whitespace-pre-wrap bg-secondary/30 p-2 rounded-lg font-mono text-xs">{adj.text}</p>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Apply button */}
                {!applied && (
                  <div className="pt-2 flex gap-2">
                    <Button className="flex-1 gap-2 rounded-xl" onClick={handleApply} disabled={applying || (!applyRules && !applyPromptAdj)}>
                      {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {applying ? "Aplicando..." : "Aplicar Correções"}
                    </Button>
                    <Button variant="outline" className="rounded-xl gap-2" onClick={() => { setAnalysis(null); setApplied(false); setStep("select_messages"); }}>
                      <X className="h-4 w-4" /> Voltar
                    </Button>
                  </div>
                )}

                {applied && (
                  <div className="pt-2">
                    <Button variant="outline" className="w-full rounded-xl gap-2" onClick={onClose}>
                      <ArrowLeft className="h-4 w-4" /> Voltar às conversas
                    </Button>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}