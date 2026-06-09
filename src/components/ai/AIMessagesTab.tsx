import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { Copy, Check, Sparkles, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type AiConfig, MSG_TYPES, AI_CHAT_URL, streamAI } from "./aiPageShared";

export default function AIMessagesTab({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [context, setContext] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [msgType, setMsgType] = useState("whatsapp");
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.from("ai_configs").select("*").eq("org_id", orgId).eq("config_type", "messages")
      .is("instance_name", null).maybeSingle()
      .then(({ data }: any) => {
        if (data) setConfig({ ...data, temperature: Number(data.temperature) || 0.8, schedule_days: data.schedule_days || [] });
      });
  }, [orgId]);

  const generate = async () => {
    if (!context.trim()) return;
    setIsLoading(true);
    setResult("");

    const enrichedContent = `[TIPO:${msgType}]\n\n${context}`;

    await streamAI(
      AI_CHAT_URL,
      { messages: [{ role: "user", content: enrichedContent }], org_id: orgId, mode: "generate_message" },
      (full) => setResult(full),
      () => setIsLoading(false),
      (err) => { toast({ title: "Erro", description: err, variant: "destructive" }); setIsLoading(false); },
    );
  };

  const saveConfig = async () => {
    if (!config) return;
    setSavingConfig(true);
    try {
      const payload = { org_id: orgId, config_type: "messages", instance_name: null, enabled: true, system_prompt: config.system_prompt, temperature: config.temperature };
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gere mensagens de prospecção otimizadas por canal</p>
        <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => setShowConfig(!showConfig)}>
          {showConfig ? "Fechar Config" : "⚙️ Configurar"}
        </Button>
      </div>

      {showConfig && (
        <div className="glass rounded-2xl p-5 space-y-4 animate-fade-in">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Instruções adicionais para geração</Label>
            <Textarea
              placeholder="Ex: Use tom informal, foque nos benefícios do produto X, inclua cases de sucesso..."
              value={config?.system_prompt || ""}
              onChange={(e) => setConfig((prev) => prev ? { ...prev, system_prompt: e.target.value } : {
                org_id: orgId, config_type: "messages", enabled: true, system_prompt: e.target.value,
                temperature: 0.8, schedule_start: null, schedule_end: null, schedule_days: [], only_outside_hours: false, config: {},
              })}
              rows={3} className="rounded-xl bg-secondary/30 resize-none"
            />
          </div>
          <Button onClick={saveConfig} disabled={savingConfig} size="sm" className="rounded-xl gradient-primary">
            {savingConfig ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}Salvar
          </Button>
        </div>
      )}

      <div className="glass rounded-2xl p-5 space-y-3">
        <Label className="font-semibold text-sm">Canal de Prospecção</Label>
        <div className="grid grid-cols-4 gap-2">
          {MSG_TYPES.map((t) => (
            <Button
              key={t.value}
              variant={msgType === t.value ? "default" : "outline"}
              size="sm"
              className={`rounded-xl text-xs h-auto py-2.5 flex-col gap-1 ${msgType === t.value ? "gradient-primary" : ""}`}
              onClick={() => setMsgType(t.value)}
            >
              <t.icon className="h-4 w-4" />{t.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl p-5 space-y-3">
        <Label className="font-semibold text-sm">Contexto do Lead</Label>
        <Textarea
          placeholder={`Cole informações do lead para gerar mensagem de ${MSG_TYPES.find(t => t.value === msgType)?.label || "prospecção"}:\n\n• Nome, empresa, cargo\n• Segmento e porte\n• Dor/necessidade identificada\n• Como descobriu o lead`}
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={5} className="rounded-xl bg-secondary/30 resize-none"
        />
        <Button onClick={generate} disabled={isLoading || !context.trim()} className="rounded-xl gradient-primary w-full">
          {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Gerando...</> : <><Sparkles className="h-4 w-4 mr-2" />Gerar Mensagens</>}
        </Button>
      </div>

      {result && (
        <div className="glass rounded-2xl p-5 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <Label className="font-semibold text-sm">Mensagens Geradas</Label>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
              navigator.clipboard.writeText(result);
              setCopied(true); setTimeout(() => setCopied(false), 2000);
            }}>
              {copied ? <Check className="h-3.5 w-3.5 mr-1 text-success" /> : <Copy className="h-3.5 w-3.5 mr-1" />}Copiar
            </Button>
          </div>
          <div className="bg-secondary/30 rounded-xl p-4 text-sm prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
