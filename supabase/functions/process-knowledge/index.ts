import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Supabase client
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function chunkText(text: string, maxChunkSize = 1500, overlap = 200): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let current = "";

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length > maxChunkSize && current.length > 0) {
      chunks.push(current.trim());
      const words = current.split(/\s+/);
      const overlapWords = words.slice(-Math.floor(overlap / 5));
      current = overlapWords.join(" ") + "\n\n" + para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  if (chunks.length === 1 && chunks[0].length > maxChunkSize) {
    const bigText = chunks[0];
    chunks.length = 0;
    const sentences = bigText.split(/(?<=[.!?])\s+/);
    let cur = "";
    for (const s of sentences) {
      if ((cur + " " + s).length > maxChunkSize && cur) {
        chunks.push(cur.trim());
        cur = s;
      } else {
        cur = cur ? cur + " " + s : s;
      }
    }
    if (cur.trim()) chunks.push(cur.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("org_id").eq("user_id", user.id).single();
    if (!profile?.org_id) {
      return new Response(JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { doc_id } = await req.json();
    if (!doc_id) throw new Error("doc_id is required");

    const { data: doc, error: docError } = await supabaseAdmin
      .from("ai_knowledge_docs")
      .select("*")
      .eq("id", doc_id)
      .single();

    if (docError || !doc) throw new Error("Document not found");

    if (doc.org_id !== profile.org_id) {
      return new Response(JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const chunks = chunkText(doc.content);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um processador de documentos. Analise o documento e retorne EXATAMENTE no formato JSON abaixo, sem markdown, sem code blocks:
{"summary":"resumo de 2-3 frases do documento","keywords":["palavra1","palavra2",...,"palavraN"]}

Regras:
- summary: resumo conciso capturando os pontos principais (máx 200 palavras)
- keywords: 15-30 palavras-chave relevantes incluindo sinônimos, variações e termos relacionados
- Inclua termos técnicos, nomes próprios, siglas e conceitos-chave
- Retorne APENAS o JSON, nada mais`
          },
          {
            role: "user",
            content: `Título: ${doc.title}\n\nConteúdo:\n${doc.content.substring(0, 8000)}`
          }
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI error:", aiResponse.status, await aiResponse.text());
      throw new Error("AI processing failed");
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    let parsed: { summary: string; keywords: string[] };
    try {
      const cleanJson = rawContent.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      const words = doc.content.toLowerCase().split(/\W+/).filter((w: string) => w.length > 3);
      const freq: Record<string, number> = {};
      words.forEach((w: string) => { freq[w] = (freq[w] || 0) + 1; });
      const topWords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([w]) => w);
      parsed = {
        summary: doc.content.substring(0, 300),
        keywords: topWords,
      };
    }

    const chunksWithMeta = chunks.map((chunk, i) => ({
      index: i,
      text: chunk,
      local_keywords: chunk.toLowerCase()
        .split(/\W+/)
        .filter((w: string) => w.length > 3)
        .reduce((acc: Record<string, number>, w: string) => { acc[w] = (acc[w] || 0) + 1; return acc; }, {} as Record<string, number>),
    }));

    const { error: updateError } = await supabaseAdmin
      .from("ai_knowledge_docs")
      .update({
        summary: parsed.summary,
        keywords: parsed.keywords.map((k: string) => k.toLowerCase()),
        chunks: chunksWithMeta,
        processed: true,
      })
      .eq("id", doc_id);

    if (updateError) throw updateError;

    // Generate embedding via Google API
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (GOOGLE_API_KEY) {
      try {
        const embeddingResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GOOGLE_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "models/gemini-embedding-001",
              content: { parts: [{ text: doc.content.substring(0, 10000) }] },
              outputDimensionality: 768,
            }),
          }
        );

        if (embeddingResponse.ok) {
          const embData = await embeddingResponse.json();
          const vector = embData?.embedding?.values;
          if (vector?.length === 768) {
            await supabaseAdmin
              .from("ai_knowledge_docs")
              .update({ embedding: JSON.stringify(vector) } as any)
              .eq("id", doc_id);
            console.log("Embedding generated and saved for doc:", doc_id);
          }
        } else {
          console.error("Embedding API error:", embeddingResponse.status, await embeddingResponse.text());
        }
      } catch (embErr) {
        console.error("Embedding generation failed:", embErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, chunks_count: chunks.length, keywords_count: parsed.keywords.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("process-knowledge error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
