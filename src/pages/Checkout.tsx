import { useState, useEffect, FormEvent } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Building2, User, Mail, Phone,
  MessageCircle, Shield, Sparkles, Zap, Crown, Users, Check, Loader2,
} from "lucide-react";

/* ────────────────────────── plan data ────────────────────────── */
const PLANS = {
  starter: {
    name: "Starter",
    subtitle: "O SDR Digital",
    price: "1.497",
    color: "#FFB366",
    icon: Zap,
    features: [
      "Prospecção ativa e automática",
      "Validação de ICP com IA",
      "Qualificação básica de leads",
      "Encaminhamento para Closer humano",
      "Operação 24/7 sem pausa",
      "Dashboard de métricas",
    ],
    hook: "Custa menos que um estagiário de pré-vendas, mas trabalha 24h por dia.",
  },
  pro: {
    name: "Pro",
    subtitle: "A Equipe Completa",
    price: "2.497",
    color: "#FF6B1A",
    icon: Crown,
    features: [
      "Tudo do Starter, mais:",
      "Closer com IA integrado",
      "Score de qualificação (0-100%)",
      "Agendamentos automáticos",
      "CRM alimentado automaticamente",
      "Configuração de ICP avançada",
      "Suporte prioritário",
    ],
    hook: "Um departamento comercial inteiro que não tira férias e custa metade de um único funcionário.",
  },
  agency: {
    name: "Agency",
    subtitle: "White-Label B2B2C",
    price: "3.497",
    color: "#00FF88",
    icon: Users,
    features: [
      "Tudo do Pro, mais:",
      "White-label com sua marca",
      "Múltiplas instâncias de IA",
      "Gestão multi-cliente",
      "Revenue share disponível",
      "API completa + documentação",
      "Onboarding dedicado",
    ],
    hook: "Entregue leads qualificados e agendados para seus clientes.",
  },
} as const;

type PlanKey = keyof typeof PLANS;
const STEPS = ["Plano", "Empresa", "Contato", "Revisão"];

/* ────────────────────────── helpers ────────────────────────── */
function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-10">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center gap-1">
            {/* dot */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500"
                style={{
                  background: done
                    ? "linear-gradient(135deg, #FFB366, #FF6B1A)"
                    : active
                    ? "rgba(255,179,102,0.12)"
                    : "rgba(26,26,46,0.6)",
                  color: done ? "#fff" : active ? "#FFB366" : "#555",
                  border: active ? "1px solid rgba(255,179,102,0.4)" : "1px solid transparent",
                  boxShadow: done ? "0 0 20px rgba(255,179,102,0.25)" : active ? "0 0 15px rgba(255,179,102,0.1)" : "none",
                }}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className="text-[10px] font-medium transition-colors duration-300"
                style={{ color: done || active ? "#FFB366" : "#555" }}
              >
                {label}
              </span>
            </div>
            {/* connector */}
            {i < steps.length - 1 && (
              <div className="w-8 md:w-14 h-px mx-1 mb-5 transition-all duration-700" style={{
                background: done ? "linear-gradient(90deg, #FFB366, #FF6B1A)" : "rgba(26,26,46,0.8)",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PlanCard({
  planKey, plan, selected, onSelect,
}: { planKey: string; plan: (typeof PLANS)[PlanKey]; selected: boolean; onSelect: () => void }) {
  const Icon = plan.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative text-left rounded-2xl border p-5 transition-all duration-500 group w-full"
      style={{
        borderColor: selected ? `${plan.color}60` : "rgba(26,26,46,0.8)",
        background: selected
          ? `linear-gradient(160deg, ${plan.color}10, transparent 60%)`
          : "rgba(13,13,24,0.6)",
        boxShadow: selected ? `0 0 40px ${plan.color}12` : "none",
        transform: selected ? "scale(1.02)" : "scale(1)",
      }}
    >
      {/* selection indicator */}
      <div
        className="absolute top-4 right-4 h-6 w-6 rounded-full flex items-center justify-center transition-all duration-400"
        style={{
          background: selected ? plan.color : "transparent",
          border: selected ? "none" : "2px solid rgba(85,85,85,0.4)",
        }}
      >
        {selected && <Check className="h-3.5 w-3.5 text-[#0a0705]" />}
      </div>

      <Icon className="h-5 w-5 mb-3" style={{ color: plan.color }} />
      <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-0.5" style={{ color: plan.color }}>
        {plan.subtitle}
      </p>
      <h3 className="text-lg font-bold text-white mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }}>
        {plan.name}
      </h3>
      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-[10px] text-gray-500">R$</span>
        <span className="text-2xl font-black text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
          {plan.price}
        </span>
        <span className="text-[10px] text-gray-500">/mês</span>
      </div>
      <ul className="space-y-1.5">
        {plan.features.slice(0, 4).map((f) => (
          <li key={f} className="flex items-start gap-1.5 text-[11px] text-gray-400">
            <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5" style={{ color: plan.color }} />
            {f}
          </li>
        ))}
        {plan.features.length > 4 && (
          <li className="text-[10px] text-gray-600 pl-4.5">+{plan.features.length - 4} mais recursos</li>
        )}
      </ul>
    </button>
  );
}

/* ────────────────────────── page ────────────────────────── */
export default function Checkout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const initialPlan = (params.get("plan") || "") as PlanKey;
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>(
    initialPlan in PLANS ? initialPlan : "pro"
  );
  const [step, setStep] = useState(initialPlan in PLANS ? 1 : 0);
  const [direction, setDirection] = useState<"next" | "prev">("next");

  const [company, setCompany] = useState({ name: "", segment: "", employees: "", revenue: "" });
  const [contact, setContact] = useState({ name: "", email: "", phone: "", role: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [slideKey, setSlideKey] = useState(0);

  const plan = PLANS[selectedPlan];

  const goNext = () => {
    setDirection("next");
    setSlideKey((k) => k + 1);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const goPrev = () => {
    setDirection("prev");
    setSlideKey((k) => k + 1);
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase.from("site_leads").insert({
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        company: company.name,
        message: `[CHECKOUT - ${plan.name}] Segmento: ${company.segment} | Funcionários: ${company.employees} | Faturamento: ${company.revenue} | Cargo: ${contact.role} | Mensagem: ${contact.message}`,
        form_source: `checkout_${selectedPlan}`,
        plan_selected: plan.name,
        status: "new",
      });
      if (error) {
        console.error("Checkout insert error:", error);
        alert("Erro ao enviar. Tente novamente.");
      } else {
        setSubmitted(true);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Erro inesperado. Tente novamente.");
    }
    setSubmitting(false);
  };

  /* ── slide animation class ── */
  const slideClass =
    direction === "next"
      ? "animate-[slideInRight_0.45s_ease-out_forwards]"
      : "animate-[slideInLeft_0.45s_ease-out_forwards]";

  if (submitted) {
    const nextSteps = [
      { num: "01", title: "Confirmação enviada", desc: `Enviamos os detalhes do seu pedido para ${contact.email}. Verifique também sua caixa de spam.`, color: "#00FF88", done: true },
      { num: "02", title: "Contato comercial", desc: "Um especialista do nosso time entrará em contato pelo WhatsApp ou telefone em até 2 horas úteis para alinhar sua operação.", color: "#FFB366", done: false },
      { num: "03", title: "Onboarding personalizado", desc: "Configuramos o VS SALES de acordo com seu ICP, segmento e metas comerciais — sem esforço da sua parte.", color: "#FF6B1A", done: false },
      { num: "04", title: "Ativação e primeiros resultados", desc: "Seu sistema estará operando em até 48h. Os primeiros leads qualificados começam a chegar imediatamente.", color: "#00FF88", done: false },
    ];

    return (
      <div className="min-h-screen bg-[#0a0705] text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
        {/* Background */}
        <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
          backgroundImage: "linear-gradient(rgba(255,179,102,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,179,102,1) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }} />

        {/* Header */}
        <header className="sticky top-0 z-50 bg-[#0a0705]/80 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Logo className="h-7 w-auto" />
              <span style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="tracking-wider">VS SALES</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-gray-500">
              <Shield className="h-3 w-3 text-[#00FF88]" />
              <span>Pedido confirmado</span>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-16 relative z-10">
          {/* Success icon */}
          <div className="text-center mb-10">
            <div className="relative inline-block mb-6">
              <div className="h-20 w-20 rounded-full flex items-center justify-center mx-auto" style={{ background: "linear-gradient(135deg, rgba(0,255,136,0.15), rgba(255,179,102,0.10))" }}>
                <CheckCircle2 className="h-10 w-10 text-[#00FF88]" />
              </div>
              <div className="absolute -inset-3 rounded-full animate-[ping_3s_ease-in-out_infinite]" style={{ background: "radial-gradient(circle, rgba(0,255,136,0.06), transparent 70%)" }} />
            </div>

            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-4xl md:text-5xl tracking-tight mb-2">
              Parabéns pela escolha, {contact.name.split(" ")[0]}!
            </h1>
            <p className="text-base text-gray-400 max-w-lg mx-auto leading-relaxed">
              Você acaba de dar o primeiro passo para transformar sua operação comercial. Veja exatamente o que vai acontecer agora:
            </p>
          </div>

          {/* Order summary card */}
          <div
            className="rounded-2xl border p-6 mb-10"
            style={{
              borderColor: `${plan.color}25`,
              background: `linear-gradient(160deg, ${plan.color}06, transparent 60%)`,
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ background: `${plan.color}12` }}>
                  <plan.icon className="h-5 w-5" style={{ color: plan.color }} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Plano {plan.name}</p>
                  <p className="text-[11px] text-gray-500">{plan.subtitle}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] text-gray-500">R$</span>
                  <span className="text-2xl font-black text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{plan.price}</span>
                  <span className="text-[10px] text-gray-500">/mês</span>
                </div>
              </div>
            </div>
            <div className="h-px bg-white/5 mb-4" />
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-gray-600 mb-0.5">Empresa</p>
                <p className="text-white font-medium">{company.name || "—"}</p>
              </div>
              <div>
                <p className="text-gray-600 mb-0.5">Responsável</p>
                <p className="text-white font-medium">{contact.name}</p>
              </div>
              <div>
                <p className="text-gray-600 mb-0.5">Contato</p>
                <p className="text-white font-medium">{contact.phone}</p>
              </div>
            </div>
          </div>

          {/* Next steps timeline */}
          <div className="mb-10">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#FFB366] font-medium mb-6">Próximos passos</p>
            <div className="space-y-0">
              {nextSteps.map((s, i) => (
                <div key={s.num} className="flex gap-4">
                  {/* Timeline line */}
                  <div className="flex flex-col items-center">
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{
                        background: s.done ? s.color : `${s.color}12`,
                        color: s.done ? "#0a0705" : s.color,
                      }}
                    >
                      {s.done ? <Check className="h-3.5 w-3.5" /> : s.num}
                    </div>
                    {i < nextSteps.length - 1 && (
                      <div className="w-px flex-1 my-1" style={{ background: `${s.color}20` }} />
                    )}
                  </div>
                  {/* Content */}
                  <div className="pb-6">
                    <p className="text-sm font-semibold text-white mb-1">{s.title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Guarantee banner */}
          <div className="rounded-xl border border-[#00FF88]/15 bg-[#00FF88]/[0.03] p-5 mb-10">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-[#00FF88] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white mb-1">Sem surpresas. Sem compromisso antecipado.</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Nenhuma cobrança será realizada agora. O pagamento só acontece após a configuração completa e sua aprovação final.
                  Você terá total visibilidade e controle antes de qualquer compromisso financeiro.
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate("/site")}
              className="flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 text-sm text-gray-300 hover:text-white hover:border-white/25 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao site
            </button>
            <a
              href={`https://wa.me/5511999999999?text=${encodeURIComponent(`Olá! Acabei de solicitar o plano ${plan.name} do VS SALES. Meu nome é ${contact.name}, da empresa ${company.name}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#00FF88] to-[#FFB366] text-sm font-bold text-[#0a0705] hover:shadow-[0_0_30px_rgba(0,255,136,0.25)] transition-all"
            >
              <MessageCircle className="h-4 w-4" />
              Falar agora pelo WhatsApp
            </a>
          </div>

          <p className="text-[10px] text-gray-600 text-center mt-6">
            Caso tenha dúvidas, responda o e-mail de confirmação ou nos chame pelo WhatsApp.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0705] text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Subtle background grid */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(255,179,102,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,179,102,1) 1px, transparent 1px)",
        backgroundSize: "80px 80px",
      }} />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0705]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <button onClick={() => navigate("/site")} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="h-4 w-4" />
            <Logo className="h-7 w-auto" />
            <span style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="tracking-wider hidden sm:inline">VS SALES</span>
          </button>
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            <Shield className="h-3 w-3 text-[#00FF88]" />
            <span>Ambiente seguro</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10 relative z-10">
        <StepIndicator current={step} steps={STEPS} />

        {/* Step content with slide animation */}
        <div key={slideKey} className={slideClass}>
          {/* ── STEP 0: Plan selection ── */}
          {step === 0 && (
            <div>
              <div className="text-center mb-8">
                <h1
                  style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                  className="text-3xl md:text-4xl tracking-tight mb-2"
                >
                  Escolha seu plano
                </h1>
                <p className="text-sm text-gray-500">Selecione o plano ideal para sua operação comercial.</p>
              </div>

              <div className="grid md:grid-cols-3 gap-4 mb-8">
                {(Object.entries(PLANS) as [PlanKey, (typeof PLANS)[PlanKey]][]).map(([key, p]) => (
                  <PlanCard
                    key={key}
                    planKey={key}
                    plan={p}
                    selected={selectedPlan === key}
                    onSelect={() => setSelectedPlan(key)}
                  />
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={goNext}
                  className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-[#FFB366] to-[#FF6B1A] text-sm font-semibold hover:shadow-[0_0_30px_rgba(255,179,102,0.3)] transition-all"
                >
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 1: Company info ── */}
          {step === 1 && (
            <div>
              <div className="text-center mb-8">
                <h1 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl md:text-4xl tracking-tight mb-2">
                  Sobre sua empresa
                </h1>
                <p className="text-sm text-gray-500">Para personalizar sua experiência com o VS SALES.</p>
              </div>

              {/* Selected plan mini card */}
              <div className="rounded-xl border border-[#1f1612] bg-[#0f0a08]/60 p-4 mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `${plan.color}15` }}>
                    <plan.icon className="h-5 w-5" style={{ color: plan.color }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{plan.name} <span className="text-gray-500 font-normal">— {plan.subtitle}</span></p>
                    <p className="text-xs text-gray-500">R$ {plan.price}/mês</p>
                  </div>
                </div>
                <button onClick={() => { setStep(0); setDirection("prev"); setSlideKey(k => k+1); }} className="text-[10px] text-[#FFB366] hover:underline">
                  Trocar plano
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Nome da empresa *</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
                    <input
                      required
                      value={company.name}
                      onChange={(e) => setCompany((c) => ({ ...c, name: e.target.value }))}
                      placeholder="Ex: TechScale Soluções"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#0a0705] border border-[#1f1612] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FFB366]/40 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">Segmento</label>
                    <select
                      value={company.segment}
                      onChange={(e) => setCompany((c) => ({ ...c, segment: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-[#0a0705] border border-[#1f1612] text-sm text-white focus:outline-none focus:border-[#FFB366]/40 transition-colors appearance-none"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23555' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 12px center",
                      }}
                    >
                      <option value="">Selecione</option>
                      <option value="tecnologia">Tecnologia / SaaS</option>
                      <option value="servicos">Serviços</option>
                      <option value="industria">Indústria</option>
                      <option value="varejo">Varejo / E-commerce</option>
                      <option value="saude">Saúde</option>
                      <option value="educacao">Educação</option>
                      <option value="financeiro">Financeiro</option>
                      <option value="agencia">Agência / Marketing</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">Nº de funcionários</label>
                    <select
                      value={company.employees}
                      onChange={(e) => setCompany((c) => ({ ...c, employees: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-[#0a0705] border border-[#1f1612] text-sm text-white focus:outline-none focus:border-[#FFB366]/40 transition-colors appearance-none"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23555' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 12px center",
                      }}
                    >
                      <option value="">Selecione</option>
                      <option value="1-5">1-5</option>
                      <option value="6-20">6-20</option>
                      <option value="21-50">21-50</option>
                      <option value="51-200">51-200</option>
                      <option value="200+">200+</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Faturamento mensal</label>
                  <select
                    value={company.revenue}
                    onChange={(e) => setCompany((c) => ({ ...c, revenue: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-[#0a0705] border border-[#1f1612] text-sm text-white focus:outline-none focus:border-[#FFB366]/40 transition-colors appearance-none"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23555' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 12px center",
                    }}
                  >
                    <option value="">Prefiro não informar</option>
                    <option value="ate-50k">Até R$ 50.000</option>
                    <option value="50k-100k">R$ 50.000 – R$ 100.000</option>
                    <option value="100k-500k">R$ 100.000 – R$ 500.000</option>
                    <option value="500k-1m">R$ 500.000 – R$ 1.000.000</option>
                    <option value="1m+">Acima de R$ 1.000.000</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between mt-8">
                <button onClick={goPrev} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </button>
                <button
                  onClick={goNext}
                  disabled={!company.name.trim()}
                  className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-[#FFB366] to-[#FF6B1A] text-sm font-semibold hover:shadow-[0_0_30px_rgba(255,179,102,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continuar <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Contact info ── */}
          {step === 2 && (
            <div>
              <div className="text-center mb-8">
                <h1 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl md:text-4xl tracking-tight mb-2">
                  Seus dados de contato
                </h1>
                <p className="text-sm text-gray-500">Para que nosso time comercial entre em contato.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Nome completo *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
                    <input
                      required
                      value={contact.name}
                      onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                      placeholder="Seu nome completo"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#0a0705] border border-[#1f1612] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FFB366]/40 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">E-mail corporativo *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
                    <input
                      required
                      type="email"
                      value={contact.email}
                      onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                      placeholder="seu@empresa.com"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#0a0705] border border-[#1f1612] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FFB366]/40 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">WhatsApp *</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
                      <input
                        required
                        value={contact.phone}
                        onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                        placeholder="(11) 99999-9999"
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#0a0705] border border-[#1f1612] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FFB366]/40 transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">Cargo</label>
                    <input
                      value={contact.role}
                      onChange={(e) => setContact((c) => ({ ...c, role: e.target.value }))}
                      placeholder="Ex: Diretor Comercial"
                      className="w-full px-4 py-3 rounded-xl bg-[#0a0705] border border-[#1f1612] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FFB366]/40 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Alguma observação? (opcional)</label>
                  <div className="relative">
                    <MessageCircle className="absolute left-3 top-3 h-4 w-4 text-gray-600" />
                    <textarea
                      value={contact.message}
                      onChange={(e) => setContact((c) => ({ ...c, message: e.target.value }))}
                      placeholder="Ex: Preciso para minha equipe de 5 vendedores..."
                      rows={3}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#0a0705] border border-[#1f1612] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FFB366]/40 transition-colors resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-8">
                <button onClick={goPrev} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </button>
                <button
                  onClick={goNext}
                  disabled={!contact.name.trim() || !contact.email.trim() || !contact.phone.trim()}
                  className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-[#FFB366] to-[#FF6B1A] text-sm font-semibold hover:shadow-[0_0_30px_rgba(255,179,102,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Revisar pedido <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Review ── */}
          {step === 3 && (
            <div>
              <div className="text-center mb-8">
                <h1 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl md:text-4xl tracking-tight mb-2">
                  Revise seu pedido
                </h1>
                <p className="text-sm text-gray-500">Confira os dados antes de finalizar.</p>
              </div>

              {/* Plan summary */}
              <div
                className="rounded-2xl border p-6 mb-6"
                style={{
                  borderColor: `${plan.color}30`,
                  background: `linear-gradient(160deg, ${plan.color}08, transparent 60%)`,
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: `${plan.color}15` }}>
                      <plan.icon className="h-6 w-6" style={{ color: plan.color }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }}>
                        Plano {plan.name}
                      </h3>
                      <p className="text-xs text-gray-500">{plan.subtitle}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs text-gray-500">R$</span>
                      <span className="text-3xl font-black text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                        {plan.price}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500">por mês</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-start gap-1.5 text-[11px] text-gray-400">
                      <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5" style={{ color: plan.color }} />
                      {f}
                    </div>
                  ))}
                </div>
              </div>

              {/* Details */}
              <div className="grid md:grid-cols-2 gap-4 mb-8">
                <div className="rounded-xl border border-[#1f1612] bg-[#0f0a08]/60 p-5">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-3 flex items-center gap-1.5">
                    <Building2 className="h-3 w-3" /> Empresa
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Nome</span>
                      <span className="text-white">{company.name || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Segmento</span>
                      <span className="text-white">{company.segment || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Funcionários</span>
                      <span className="text-white">{company.employees || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Faturamento</span>
                      <span className="text-white">{company.revenue || "—"}</span>
                    </div>
                  </div>
                  <button onClick={() => { setStep(1); setDirection("prev"); setSlideKey(k => k+1); }} className="text-[10px] text-[#FFB366] hover:underline mt-3">
                    Editar
                  </button>
                </div>

                <div className="rounded-xl border border-[#1f1612] bg-[#0f0a08]/60 p-5">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-3 flex items-center gap-1.5">
                    <User className="h-3 w-3" /> Contato
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Nome</span>
                      <span className="text-white">{contact.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">E-mail</span>
                      <span className="text-white">{contact.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">WhatsApp</span>
                      <span className="text-white">{contact.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Cargo</span>
                      <span className="text-white">{contact.role || "—"}</span>
                    </div>
                  </div>
                  <button onClick={() => { setStep(2); setDirection("prev"); setSlideKey(k => k+1); }} className="text-[10px] text-[#FFB366] hover:underline mt-3">
                    Editar
                  </button>
                </div>
              </div>

              {/* Info banner */}
              <div className="rounded-xl border border-[#00FF88]/15 bg-[#00FF88]/[0.03] p-4 mb-8">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-4 w-4 text-[#00FF88] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-white mb-1">O que acontece depois?</p>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      Ao confirmar, nosso time comercial receberá seu pedido e entrará em contato em até <strong className="text-white">2 horas úteis</strong> para
                      configurar sua conta, alinhar expectativas e iniciar o onboarding personalizado do seu plano {plan.name}.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button onClick={goPrev} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#00FF88] to-[#FFB366] text-sm font-bold text-[#0a0705] hover:shadow-[0_0_30px_rgba(0,255,136,0.3)] transition-all disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
                    </>
                  ) : (
                    <>
                      Confirmar pedido
                      <CheckCircle2 className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Keyframes */}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        html { scroll-behavior: smooth; }
      `}</style>
    </div>
  );
}
