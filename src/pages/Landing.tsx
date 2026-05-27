import { useState, useRef, useEffect } from "react";
import { motion, useScroll, useTransform, useSpring, MotionValue } from "framer-motion";
import { Logo } from "@/components/Logo";
import { ParticleCanvas } from "@/components/landing/ParticleCanvas";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { whatsappLink, type WhatsAppIntent } from "@/lib/whatsapp";
import {
  Search, Target, CalendarCheck, CheckCircle2,
  Clock, TrendingUp, Users, ChevronDown, ArrowRight, Shield,
  Brain, BarChart3, Sparkles, MessageCircle, Rocket, Building2,
  Globe, Send, BotMessageSquare, ArrowUpRight,
} from "lucide-react";

/* ───────────────────────── Helpers ───────────────────────── */

function Reveal({
  children, className = "", delay = 0, direction = "up",
}: { children: React.ReactNode; className?: string; delay?: number; direction?: "up" | "left" | "right" | "scale" }) {
  const { ref, isVisible } = useScrollAnimation(0.12);
  const transforms: Record<string, string> = {
    up: "translateY(40px)",
    left: "translateX(-40px)",
    right: "translateX(40px)",
    scale: "scale(0.92)",
  };
  return (
    <div
      ref={ref}
      className={`transition-all ease-out ${className}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "none" : transforms[direction],
        transitionDuration: "800ms",
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#1f1612] rounded-xl overflow-hidden transition-colors hover:border-[#FFB366]/15">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-[#120c08] transition-colors"
        aria-expanded={open}
      >
        <span className="font-medium text-sm md:text-base text-gray-200 pr-4">{question}</span>
        <ChevronDown className={`h-4 w-4 text-[#FFB366] shrink-0 transition-transform duration-500 ${open ? "rotate-180" : ""}`} />
      </button>
      <div className="grid transition-all duration-500 ease-out" style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}>
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-sm text-gray-400 leading-relaxed">{answer}</p>
        </div>
      </div>
    </div>
  );
}

const WAButton = ({
  intent = "explore",
  children,
  variant = "primary",
  className = "",
  icon: Icon = MessageCircle,
}: {
  intent?: WhatsAppIntent;
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "outline";
  className?: string;
  icon?: typeof MessageCircle;
}) => {
  const base = "inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold transition-all duration-300";
  const styles: Record<string, string> = {
    primary:
      "bg-gradient-to-r from-[#FFB366] to-[#FF6B1A] text-[#0a0705] hover:shadow-[0_0_30px_rgba(255,107,26,0.45)] hover:scale-[1.02]",
    ghost: "text-gray-300 hover:text-white border border-white/10 hover:border-white/25",
    outline: "border border-[#FFB366]/30 text-[#FFB366] hover:bg-[#FFB366]/10",
  };
  return (
    <a
      href={whatsappLink(intent)}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} ${styles[variant]} ${className}`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </a>
  );
};

/* ───────────────────── Scroll-driven hero stage ─────────────────────
 * Inspired by Apple product pages: a tall section holds a sticky stage
 * inside; as the user scrolls, the dashboard mockup scales/rotates and
 * three "scenes" of copy cross-fade. Three orbiting status cards appear
 * one at a time, each tied to a scene. Mobile gracefully falls back.
 */
function ScrollStage({ progress }: { progress: MotionValue<number> }) {
  // smooth out scroll for buttery feel
  const sp = useSpring(progress, { stiffness: 120, damping: 22, mass: 0.25 });

  const dashScale = useTransform(sp, [0, 0.35, 0.7, 1], [0.82, 1, 1.04, 1.08]);
  const dashRotate = useTransform(sp, [0, 1], [6, -3]);
  const dashY = useTransform(sp, [0, 1], [40, -60]);
  const glow = useTransform(sp, [0, 0.5, 1], [0.2, 0.55, 0.8]);

  // 3 scenes for the headline
  const scene1Op = useTransform(sp, [0, 0.18, 0.32], [1, 1, 0]);
  const scene2Op = useTransform(sp, [0.28, 0.4, 0.62], [0, 1, 0]);
  const scene3Op = useTransform(sp, [0.58, 0.72, 1], [0, 1, 1]);

  const scene1Y = useTransform(sp, [0, 0.32], [0, -20]);
  const scene2Y = useTransform(sp, [0.28, 0.62], [20, -20]);
  const scene3Y = useTransform(sp, [0.58, 1], [20, 0]);

  // floating cards reveal
  const card1 = useTransform(sp, [0.05, 0.18, 0.4, 0.5], [0, 1, 1, 0.6]);
  const card2 = useTransform(sp, [0.32, 0.45, 0.65, 0.75], [0, 1, 1, 0.6]);
  const card3 = useTransform(sp, [0.55, 0.7, 1], [0, 1, 1]);
  const card1Y = useTransform(sp, [0, 1], [0, -30]);
  const card2X = useTransform(sp, [0, 1], [10, -20]);
  const card3Y = useTransform(sp, [0, 1], [20, 0]);
  const hintOp = useTransform(sp, [0, 0.15], [1, 0]);

  return (
    <div className="sticky top-0 h-screen flex items-center overflow-hidden">
      <ParticleCanvas />
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,179,102,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,179,102,1) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />
      <motion.div
        aria-hidden
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[80%] rounded-full blur-[120px] pointer-events-none"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,107,26,0.35), rgba(255,179,102,0.08) 60%, transparent 70%)",
          opacity: glow,
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 w-full grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        {/* Left: morphing copy */}
        <div className="relative min-h-[360px] sm:min-h-[420px]">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#FFB366]/20 bg-[#FFB366]/5 text-[10px] text-[#FFB366] font-medium mb-5 tracking-[0.2em] uppercase">
            <Sparkles className="h-3 w-3" /> VS Soluções Labs
          </div>

          <div className="relative h-[260px] sm:h-[320px]">
            <motion.div
              className="absolute inset-0"
              style={{ opacity: scene1Op, y: scene1Y }}
            >
              <h1
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[0.92] tracking-tight"
              >
                Sua equipe comercial<br />
                <span className="bg-gradient-to-r from-[#FFB366] via-[#FF8C3C] to-[#FF6B1A] bg-clip-text text-transparent">
                  inteira. Só que é IA.
                </span>
              </h1>
              <p className="text-gray-400 text-sm sm:text-base leading-relaxed mt-5 max-w-md">
                Três agentes — SDR, BDR e Closer — trabalhando 24/7 pelo seu funil. Sem férias, sem encargos, sem desculpas.
              </p>
            </motion.div>

            <motion.div
              className="absolute inset-0"
              style={{ opacity: scene2Op, y: scene2Y }}
            >
              <h1
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[0.92] tracking-tight"
              >
                Prospecta.<br />
                Qualifica.<br />
                <span className="text-[#FFB366]">Fecha.</span>
              </h1>
              <p className="text-gray-400 text-sm sm:text-base leading-relaxed mt-5 max-w-md">
                Da primeira mensagem ao agendamento da reunião, sem você tocar no teclado.
              </p>
            </motion.div>

            <motion.div
              className="absolute inset-0"
              style={{ opacity: scene3Op, y: scene3Y }}
            >
              <h1
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[0.92] tracking-tight"
              >
                E ainda <span className="text-[#FF6B1A]">vende</span><br />
                enquanto você dorme.
              </h1>
              <p className="text-gray-400 text-sm sm:text-base leading-relaxed mt-5 max-w-md">
                Operação contínua, pipeline em tempo real, follow-up que nunca falha. Você só precisa atender o WhatsApp.
              </p>
            </motion.div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-start gap-3">
            <WAButton intent="explore">
              Conversar pelo WhatsApp
              <ArrowRight className="h-4 w-4" />
            </WAButton>
            <a
              href="#como-funciona"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-white/10 text-sm text-gray-300 hover:text-white hover:border-white/25 transition-all"
            >
              Ver como funciona
              <ChevronDown className="h-4 w-4" />
            </a>
          </div>

          <div className="mt-5 flex items-center gap-4 text-[10px] text-gray-600">
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-[#FFB366]/60" />Sem compromisso</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-[#FFB366]/60" />Setup &lt; 48h</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-[#FFB366]/60" />100% no WhatsApp</span>
          </div>
        </div>

        {/* Right: dashboard with floating cards */}
        <div className="relative hidden lg:block">
          <motion.div
            className="relative will-change-transform"
            style={{ scale: dashScale, rotate: dashRotate, y: dashY }}
          >
            <div className="absolute -inset-6 bg-[#FFB366]/[0.05] rounded-3xl blur-2xl" />
            <div
              className="relative rounded-2xl border border-[#FFB366]/20 bg-[#0d0a08]/95 p-1 overflow-hidden backdrop-blur-sm"
              style={{ boxShadow: "0 30px 80px -20px rgba(255,107,26,0.25)" }}
            >
              <div className="rounded-xl bg-[#0d0a08] p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/50" />
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500/50" />
                  </div>
                  <span className="text-[8px] text-gray-600 font-mono">app.vssales.com.br</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: "Leads Hoje", val: "47", change: "+12%", color: "#FFB366" },
                    { label: "Pipeline", val: "R$ 234k", change: "+8%", color: "#FF6B1A" },
                    { label: "Conversão", val: "23%", change: "+5pp", color: "#FFB366" },
                  ].map((m) => (
                    <div key={m.label} className="rounded-lg border border-[#1f1612] bg-[#0f0a08] p-2.5">
                      <p className="text-[8px] text-gray-500 uppercase tracking-wider">{m.label}</p>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <p className="text-base font-bold text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{m.val}</p>
                        <p className="text-[8px] font-medium" style={{ color: m.color }}>{m.change}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-[#1f1612] bg-[#0f0a08] p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[8px] text-gray-500 uppercase tracking-wider">Leads últimos 7 dias</p>
                    <p className="text-[8px] text-[#FFB366]">+34%</p>
                  </div>
                  <div className="flex items-end gap-1 h-16">
                    {[30, 45, 35, 60, 50, 75, 65].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t"
                        style={{
                          height: `${h}%`,
                          background:
                            i === 6
                              ? "linear-gradient(to top, #FFB366, #FF6B1A)"
                              : "linear-gradient(to top, #FFB36620, #FF6B1A30)",
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {[
                    { label: "Novo", count: 23, color: "#FFB366" },
                    { label: "Qualificado", count: 15, color: "#FF6B1A" },
                    { label: "Proposta", count: 8, color: "#FF8C3C" },
                    { label: "Fechado", count: 4, color: "#FFB366" },
                  ].map((s) => (
                    <div key={s.label} className="flex-1 rounded-lg border border-[#1f1612] bg-[#0f0a08] p-2 text-center">
                      <p className="text-[7px] text-gray-600 uppercase">{s.label}</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: s.color, fontFamily: "'Bebas Neue', sans-serif" }}>{s.count}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Floating event cards orbiting the dashboard */}
          <motion.div
            className="absolute -top-4 -left-6 rounded-xl border border-[#FFB366]/25 bg-[#0f0a08]/95 backdrop-blur-md p-3 shadow-xl max-w-[210px]"
            style={{ opacity: card1, y: card1Y }}
          >
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-[#FFB366]/15 flex items-center justify-center">
                <MessageCircle className="h-3.5 w-3.5 text-[#FFB366]" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-white">Novo lead qualificado</p>
                <p className="text-[9px] text-gray-500">Score 87% · agora</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="absolute top-1/2 -right-6 -translate-y-1/2 rounded-xl border border-[#FF6B1A]/25 bg-[#0f0a08]/95 backdrop-blur-md p-3 shadow-xl"
            style={{ opacity: card2, x: card2X }}
          >
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-[#FF6B1A]" />
              <div>
                <p className="text-[10px] font-semibold text-white">Reunião agendada</p>
                <p className="text-[9px] text-gray-500">Automático · 14:30</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="absolute -bottom-4 left-12 rounded-xl border border-emerald-500/25 bg-[#0f0a08]/95 backdrop-blur-md p-3 shadow-xl"
            style={{ opacity: card3, y: card3Y }}
          >
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-white">Deal fechado</p>
                <p className="text-[9px] text-gray-500">R$ 18.400 · WhatsApp</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* scroll hint */}
      <motion.div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-[10px] text-gray-600"
        style={{ opacity: hintOp }}
      >
        <span className="uppercase tracking-[0.3em]">Role para ver</span>
        <ChevronDown className="h-3 w-3 animate-bounce" />
      </motion.div>
    </div>
  );
}

/* ───────────────────────── Page ───────────────────────── */

export default function Landing() {
  const stageRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ["start start", "end end"],
  });

  // Lock body to avoid horizontal overflow during animations on resize
  useEffect(() => {
    document.body.style.overflowX = "hidden";
    return () => { document.body.style.overflowX = ""; };
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0705] text-white">
      {/* ═══ NAVBAR ═══ */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0705]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-5 h-14 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2">
            <Logo variant="dark" className="h-8 w-auto" />
            <span style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-lg tracking-[0.18em]">SALES</span>
          </a>
          <div className="hidden md:flex items-center gap-6 text-xs text-gray-400">
            <a href="#problema" className="hover:text-white transition-colors">Problema</a>
            <a href="#solucao" className="hover:text-white transition-colors">Solução</a>
            <a href="#como-funciona" className="hover:text-white transition-colors">Como funciona</a>
            <a href="#diferenciais" className="hover:text-white transition-colors">Diferenciais</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="/auth" className="text-xs font-medium px-3 sm:px-4 py-2 rounded-lg border border-white/10 text-gray-300 hover:text-white hover:border-white/25 transition-all">
              Entrar
            </a>
            <a
              href={whatsappLink("explore")}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold px-3 sm:px-4 py-2 rounded-lg bg-gradient-to-r from-[#FFB366] to-[#FF6B1A] text-[#0a0705] hover:shadow-[0_0_20px_rgba(255,107,26,0.45)] transition-all flex items-center gap-1.5"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Falar conosco
            </a>
          </div>
        </div>
      </nav>

      {/* ═══ 1. HERO STAGE (3 viewport heights, sticky inside) ═══ */}
      <section ref={stageRef} className="relative" style={{ height: "320vh" }}>
        <ScrollStage progress={scrollYProgress} />
      </section>

      {/* ═══ 2. CREDIBILIDADE ═══ */}
      <section className="py-10 sm:py-14 border-y border-[#1f1612]/60 bg-[#0d0a08]/40">
        <div className="max-w-5xl mx-auto px-4 sm:px-5">
          <Reveal>
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-center">
              {[
                { label: "Operação", value: "24/7", sub: "sem pausa" },
                { label: "Setup", value: "< 48h", sub: "para começar" },
                { label: "Custo humano", value: "−80%", sub: "vs SDR tradicional" },
                { label: "Resposta", value: "< 5 min", sub: "ao novo lead" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <p className="text-2xl sm:text-3xl font-bold text-[#FFB366]" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }}>
                    {item.value}
                  </p>
                  <div className="text-left">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider leading-tight">{item.label}</p>
                    <p className="text-[9px] text-gray-600">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 3. O PROBLEMA ═══ */}
      <section id="problema" className="py-16 sm:py-24 md:py-32 relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-5">
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#FFB366] font-medium mb-3">O problema</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl sm:text-4xl md:text-5xl tracking-tight mb-4">
              Seu time comercial está te custando<br className="hidden sm:block" />
              <span className="text-gray-500">mais do que deveria.</span>
            </h2>
            <p className="text-gray-400 text-sm max-w-xl mb-10">
              Enquanto você paga salários, encargos e treinamento, sua concorrência já automatizou o comercial inteiro.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
            {[
              { icon: Users, title: "Custo fixo alto", desc: "Um SDR no CLT pesa fácil 5 dígitos por mês — e ainda prospecta no máximo 40 leads por dia." },
              { icon: Target, title: "Qualificação inconsistente", desc: "Cada SDR usa um critério. Seu Closer perde tempo com lead que nunca ia comprar." },
              { icon: Clock, title: "Follow-up esquecido", desc: "67% dos leads são abandonados depois do primeiro contato. Dinheiro indo embora." },
              { icon: BarChart3, title: "Pipeline fictício", desc: "CRM desatualizado, forecast que não bate, decisões no achismo. Todo mês a mesma história." },
            ].map((card, i) => (
              <Reveal key={card.title} delay={i * 100}>
                <div className="group p-5 rounded-xl border border-[#1f1612] bg-[#0f0a08]/60 hover:border-red-500/25 hover:bg-red-500/[0.03] transition-all duration-300">
                  <card.icon className="h-5 w-5 text-red-400/80 mb-3" />
                  <h3 className="text-sm font-semibold text-white mb-1.5">{card.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{card.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 4. SOLUÇÃO ═══ */}
      <section id="solucao" className="py-16 sm:py-24 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#FFB366]/[0.02] to-transparent" />
        <div className="max-w-6xl mx-auto px-4 sm:px-5 relative z-10">
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#FFB366] font-medium mb-3 text-center">A solução</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl sm:text-4xl md:text-5xl tracking-tight mb-4 text-center">
              Conheça o VS SALES
            </h2>
            <p className="text-gray-400 text-sm max-w-2xl mx-auto text-center mb-12">
              Plataforma de IA que substitui SDR, BDR e Closer. Prospecta, qualifica, agenda e fecha — automatizado,
              24h por dia, 7 dias por semana.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {[
              { icon: BotMessageSquare, title: "IA Vendedora 24/7", desc: "Três agentes autônomos (SDR, BDR, Closer) que nunca dormem.", color: "#FFB366" },
              { icon: MessageCircle, title: "WhatsApp como canal", desc: "Integração nativa. Abordagem personalizada, follow-up automático.", color: "#FF6B1A" },
              { icon: BarChart3, title: "CRM que se atualiza sozinho", desc: "Pipeline em tempo real, sem digitação manual.", color: "#FFB366" },
              { icon: Brain, title: "IA que aprende seu negócio", desc: "Treine com seus documentos, FAQs e tom de voz.", color: "#FF6B1A" },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 100}>
                <div className="group p-6 rounded-xl border border-[#1f1612] bg-[#0f0a08]/60 hover:border-[#FFB366]/20 transition-all duration-300">
                  <f.icon className="h-6 w-6 mb-3" style={{ color: f.color }} />
                  <h3 className="text-sm font-semibold text-white mb-1.5">{f.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 5. COMO FUNCIONA ═══ */}
      <section id="como-funciona" className="py-16 sm:py-24 md:py-32 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-5 relative z-10">
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#FFB366] font-medium mb-3 text-center">Como funciona</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl sm:text-4xl md:text-5xl tracking-tight mb-3 text-center">
              Da prospecção ao fechamento.
            </h2>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl sm:text-4xl md:text-5xl tracking-tight mb-14 text-center text-gray-500">
              Sem intervenção humana.
            </p>
          </Reveal>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
            {[
              { emoji: "🔍", title: "Prospecção", desc: "IA mapeia leads do seu ICP em tempo real.", color: "#FFB366" },
              { emoji: "🧩", title: "Enriquecimento", desc: "Contato, empresa, cargo automáticos.", color: "#FF8C3C" },
              { emoji: "🎯", title: "Qualificação", desc: "Score 0-100. Só lead quente avança.", color: "#FF6B1A" },
              { emoji: "💬", title: "Abordagem", desc: "Mensagem personalizada via WhatsApp.", color: "#FF6B1A" },
              { emoji: "📅", title: "Agendamento", desc: "Reunião marcada sem ping-pong.", color: "#FF8C3C" },
              { emoji: "💰", title: "Fechamento", desc: "IA conduz ou encaminha ao Closer.", color: "#FFB366" },
            ].map((step, i) => (
              <Reveal key={step.title} delay={i * 100}>
                <div className="flex flex-col items-center text-center">
                  <div
                    className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border"
                    style={{
                      borderColor: `${step.color}40`,
                      backgroundColor: `${step.color}08`,
                      boxShadow: `0 0 30px ${step.color}15`,
                    }}
                  >
                    <span className="text-xl">{step.emoji}</span>
                  </div>
                  <div className="mt-3 text-[10px] font-mono font-semibold tracking-widest" style={{ color: step.color }}>
                    0{i + 1}
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-white">{step.title}</h3>
                  <p className="mt-1.5 text-xs text-gray-500 leading-relaxed max-w-[180px]">{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={500}>
            <div className="mt-16 flex items-center justify-center">
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full border border-[#FFB366]/20 bg-[#FFB366]/[0.04]">
                <div className="flex -space-x-1">
                  {["#FFB366", "#FF6B1A", "#FF8C3C"].map((c) => (
                    <div key={c} className="h-2 w-2 rounded-full" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <p className="text-xs text-gray-400">
                  Tudo isso em <span className="text-[#FFB366] font-semibold">modo 100% automático</span>
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 6. PARA QUEM É ═══ */}
      <section className="py-16 sm:py-24 md:py-32 bg-[#0d0a08]/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-5">
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#FFB366] font-medium mb-3 text-center">Para quem é</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl sm:text-4xl md:text-5xl tracking-tight mb-4 text-center">
              Pensado para quem quer vender mais<br /><span className="text-gray-500">gastando menos.</span>
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-4 mt-14">
            {[
              {
                icon: Rocket, color: "#FFB366", title: "Startups B2B",
                desc: "Você não tem verba pra contratar 3 SDRs, mas precisa de pipeline. O VS SALES é seu time inteiro por uma fração do custo.",
                scenario: '"Tínhamos 0 SDRs e precisávamos de 50 reuniões/mês. Agora temos."',
              },
              {
                icon: Building2, color: "#FF6B1A", title: "PMEs com time enxuto",
                desc: "Seu vendedor prospecta, qualifica, fecha e ainda faz pós-venda. Com o VS SALES, ele só faz o que importa: fechar.",
                scenario: '"Meu closer recebe leads quentes prontos. Triplicou a conversão."',
              },
              {
                icon: Globe, color: "#FFB366", title: "Agências que revendem",
                desc: "White-label pronto. Coloque sua marca, revenda para seus clientes e ganhe receita recorrente.",
                scenario: '"Adicionei receita recorrente revendendo o VS SALES."',
              },
            ].map((card, i) => (
              <Reveal key={card.title} delay={i * 120}>
                <div className="rounded-xl border border-[#1f1612] bg-[#0f0a08]/60 p-6 h-full flex flex-col hover:border-[#FFB366]/20 transition-all duration-300">
                  <card.icon className="h-6 w-6 mb-4" style={{ color: card.color }} />
                  <h3 className="text-base font-semibold text-white mb-2">{card.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed mb-4 flex-1">{card.desc}</p>
                  <div className="rounded-lg bg-[#FFB366]/[0.04] border border-[#FFB366]/10 p-3">
                    <p className="text-[11px] text-[#FFB366] italic leading-relaxed">{card.scenario}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 7. DIFERENCIAIS ═══ */}
      <section id="diferenciais" className="py-16 sm:py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-5">
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#FFB366] font-medium mb-3 text-center">Diferenciais</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl sm:text-4xl md:text-5xl tracking-tight mb-4 text-center">
              Tudo que você precisa.<br /><span className="text-gray-500">Nada que você não precisa.</span>
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-14">
            {[
              { icon: Search, title: "Prospecção Autônoma", desc: "Leads ideais via Google Maps, LinkedIn e web scraping. Sem trabalho manual." },
              { icon: MessageCircle, title: "WhatsApp Nativo", desc: "Integração via Evolution API. Mensagens personalizadas, não spam." },
              { icon: BarChart3, title: "CRM Inteligente", desc: "Pipeline atualizado automaticamente, com automação em cada estágio." },
              { icon: Brain, title: "IA Treinável", desc: "Ensine sua IA com documentos, FAQs e tom de voz da empresa." },
              { icon: Send, title: "Disparos em Massa", desc: "Broadcasts segmentados com variáveis dinâmicas. Zero esforço." },
              { icon: CalendarCheck, title: "Agendamento Automático", desc: "A IA marca reuniões direto na agenda do Closer." },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <div className="group p-5 rounded-xl border border-[#1f1612] bg-[#0f0a08]/60 hover:border-[#FFB366]/25 hover:bg-[#FFB366]/[0.02] transition-all duration-300">
                  <f.icon className="h-5 w-5 text-[#FFB366] mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="text-sm font-semibold text-white mb-1.5">{f.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 8. COMPARATIVO (sem preços) ═══ */}
      <section id="comparativo" className="py-16 sm:py-24 md:py-32 bg-[#0d0a08]/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-5">
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#FFB366] font-medium mb-3 text-center">Comparativo</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl sm:text-4xl md:text-5xl tracking-tight mb-14 text-center">
              Time Humano <span className="text-gray-500">vs</span> VS SALES
            </h2>
          </Reveal>

          <Reveal>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-4 text-gray-500 text-xs font-medium" />
                    <th className="p-4 text-center text-gray-400 text-xs font-medium">Time Humano</th>
                    <th className="p-4 text-center rounded-t-xl border-t border-x border-[#FFB366]/30 bg-[#FFB366]/[0.04]">
                      <span className="text-xs font-semibold text-[#FFB366]">VS SALES</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {[
                    ["Horário de operação", "8h/dia, seg-sex", "24/7/365"],
                    ["Consistência", "Depende do humor", "100% todo dia"],
                    ["Escalabilidade", "Contratar + treinar (90 dias)", "Imediata (< 48h)"],
                    ["Integração CRM", "Manual (se fizer)", "Automática em tempo real"],
                    ["Tempo de ramp-up", "30-90 dias", "< 48 horas"],
                    ["Follow-up", "Esquecido em 67% dos casos", "100% garantido"],
                    ["Férias / 13º / Encargos", "Sim", "Não"],
                  ].map(([feature, human, vs]) => (
                    <tr key={feature} className="border-b border-[#1f1612]/50">
                      <td className="p-4 text-gray-400 font-medium">{feature}</td>
                      <td className="p-4 text-center text-gray-500">{human}</td>
                      <td className="p-4 text-center border-x border-[#FFB366]/30 bg-[#FFB366]/[0.04] text-white font-medium">{vs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 9. CONVERSAÇÃO (substitui Planos) ═══ */}
      <section id="conversar" className="py-16 sm:py-24 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full blur-[140px]"
            style={{ background: "radial-gradient(closest-side, rgba(255,107,26,0.18), transparent)" }} />
        </div>
        <div className="max-w-3xl mx-auto px-4 sm:px-5 relative z-10">
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#FFB366] font-medium mb-3 text-center">Próximo passo</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl sm:text-4xl md:text-5xl tracking-tight mb-4 text-center">
              Bora trocar uma ideia<br />
              <span className="bg-gradient-to-r from-[#FFB366] to-[#FF6B1A] bg-clip-text text-transparent">no WhatsApp?</span>
            </h2>
            <p className="text-gray-400 text-sm text-center max-w-xl mx-auto mb-10">
              Sem formulário, sem ligação fria, sem pegadinha. Você escolhe por onde quer começar a conversa
              e a gente te responde como gente — porque é gente do outro lado.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-3 gap-3 mb-6">
            {[
              { intent: "explore" as const, label: "Quero entender melhor", icon: Sparkles, hint: "Ainda tô pesquisando" },
              { intent: "demo" as const, label: "Quero ver na prática", icon: Eye, hint: "Mostra a plataforma rodando" },
              { intent: "start" as const, label: "Já decidi, bora começar", icon: Rocket, hint: "Quero ativar minha conta" },
            ].map((opt, i) => (
              <Reveal key={opt.intent} delay={i * 120}>
                <a
                  href={whatsappLink(opt.intent)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block h-full rounded-2xl border border-[#1f1612] bg-[#0f0a08]/70 p-5 hover:border-[#FFB366]/40 hover:bg-[#FFB366]/[0.03] transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-9 w-9 rounded-lg bg-[#FFB366]/12 flex items-center justify-center group-hover:bg-[#FFB366]/20 transition-colors">
                      <opt.icon className="h-4 w-4 text-[#FFB366]" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-gray-600 group-hover:text-[#FFB366] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="text-sm font-semibold text-white mb-1">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.hint}</p>
                </a>
              </Reveal>
            ))}
          </div>

          <Reveal delay={400}>
            <div className="rounded-2xl border border-[#FFB366]/25 bg-[#0f0a08]/80 backdrop-blur-sm p-6 sm:p-8"
              style={{ boxShadow: "0 0 60px rgba(255,107,26,0.06)" }}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 justify-between">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#FFB366] to-[#FF6B1A] flex items-center justify-center shrink-0">
                    <MessageCircle className="h-5 w-5 text-[#0a0705]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white mb-1">Falar direto com a equipe VS</p>
                    <p className="text-xs text-gray-400 leading-relaxed max-w-md">
                      Resposta humana em horário comercial. Costumamos responder em poucos minutos —
                      sem robô, sem filas, sem ser tratado como número.
                    </p>
                  </div>
                </div>
                <a
                  href={whatsappLink("explore")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-gradient-to-r from-[#FFB366] to-[#FF6B1A] text-[#0a0705] text-sm font-semibold hover:shadow-[0_0_30px_rgba(255,107,26,0.45)] transition-all"
                >
                  <MessageCircle className="h-4 w-4" />
                  Abrir conversa
                </a>
              </div>
            </div>
          </Reveal>

          <p className="text-[10px] text-gray-600 text-center mt-6">
            🔒 A gente não vende seu contato, não enche de email e não passa pra ninguém. Promessa.
          </p>
        </div>
      </section>

      {/* ═══ 10. FAQ ═══ */}
      <section id="faq" className="py-16 sm:py-24 md:py-32 bg-[#0d0a08]/40">
        <div className="max-w-2xl mx-auto px-4 sm:px-5">
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#FFB366] font-medium mb-3 text-center">Perguntas frequentes</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl sm:text-4xl md:text-4xl tracking-tight mb-10 text-center">
              Tire suas dúvidas
            </h2>
          </Reveal>

          <div className="space-y-2">
            {[
              { q: "Como funciona o investimento?", a: "Nada de tabela genérica. A gente conversa, entende o porte da sua operação, o volume de leads que faz sentido pra você e monta uma proposta sob medida. Tudo no WhatsApp, sem compromisso." },
              { q: "O VS SALES substitui 100% do meu time comercial?", a: "Para operações com ticket até R$ 5.000, sim — prospecção, qualificação e fechamento ficam 100% automatizados. Para tickets maiores, recomendamos que um Closer humano assuma a etapa final após a qualificação da IA." },
              { q: "Quanto tempo leva para começar?", a: "Menos de 48 horas após o aceite. O onboarding é guiado: você cadastra a empresa, define o ICP, conecta o WhatsApp e a IA já entra em operação." },
              { q: "Funciona pro meu segmento?", a: "Sim. O VS SALES se adapta a qualquer segmento B2B ou B2C. Você define o perfil ideal de cliente e os critérios de qualificação — a IA faz o resto." },
              { q: "E se o lead não quiser falar com IA?", a: "Tudo configurável. Você define que leads acima de um score sejam direcionados direto pra um humano, sem passar pela IA de fechamento." },
              { q: "Preciso ter WhatsApp Business?", a: "Você precisa de um número de WhatsApp dedicado. A integração é via Evolution API e opera de forma autônoma, sem precisar do celular ligado." },
              { q: "Posso cancelar quando quiser?", a: "Sem contrato longo, sem multa, sem fidelidade. Cancele com um aviso simples quando quiser." },
              { q: "Como é diferente de um chatbot?", a: "Chatbots seguem scripts fixos. O VS SALES usa IA treinável que entende contexto, personaliza abordagens, qualifica com score inteligente e conduz negociações completas. É um vendedor, não um robô de FAQ." },
            ].map((item) => (
              <Reveal key={item.q}>
                <FAQItem question={item.q} answer={item.a} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 11. CTA FINAL ═══ */}
      <section className="py-20 sm:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#FFB366]/[0.03] to-transparent" />
        <div className="max-w-3xl mx-auto px-4 sm:px-5 relative z-10 text-center">
          <Reveal>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-4xl sm:text-5xl md:text-6xl tracking-tight mb-4">
              Sua concorrência já vai usar.<br />
              <span className="bg-gradient-to-r from-[#FFB366] to-[#FF6B1A] bg-clip-text text-transparent">Você vai esperar?</span>
            </h2>
            <p className="text-sm sm:text-base text-gray-400 mb-8 max-w-xl mx-auto">
              Manda um "oi" pra gente. Sem cartão, sem formulário, sem pressão.
              A gente conta como funciona, mostra na prática e você decide no seu tempo.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <WAButton intent="explore" className="text-base px-7 py-4">
                Chamar no WhatsApp
                <ArrowRight className="h-4 w-4" />
              </WAButton>
              <a href="#como-funciona" className="text-sm text-gray-400 hover:text-white transition-colors">
                Ou role pra cima e veja como funciona ↑
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-[#1f1612] py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
            <div className="flex items-center gap-3">
              <Logo variant="dark" className="h-7 w-auto" />
              <div>
                <span className="text-xs font-semibold text-white">VS Soluções</span>
                <span className="text-[10px] text-gray-600 ml-2 hidden sm:inline">Tecnologia que substitui. Resultado que comprova.</span>
              </div>
            </div>
            <div className="flex items-center gap-4 sm:gap-6 text-[10px] text-gray-600 flex-wrap justify-center">
              <a href="#" className="hover:text-gray-400 transition-colors">Privacidade</a>
              <a href="#" className="hover:text-gray-400 transition-colors">Termos</a>
              <a href={whatsappLink("explore")} target="_blank" rel="noopener noreferrer" className="hover:text-[#FFB366] transition-colors">Contato</a>
              <a href="/auth" className="hover:text-[#FFB366] transition-colors">Entrar</a>
              <a href="/admin" className="hover:text-[#FFB366] transition-colors flex items-center gap-1">
                <Shield className="h-3 w-3" />Admin
              </a>
            </div>
          </div>
          <p className="text-[10px] text-gray-700 text-center mt-6">© 2026 VS Soluções. Todos os direitos reservados.</p>
        </div>
      </footer>

      <style>{`html { scroll-behavior: smooth; }`}</style>
    </div>
  );
}

/* tiny inline icon since we don't import Eye from lucide above */
function Eye({ className = "" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
