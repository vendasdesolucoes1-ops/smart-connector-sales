import { useState } from "react";
import {
  MessageSquare, Plus, Trash2, ChevronDown, ChevronUp,
  Users, Building2, ShoppingCart, Sparkles, Shield,
  Target, Zap, Settings2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Types for modular config stored in ai_configs.config
export type ModularConfig = {
  // B2B/B2C
  business_mode: "b2b" | "b2c" | "hybrid";
  b2b_context: {
    decision_cycle: string;
    avg_ticket: string;
    personas: string;
    qualification_method: string;
  };
  b2c_context: {
    impulse_level: string;
    price_sensitivity: string;
    emotional_triggers: string;
    purchase_journey: string;
  };
  hybrid_detection_hint: string;
  hybrid_qualification_question: string;

  // Tone of voice
  tone: {
    formality: number; // 0 = very informal, 100 = very formal
    energy: number;    // 0 = calm, 100 = energetic
    emoji_usage: "none" | "minimal" | "moderate" | "frequent";
    custom_instructions: string;
  };

  // Golden rules
  golden_rules: string[];

  // Objection handling
  objections: { trigger: string; response: string }[];

  // CTAs
  ctas: { label: string; text: string }[];

  // Block config
  blocks: {
    max_blocks: number;
    max_chars_per_block: number;
    delay_min_ms: number;
    delay_max_ms: number;
    max_emojis_per_block: number;
  };

  // Custom base prompt (advanced)
  custom_base_prompt: string;
  use_custom_prompt: boolean;
};

export const DEFAULT_MODULAR_CONFIG: ModularConfig = {
  business_mode: "hybrid",
  b2b_context: {
    decision_cycle: "médio (2-4 semanas)",
    avg_ticket: "",
    personas: "Gerente, Diretor, CEO",
    qualification_method: "BANT",
  },
  b2c_context: {
    impulse_level: "médio",
    price_sensitivity: "alta",
    emotional_triggers: "urgência, escassez, prova social",
    purchase_journey: "curta (1-3 interações)",
  },
  hybrid_detection_hint: "Detecte automaticamente se o lead é B2B ou B2C pela linguagem, cargo mencionado, nome de empresa ou tipo de pergunta. Adapte tom e estratégia conforme o perfil detectado.",
  hybrid_qualification_question: "Você está buscando para consumo pessoal (festa, churrasco, evento) ou para o seu estabelecimento/empresa?",
  tone: {
    formality: 30,
    energy: 60,
    emoji_usage: "moderate",
    custom_instructions: "",
  },
  golden_rules: [
    "Máximo 3 mensagens seguidas sem resposta do lead",
    "Sempre use o nome do lead",
    "Se não souber algo, diga que vai confirmar com o time",
    "Nunca invente informações sobre produtos/preços",
    "Mensagens curtas e diretas",
  ],
  objections: [
    { trigger: "Está caro / Não tenho orçamento", response: "Entendo. Vamos olhar o retorno: se [benefício], em quanto tempo você recupera esse investimento?" },
    { trigger: "Preciso pensar", response: "Claro! O que especificamente você precisa avaliar? Posso ajudar com alguma informação?" },
    { trigger: "Já tenho fornecedor", response: "Ótimo! O que faria você considerar uma alternativa? O que poderia ser melhor?" },
  ],
  ctas: [
    { label: "Agendar reunião", text: "Posso agendar 15 minutos para conversarmos? Que dia e horário funcionam melhor?" },
    { label: "Enviar proposta", text: "Posso preparar uma proposta personalizada. Me confirma seu email?" },
    { label: "Demonstração", text: "Que tal uma demonstração rápida? Leva menos de 10 minutos!" },
  ],
  blocks: {
    max_blocks: 4,
    max_chars_per_block: 200,
    delay_min_ms: 1000,
    delay_max_ms: 3000,
    max_emojis_per_block: 1,
  },
  custom_base_prompt: "",
  use_custom_prompt: false,
};

type Props = {
  config: ModularConfig;
  onChange: (config: ModularConfig) => void;
};

function Section({
  title, icon: Icon, badge, defaultOpen = false, children,
}: { title: string; icon: any; badge?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full glass rounded-xl p-4 flex items-center gap-3 hover:border-primary/30 transition-all text-left">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{title}</p>
          </div>
          {badge && <Badge variant="outline" className="text-[10px] shrink-0">{badge}</Badge>}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-1 pt-3 pb-1 space-y-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ModularPromptEditor({ config, onChange }: Props) {
  const update = <K extends keyof ModularConfig>(key: K, value: ModularConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  const EMOJI_OPTIONS = [
    { value: "none", label: "Nenhum" },
    { value: "minimal", label: "Mínimo (1 a cada 3 msgs)" },
    { value: "moderate", label: "Moderado (1 por msg)" },
    { value: "frequent", label: "Frequente (2+ por msg)" },
  ];

  const FORMALITY_LABELS = ["Muito informal", "Informal", "Neutro", "Formal", "Muito formal"];
  const ENERGY_LABELS = ["Calmo", "Tranquilo", "Equilibrado", "Animado", "Muito energético"];

  return (
    <div className="space-y-3">
      {/* B2B/B2C MODE */}
      <Section title="Contexto de Negócio" icon={Building2} badge={config.business_mode.toUpperCase()} defaultOpen>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Modo de operação</Label>
            <Select value={config.business_mode} onValueChange={(v: any) => update("business_mode", v)}>
              <SelectTrigger className="rounded-xl bg-secondary/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="b2b">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3 w-3" />B2B — Empresa para Empresa
                  </div>
                </SelectItem>
                <SelectItem value="b2c">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-3 w-3" />B2C — Direto ao Consumidor
                  </div>
                </SelectItem>
                <SelectItem value="hybrid">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3 w-3" />Híbrido — Detecção Automática
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.business_mode === "hybrid" && (
            <div className="space-y-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-primary" />
                  Pergunta de qualificação
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  No primeiro contato orgânico, a IA fará esta pergunta para identificar o perfil do lead.
                </p>
                <Textarea
                  value={config.hybrid_qualification_question || ""}
                  onChange={(e) => update("hybrid_qualification_question", e.target.value)}
                  rows={2}
                  className="rounded-lg bg-background text-xs resize-none"
                  placeholder="ex: Você está buscando para consumo pessoal ou para o seu estabelecimento?"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Settings2 className="h-3 w-3 text-primary" />
                  Instrução de detecção (avançado)
                </Label>
                <Textarea
                  value={config.hybrid_detection_hint}
                  onChange={(e) => update("hybrid_detection_hint", e.target.value)}
                  rows={2}
                  className="rounded-lg bg-background text-xs resize-none"
                  placeholder="Como a IA deve detectar se é B2B ou B2C..."
                />
              </div>
            </div>
          )}

          {(config.business_mode === "b2b" || config.business_mode === "hybrid") && (
            <div className="space-y-2 p-3 bg-secondary/20 rounded-lg">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <Building2 className="h-3 w-3" /> Contexto B2B
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Ciclo de decisão</Label>
                  <Input
                    value={config.b2b_context.decision_cycle}
                    onChange={(e) => update("b2b_context", { ...config.b2b_context, decision_cycle: e.target.value })}
                    className="h-8 text-xs rounded-lg"
                    placeholder="ex: 2-4 semanas"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Ticket médio</Label>
                  <Input
                    value={config.b2b_context.avg_ticket}
                    onChange={(e) => update("b2b_context", { ...config.b2b_context, avg_ticket: e.target.value })}
                    className="h-8 text-xs rounded-lg"
                    placeholder="ex: R$ 5.000"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Personas-alvo</Label>
                  <Input
                    value={config.b2b_context.personas}
                    onChange={(e) => update("b2b_context", { ...config.b2b_context, personas: e.target.value })}
                    className="h-8 text-xs rounded-lg"
                    placeholder="ex: Gerente, Diretor"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Método de qualificação</Label>
                  <Select
                    value={config.b2b_context.qualification_method}
                    onValueChange={(v) => update("b2b_context", { ...config.b2b_context, qualification_method: v })}
                  >
                    <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BANT">BANT</SelectItem>
                      <SelectItem value="MEDDIC">MEDDIC</SelectItem>
                      <SelectItem value="SPIN">SPIN Selling</SelectItem>
                      <SelectItem value="GPCT">GPCT</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {(config.business_mode === "b2c" || config.business_mode === "hybrid") && (
            <div className="space-y-2 p-3 bg-secondary/20 rounded-lg">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <ShoppingCart className="h-3 w-3" /> Contexto B2C
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Nível de impulso</Label>
                  <Select
                    value={config.b2c_context.impulse_level}
                    onValueChange={(v) => update("b2c_context", { ...config.b2c_context, impulse_level: v })}
                  >
                    <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixo">Baixo (compra racional)</SelectItem>
                      <SelectItem value="médio">Médio</SelectItem>
                      <SelectItem value="alto">Alto (compra por impulso)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Sensibilidade a preço</Label>
                  <Select
                    value={config.b2c_context.price_sensitivity}
                    onValueChange={(v) => update("b2c_context", { ...config.b2c_context, price_sensitivity: v })}
                  >
                    <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa (premium)</SelectItem>
                      <SelectItem value="média">Média</SelectItem>
                      <SelectItem value="alta">Alta (preço importa muito)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-[10px] text-muted-foreground">Gatilhos emocionais</Label>
                  <Input
                    value={config.b2c_context.emotional_triggers}
                    onChange={(e) => update("b2c_context", { ...config.b2c_context, emotional_triggers: e.target.value })}
                    className="h-8 text-xs rounded-lg"
                    placeholder="ex: urgência, escassez, prova social"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-[10px] text-muted-foreground">Jornada de compra</Label>
                  <Input
                    value={config.b2c_context.purchase_journey}
                    onChange={(e) => update("b2c_context", { ...config.b2c_context, purchase_journey: e.target.value })}
                    className="h-8 text-xs rounded-lg"
                    placeholder="ex: curta (1-3 interações)"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* TONE OF VOICE */}
      <Section title="Tom de Voz" icon={MessageSquare} badge={FORMALITY_LABELS[Math.round(config.tone.formality / 25)]}>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Formalidade</Label>
              <span className="text-[10px] text-muted-foreground">{FORMALITY_LABELS[Math.round(config.tone.formality / 25)]}</span>
            </div>
            <Slider
              value={[config.tone.formality]}
              min={0} max={100} step={25}
              onValueChange={([v]) => update("tone", { ...config.tone, formality: v })}
            />
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>😎 Informal</span><span>👔 Formal</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Energia</Label>
              <span className="text-[10px] text-muted-foreground">{ENERGY_LABELS[Math.round(config.tone.energy / 25)]}</span>
            </div>
            <Slider
              value={[config.tone.energy]}
              min={0} max={100} step={25}
              onValueChange={([v]) => update("tone", { ...config.tone, energy: v })}
            />
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>🧘 Calmo</span><span>🚀 Energético</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Uso de emojis</Label>
            <Select value={config.tone.emoji_usage} onValueChange={(v: any) => update("tone", { ...config.tone, emoji_usage: v })}>
              <SelectTrigger className="rounded-lg text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EMOJI_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Instruções adicionais de tom</Label>
            <Textarea
              value={config.tone.custom_instructions}
              onChange={(e) => update("tone", { ...config.tone, custom_instructions: e.target.value })}
              rows={2}
              className="rounded-lg text-xs resize-none bg-secondary/30"
              placeholder="ex: Use gírias do Sul do Brasil, sempre chame de 'tu'..."
            />
          </div>
        </div>
      </Section>

      {/* GOLDEN RULES */}
      <Section title="Regras de Ouro" icon={Shield} badge={`${config.golden_rules.length} regras`}>
        <div className="space-y-2">
          {config.golden_rules.map((rule, i) => (
            <div key={i} className="flex gap-2 items-start">
              <Badge variant="outline" className="text-[10px] mt-1 shrink-0">{i + 1}</Badge>
              <Input
                value={rule}
                onChange={(e) => {
                  const rules = [...config.golden_rules];
                  rules[i] = e.target.value;
                  update("golden_rules", rules);
                }}
                className="h-8 text-xs rounded-lg flex-1"
              />
              <Button
                variant="ghost" size="sm"
                className="h-8 w-8 p-0 text-destructive shrink-0"
                onClick={() => update("golden_rules", config.golden_rules.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline" size="sm"
            className="text-xs rounded-lg gap-1 w-full"
            onClick={() => update("golden_rules", [...config.golden_rules, ""])}
          >
            <Plus className="h-3 w-3" /> Adicionar regra
          </Button>
        </div>
      </Section>

      {/* OBJECTION HANDLING */}
      <Section title="Contorno de Objeções" icon={Target} badge={`${config.objections.length} objeções`}>
        <div className="space-y-3">
          {config.objections.map((obj, i) => (
            <div key={i} className="p-3 bg-secondary/20 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] shrink-0">#{i + 1}</Badge>
                <Input
                  value={obj.trigger}
                  onChange={(e) => {
                    const objs = [...config.objections];
                    objs[i] = { ...objs[i], trigger: e.target.value };
                    update("objections", objs);
                  }}
                  className="h-7 text-xs rounded-lg flex-1"
                  placeholder="Objeção do lead..."
                />
                <Button
                  variant="ghost" size="sm"
                  className="h-7 w-7 p-0 text-destructive shrink-0"
                  onClick={() => update("objections", config.objections.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <Textarea
                value={obj.response}
                onChange={(e) => {
                  const objs = [...config.objections];
                  objs[i] = { ...objs[i], response: e.target.value };
                  update("objections", objs);
                }}
                rows={2}
                className="text-xs rounded-lg resize-none bg-background"
                placeholder="Como a IA deve responder..."
              />
            </div>
          ))}
          <Button
            variant="outline" size="sm"
            className="text-xs rounded-lg gap-1 w-full"
            onClick={() => update("objections", [...config.objections, { trigger: "", response: "" }])}
          >
            <Plus className="h-3 w-3" /> Adicionar objeção
          </Button>
        </div>
      </Section>

      {/* CTAs */}
      <Section title="CTAs Preferidos" icon={Zap} badge={`${config.ctas.length} CTAs`}>
        <div className="space-y-2">
          {config.ctas.map((cta, i) => (
            <div key={i} className="p-3 bg-secondary/20 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={cta.label}
                  onChange={(e) => {
                    const ctas = [...config.ctas];
                    ctas[i] = { ...ctas[i], label: e.target.value };
                    update("ctas", ctas);
                  }}
                  className="h-7 text-xs rounded-lg w-40"
                  placeholder="Nome do CTA"
                />
                <Input
                  value={cta.text}
                  onChange={(e) => {
                    const ctas = [...config.ctas];
                    ctas[i] = { ...ctas[i], text: e.target.value };
                    update("ctas", ctas);
                  }}
                  className="h-7 text-xs rounded-lg flex-1"
                  placeholder="Texto do CTA..."
                />
                <Button
                  variant="ghost" size="sm"
                  className="h-7 w-7 p-0 text-destructive shrink-0"
                  onClick={() => update("ctas", config.ctas.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            variant="outline" size="sm"
            className="text-xs rounded-lg gap-1 w-full"
            onClick={() => update("ctas", [...config.ctas, { label: "", text: "" }])}
          >
            <Plus className="h-3 w-3" /> Adicionar CTA
          </Button>
        </div>
      </Section>

      {/* BLOCK CONFIGURATION */}
      <Section title="Configuração de Blocos" icon={Settings2} badge={`${config.blocks.max_blocks} blocos`}>
        <div className="space-y-4">
          <p className="text-[10px] text-muted-foreground">
            Mensagens são divididas em blocos curtos para parecer mais natural no WhatsApp.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">Máx. blocos por resposta</Label>
              <Select value={String(config.blocks.max_blocks)} onValueChange={(v) => update("blocks", { ...config.blocks, max_blocks: Number(v) })}>
                <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map(n => <SelectItem key={n} value={String(n)}>{n} {n === 1 ? "bloco" : "blocos"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">Máx. caracteres por bloco</Label>
              <Select value={String(config.blocks.max_chars_per_block)} onValueChange={(v) => update("blocks", { ...config.blocks, max_chars_per_block: Number(v) })}>
                <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[100, 150, 200, 300, 400, 500].map(n => <SelectItem key={n} value={String(n)}>{n} chars</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">Emojis por bloco</Label>
              <Select value={String(config.blocks.max_emojis_per_block)} onValueChange={(v) => update("blocks", { ...config.blocks, max_emojis_per_block: Number(v) })}>
                <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3].map(n => <SelectItem key={n} value={String(n)}>{n === 0 ? "Nenhum" : `Até ${n}`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">Delay entre blocos</Label>
              <Select
                value={`${config.blocks.delay_min_ms}-${config.blocks.delay_max_ms}`}
                onValueChange={(v) => {
                  const [min, max] = v.split("-").map(Number);
                  update("blocks", { ...config.blocks, delay_min_ms: min, delay_max_ms: max });
                }}
              >
                <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="500-1500">Rápido (0.5-1.5s)</SelectItem>
                  <SelectItem value="1000-3000">Natural (1-3s)</SelectItem>
                  <SelectItem value="2000-5000">Humano (2-5s)</SelectItem>
                  <SelectItem value="3000-8000">Lento (3-8s)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview visual */}
          <div className="p-3 bg-secondary/20 rounded-lg space-y-2">
            <p className="text-[10px] font-medium text-muted-foreground">📱 Preview de entrega</p>
            <div className="space-y-1.5">
              {Array.from({ length: Math.min(config.blocks.max_blocks, 4) }).map((_, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div
                    className="bg-success/20 text-success rounded-xl rounded-bl-sm px-3 py-1.5 text-[10px] max-w-[70%] animate-in slide-in-from-left"
                    style={{ animationDelay: `${i * 300}ms`, width: `${30 + Math.random() * 40}%` }}
                  >
                    Bloco {i + 1} da mensagem...
                  </div>
                  {i < config.blocks.max_blocks - 1 && (
                    <span className="text-[8px] text-muted-foreground">
                      +{(config.blocks.delay_min_ms / 1000).toFixed(1)}-{(config.blocks.delay_max_ms / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ADVANCED: Custom prompt */}
      <Section title="Prompt Avançado (Manual)" icon={Settings2}>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch
              checked={config.use_custom_prompt}
              onCheckedChange={(v) => update("use_custom_prompt", v)}
            />
            <span className="text-xs">Usar prompt manual em vez do editor modular</span>
          </div>
          {config.use_custom_prompt && (
            <Textarea
              value={config.custom_base_prompt}
              onChange={(e) => update("custom_base_prompt", e.target.value)}
              rows={10}
              className="rounded-lg bg-secondary/30 resize-none font-mono text-xs"
              placeholder="Prompt personalizado completo..."
            />
          )}
          <p className="text-[10px] text-muted-foreground">
            ⚠️ Ao ativar o prompt manual, as configurações modulares acima serão ignoradas.
          </p>
        </div>
      </Section>
    </div>
  );
}
