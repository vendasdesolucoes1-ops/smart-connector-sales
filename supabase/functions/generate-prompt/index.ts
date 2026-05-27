import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: profile } = await supabase.from("profiles").select("org_id").eq("user_id", user.id).single();
    if (!profile?.org_id) throw new Error("No org");

    const { user_description, scenario_key } = await req.json();
    if (!user_description || !scenario_key) throw new Error("Missing user_description or scenario_key");

    const { data: company } = await supabase.from("company_profiles").select("*").eq("org_id", profile.org_id).maybeSingle();

    const companyCtx = company ? `
DADOS DA EMPRESA:
- Nome: ${company.company_name || "Não informado"}
- Segmento: ${company.segment || "Não informado"}
- Descrição: ${company.description || "Não informado"}
- Tom de Voz: ${company.tone_of_voice || "Não informado"}
- Público-Alvo: ${company.target_audience || "Não informado"}
- Diferenciais: ${company.differentials || "Não informado"}
- Processo de Vendas: ${company.sales_process || "Não informado"}
- Ticket Médio: ${company.avg_ticket || "Não informado"}
- Produtos: ${JSON.stringify((company.products_services || []).slice(0, 10))}
- Objeções: ${JSON.stringify((company.objections_faq || []).slice(0, 10))}
` : "Dados da empresa não encontrados.";

    const scenarioLabels: Record<string, string> = {
      outbound_prospecting: "Prospecção Outbound — abordagem de empresas raspadas. Tom B2B, qualificação e agendamento de reuniões.",
      broadcast_own_base: "Disparo Base Própria — mensagem para leads frios da base do usuário. Tom personalizado.",
      broadcast_whatsapp: "Disparo WhatsApp (Grupos) — abordagem de leads extraídos de grupos. Apresentação e qualificação.",
      organic_inbound: "Atendimento Orgânico — leads que chamam no WhatsApp espontaneamente. Receptivo e qualificação.",
    };

    const systemPrompt = `Você é um especialista em criação de prompts de sistema para agentes de vendas por WhatsApp.

Seu trabalho é gerar um prompt de sistema COMPLETO, PROFISSIONAL e PRONTO PARA USO.

A PRIORIDADE MÁXIMA é a DESCRIÇÃO DO USUÁRIO abaixo. O usuário vai descrever exatamente o que quer que o agente faça, o tom, as regras e o comportamento. Você deve seguir fielmente o que ele pediu.

Os dados da empresa servem APENAS como contexto complementar — use-os para enriquecer o prompt com nomes de produtos, diferenciais e informações reais, MAS sem substituir ou ignorar as instruções do usuário.

CENÁRIO: ${scenarioLabels[scenario_key] || scenario_key}

${companyCtx}

REGRAS OBRIGATÓRIAS DO PROMPT GERADO:
1. O prompt deve ser em português brasileiro
2. SIGA FIELMENTE o que o usuário descreveu — tom, regras, comportamento, restrições
3. Use os dados da empresa (produtos, preços, diferenciais) para complementar, NÃO para substituir
4. Deve ser específico para o cenário "${scenarioLabels[scenario_key] || scenario_key}"
5. O prompt deve ter entre 500 e 1500 caracteres — conciso mas completo
6. NÃO coloque explicações antes ou depois do prompt. Retorne APENAS o prompt pronto.
7. O prompt deve começar com "Você é..." definindo o papel do agente
8. NÃO inclua instruções de formato de resposta (blocos, emojis) — isso é injetado automaticamente
9. Se o usuário NÃO mencionou algo específico, aí sim use os dados da empresa para preencher lacunas

IMPORTANTE: Retorne SOMENTE o prompt final, sem comentários, sem explicações, sem blocos de código.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: user_description }],
        stream: false,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI error:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI generation failed");
    }

    const aiData = await aiResp.json();
    const generatedPrompt = aiData.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ prompt: generatedPrompt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-prompt error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
