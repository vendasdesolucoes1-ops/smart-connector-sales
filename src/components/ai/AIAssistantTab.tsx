import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { Brain, Trash2, Save, Send, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type AiConfig, type ChatMessage, ASSISTANT_SUGGESTIONS, AI_CHAT_URL, streamAI } from "./aiPageShared";

export default function AIAssistantTab({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("ai_configs").select("*").eq("org_id", orgId).eq("config_type", "assistant")
      .is("instance_name", null).maybeSingle()
      .then(({ data }: any) => {
        if (data) setConfig({ ...data, temperature: Number(data.temperature) || 0.7, schedule_days: data.schedule_days || [] });
      });
  }, [orgId]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isLoading) return;
    const userMsg: ChatMessage = { role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const allMsgs = [...messages, userMsg];

    await streamAI(
      AI_CHAT_URL,
      { messages: allMsgs, org_id: orgId, mode: "assistant" },
      (full) => {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: full } : m);
          return [...prev, { role: "assistant", content: full }];
        });
      },
      () => setIsLoading(false),
      (err) => { toast({ title: "Erro", description: err, variant: "destructive" }); setIsLoading(false); },
    );
  };

  const saveConfig = async () => {
    if (!config) return;
    setSavingConfig(true);
    try {
      const payload = { org_id: orgId, config_type: "assistant", instance_name: null, enabled: true, system_prompt: config.system_prompt, temperature: config.temperature };
      if (config.id) {
        await supabase.from("ai_configs").update(payload).eq("id", config.id);
      } else {
        const { data } = await supabase.from("ai_configs").insert(payload).select().single();
        if (data) setConfig((prev) => prev ? { ...prev, id: data.id } : prev);
      }
      toast({ title: "Salvo!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSavingConfig(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Assistente IA estratégico para sua equipe de vendas</p>
        <div className="flex gap-2">
          {messages.length > 0 && (
            <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => setMessages([])}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />Limpar
            </Button>
          )}
          <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => setShowConfig(!showConfig)}>
            {showConfig ? "Fechar Config" : "⚙️ Configurar"}
          </Button>
        </div>
      </div>

      {showConfig && (
        <div className="glass rounded-2xl p-5 space-y-4 animate-fade-in">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Prompt do Assistente</Label>
            <Textarea
              placeholder="Defina a personalidade e instruções do assistente interno..."
              value={config?.system_prompt || ""}
              onChange={(e) => setConfig((prev) => prev ? { ...prev, system_prompt: e.target.value } : {
                org_id: orgId, config_type: "assistant", enabled: true, system_prompt: e.target.value,
                temperature: 0.7, schedule_start: null, schedule_end: null, schedule_days: [], only_outside_hours: false, config: {},
              })}
              rows={4} className="rounded-xl bg-secondary/30 resize-none font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Criatividade</Label>
              <Badge variant="outline" className="font-mono text-xs">{(config?.temperature ?? 0.7).toFixed(1)}</Badge>
            </div>
            <Slider value={[config?.temperature ?? 0.7]} min={0} max={1} step={0.1} onValueChange={([v]) => setConfig((prev) => prev ? { ...prev, temperature: v } : prev)} />
          </div>
          <Button onClick={saveConfig} disabled={savingConfig} size="sm" className="rounded-xl gradient-primary">
            {savingConfig ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}Salvar
          </Button>
        </div>
      )}

      {messages.length === 0 && (
        <div className="grid grid-cols-2 gap-2">
          {ASSISTANT_SUGGESTIONS.map((s) => (
            <Button
              key={s.label} variant="outline" size="sm"
              className="rounded-xl text-xs h-auto py-2.5 justify-start text-left"
              onClick={() => {
                if (s.prompt.endsWith(": ")) {
                  setInput(s.prompt);
                } else {
                  sendMessage(s.prompt);
                }
              }}
            >
              <s.icon className="h-3.5 w-3.5 mr-1.5 shrink-0 text-primary" />{s.label}
            </Button>
          ))}
        </div>
      )}

      <div className="glass rounded-2xl overflow-hidden flex flex-col" style={{ height: "60vh" }}>
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
              <Brain className="h-10 w-10 text-primary/40" />
              <p className="text-sm text-muted-foreground">Pergunte qualquer coisa sobre seus leads, estratégias de vendas, ou peça análises.</p>
            </div>
          )}
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "gradient-primary text-primary-foreground whitespace-pre-wrap"
                    : "bg-secondary/50 text-foreground"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-li:my-0.5 prose-ul:my-1">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : msg.content}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-secondary/50 rounded-2xl px-4 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
          <div ref={scrollRef} />
        </ScrollArea>

        <div className="border-t border-border/50 p-3 flex gap-2">
          <Input
            placeholder="Pergunte algo..."
            value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            className="rounded-xl bg-secondary/30 border-0"
          />
          <Button onClick={() => sendMessage()} disabled={isLoading || !input.trim()} size="icon" className="rounded-xl gradient-primary shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
