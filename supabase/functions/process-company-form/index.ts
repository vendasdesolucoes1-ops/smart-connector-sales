import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { form_token, data } = await req.json();

    if (!form_token || !data) {
      return new Response(JSON.stringify({ error: "form_token and data are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Validate form_token and get org
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("form_token", form_token)
      .maybeSingle();

    if (orgError || !org) {
      return new Response(JSON.stringify({ error: "Invalid form token" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use AI to improve the responses
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    let enhancedData = data;

    if (lovableApiKey) {
      try {
        const aiPrompt = `Você é um especialista em branding e estratégia comercial. 
O cliente preencheu um formulário sobre sua empresa. Melhore e profissionalize cada resposta, mantendo a essência original mas tornando mais claro, profissional e completo.

IMPORTANTE: Retorne APENAS um JSON válido, sem markdown, sem backticks, sem explicações extras.

Dados do formulário:
${JSON.stringify(data, null, 2)}

Retorne um JSON com a MESMA estrutura, com os valores melhorados. Para campos vazios ou null, mantenha como estão.
Melhore: description, mission, vision, values, target_audience, differentials, tone_of_voice, sales_process.
Para products_services, melhore as descrições de cada produto.
Para objections_faq, melhore as respostas.
NÃO altere: company_name, cnpj, phone, email, website, instagram, linkedin, facebook, address, segment, founded_year, team_size, avg_ticket, logo_url.`;

        const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableApiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: aiPrompt }],
            temperature: 0.4,
          }),
        });

        if (aiResponse.ok) {
          const aiResult = await aiResponse.json();
          const content = aiResult.choices?.[0]?.message?.content;
          if (content) {
            // Clean markdown code blocks if present
            const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            try {
              enhancedData = JSON.parse(cleaned);
            } catch {
              console.error("Failed to parse AI response, using original data");
            }
          }
        }
      } catch (aiErr) {
        console.error("AI enhancement failed, using original data:", aiErr);
      }
    }

    // Check if company profile exists
    const { data: existing } = await supabase
      .from("company_profiles")
      .select("id")
      .eq("org_id", org.id)
      .maybeSingle();

    const payload = {
      org_id: org.id,
      company_name: enhancedData.company_name || data.company_name || "",
      segment: enhancedData.segment || null,
      description: enhancedData.description || "",
      mission: enhancedData.mission || "",
      vision: enhancedData.vision || "",
      values: enhancedData.values || "",
      target_audience: enhancedData.target_audience || "",
      differentials: enhancedData.differentials || "",
      tone_of_voice: enhancedData.tone_of_voice || "",
      sales_process: enhancedData.sales_process || "",
      products_services: enhancedData.products_services || [],
      objections_faq: enhancedData.objections_faq || [],
      cnpj: enhancedData.cnpj || null,
      phone: enhancedData.phone || null,
      email: enhancedData.email || null,
      website: enhancedData.website || null,
      instagram: enhancedData.instagram || null,
      linkedin: enhancedData.linkedin || null,
      facebook: enhancedData.facebook || null,
      address: enhancedData.address || null,
      founded_year: enhancedData.founded_year || null,
      team_size: enhancedData.team_size || null,
      avg_ticket: enhancedData.avg_ticket || null,
    };

    let error;
    if (existing) {
      ({ error } = await supabase.from("company_profiles").update(payload).eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("company_profiles").insert(payload));
    }

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, org_name: org.name }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
