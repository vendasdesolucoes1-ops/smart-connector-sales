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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is authenticated
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, org_id, mode } = await req.json();
    // mode: "assistant" (internal helper) | "generate_message" (prospecting copy)

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the user belongs to the requested org
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("org_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile || profile.org_id !== org_id) {
      return new Response(JSON.stringify({ error: "Forbidden: not a member of this organization" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch AI config for this org + mode
    const configType = mode === "generate_message" ? "messages" : "assistant";
    const { data: aiConfig } = await supabaseAdmin
      .from("ai_configs")
      .select("*")
      .eq("org_id", org_id)
      .eq("config_type", configType)
      .maybeSingle();

    // Fetch company profile for deep context
    const { data: companyProfile } = await supabaseAdmin
      .from("company_profiles")
      .select("*")
      .eq("org_id", org_id)
      .maybeSingle();

    let companyContext = "";
    if (companyProfile) {
      const cp = companyProfile as any;
      const parts: string[] = [];
      if (cp.company_name) parts.push(`Empresa: ${cp.company_name}`);
      if (cp.segment) parts.push(`Segmento: ${cp.segment}`);
      if (cp.description) parts.push(`Sobre: ${cp.description}`);
      if (cp.mission) parts.push(`Missão: ${cp.mission}`);
      if (cp.target_audience) parts.push(`Público-alvo: ${cp.target_audience}`);
      if (cp.differentials) parts.push(`Diferenciais: ${cp.differentials}`);
      if (cp.tone_of_voice) parts.push(`Tom de voz: ${cp.tone_of_voice}`);
      if (cp.sales_process) parts.push(`Processo de vendas: ${cp.sales_process}`);
      if (cp.avg_ticket) parts.push(`Ticket médio: ${cp.avg_ticket}`);
      const products = cp.products_services || [];
      if (products.length > 0) {
        parts.push("Produtos/Serviços:\n" + products.map((p: any) => `- ${p.name}${p.price ? ` (${p.price})` : ""}: ${p.description}`).join("\n"));
      }
      const faqs = cp.objections_faq || [];
      if (faqs.length > 0) {
        parts.push("Objeções e respostas:\n" + faqs.map((f: any) => `Q: ${f.question}\nR: ${f.answer}`).join("\n\n"));
      }
      if (cp.website) parts.push(`Site: ${cp.website}`);
      if (cp.phone) parts.push(`Telefone: ${cp.phone}`);
      if (cp.email) parts.push(`Email: ${cp.email}`);
      companyContext = `\n\n--- PERFIL DA EMPRESA ---\n${parts.join("\n")}\n--- FIM DO PERFIL ---`;
    }

    // Smart knowledge retrieval using keywords
    const userQuery = messages[messages.length - 1]?.content?.toLowerCase() || "";
    const queryWords = userQuery.split(/\W+/).filter((w: string) => w.length > 3);

    // Fetch all processed docs with keywords
    const { data: kbDocs } = await supabaseAdmin
      .from("ai_knowledge_docs")
      .select("title, content, summary, keywords, chunks, processed")
      .eq("org_id", org_id);

    let knowledgeContext = "";
    if (kbDocs?.length) {
      // Score docs by keyword overlap with user query
      const scoredDocs = kbDocs.map((doc: any) => {
        let score = 0;
        if (doc.processed && doc.keywords?.length) {
          for (const kw of doc.keywords) {
            if (queryWords.some((qw: string) => kw.includes(qw) || qw.includes(kw))) {
              score += 2;
            }
          }
          // Also check title match
          const titleWords = doc.title.toLowerCase().split(/\W+/);
          for (const tw of titleWords) {
            if (queryWords.some((qw: string) => tw.includes(qw) || qw.includes(tw))) {
              score += 3;
            }
          }
        } else {
          score = 1; // unprocessed docs get base score
        }
        return { ...doc, score };
      });

      // Sort by relevance, take top docs
      scoredDocs.sort((a: any, b: any) => b.score - a.score);
      const relevantDocs = scoredDocs.filter((d: any) => d.score > 0).slice(0, 5);

      // For processed docs, find the most relevant chunks
      const contextParts: string[] = [];
      for (const doc of relevantDocs) {
        if (doc.processed && doc.chunks?.length) {
          // Score chunks by local keyword overlap
          const scoredChunks = doc.chunks.map((chunk: any) => {
            let chunkScore = 0;
            const chunkText = (chunk.text || "").toLowerCase();
            for (const qw of queryWords) {
              if (chunkText.includes(qw)) chunkScore++;
            }
            return { ...chunk, chunkScore };
          });
          scoredChunks.sort((a: any, b: any) => b.chunkScore - a.chunkScore);
          const topChunks = scoredChunks.slice(0, 3);
          const chunkTexts = topChunks.map((c: any) => c.text).join("\n\n");
          contextParts.push(`## ${doc.title}\n${doc.summary ? `Resumo: ${doc.summary}\n\n` : ""}${chunkTexts}`);
        } else {
          // Unprocessed: include full content (truncated)
          contextParts.push(`## ${doc.title}\n${doc.content.substring(0, 2000)}`);
        }
      }

      // If no relevant docs found, include summaries of all docs
      if (relevantDocs.length === 0 && kbDocs.length > 0) {
        for (const doc of kbDocs.slice(0, 10)) {
          contextParts.push(`## ${(doc as any).title}\n${(doc as any).summary || (doc as any).content.substring(0, 500)}`);
        }
      }

      if (contextParts.length > 0) {
        knowledgeContext = `\n\n--- BASE DE CONHECIMENTO (trechos relevantes) ---\n${contextParts.join("\n\n")}\n--- FIM DA BASE ---`;
      }
    }

    let systemPrompt = "";

    if (mode === "generate_message") {
      const msgType = messages[messages.length - 1]?.content?.match(/\[TIPO:(.*?)\]/)?.[1]?.trim() || "whatsapp";
      const channelInstructions: Record<string, string> = {
        whatsapp: `Canal: WhatsApp
- Máximo 300 caracteres por mensagem
- Use quebras de linha para legibilidade
- Emojis com moderação (1-2 por mensagem)
- Tom conversacional e direto
- Primeira mensagem deve gerar curiosidade
- CTA claro (responder, agendar, link)`,
        linkedin: `Canal: LinkedIn (InMail / Mensagem Direta)
- Tom profissional e consultivo
- Referencie algo específico do perfil do lead
- Máximo 500 caracteres
- Sem emojis excessivos (máx 1)
- Mencione conexões em comum ou interesses mútuos quando possível
- CTA suave (pergunta aberta, convite para conversa)`,
        email: `Canal: Email de Prospecção
- Assunto impactante (máx 50 chars, gere 3 opções)
- Abertura personalizada (sem "Prezado", sem "Espero que esteja bem")
- Corpo conciso (máx 150 palavras)
- Destaque 1 benefício claro com prova social
- CTA específico com data/horário sugerido
- PS opcional com gatilho de urgência/escassez`,
        cold_call: `Canal: Script para Ligação Fria
- Abertura em 10 segundos (nome + empresa + motivo)
- Pergunta de qualificação logo no início
- 3 respostas para objeções comuns (não tenho tempo, já tenho fornecedor, mande por email)
- Pitch de 30 segundos focado em dor do cliente
- Técnica de fechamento para agendar reunião
- Tom confiante mas não agressivo`,
      };

      systemPrompt = `Você é um especialista sênior em copywriting comercial, vendas consultivas e prospecção B2B/B2C multi-segmento.

${aiConfig?.system_prompt || ""}

${channelInstructions[msgType] || channelInstructions.whatsapp}

REGRAS DE OURO:
1. PERSONALIZAÇÃO: Use TODAS as informações do lead fornecidas. Não seja genérico.
2. VALOR PRIMEIRO: Lidere com o benefício para o lead, não com features do produto.
3. GATILHOS MENTAIS: Use prova social, escassez, autoridade ou reciprocidade naturalmente.
4. SEM JARGÃO: Evite "solução", "inovador", "disruptivo". Use linguagem do dia-a-dia do lead.
5. GERE 3 VARIAÇÕES distintas: (A) Direta/urgente (B) Consultiva/educativa (C) Social proof/case
6. Formate em Markdown com headers para cada variação.
7. Inclua ao final uma análise de 2 has sobre qual variação usar em cada situação.${companyContext}${knowledgeContext}`;
    } else if (mode === "enrich_analysis") {
      systemPrompt = `Você é um analista de inteligência comercial sênior especializado em pesquisa B2B.

${aiConfig?.system_prompt || ""}

Analise o lead fornecido e gere insights acionáveis:

FRAMEWORK DE ANÁLISE:
1. **Perfil Empresarial**: Segmento, porte estimado, maturidade digital
2. **Persona**: Cargo, nível de decisão, dores prováveis, motivações
3. **Timing**: Sinais de compra, sazonalidade do segmento, momento ideal de abordagem
4. **Abordagem Recomendada**: Canal preferido, tom, argumentos-chave
5. **Score de Prioridade**: 0-100 com justificativa
6. **Riscos**: Objeções prováveis e como contorná-las

Responda em Markdown estruturado. Seja específico e acionável — evite generalidades.${companyContext}${knowledgeContext}`;
    } else {
      systemPrompt = `Você é um estrategista de vendas de alta performance integrado ao CRM da equipe.

${aiConfig?.system_prompt || ""}

CAPACIDADES:
- Análise profunda de leads com recomendações de abordagem personalizadas
- Diagnóstico de pipeline: gargalos, oportunidades perdidas, previsão de fechamento
- Criação de playbooks de vendas baseados no segmento do cliente
- Análise de objeções e scripts de contorno
- Coaching de vendas em tempo real
- Resumo e insights de conversas com clientes
- Sugestões de upsell/cross-sell baseadas no perfil

REGRAS:
- Responda SEMPRE em português brasileiro
- Use Markdown para formatar (headers, bullets, bold, tabelas quando útil)
- Seja direto e acionável — cada resposta deve ter um "próximo passo" claro
- Quando analisar dados, use números e percentuais
- Quando sugerir ações, ordene por impacto esperado
- Baseie-se na base de conhecimento quando disponível${companyContext}${knowledgeContext}`;
    }

    const temperature = aiConfig?.temperature ? Number(aiConfig.temperature) : 0.7;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
        temperature,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
