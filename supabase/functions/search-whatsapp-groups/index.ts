const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { niche, region, limit } = await req.json();

    if (!niche) {
      return new Response(JSON.stringify({ success: false, error: 'Nicho é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'Firecrawl não configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build search query to find WhatsApp group invite links
    const regionPart = region ? ` ${region}` : '';
    const query = `site:chat.whatsapp.com "${niche}"${regionPart} grupo whatsapp`;

    console.log('Searching WhatsApp groups:', query);

    const searchResp = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        limit: Math.min(limit || 20, 30),
      }),
    });

    const searchData = await searchResp.json();

    if (!searchResp.ok) {
      console.error('Firecrawl error:', searchData);
      return new Response(JSON.stringify({ success: false, error: searchData.error || 'Erro na busca' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Also search directory sites
    const dirQuery = `"grupo whatsapp" "${niche}"${regionPart} link convite`;
    const dirResp = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: dirQuery,
        limit: 10,
        scrapeOptions: { formats: ['links'] },
      }),
    });

    const dirData = await dirResp.json();

    // Extract WhatsApp links from all results
    const whatsappLinkRegex = /https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+/g;
    const groupMap = new Map<string, { name: string; url: string; source: string }>();

    // Process direct search results
    const directResults = searchData?.data || searchData?.results || [];
    for (const r of directResults) {
      const url = r.url || '';
      if (url.includes('chat.whatsapp.com')) {
        const code = url.split('/').pop();
        if (code && code.length > 10) {
          groupMap.set(code, {
            name: r.title?.replace(/ - WhatsApp.*$/i, '').replace(/WhatsApp Group/i, '').trim() || `Grupo ${niche}`,
            url: url.startsWith('https') ? url : `https://chat.whatsapp.com/${code}`,
            source: 'busca direta',
          });
        }
      }
    }

    // Process directory results - extract whatsapp links from page content
    const dirResults = dirData?.data || dirData?.results || [];
    for (const r of dirResults) {
      // Check URL itself
      const pageUrl = r.url || '';
      if (pageUrl.includes('chat.whatsapp.com')) {
        const code = pageUrl.split('/').pop();
        if (code && code.length > 10 && !groupMap.has(code)) {
          groupMap.set(code, {
            name: r.title?.replace(/ - WhatsApp.*$/i, '').replace(/WhatsApp Group/i, '').trim() || `Grupo ${niche}`,
            url: `https://chat.whatsapp.com/${code}`,
            source: 'diretório',
          });
        }
      }

      // Extract links from page content/links
      const content = [r.markdown || '', r.description || '', JSON.stringify(r.links || [])].join(' ');
      const matches = content.match(whatsappLinkRegex) || [];
      for (const link of matches) {
        const code = link.split('/').pop();
        if (code && code.length > 10 && !groupMap.has(code)) {
          groupMap.set(code, {
            name: r.title?.replace(/ - WhatsApp.*$/i, '').trim() || `Grupo ${niche}`,
            url: `https://chat.whatsapp.com/${code}`,
            source: new URL(pageUrl || 'https://unknown.com').hostname,
          });
        }
      }
    }

    const groups = Array.from(groupMap.values());
    console.log(`Found ${groups.length} unique WhatsApp groups`);

    return new Response(JSON.stringify({
      success: true,
      groups,
      total: groups.length,
      query: niche + regionPart,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
