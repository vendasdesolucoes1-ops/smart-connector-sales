import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

function getCorsHeaders(req: Request) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

async function firecrawlSearch(apiKey: string, query: string, limit: number): Promise<any[]> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          limit,
          lang: "pt-br",
          country: "br",
          scrapeOptions: { formats: ["markdown"], onlyMainContent: false },
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        return data?.data || data?.results || [];
      }
      if (resp.status < 500) return [];
      console.error(`Firecrawl search attempt ${attempt}: ${resp.status}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt));
    } catch (e) {
      console.error(`Firecrawl search error attempt ${attempt}:`, e);
      if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  return [];
}

async function firecrawlScrape(apiKey: string, url: string): Promise<string> {
  try {
    const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: false }),
    });
    if (!resp.ok) return "";
    const data = await resp.json();
    return data?.data?.markdown || data?.markdown || "";
  } catch {
    return "";
  }
}

function buildCompanyContext(company: any): string {
  if (!company) return "";

  const hasB2B = company.business_models?.includes("B2B");
  const hasB2C = company.business_models?.includes("B2C");

  const targetAudience = hasB2B
    ? (company.b2b_target_audience || company.target_audience || "")
    : (company.b2c_target_audience || company.target_audience || "");

  const products = hasB2B
    ? (company.b2b_products_services?.length ? company.b2b_products_services : company.products_services)
    : (company.b2c_products_services?.length ? company.b2c_products_services : company.products_services);

  const differentials = hasB2B
    ? (company.b2b_differentials || company.differentials || "")
    : (company.b2c_differentials || company.differentials || "");

  const avgTicket = hasB2B
    ? (company.b2b_avg_ticket || company.avg_ticket || "")
    : (company.b2c_avg_ticket || company.avg_ticket || "");

  const productsList = Array.isArray(products)
    ? products.slice(0, 5).map((p: any) =>
        typeof p === "string" ? p : `${p.name || ""}${p.description ? ` — ${p.description}` : ""}${p.price ? ` (${p.price})` : ""}`
      ).join("; ")
    : "";

  return `
EMPRESA VENDEDORA (quem vai abordar os leads):
- Nome: ${company.company_name || "Não informado"}
- Segmento: ${company.segment || "Não informado"}
- Descrição: ${company.description || "Não informado"}
- Modelo de negócio: ${company.business_models?.join(", ") || "Não informado"}
- Público-alvo: ${targetAudience || "Não informado"}
- Produtos/Serviços: ${productsList || "Não informado"}
- Diferenciais: ${differentials || "Não informado"}
- Ticket médio: ${avgTicket || "Não informado"}`.trim();
}

function buildSmartQueries(
  niche: string,
  locationStr: string,
  prospectingIntent: string,
  company: any
): string[] {
  const loc = locationStr || "";

  // Base queries — always include
  const queries: string[] = [
    `${niche} ${loc} telefone contato`,
    `${niche} ${loc} WhatsApp celular`,
    `"${niche}" "${loc.split(",")[0]?.trim() || ""}" site contato email`,
  ];

  // Add intent-driven queries if provided
  if (prospectingIntent?.trim()) {
    const intentKeywords = prospectingIntent.trim().slice(0, 100);
    queries.push(`${niche} ${loc} ${intentKeywords}`);
  }

  // Add company-context-aware query if we have target audience info
  const hasB2B = company?.business_models?.includes("B2B");
  const targetAudience = hasB2B
    ? (company?.b2b_target_audience || company?.target_audience || "")
    : (company?.target_audience || "");

  if (targetAudience) {
    // Build a smarter query based on who this company sells to
    const audienceKeywords = targetAudience.slice(0, 80);
    queries.push(`${niche} ${loc} ${audienceKeywords} contato`);
  } else {
    queries.push(`${niche} ${loc} endereço CNPJ`);
  }

  return queries.filter(q => q.trim().length > 5);
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!FIRECRAWL_API_KEY) return json({ error: "Firecrawl não configurado." }, 400);
    if (!LOVABLE_API_KEY) return json({ error: "AI não configurada." }, 400);

    // Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { org_id, niche, city, state, bairro, limit = 20, prospecting_intent = "" } = await req.json();
    if (!org_id || !niche) return json({ error: "org_id e niche são obrigatórios" }, 400);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const locationParts: string[] = [];
    if (bairro) locationParts.push(bairro);
    if (city) locationParts.push(city);
    if (state) locationParts.push(state);
    const locationStr = locationParts.join(", ");
    const desiredCount = Math.min(Math.max(limit, 5), 50);

    console.log(`=== PROSPECTING: "${niche}" in "${locationStr}" (want ${desiredCount} leads) ===`);

    // ──────────────────────────────────────────────────
    // LOAD COMPANY PROFILE for ICP-aware prospecting
    // ──────────────────────────────────────────────────
    const { data: company } = await supabaseAdmin
      .from("company_profiles")
      .select("*")
      .eq("org_id", org_id)
      .maybeSingle();

    const companyContext = buildCompanyContext(company);
    const hasCompanyProfile = !!company?.company_name;

    console.log(`Company profile: ${hasCompanyProfile ? company.company_name : "NOT CONFIGURED"}`);
    console.log(`Prospecting intent: "${prospecting_intent || "not provided"}"`);

    // ──────────────────────────────────────────────────
    // PHASE 1: Smart, ICP-aware search queries
    // ──────────────────────────────────────────────────
    const queries = buildSmartQueries(niche, locationStr, prospecting_intent, company);

    const perQueryLimit = Math.ceil(desiredCount / 2);
    console.log(`Running ${queries.length} smart search queries (${perQueryLimit} results each)...`);

    const allSearchResults: any[] = [];
    const seenUrls = new Set<string>();

    for (let i = 0; i < queries.length; i += 2) {
      const batch = queries.slice(i, i + 2);
      const batchResults = await Promise.all(
        batch.map(q => firecrawlSearch(FIRECRAWL_API_KEY, q, perQueryLimit))
      );
      for (const results of batchResults) {
        for (const r of results) {
          const url = r.url || r.metadata?.sourceURL || "";
          if (url && !seenUrls.has(url)) {
            seenUrls.add(url);
            allSearchResults.push(r);
          }
        }
      }
      if (i + 2 < queries.length) await new Promise(r => setTimeout(r, 500));
    }

    console.log(`Total unique pages from searches: ${allSearchResults.length}`);

    if (allSearchResults.length === 0) {
      return json({ count: 0, results: [], pages_searched: 0, message: "Nenhum resultado encontrado." });
    }

    // ──────────────────────────────────────────────────
    // PHASE 2: Identify and scrape contact/about pages
    // ──────────────────────────────────────────────────
    const contactPageUrls: string[] = [];
    for (const r of allSearchResults) {
      const url = (r.url || r.metadata?.sourceURL || "").toLowerCase();
      const markdown = (r.markdown || r.content || "").toLowerCase();

      const hasPhone = /\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/.test(markdown) || /\+55\s?\d{2}/.test(markdown);

      if (!hasPhone) {
        const contactLinks = markdown.match(/https?:\/\/[^\s"')]+(?:contato|contact|fale-conosco|about|sobre|quem-somos)[^\s"')]*/) ;
        if (contactLinks) {
          const contactUrl = contactLinks[0];
          if (!seenUrls.has(contactUrl)) {
            contactPageUrls.push(contactUrl);
            seenUrls.add(contactUrl);
          }
        }
      }
    }

    const contactPagesToScrape = contactPageUrls.slice(0, 10);
    if (contactPagesToScrape.length > 0) {
      console.log(`Scraping ${contactPagesToScrape.length} contact pages...`);
      for (let i = 0; i < contactPagesToScrape.length; i += 3) {
        const batch = contactPagesToScrape.slice(i, i + 3);
        const scrapeResults = await Promise.all(
          batch.map(async (url) => {
            const md = await firecrawlScrape(FIRECRAWL_API_KEY, url);
            return { url, markdown: md, title: `Contato - ${url}`, metadata: { sourceURL: url } };
          })
        );
        for (const sr of scrapeResults) {
          if (sr.markdown) allSearchResults.push(sr);
        }
        if (i + 3 < contactPagesToScrape.length) await new Promise(r => setTimeout(r, 500));
      }
    }

    // ──────────────────────────────────────────────────
    // PHASE 3: Build rich context for AI extraction
    // ──────────────────────────────────────────────────
    const pagesContent = allSearchResults.map((r: any, i: number) => {
      const title = r.title || r.metadata?.title || `Resultado ${i + 1}`;
      const url = r.url || r.metadata?.sourceURL || "";
      const markdown = r.markdown || r.content || "";
      const trimmed = markdown.substring(0, 5000);
      return `--- PÁGINA ${i + 1}: ${title} (${url}) ---\n${trimmed}`;
    }).join("\n\n");

    // ──────────────────────────────────────────────────
    // PHASE 4: AI extraction WITH ICP qualification
    // ──────────────────────────────────────────────────

    const intentSection = prospecting_intent?.trim()
      ? `\nINTENÇÃO DE PROSPECÇÃO DO USUÁRIO:\n"${prospecting_intent.trim()}"\nConsidere essa intenção ao avaliar se cada lead é adequado.\n`
      : "";

    const icpSection = hasCompanyProfile
      ? `
${companyContext}

CRITÉRIOS DE QUALIFICAÇÃO ICP (Ideal Customer Profile):
Com base no perfil da empresa acima, avalie cada lead e atribua um icp_score de 0 a 100:
- 80-100: Lead PERFEITO — é exatamente o público-alvo da empresa, alta probabilidade de conversão
- 60-79: Lead BOM — tem bom fit, vale a pena abordar
- 40-59: Lead MÉDIO — fit razoável, pode converter com esforço
- 20-39: Lead FRACO — pouco alinhado, abordar apenas se faltar leads melhores
- 0-19: Lead RUIM — fora do perfil ideal da empresa

Preencha o campo "icp_score" e "icp_reason" (1 frase explicando o score) para cada lead.
`
      : `
Como não há perfil de empresa configurado, atribua icp_score = 50 para todos os leads e icp_reason = "Perfil de empresa não configurado".
`;

    const extractionPrompt = `Analise TODAS as ${allSearchResults.length} páginas abaixo e extraia ABSOLUTAMENTE TODOS os contatos de empresas do segmento "${niche}" ${locationStr ? `localizadas em ${locationStr}` : ""}.
${intentSection}
PÁGINAS RASPADAS:
${pagesContent}

INSTRUÇÕES DE EXTRAÇÃO (SIGA RIGOROSAMENTE):

1. TELEFONE - Extraia TODOS os formatos:
   - (XX) XXXXX-XXXX, (XX) XXXX-XXXX
   - +55 XX XXXXX-XXXX
   - Apenas dígitos seguidos: 11999998888
   - WhatsApp: links wa.me/55XXXXXXXXXXX
   - Telefones em imagens de texto ou alt text
   - Se houver múltiplos telefones, use o celular/WhatsApp

2. EMAIL - Busque em:
   - Links mailto:
   - Texto com @ no conteúdo
   - Padrões como contato@, atendimento@, comercial@

3. WEBSITE - Capture:
   - A URL da página onde o contato foi encontrado
   - Links para o site da empresa mencionados no conteúdo
   - Domínio principal da empresa

4. DADOS COMPLEMENTARES:
   - Nome da empresa/pessoa de contato
   - Cargo/função
   - Endereço/cidade
   - Segmento de atuação
   - CNPJ se disponível
   - Porte da empresa (pequena/média/grande) se inferível

${locationStr ? `FILTRO DE LOCALIDADE:
- Priorize contatos de ${locationStr}
- Inclua contatos onde a cidade/estado seja compatível
- Se não puder confirmar a localidade mas o DDD for compatível, inclua` : ""}

${icpSection}

REGRAS CRÍTICAS:
- Extraia o MÁXIMO possível de contatos — meta: pelo menos ${desiredCount}
- NÃO pule nenhum contato que tenha pelo menos telefone OU email
- Se uma página tem vários contatos (lista, diretório), extraia TODOS
- NÃO invente dados, mas extraia tudo que existir nas páginas
- Cada empresa conta como 1 contato mesmo que tenha múltiplas pessoas

Responda APENAS com JSON válido:
{
  "contacts": [
    {
      "name": "string ou null",
      "phone": "string ou null",
      "email": "string ou null",
      "company": "string ou null",
      "role": "string ou null",
      "city": "string ou null",
      "website": "string ou null",
      "segment": "string ou null",
      "company_size": "string ou null",
      "icp_score": 0,
      "icp_reason": "string ou null"
    }
  ]
}`;

    console.log(`Sending ${allSearchResults.length} pages to AI for extraction + ICP qualification...`);

    const systemPrompt = hasCompanyProfile
      ? `Você é um especialista em prospecção B2B e qualificação de leads. Sua missão: encontrar TODOS os contatos empresariais nas páginas fornecidas E qualificar cada lead com um score de aderência ao ICP da empresa vendedora. ${locationStr ? `Priorize contatos de ${locationStr}.` : ""} Retorne APENAS JSON válido, sem markdown, sem explicações.`
      : `Você é o MELHOR extrator de dados comerciais do Brasil. Sua missão: encontrar TODOS os contatos empresariais nas páginas fornecidas. Não deixe escapar nenhum telefone, email ou website. ${locationStr ? `Priorize contatos de ${locationStr}.` : ""} Retorne APENAS JSON válido, sem markdown, sem explicações.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: extractionPrompt },
        ],
        max_tokens: 8192,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errorText = await aiResponse.text();
      console.error("AI extraction error:", status, errorText);

      if (status === 402) {
        return json({ error: "Créditos de IA esgotados. Verifique seu plano no Lovable." }, 402);
      }
      if (status === 429) {
        return json({ error: "Limite de requisições do Google Gemini atingido. Tente novamente em 1 minuto." }, 429);
      }

      return json({ error: `Erro na extração por IA: Status ${status}` }, 502);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    let contacts: any[] = [];
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        contacts = parsed.contacts || [];
      }
    } catch (e) {
      console.error("JSON parse error:", e, "Content:", aiContent.substring(0, 500));
    }

    console.log(`AI extracted ${contacts.length} contacts`);

    if (contacts.length === 0) {
      return json({
        count: 0, results: [], pages_searched: allSearchResults.length,
        message: "Nenhum contato extraído. Tente termos mais específicos.",
      });
    }

    // ──────────────────────────────────────────────────
    // PHASE 5: Format, deduplicate, and save
    // ──────────────────────────────────────────────────
    const formatPhone = (phone: string): string | null => {
      if (!phone) return null;
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 8) return null;
      if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
      if (digits.length === 11 || digits.length === 10) return `+55${digits}`;
      if (digits.length === 8 || digits.length === 9) return null;
      return `+${digits}`;
    };

    const capitalizeName = (name: string): string | null =>
      name ? name.replace(/\b\w/g, (c) => c.toUpperCase()).trim() : null;

    // Deduplicate within batch
    const seenPhones = new Set<string>();
    const seenEmails = new Set<string>();
    const uniqueContacts = contacts.filter((c: any) => {
      const phone = formatPhone(c.phone || "");
      const email = c.email?.toLowerCase()?.trim();
      if (phone && seenPhones.has(phone)) return false;
      if (!phone && email && seenEmails.has(email)) return false;
      if (phone) seenPhones.add(phone);
      if (email) seenEmails.add(email);
      return phone || email;
    });

    // Sort by ICP score descending (best leads first)
    uniqueContacts.sort((a: any, b: any) => (b.icp_score || 50) - (a.icp_score || 50));

    // Check DB duplicates
    const phonesToCheck = uniqueContacts.map((c: any) => formatPhone(c.phone || "")).filter(Boolean) as string[];
    const emailsToCheck = uniqueContacts.map((c: any) => c.email?.toLowerCase()?.trim()).filter(Boolean) as string[];

    let existingPhones = new Set<string>();
    let existingEmails = new Set<string>();

    if (phonesToCheck.length > 0) {
      const { data: existingByPhone } = await supabaseAdmin
        .from("leads_raw").select("phone").eq("org_id", org_id).in("phone", phonesToCheck);
      existingPhones = new Set((existingByPhone || []).map((l: any) => l.phone));
    }
    if (emailsToCheck.length > 0) {
      const { data: existingByEmail } = await supabaseAdmin
        .from("leads_raw").select("email").eq("org_id", org_id).in("email", emailsToCheck);
      existingEmails = new Set((existingByEmail || []).map((l: any) => l.email?.toLowerCase()));
    }

    const newLeads = uniqueContacts
      .map((c: any) => {
        const phone = formatPhone(c.phone || "");
        const email = c.email?.toLowerCase()?.trim() || null;
        const icpScore = typeof c.icp_score === "number"
          ? Math.min(100, Math.max(0, Math.round(c.icp_score)))
          : 50;
        return {
          org_id,
          name: capitalizeName(c.name || c.company || "") || "Lead sem nome",
          phone,
          email,
          source: "web" as const,
          status: "pending" as const,
          enrichment_data: {
            company: c.company || null,
            role: c.role || null,
            city: c.city || null,
            website: c.website || null,
            segment: c.segment || niche,
            company_size: c.company_size || null,
            scraped_niche: niche,
            scraped_location: locationStr,
            scraped_at: new Date().toISOString(),
            prospecting_intent: prospecting_intent || null,
            icp_score: icpScore,
            icp_reason: c.icp_reason || null,
            company_profile_used: hasCompanyProfile,
          },
        };
      })
      .filter((l: any) => {
        if (l.phone && existingPhones.has(l.phone)) return false;
        if (!l.phone && l.email && existingEmails.has(l.email)) return false;
        return true;
      });

    // Save in batches
    let savedCount = 0;
    if (newLeads.length > 0) {
      for (let i = 0; i < newLeads.length; i += 100) {
        const chunk = newLeads.slice(i, i + 100);
        const { error: insertError } = await supabaseAdmin.from("leads_raw").insert(chunk);
        if (insertError) {
          console.error("Insert error:", insertError);
        } else {
          savedCount += chunk.length;
        }
      }
    }

    const displayResults = uniqueContacts.map((c: any) => ({
      name: capitalizeName(c.name || c.company || "") || null,
      phone: formatPhone(c.phone || ""),
      email: c.email || null,
      company: c.company || null,
      role: c.role || null,
      city: c.city || null,
      website: c.website || null,
      segment: c.segment || null,
      company_size: c.company_size || null,
      icp_score: typeof c.icp_score === "number" ? Math.min(100, Math.max(0, Math.round(c.icp_score))) : 50,
      icp_reason: c.icp_reason || null,
    }));

    const avgIcpScore = displayResults.length
      ? Math.round(displayResults.reduce((sum: number, r: any) => sum + (r.icp_score || 50), 0) / displayResults.length)
      : 0;

    console.log(`=== DONE: ${savedCount} saved, ${contacts.length - newLeads.length} dupes, ${allSearchResults.length} pages searched, avg ICP score: ${avgIcpScore} ===`);

    return json({
      count: savedCount,
      total_found: contacts.length,
      duplicates_skipped: contacts.length - newLeads.length,
      pages_searched: allSearchResults.length,
      results: displayResults,
      avg_icp_score: avgIcpScore,
      company_profile_used: hasCompanyProfile,
    });

  } catch (e) {
    console.error("scrape-leads error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
