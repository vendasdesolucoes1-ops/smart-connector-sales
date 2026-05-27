import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isInCooldown, registerContact } from "../_shared/contact-cooldown.ts";

const allowedOrigins = [
  "https://vssalesreal.lovable.app",
  Deno.env.get("ALLOWED_ORIGIN") || "",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    // Find all conversations that need follow-up:
    // - Not paused (lead hasn't replied since last follow-up)
    // - Has a scenario_key linked
    const { data: conversations, error: convErr } = await supabaseAdmin
      .from("conversation_tracker")
      .select("*")
      .eq("follow_up_paused", false)
      .not("scenario_key", "is", null);

    if (convErr) {
      console.error("Error fetching conversations:", convErr);
      throw convErr;
    }

    if (!conversations || conversations.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No conversations need follow-up" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all follow-up rules grouped by ai_config_id
    const configIds = [...new Set(conversations.map((c: any) => c.ai_config_id).filter(Boolean))];
    const { data: allRules } = await supabaseAdmin
      .from("follow_up_rules")
      .select("*")
      .in("ai_config_id", configIds)
      .eq("enabled", true)
      .order("step_order", { ascending: true });

    if (!allRules || allRules.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No follow-up rules configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group rules by ai_config_id
    const rulesByConfig: Record<string, any[]> = {};
    for (const rule of allRules) {
      if (!rulesByConfig[rule.ai_config_id]) rulesByConfig[rule.ai_config_id] = [];
      rulesByConfig[rule.ai_config_id].push(rule);
    }

    // Global Evolution API credentials
    const evolutionUrl = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY") || "";
    const orgIds = [...new Set(conversations.map((c: any) => c.org_id))];

    // Get AI scenarios for system prompts
    const scenarioKeys = [...new Set(conversations.map((c: any) => c.scenario_key).filter(Boolean))];
    const { data: aiScenarios } = await supabaseAdmin
      .from("ai_scenarios")
      .select("*")
      .in("org_id", orgIds)
      .in("scenario_key", scenarioKeys);

    // Index scenarios by "org_id::scenario_key"
    const scenarioByKey: Record<string, any> = {};
    for (const sc of aiScenarios || []) {
      scenarioByKey[`${sc.org_id}::${sc.scenario_key}`] = sc;
    }

    // Get company profiles for context
    const { data: companyProfiles } = await supabaseAdmin
      .from("company_profiles")
      .select("*")
      .in("org_id", orgIds);

    const companyByOrg: Record<string, any> = {};
    for (const cp of companyProfiles || []) {
      companyByOrg[cp.org_id] = cp;
    }

    const now = new Date();
    let processed = 0;
    const results: any[] = [];

    for (const conv of conversations) {
      const rules = rulesByConfig[conv.ai_config_id] || [];
      if (rules.length === 0) continue;

      const nextStep = conv.last_follow_up_step + 1;
      const rule = rules.find((r: any) => r.step_order === nextStep);

      if (!rule) {
        // All follow-up steps exhausted for this conversation
        continue;
      }

      // Check if enough time has passed since last bot message or last customer message
      const referenceTime = conv.last_bot_msg_at || conv.last_customer_msg_at;
      const refDate = new Date(referenceTime);
      const minutesSince = (now.getTime() - refDate.getTime()) / (1000 * 60);

      if (minutesSince < rule.delay_minutes) {
        // Not yet time for this follow-up
        continue;
      }

      // Cooldown check
      const phone = conv.remote_jid.replace("@s.whatsapp.net", "");
      if (await isInCooldown(supabaseAdmin, phone, conv.org_id)) {
        console.log(`Skipping follow-up for ${phone}: in cooldown`);
        continue;
      }

      if (!evolutionUrl || !evolutionKey) {
        console.error(`Evolution API not configured`);
        continue;
      }

      const scenario = scenarioByKey[`${conv.org_id}::${conv.scenario_key}`];
      if (!scenario?.enabled) continue;

      // Generate follow-up message using AI
      const contextHint = rule.context_hint || "reativar a conversa de forma natural";
      const stepLabel = `${nextStep}º follow-up (de ${rules.length} total)`;

      // Company context for follow-up
      const cp = companyByOrg[conv.org_id];
      let compCtx = "";
      if (cp) {
        const p: string[] = [];
        if (cp.company_name) p.push(`Empresa: ${cp.company_name}`);
        if (cp.segment) p.push(`Segmento: ${cp.segment}`);
        if (cp.tone_of_voice) p.push(`Tom: ${cp.tone_of_voice}`);
        const products = cp.products_services || [];
        if (products.length > 0) p.push("Produtos: " + products.map((pr: any) => pr.name).join(", "));
        compCtx = `\n\nCONTEXTO DA EMPRESA:\n${p.join("\n")}`;
      }

      const systemPrompt = `Você é um assistente de vendas via WhatsApp.
${scenario.system_prompt || "Seja educado, prestativo e profissional."}

SITUAÇÃO: O lead "${conv.push_name || 'cliente'}" não respondeu há ${Math.round(minutesSince)} minutos.
Este é o ${stepLabel}.
Objetivo do follow-up: ${contextHint}
${compCtx}

FORMATO (CRÍTICO):
- Se precisar mais de 2 linhas, divida em blocos separados por ---BLOCO---
- Cada bloco = 1-2 linhas no máximo
- Máximo 2 blocos para follow-up
- Tom natural, humano, como se estivesse digitando normalmente

REGRAS:
- Mensagem CURTA (máx 2 linhas por bloco)
- Tom natural, não robótico
- NÃO repita mensagens anteriores
- Varie a abordagem a cada etapa
- Se for o último follow-up, indique que está à disposição sem pressionar
- Use 1 emoji no máximo
- Responda APENAS com a mensagem, sem explicação`;

      try {
        const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-3-5-haiku-20241022",
            system: systemPrompt,
            messages: [
              { role: "user", content: `Gere a mensagem de follow-up #${nextStep} para ${conv.push_name || "o lead"}.` },
            ],
            max_tokens: 1024,
            temperature: Math.max(0.2, Math.min(Number(scenario.temperature) ?? 0.35, 0.45)),
          }),
        });

        if (!aiResponse.ok) {
          console.error(`AI error for conv ${conv.id}:`, aiResponse.status);
          continue;
        }

        const aiData = await aiResponse.json();
        const reply = aiData.content?.[0]?.text?.trim() || "";

        if (!reply) continue;

        // Send via Evolution API — split into blocks for human-like delivery
        const blocks = reply.split(/---BLOCO---/i).map((b: string) => b.trim()).filter((b: string) => b.length > 0);
        const messageParts = blocks.length > 0 ? blocks : [reply];

        let sendOk = false;
        for (let i = 0; i < messageParts.length; i++) {
          if (i > 0) {
            const delayMs = Math.min(1000 + messageParts[i].length * 30, 3000);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
          const sendResponse = await fetch(
            `${evolutionUrl}/message/sendText/${conv.instance_name}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: evolutionKey,
              },
              body: JSON.stringify({ number: phone, text: messageParts[i] }),
            }
          );
          if (!sendResponse.ok) {
            console.error(`Evolution send error for ${phone}:`, sendResponse.status);
          } else {
            sendOk = true;
          }
        }

        if (!sendOk) {
          results.push({ conv_id: conv.id, status: "send_failed", phone });
          continue;
        }

        // Update conversation tracker
        await supabaseAdmin
          .from("conversation_tracker")
          .update({
            last_bot_msg_at: now.toISOString(),
            last_follow_up_step: nextStep,
            // If this was the last step, pause further follow-ups
            follow_up_paused: nextStep >= rules.length,
          })
          .eq("id", conv.id);

        await registerContact(supabaseAdmin, phone, conv.org_id, 24);
        processed++;
        results.push({ conv_id: conv.id, status: "sent", step: nextStep, phone });
        console.log(`Follow-up #${nextStep} sent to ${phone} on instance ${conv.instance_name}`);
      } catch (err) {
        console.error(`Error processing follow-up for conv ${conv.id}:`, err);
        results.push({ conv_id: conv.id, status: "error", error: String(err) });
      }
    }

    return new Response(JSON.stringify({ processed, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-follow-up error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
