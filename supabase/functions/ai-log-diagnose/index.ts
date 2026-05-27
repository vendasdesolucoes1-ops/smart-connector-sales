import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is authenticated
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Input data: the log entry
    const { log_entry } = await req.json();
    if (!log_entry) throw new Error("Missing log_entry in request body");

    console.log(`Diagnosing log: ${log_entry.id} - ${log_entry.action}`);

    const systemPrompt = `Você é um Engenheiro de SRE e Support Senior. 
Sua tarefa é analisar um log de erro de uma aplicação SaaS e fornecer um diagnóstico preciso.

FORMATO DE RESPOSTA (Markdown):
### 🔍 Diagnóstico
[Explicação clara e concisa do que aconteceu em termos técnicos e funcionais]

### 💡 Causa Provável
[Identifique o motivo raiz: falta de permissão, erro de rede, bug de lógica, dado faltando, etc.]

### 🛠️ Como Resolver
[Passos exatos para corrigir o problema agora ou evitar que aconteça novamente]

### 📝 Notas Adicionais
[Qualquer outra observação relevante]

DADOS DO LOG:
Ação: ${log_entry.action}
Descrição: ${log_entry.description}
Erro: ${log_entry.error_message || "Nenhuma mensagem de erro direta"}
Metadados: ${JSON.stringify(log_entry.metadata || {}, null, 2)}
Data: ${log_entry.created_at}
Sucesso: ${log_entry.success}

Seja direto, profissional e muito prático. Use português brasileiro.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 402) {
        throw new Error("Créditos de IA esgotados no workspace. Por favor, adicione créditos para continuar.");
      }
      if (status === 429) {
        throw new Error("Limite de requisições atingido. Tente novamente em alguns segundos.");
      }
      const errorText = await response.text();
      console.error("AI gateway error:", status, errorText);
      throw new Error(`Erro no Gateway de IA: ${status}`);
    }

    const aiResult = await response.json();
    const diagnosis = aiResult.choices[0].message.content;

    return new Response(JSON.stringify({ diagnosis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("ai-log-diagnose error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno no diagnóstico" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
