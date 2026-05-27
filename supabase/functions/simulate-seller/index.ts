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

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("user_id", user.id)
      .single();
    if (!profile?.org_id) throw new Error("No org");

    const orgId = profile.org_id;
    const { messages, ai_config_id } = await req.json();

    // Fetch all context in parallel
    const queries: any[] = [
      supabase.from("company_profiles").select("*").eq("org_id", orgId).maybeSingle(),
      supabase.from("ai_knowledge_docs").select("title, summary, keywords").eq("org_id", orgId),
      supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      supabase.from("opportunities").select("value, probability").eq("org_id", orgId),
    ];

    // If specific ai_config_id provided, fetch that config
    if (ai_config_id) {
      queries.push(
        supabase.from("ai_configs").select("*").eq("id", ai_config_id).maybeSingle()
      );
    } else {
      queries.push(
        supabase.from("ai_configs").select("*").eq("org_id", orgId).eq("config_type", "chatbot").eq("enabled", true).limit(1)
      );
    }

    const [companyRes, knowledgeRes, leadsCountRes, oppsRes, aiConfigRes] = await Promise.all(queries);

    const company = companyRes.data;
    const aiConfig = ai_config_id ? aiConfigRes.data : aiConfigRes.data?.[0];
    const knowledgeDocs = knowledgeRes.data || [];
    const totalLeads = leadsCountRes.count || 0;
    const opps = oppsRes.data || [];
    const pipelineValue = opps.reduce((sum: number, o: any) => sum + (Number(o.value) || 0), 0);

    // Build system prompt - use modular config if available
    const modularCfg = (aiConfig?.config as any)?.modular;
    let systemPrompt = "";

    if (modularCfg && !modularCfg.use_custom_prompt) {
      // Build from modular config (same logic as ai-whatsapp-hook)
      const formalityLabels = ["muito informal e descontraído", "informal e amigável", "neutro e equilibrado", "formal e profissional", "muito formal e corporativo"];
      const energyLabels = ["calmo e tranquilo", "sereno", "equilibrado", "animado e positivo", "muito energético e entusiasmado"];
      const formalityIdx = Math.round((modularCfg.tone?.formality || 30) / 25);
      const energyIdx = Math.round((modularCfg.tone?.energy || 60) / 25);
      const emojiMap: Record<string, string> = {
        none: "NÃO use emojis",
        minimal: "Emojis com muita moderação (1 a cada 3 msgs)",
        moderate: "Emojis com moderação (máx 1 por msg)",
        frequent: "Emojis livremente (2+ por msg)",
      };

      const parts: string[] = [];
      parts.push(`Você é o vendedor virtual da empresa. Responda EXATAMENTE como responderia no WhatsApp real.`);
      parts.push(`\nEsta é uma SIMULAÇÃO para teste. Responda como se fosse uma conversa real.`);
      if (aiConfig?.system_prompt) parts.push(`\n${aiConfig.system_prompt}`);

      parts.push(`\nTOM DE VOZ:`);
      parts.push(`- ${formalityLabels[formalityIdx]}`);
      parts.push(`- Energia: ${energyLabels[energyIdx]}`);
      parts.push(`- ${emojiMap[modularCfg.tone?.emoji_usage || "moderate"]}`);
      if (modularCfg.tone?.custom_instructions) parts.push(`- ${modularCfg.tone.custom_instructions}`);

      // B2B/B2C
      const mode = modularCfg.business_mode || "hybrid";
      if (mode === "hybrid") {
        parts.push(`\nMODO HÍBRIDO: ${modularCfg.hybrid_detection_hint || "Detecte B2B/B2C automaticamente."}`);
      } else if (mode === "b2b") {
        parts.push(`\nCONTEXTO B2B: Qualificação ${modularCfg.b2b_context?.qualification_method || "BANT"}, personas ${modularCfg.b2b_context?.personas || "decisores"}`);
      } else {
        parts.push(`\nCONTEXTO B2C: Gatilhos ${modularCfg.b2c_context?.emotional_triggers || "urgência, prova social"}, sensibilidade a preço ${modularCfg.b2c_context?.price_sensitivity || "média"}`);
      }

      if (modularCfg.golden_rules?.length) {
        parts.push(`\nREGRAS:`);
        modularCfg.golden_rules.forEach((r: string, i: number) => { if (r.trim()) parts.push(`${i + 1}. ${r}`); });
      }

      if (modularCfg.objections?.length) {
        parts.push(`\nOBJEÇÕES:`);
        modularCfg.objections.forEach((o: any) => { if (o.trigger?.trim()) parts.push(`- "${o.trigger}" → ${o.response}`); });
      }

      if (modularCfg.ctas?.length) {
        parts.push(`\nCTAs:`);
        modularCfg.ctas.forEach((c: any) => { if (c.label?.trim()) parts.push(`- ${c.label}: "${c.text}"`); });
      }

      const blocks = modularCfg.blocks || { max_blocks: 4, max_chars_per_block: 200, max_emojis_per_block: 1 };
      parts.push(`\nFORMATO:`);
      parts.push(`- Divida em blocos de até ${blocks.max_chars_per_block} chars, separados por ---BLOCO---`);
      parts.push(`- Máx ${blocks.max_blocks} blocos, ${blocks.max_emojis_per_block} emoji(s) por bloco`);

      systemPrompt = parts.join("\n");
    } else if (modularCfg?.use_custom_prompt && modularCfg?.custom_base_prompt) {
      systemPrompt = `Você é o vendedor virtual. Esta é uma SIMULAÇÃO.\n\n${modularCfg.custom_base_prompt}`;
    } else {
      // Legacy prompt
      systemPrompt = `Você é o vendedor virtual da empresa. Responda EXATAMENTE como o vendedor real responderia.\nEsta é uma SIMULAÇÃO para teste.\n\n`;
      if (aiConfig?.system_prompt) systemPrompt += `## PERSONALIDADE\n${aiConfig.system_prompt}\n`;
    }

    // Add company context — use B2B/B2C specific data if available
    if (company) {
      const cp = company as any;
      const businessModels: string[] = cp.business_models || [];
      // Default to general; could be extended to accept audience param from frontend
      const prefix = businessModels.includes("b2b") && !businessModels.includes("b2c") ? "b2b"
        : businessModels.includes("b2c") && !businessModels.includes("b2b") ? "b2c"
        : null; // both or none = use general

      systemPrompt += `\n\n## EMPRESA\n`;
      if (cp.company_name) systemPrompt += `- Nome: ${cp.company_name}\n`;
      if (cp.segment) systemPrompt += `- Segmento: ${cp.segment}\n`;
      if (cp.description) systemPrompt += `- Descrição: ${cp.description}\n`;

      const differentials = (prefix && cp[`${prefix}_differentials`]) || cp.differentials;
      const targetAudience = (prefix && cp[`${prefix}_target_audience`]) || cp.target_audience;
      const toneOfVoice = (prefix && cp[`${prefix}_tone_of_voice`]) || cp.tone_of_voice;
      const avgTicket = (prefix && cp[`${prefix}_avg_ticket`]) || cp.avg_ticket;
      const products = (prefix && cp[`${prefix}_products_services`]?.length > 0 ? cp[`${prefix}_products_services`] : cp.products_services) as any[];
      const faqs = (prefix && cp[`${prefix}_objections_faq`]?.length > 0 ? cp[`${prefix}_objections_faq`] : cp.objections_faq) as any[];

      if (differentials) systemPrompt += `- Diferenciais: ${differentials}\n`;
      if (targetAudience) systemPrompt += `- Público-alvo: ${targetAudience}\n`;
      if (toneOfVoice) systemPrompt += `- Tom de voz: ${toneOfVoice}\n`;
      if (avgTicket) systemPrompt += `- Ticket médio: ${avgTicket}\n`;
      if (products?.length) {
        systemPrompt += `\n## PRODUTOS\n`;
        products.forEach((p: any) => { systemPrompt += `- ${p.name}: ${p.description}${p.price ? ` (${p.price})` : ""}\n`; });
      }
      if (faqs?.length) {
        systemPrompt += `\n## FAQ\n`;
        faqs.forEach((f: any) => { systemPrompt += `- "${f.question}" → "${f.answer}"\n`; });
      }
    }

    if (knowledgeDocs.length > 0) {
      systemPrompt += `\n## BASE DE CONHECIMENTO (${knowledgeDocs.length} docs)\n`;
      knowledgeDocs.slice(0, 10).forEach((doc: any) => {
        systemPrompt += `- ${doc.title}${doc.summary ? `: ${doc.summary}` : ""}\n`;
      });
    }

    systemPrompt += `\n## CONTEXTO\n- ${totalLeads} leads, ${opps.length} oportunidades, R$ ${pipelineValue.toLocaleString("pt-BR")} no pipeline\n`;
    systemPrompt += `- NUNCA invente informações sobre produtos/preços não listados\n`;
    systemPrompt += `- Responda em português brasileiro\n`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const temperature = aiConfig?.temperature ? Number(aiConfig.temperature) : 0.7;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
        temperature,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("simulate-seller error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
