import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!).auth.getUser(token);
    if (authError || !user) throw new Error("Não autenticado");

    // Get org_id from profile
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("user_id", user.id).single();
    if (!profile?.org_id) throw new Error("Organização não encontrada");
    const orgId = profile.org_id;

    const body = await req.json();
    const { remote_jids, feedback, action } = body;

    // === ACTION: analyze ===
    if (action === "analyze") {
      if (!remote_jids?.length || !feedback?.trim()) {
        throw new Error("Selecione conversas e descreva o que precisa melhorar");
      }

      // Load conversations
      const { data: messages } = await supabase
        .from("chat_messages")
        .select("remote_jid, from_me, message_text, push_name, timestamp")
        .eq("org_id", orgId)
        .in("remote_jid", remote_jids)
        .order("timestamp", { ascending: true })
        .limit(500);

      if (!messages?.length) throw new Error("Nenhuma mensagem encontrada para essas conversas");

      // Group by contact
      const grouped: Record<string, typeof messages> = {};
      for (const msg of messages) {
        if (!grouped[msg.remote_jid]) grouped[msg.remote_jid] = [];
        grouped[msg.remote_jid].push(msg);
      }

      // Format conversations for AI
      let conversationsText = "";
      for (const [jid, msgs] of Object.entries(grouped)) {
        const contactName = msgs.find(m => !m.from_me)?.push_name || jid;
        conversationsText += `\n--- CONVERSA COM ${contactName} ---\n`;
        for (const m of msgs) {
          const sender = m.from_me ? "BOT" : contactName;
          conversationsText += `[${sender}]: ${m.message_text}\n`;
        }
      }

      // Load current scenarios and knowledge base
      const [scenariosRes, docsRes, companyRes] = await Promise.all([
        supabase.from("ai_scenarios").select("scenario_key, name, system_prompt, behavior").eq("org_id", orgId),
        supabase.from("ai_knowledge_docs").select("title, content").eq("org_id", orgId),
        supabase.from("company_profiles").select("company_name, products_services, objections_faq").eq("org_id", orgId).maybeSingle(),
      ]);

      const currentScenarios = (scenariosRes.data || []).map(s => `[${s.name}]: ${s.system_prompt?.slice(0, 500) || "(vazio)"}`).join("\n\n");
      const currentKnowledge = (docsRes.data || []).map(d => `[${d.title}]: ${d.content?.slice(0, 300) || ""}`).join("\n\n");

      const systemPrompt = `Você é um especialista em otimização de chatbots de vendas.

O usuário está revisando conversas do bot com clientes e identificou problemas. Sua tarefa é analisar as conversas, entender o feedback do usuário e gerar 3 tipos de correções práticas:

1. **REGRAS DE COMPORTAMENTO**: Regras claras e objetivas que o bot deve seguir. Formato: frases imperativas curtas.
2. **RESPOSTAS MODELO**: Exemplos concretos de como o bot DEVERIA ter respondido em situações específicas identificadas nas conversas. Formato: "Quando o cliente diz X → Responder: Y"
3. **AJUSTES NO PROMPT**: Trechos de texto para adicionar ou modificar no system_prompt do cenário relevante. Seja específico sobre O QUE mudar.

CONTEXTO DA EMPRESA:
${companyRes.data?.company_name || "Não informado"}
Produtos: ${JSON.stringify(companyRes.data?.products_services || []).slice(0, 500)}

CENÁRIOS ATUAIS:
${currentScenarios}

BASE DE CONHECIMENTO ATUAL:
${currentKnowledge || "(vazia)"}

IMPORTANTE:
- Seja MUITO prático e objetivo
- Não invente informações sobre produtos — se o feedback indica que o bot inventou algo, a regra deve proibir isso
- Cada sugestão deve ser diretamente aplicável
- Responda APENAS no formato JSON especificado abaixo:

{
  "summary": "Resumo de 1-2 frases do que foi identificado",
  "rules": ["regra 1", "regra 2", ...],
  "model_responses": [
    {"situation": "Quando o cliente pergunta X", "response": "Responder assim: Y"}
  ],
  "prompt_adjustments": [
    {"scenario_key": "broadcast_own_base", "action": "adicionar", "text": "Texto para adicionar ao prompt"}
  ],
  "knowledge_doc_title": "Título sugerido para o documento de regras",
  "knowledge_doc_content": "Conteúdo completo do documento de regras formatado para a base de conhecimento"
}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${lovableKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `CONVERSAS:\n${conversationsText}\n\nFEEDBACK DO USUÁRIO:\n${feedback}` },
          ],
          temperature: 0.3,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Erro na IA: ${err}`);
      }

      const result = await response.json();
      let content = result.choices?.[0]?.message?.content || "";
      
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) content = jsonMatch[1].trim();

      let analysis;
      try {
        analysis = JSON.parse(content);
      } catch {
        throw new Error("A IA não retornou um formato válido. Tente novamente com feedback mais específico.");
      }

      return new Response(JSON.stringify({ success: true, analysis }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === ACTION: apply ===
    if (action === "apply") {
      const { analysis: analysisData, apply_rules, apply_prompt_adjustments } = body;
      
      if (!analysisData) throw new Error("Dados de análise não encontrados");

      const results: string[] = [];

      // 1. Save rules + model responses as knowledge doc
      if (apply_rules !== false && analysisData.knowledge_doc_content) {
        const { error } = await supabase.from("ai_knowledge_docs").insert({
          org_id: orgId,
          title: analysisData.knowledge_doc_title || "Regras de Feedback - " + new Date().toLocaleDateString("pt-BR"),
          content: analysisData.knowledge_doc_content,
          processed: false,
        });
        if (!error) results.push("Documento de regras salvo na base de conhecimento");
      }

      // 2. Apply prompt adjustments to scenarios (explicit from AI)
      if (apply_prompt_adjustments !== false && analysisData.prompt_adjustments?.length) {
        for (const adj of analysisData.prompt_adjustments) {
          const { data: scenario } = await supabase
            .from("ai_scenarios")
            .select("id, system_prompt")
            .eq("org_id", orgId)
            .eq("scenario_key", adj.scenario_key)
            .single();

          if (scenario) {
            let newPrompt = scenario.system_prompt || "";
            if (adj.action === "adicionar" || adj.action === "add") {
              newPrompt = newPrompt + "\n\n" + adj.text;
            } else if (adj.action === "substituir" || adj.action === "replace") {
              newPrompt = adj.text;
            }
            await supabase.from("ai_scenarios").update({ system_prompt: newPrompt }).eq("id", scenario.id);
            results.push(`Prompt do cenário "${adj.scenario_key}" atualizado`);
          }
        }
      }

      // 3. Always inject rules summary into ALL enabled scenarios' prompts
      if (apply_prompt_adjustments !== false && analysisData.rules?.length) {
        const rulesBlock = `\n\n## REGRAS DE REVISÃO (${new Date().toLocaleDateString("pt-BR")})\n${analysisData.rules.map((r: string) => `- ${r}`).join("\n")}`;
        
        // Also inject model responses if available
        let responsesBlock = "";
        if (analysisData.model_responses?.length) {
          responsesBlock = `\n\n## RESPOSTAS MODELO\n${analysisData.model_responses.map((mr: any) => `- ${mr.situation} → ${mr.response}`).join("\n")}`;
        }

        const injection = rulesBlock + responsesBlock;

        const { data: enabledScenarios } = await supabase
          .from("ai_scenarios")
          .select("id, scenario_key, system_prompt")
          .eq("org_id", orgId)
          .eq("enabled", true);

        if (enabledScenarios?.length) {
          // Skip scenarios already updated by explicit prompt_adjustments
          const alreadyUpdated = new Set((analysisData.prompt_adjustments || []).map((a: any) => a.scenario_key));
          
          for (const sc of enabledScenarios) {
            if (alreadyUpdated.has(sc.scenario_key)) continue;
            const newPrompt = (sc.system_prompt || "") + injection;
            await supabase.from("ai_scenarios").update({ system_prompt: newPrompt }).eq("id", sc.id);
            results.push(`Regras injetadas no cenário "${sc.scenario_key}"`);
          }
        }
      }

      // 3. Trigger knowledge processing
      try {
        await supabase.functions.invoke("process-knowledge", {
          body: { org_id: orgId },
        });
        results.push("Base de conhecimento reprocessada");
      } catch { /* non-critical */ }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Ação desconhecida: ${action}`);
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});