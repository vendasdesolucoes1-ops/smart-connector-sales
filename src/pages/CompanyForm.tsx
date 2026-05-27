import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2, Package, Target, HelpCircle, Globe, Plus, X,
  Loader2, CheckCircle2, Sparkles, Send
} from "lucide-react";
import { Logo } from "@/components/Logo";
import kayronLogo from "@/assets/kayron-logo-full-light.png";

interface FormData {
  company_name: string;
  segment: string;
  cnpj: string;
  founded_year: string;
  description: string;
  mission: string;
  vision: string;
  values: string;
  team_size: string;
  avg_ticket: string;
  target_audience: string;
  differentials: string;
  tone_of_voice: string;
  sales_process: string;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  linkedin: string;
  facebook: string;
  address: string;
  products_services: { name: string; description: string; price: string }[];
  objections_faq: { question: string; answer: string }[];
}

const emptyForm: FormData = {
  company_name: "", segment: "", cnpj: "", founded_year: "", description: "",
  mission: "", vision: "", values: "", team_size: "", avg_ticket: "",
  target_audience: "", differentials: "", tone_of_voice: "", sales_process: "",
  phone: "", email: "", website: "", instagram: "", linkedin: "", facebook: "",
  address: "",
  products_services: [{ name: "", description: "", price: "" }],
  objections_faq: [{ question: "", answer: "" }],
};

export default function CompanyForm() {
  const { token } = useParams<{ token: string }>();
  const [form, setForm] = useState<FormData>(emptyForm);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidToken, setInvalidToken] = useState(false);

  useEffect(() => {
    // Validate token exists
    if (!token) { setInvalidToken(true); return; }
    // We'll validate on submit via the edge function
  }, [token]);

  const updateField = (field: keyof FormData, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const addProduct = () => updateField("products_services", [...form.products_services, { name: "", description: "", price: "" }]);
  const removeProduct = (i: number) => updateField("products_services", form.products_services.filter((_, idx) => idx !== i));
  const updateProduct = (i: number, f: string, v: string) => {
    const updated = [...form.products_services];
    (updated[i] as any)[f] = v;
    updateField("products_services", updated);
  };

  const addFaq = () => updateField("objections_faq", [...form.objections_faq, { question: "", answer: "" }]);
  const removeFaq = (i: number) => updateField("objections_faq", form.objections_faq.filter((_, idx) => idx !== i));
  const updateFaq = (i: number, f: string, v: string) => {
    const updated = [...form.objections_faq];
    (updated[i] as any)[f] = v;
    updateField("objections_faq", updated);
  };

  const handleSubmit = async () => {
    if (!form.company_name.trim()) {
      setError("O nome da empresa é obrigatório.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        ...form,
        founded_year: form.founded_year ? Number(form.founded_year) : null,
        products_services: form.products_services.filter(p => p.name.trim()),
        objections_faq: form.objections_faq.filter(f => f.question.trim()),
      };

      const { data, error: fnErr } = await supabase.functions.invoke("process-company-form", {
        body: { form_token: token, data: payload },
      });

      if (fnErr || data?.error) {
        setError(data?.error || fnErr?.message || "Erro ao enviar formulário.");
      } else {
        setSubmitted(true);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setSubmitting(false);
  };

  if (invalidToken) {
    return (
      <div className="min-h-screen bg-[#0a0705] flex items-center justify-center p-4">
        <div className="text-center">
          <X className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Link inválido</h1>
          <p className="text-sm text-gray-400">Este link de formulário não é válido ou expirou.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a0705] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="h-16 w-16 rounded-2xl bg-[#00FF88]/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-8 w-8 text-[#00FF88]" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Formulário enviado!</h1>
          <p className="text-sm text-gray-400 mb-2">
            Seus dados foram recebidos e estão sendo processados pela nossa IA para otimizar o perfil da sua empresa.
          </p>
          <div className="flex flex-col items-center gap-2 mt-6">
            <img src={kayronLogo} alt="Kayron Agency" className="h-5 opacity-60" />
            <p className="text-[10px] text-gray-500">Uma colaboração entre <span className="text-gray-400 font-medium">Kayron Agency</span> & <span className="text-gray-400 font-medium">VS Labs</span></p>
          </div>
        </div>
      </div>
    );
  }

  const steps = [
    { title: "Identidade", icon: Building2, color: "#FFB366" },
    { title: "Produtos", icon: Package, color: "#00FF88" },
    { title: "Estratégia", icon: Target, color: "#FFB800" },
    { title: "Objeções", icon: HelpCircle, color: "#FF4444" },
    { title: "Contato", icon: Globe, color: "#FF6B1A" },
  ];

  const inputClass = "w-full h-10 px-4 rounded-xl bg-[#0a0705] border border-[#1f1612] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FFB366]/40 transition-colors";
  const textareaClass = "w-full px-4 py-3 rounded-xl bg-[#0a0705] border border-[#1f1612] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FFB366]/40 resize-none transition-colors";
  const labelClass = "text-[11px] text-gray-400 uppercase tracking-wider mb-1.5 block font-medium";

  return (
    <div className="min-h-screen bg-[#0a0705] text-white">
      {/* Header */}
      <div className="border-b border-[#1f1612] bg-[#0a0705]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={kayronLogo} alt="Kayron Agency" className="h-7" />
            <div>
              <p className="text-sm font-semibold">Perfil da Empresa</p>
              <p className="text-[10px] text-gray-500">Preencha para configurar sua IA de vendas</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#FFB366]" />
            <span className="text-[10px] text-[#FFB366]">IA aprimorará suas respostas</span>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-2">
        <div className="flex items-center gap-1">
          {steps.map((s, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className="flex-1 group"
            >
              <div
                className="h-1 rounded-full transition-all duration-300"
                style={{ background: i <= step ? s.color : "#1f1612" }}
              />
              <div className="flex items-center gap-1 mt-2 justify-center">
                <s.icon className="h-3 w-3" style={{ color: i <= step ? s.color : "#333" }} />
                <span className="text-[9px] font-medium" style={{ color: i <= step ? s.color : "#444" }}>
                  {s.title}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Form content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Step 0: Identity */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold mb-1">Sobre sua empresa</h2>
            <p className="text-xs text-gray-500 mb-4">Informações básicas sobre a identidade do seu negócio.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Nome da Empresa *</label>
                <input value={form.company_name} onChange={e => updateField("company_name", e.target.value)} className={inputClass} placeholder="Ex: Minha Empresa" />
              </div>
              <div>
                <label className={labelClass}>Segmento</label>
                <input value={form.segment} onChange={e => updateField("segment", e.target.value)} className={inputClass} placeholder="Ex: Tecnologia B2B" />
              </div>
              <div>
                <label className={labelClass}>CNPJ</label>
                <input value={form.cnpj} onChange={e => updateField("cnpj", e.target.value)} className={inputClass} placeholder="00.000.000/0000-00" />
              </div>
              <div>
                <label className={labelClass}>Ano de Fundação</label>
                <input type="number" value={form.founded_year} onChange={e => updateField("founded_year", e.target.value)} className={inputClass} placeholder="2020" />
              </div>
            </div>
            <div>
              <label className={labelClass}>O que sua empresa faz?</label>
              <textarea rows={3} value={form.description} onChange={e => updateField("description", e.target.value)} className={textareaClass} placeholder="Descreva em poucas palavras o que sua empresa faz e qual problema resolve..." />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Missão</label>
                <textarea rows={2} value={form.mission} onChange={e => updateField("mission", e.target.value)} className={textareaClass} placeholder="Qual o propósito?" />
              </div>
              <div>
                <label className={labelClass}>Visão</label>
                <textarea rows={2} value={form.vision} onChange={e => updateField("vision", e.target.value)} className={textareaClass} placeholder="Onde quer chegar?" />
              </div>
              <div>
                <label className={labelClass}>Valores</label>
                <textarea rows={2} value={form.values} onChange={e => updateField("values", e.target.value)} className={textareaClass} placeholder="O que guia a empresa?" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Tamanho da Equipe</label>
                <input value={form.team_size} onChange={e => updateField("team_size", e.target.value)} className={inputClass} placeholder="Ex: 10-50 colaboradores" />
              </div>
              <div>
                <label className={labelClass}>Ticket Médio</label>
                <input value={form.avg_ticket} onChange={e => updateField("avg_ticket", e.target.value)} className={inputClass} placeholder="Ex: R$ 2.000/mês" />
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Products */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold mb-1">Produtos & Serviços</h2>
                <p className="text-xs text-gray-500">Liste o que você vende ou oferece.</p>
              </div>
              <button onClick={addProduct} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00FF88]/10 text-[#00FF88] text-xs hover:bg-[#00FF88]/20 transition-colors border border-[#00FF88]/20">
                <Plus className="h-3 w-3" /> Adicionar
              </button>
            </div>
            {form.products_services.map((p, i) => (
              <div key={i} className="p-4 rounded-xl border border-[#1f1612] bg-[#0a0705]/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 font-medium">Produto/Serviço {i + 1}</span>
                  {form.products_services.length > 1 && (
                    <button onClick={() => removeProduct(i)} className="text-gray-600 hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input value={p.name} onChange={e => updateProduct(i, "name", e.target.value)} className={inputClass} placeholder="Nome do produto" />
                  <input value={p.price} onChange={e => updateProduct(i, "price", e.target.value)} className={inputClass} placeholder="Preço (ex: R$ 997)" />
                </div>
                <textarea rows={2} value={p.description} onChange={e => updateProduct(i, "description", e.target.value)} className={textareaClass} placeholder="Descreva brevemente o que é e para quem serve..." />
              </div>
            ))}
          </div>
        )}

        {/* Step 2: Strategy */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold mb-1">Estratégia Comercial</h2>
            <p className="text-xs text-gray-500 mb-4">Informações sobre como você vende e para quem.</p>
            <div>
              <label className={labelClass}>Quem é seu cliente ideal?</label>
              <textarea rows={3} value={form.target_audience} onChange={e => updateField("target_audience", e.target.value)} className={textareaClass} placeholder="Descreva o perfil do seu cliente ideal: segmento, porte, cargo do decisor..." />
            </div>
            <div>
              <label className={labelClass}>O que diferencia sua empresa?</label>
              <textarea rows={3} value={form.differentials} onChange={e => updateField("differentials", e.target.value)} className={textareaClass} placeholder="Por que os clientes escolhem você ao invés da concorrência?" />
            </div>
            <div>
              <label className={labelClass}>Como você quer que a IA se comunique?</label>
              <textarea rows={2} value={form.tone_of_voice} onChange={e => updateField("tone_of_voice", e.target.value)} className={textareaClass} placeholder="Ex: Profissional e consultivo, direto ao ponto, amigável..." />
            </div>
            <div>
              <label className={labelClass}>Descreva seu processo de vendas</label>
              <textarea rows={3} value={form.sales_process} onChange={e => updateField("sales_process", e.target.value)} className={textareaClass} placeholder="Quais etapas o lead passa até virar cliente? Prospecção → Qualificação → Proposta → Fechamento..." />
            </div>
          </div>
        )}

        {/* Step 3: Objections */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold mb-1">Objeções & Perguntas Frequentes</h2>
                <p className="text-xs text-gray-500">O que os clientes costumam perguntar ou questionar?</p>
              </div>
              <button onClick={addFaq} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF4444]/10 text-[#FF4444] text-xs hover:bg-[#FF4444]/20 transition-colors border border-[#FF4444]/20">
                <Plus className="h-3 w-3" /> Adicionar
              </button>
            </div>
            {form.objections_faq.map((f, i) => (
              <div key={i} className="p-4 rounded-xl border border-[#1f1612] bg-[#0a0705]/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 font-medium">Objeção/Pergunta {i + 1}</span>
                  {form.objections_faq.length > 1 && (
                    <button onClick={() => removeFaq(i)} className="text-gray-600 hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
                  )}
                </div>
                <input value={f.question} onChange={e => updateFaq(i, "question", e.target.value)} className={inputClass} placeholder="Ex: É muito caro, não tenho budget agora..." />
                <textarea rows={2} value={f.answer} onChange={e => updateFaq(i, "answer", e.target.value)} className={textareaClass} placeholder="Como você contorna essa objeção?" />
              </div>
            ))}
          </div>
        )}

        {/* Step 4: Contact */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold mb-1">Contato & Redes</h2>
            <p className="text-xs text-gray-500 mb-4">Informações de contato e presença online.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Telefone / WhatsApp</label>
                <input value={form.phone} onChange={e => updateField("phone", e.target.value)} className={inputClass} placeholder="+55 11 99999-9999" />
              </div>
              <div>
                <label className={labelClass}>E-mail</label>
                <input value={form.email} onChange={e => updateField("email", e.target.value)} className={inputClass} placeholder="contato@empresa.com" />
              </div>
              <div>
                <label className={labelClass}>Website</label>
                <input value={form.website} onChange={e => updateField("website", e.target.value)} className={inputClass} placeholder="https://www.empresa.com" />
              </div>
              <div>
                <label className={labelClass}>Instagram</label>
                <input value={form.instagram} onChange={e => updateField("instagram", e.target.value)} className={inputClass} placeholder="@empresa" />
              </div>
              <div>
                <label className={labelClass}>LinkedIn</label>
                <input value={form.linkedin} onChange={e => updateField("linkedin", e.target.value)} className={inputClass} placeholder="linkedin.com/company/empresa" />
              </div>
              <div>
                <label className={labelClass}>Facebook</label>
                <input value={form.facebook} onChange={e => updateField("facebook", e.target.value)} className={inputClass} placeholder="facebook.com/empresa" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Endereço</label>
              <input value={form.address} onChange={e => updateField("address", e.target.value)} className={inputClass} placeholder="Rua, número, cidade - estado" />
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#1f1612]">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="px-5 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Voltar
          </button>

          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-6 py-2.5 rounded-xl bg-[#FF6B1A] text-white text-sm font-medium hover:bg-[#FF6B1A]/80 transition-colors"
            >
              Próximo →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#00FF88] to-[#FFB366] text-[#0a0705] text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processando com IA...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Enviar Formulário
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-2xl mx-auto px-4 py-6 mt-4 border-t border-[#1f1612]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <img src={kayronLogo} alt="Kayron Agency" className="h-5 opacity-60" />
            <span className="text-[10px] text-gray-600">&</span>
            <Logo className="h-5 w-auto opacity-60" />
          </div>
          <p className="text-[10px] text-gray-500 text-center">
            Uma colaboração entre <span className="text-gray-400 font-medium">Kayron Agency</span> & <span className="text-gray-400 font-medium">VS Labs</span>
          </p>
        </div>
      </div>
    </div>
  );
}
