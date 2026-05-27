import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import {
  Bot, Send, Loader2, User, Trash2, Settings2,
  Building2, Phone, MapPin, Briefcase, RotateCcw,
  MessageCircle, Smartphone, Sparkles
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";

type ChatMessage = { role: "user" | "assistant"; content: string };

type LeadProfile = {
  name: string;
  company: string;
  role: string;
  segment: string;
  interest_level: "cold" | "warm" | "hot";
  context: string;
};

const LEAD_PRESETS: { label: string; profile: LeadProfile }[] = [
  {
    label: "🏢 Diretor B2B — Interessado",
    profile: {
      name: "Carlos Mendes",
      company: "TechSolutions Ltda",
      role: "Diretor Comercial",
      segment: "Tecnologia",
      interest_level: "warm",
      context: "Viu um anúncio no LinkedIn e mandou mensagem perguntando sobre o serviço",
    },
  },
  {
    label: "🛍️ Consumidor B2C — Impulsivo",
    profile: {
      name: "Ana Paula",
      company: "",
      role: "Consumidora final",
      segment: "Varejo",
      interest_level: "hot",
      context: "Viu um story no Instagram e quer comprar agora",
    },
  },
  {
    label: "❄️ Lead Frio — Sem interesse",
    profile: {
      name: "Roberto Alves",
      company: "Alves & Cia",
      role: "Gerente",
      segment: "Serviços",
      interest_level: "cold",
      context: "Recebeu uma mensagem de prospecção e respondeu 'não tenho interesse'",
    },
  },
  {
    label: "🔥 Decisor B2B — Urgente",
    profile: {
      name: "Mariana Costa",
      company: "InnovateCorp",
      role: "CEO",
      segment: "SaaS",
      interest_level: "hot",
      context: "Precisa resolver um problema urgente e já tem orçamento aprovado",
    },
  },
];

const DEFAULT_PROFILE: LeadProfile = {
  name: "João Silva",
  company: "",
  role: "",
  segment: "",
  interest_level: "warm",
  context: "",
};

// Streaming helper
async function streamSimulation(
  url: string,
  body: any,
  onDelta: (text: string) => void,
  onDone: () => void,
  onError: (msg: string) => void,
) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) { onError("Sessão expirada. Faça login novamente."); return; }

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      onError(errData.error || `Erro ${resp.status}`);
      return;
    }
    const reader = resp.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") break;
        try {
          const parsed = JSON.parse(json);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) { full += content; onDelta(full); }
        } catch {}
      }
    }
  } catch (e: any) { onError(e.message); }
  onDone();
}

type BlockMessage = {
  text: string;
  visible: boolean;
};

export function AgentSimulator({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<LeadProfile>(DEFAULT_PROFILE);
  const [showProfile, setShowProfile] = useState(true);
  const [displayBlocks, setDisplayBlocks] = useState<{ role: string; blocks: BlockMessage[] }[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>(""); // scenario_key
  const [agents, setAgents] = useState<{ scenario_key: string; name: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const SIMULATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/simulate-seller`;

  // Load available agents
  useEffect(() => {
    supabase
      .from("ai_scenarios")
      .select("scenario_key, name")
      .eq("org_id", orgId)
      .eq("enabled", true)
      .then(({ data }) => {
        const agentList = (data || []).map((a: any) => ({
          scenario_key: a.scenario_key,
          name: a.name,
        }));
        setAgents(agentList);
        if (agentList.length > 0 && !selectedAgent) setSelectedAgent(agentList[0].scenario_key);
      });
  }, [orgId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayBlocks]);

  const splitIntoBlocks = useCallback((text: string): string[] => {
    // Split by ---BLOCO--- marker
    const blocks = text.split(/---BLOCO---/i).map(b => b.trim()).filter(b => b.length > 0);
    if (blocks.length > 1) return blocks;
    // Fallback: split by double newline
    const parts = text.split(/\n\n+/).map(b => b.trim()).filter(b => b.length > 0);
    return parts.length > 0 ? parts : [text];
  }, []);

  const animateBlocks = useCallback((blocks: string[]) => {
    const entry = { role: "assistant", blocks: blocks.map(b => ({ text: b, visible: false })) };
    setDisplayBlocks(prev => [...prev, entry]);

    // Reveal blocks one by one with delays
    blocks.forEach((_, i) => {
      setTimeout(() => {
        setDisplayBlocks(prev => {
          const updated = [...prev];
          const lastEntry = updated[updated.length - 1];
          if (lastEntry?.role === "assistant" && lastEntry.blocks[i]) {
            lastEntry.blocks[i].visible = true;
          }
          return [...updated];
        });
      }, (i + 1) * 1500); // 1.5s between each block
    });
  }, []);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isLoading) return;
    const userMsg: ChatMessage = { role: "user", content: msg };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Add user message to display
    setDisplayBlocks(prev => [...prev, { role: "user", blocks: [{ text: msg, visible: true }] }]);

    // Build context with lead profile
    const profileContext = `[PERFIL DO LEAD SIMULADO]
Nome: ${profile.name}
${profile.company ? `Empresa: ${profile.company}` : ""}
${profile.role ? `Cargo: ${profile.role}` : ""}
${profile.segment ? `Segmento: ${profile.segment}` : ""}
Nível de interesse: ${profile.interest_level === "cold" ? "Frio" : profile.interest_level === "warm" ? "Morno" : "Quente"}
${profile.context ? `Contexto: ${profile.context}` : ""}
[FIM DO PERFIL]

Mensagem do lead: ${msg}`;

    const firstMsg = messages.length === 0;
    const allMsgs = firstMsg
      ? [{ role: "user" as const, content: profileContext }]
      : [...messages, userMsg].map((m, i) =>
          i === 0 ? { ...m, content: profileContext.replace(`Mensagem do lead: ${msg}`, `Mensagem do lead: ${m.content}`) } : m
        );

    // If first message, inject profile context
    const finalMsgs = firstMsg
      ? allMsgs
      : [...messages.map((m, i) => i === 0 ? { ...m, content: `[PERFIL: ${profile.name}, ${profile.company || "pessoa física"}, ${profile.interest_level}]\n${m.content}` } : m), userMsg];

    let fullReply = "";

    await streamSimulation(
      SIMULATE_URL,
      { messages: finalMsgs, scenario_key: selectedAgent },
      (full) => {
        fullReply = full;
        // Update streaming in messages
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: full } : m);
          return [...prev, { role: "assistant", content: full }];
        });
      },
      () => {
        setIsLoading(false);
        // Show as blocks after streaming is done
        if (fullReply) {
          const blocks = splitIntoBlocks(fullReply);
          animateBlocks(blocks);
        }
      },
      (err) => {
        toast({ title: "Erro", description: err, variant: "destructive" });
        setIsLoading(false);
      },
    );
  };

  const clearChat = () => {
    setMessages([]);
    setDisplayBlocks([]);
  };

  const INTEREST_COLORS = {
    cold: "bg-sky-500/10 text-sky-500 border-sky-500/30",
    warm: "bg-warning/10 text-warning border-warning/30",
    hot: "bg-destructive/10 text-destructive border-destructive/30",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Teste seu agente como se fosse um lead real</p>
        <div className="flex gap-2">
          {messages.length > 0 && (
            <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={clearChat}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />Limpar
            </Button>
          )}
          <Button
            variant="outline" size="sm" className="rounded-xl text-xs"
            onClick={() => setShowProfile(!showProfile)}
          >
            {showProfile ? "Ocultar perfil" : "👤 Perfil do lead"}
          </Button>
        </div>
      </div>

      {/* Agent selector */}
      {agents.length > 0 && (
        <div className="glass rounded-xl p-3 flex items-center gap-3">
          <Bot className="h-4 w-4 text-primary shrink-0" />
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="rounded-lg text-xs h-8 bg-secondary/30 flex-1">
              <SelectValue placeholder="Selecione o agente..." />
            </SelectTrigger>
            <SelectContent>
              {agents.map(a => (
                <SelectItem key={a.scenario_key} value={a.scenario_key}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Lead Profile */}
      <Collapsible open={showProfile} onOpenChange={setShowProfile}>
        <CollapsibleContent>
          <div className="glass rounded-2xl p-5 space-y-4 animate-fade-in">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <Label className="font-semibold text-sm">Perfil do Lead Simulado</Label>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-2">
              {LEAD_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  className="text-[11px] rounded-lg h-auto py-1.5"
                  onClick={() => { setProfile(preset.profile); clearChat(); }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" /> Nome
                </Label>
                <Input
                  value={profile.name}
                  onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))}
                  className="h-8 text-xs rounded-lg"
                  placeholder="Nome do lead"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Empresa
                </Label>
                <Input
                  value={profile.company}
                  onChange={(e) => setProfile(p => ({ ...p, company: e.target.value }))}
                  className="h-8 text-xs rounded-lg"
                  placeholder="(vazio = B2C)"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Briefcase className="h-3 w-3" /> Cargo
                </Label>
                <Input
                  value={profile.role}
                  onChange={(e) => setProfile(p => ({ ...p, role: e.target.value }))}
                  className="h-8 text-xs rounded-lg"
                  placeholder="ex: Diretor Comercial"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Segmento
                </Label>
                <Input
                  value={profile.segment}
                  onChange={(e) => setProfile(p => ({ ...p, segment: e.target.value }))}
                  className="h-8 text-xs rounded-lg"
                  placeholder="ex: Tecnologia"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Nível de interesse</Label>
              <div className="flex gap-2">
                {(["cold", "warm", "hot"] as const).map(level => (
                  <Button
                    key={level}
                    variant="outline"
                    size="sm"
                    className={`rounded-lg text-xs flex-1 ${profile.interest_level === level ? INTEREST_COLORS[level] : ""}`}
                    onClick={() => setProfile(p => ({ ...p, interest_level: level }))}
                  >
                    {level === "cold" ? "❄️ Frio" : level === "warm" ? "🟡 Morno" : "🔥 Quente"}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Contexto da conversa</Label>
              <Textarea
                value={profile.context}
                onChange={(e) => setProfile(p => ({ ...p, context: e.target.value }))}
                rows={2}
                className="text-xs rounded-lg resize-none bg-secondary/30"
                placeholder="Como o lead chegou, o que motivou o contato..."
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* WhatsApp-style chat */}
      <div className="rounded-2xl overflow-hidden border border-border/50 flex flex-col" style={{ height: "55vh" }}>
        {/* WhatsApp header */}
        <div className="bg-success/10 border-b border-border/30 px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-success/20 flex items-center justify-center">
            <Bot className="h-4 w-4 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              {agents.find(a => a.scenario_key === selectedAgent)?.name || "Agente IA"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {isLoading ? "digitando..." : "online"}
            </p>
          </div>
          <Badge variant="outline" className="text-[9px]">
            <Smartphone className="h-3 w-3 mr-1" />Simulação
          </Badge>
        </div>

        {/* Messages area - WhatsApp style */}
        <ScrollArea className="flex-1 p-4" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, hsl(var(--secondary)/0.3) 0%, transparent 50%)" }}>
          {displayBlocks.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
              <MessageCircle className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-xs text-muted-foreground">Envie uma mensagem como se você fosse o lead</p>
              <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                {[
                  "Oi, vi o anúncio de vocês",
                  "Quanto custa?",
                  "Quero saber mais",
                  "Não tenho interesse",
                ].map(suggestion => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    className="text-[10px] rounded-full h-auto py-1 px-3"
                    onClick={() => sendMessage(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {displayBlocks.map((entry, ei) => (
              <div key={ei}>
                {entry.role === "user" ? (
                  <div className="flex justify-end mb-2">
                    <div className="max-w-[75%] rounded-2xl rounded-br-sm px-3 py-2 text-sm bg-success/20 text-foreground">
                      {entry.blocks[0]?.text}
                      <p className="text-[9px] text-muted-foreground text-right mt-0.5">
                        {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 mb-3">
                    {entry.blocks.map((block, bi) => (
                      <div
                        key={bi}
                        className={`flex justify-start transition-all duration-500 ${
                          block.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                        }`}
                      >
                        <div className="max-w-[75%] rounded-2xl rounded-bl-sm px-3 py-2 text-sm bg-secondary/50">
                          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-0.5 prose-headings:my-1">
                            <ReactMarkdown>{block.text}</ReactMarkdown>
                          </div>
                          <p className="text-[9px] text-muted-foreground text-right mt-0.5">
                            {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))}
                    {/* Show typing indicator while blocks are being revealed */}
                    {entry.blocks.some(b => !b.visible) && (
                      <div className="flex justify-start">
                        <div className="bg-secondary/50 rounded-2xl rounded-bl-sm px-4 py-2.5 flex gap-1">
                          <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {isLoading && displayBlocks[displayBlocks.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-secondary/50 rounded-2xl rounded-bl-sm px-4 py-2.5 flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>
          <div ref={scrollRef} />
        </ScrollArea>

        {/* Input bar */}
        <div className="border-t border-border/30 p-3 flex gap-2 bg-background/50">
          <Input
            placeholder={`Escreva como ${profile.name}...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            className="rounded-full bg-secondary/30 border-0 text-sm"
          />
          <Button
            onClick={() => sendMessage()}
            disabled={isLoading || !input.trim()}
            size="icon"
            className="rounded-full bg-success hover:bg-success/90 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
