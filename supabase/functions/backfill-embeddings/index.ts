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
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY is not configured");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth check
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

    // Check if user is platform admin
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Forbidden - admin only" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Parse optional batch_size from body
    let batch_size = 10;
    try {
      const body = await req.json();
      if (body?.batch_size) batch_size = Math.min(body.batch_size, 50);
    } catch {}

    // Fetch docs without embedding
    const { data: docs, error: fetchError } = await supabaseAdmin
      .from("ai_knowledge_docs")
      .select("id, title, content")
      .is("embedding", null)
      .limit(batch_size);

    if (fetchError) throw fetchError;
    if (!docs || docs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No documents need embedding", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${docs.length} docs without embedding`);

    let processed = 0;
    let failed = 0;
    const errors: { id: string; title: string; error: string }[] = [];

    for (const doc of docs) {
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

        if (!embeddingResponse.ok) {
          const errText = await embeddingResponse.text();
          throw new Error(`API ${embeddingResponse.status}: ${errText}`);
        }

        const embData = await embeddingResponse.json();
        const vector = embData?.embedding?.values;

        if (!vector || vector.length !== 768) {
          throw new Error(`Invalid vector length: ${vector?.length}`);
        }

        const { error: updateError } = await supabaseAdmin
          .from("ai_knowledge_docs")
          .update({ embedding: JSON.stringify(vector) } as any)
          .eq("id", doc.id);

        if (updateError) throw updateError;

        processed++;
        console.log(`✓ Embedded: ${doc.title} (${processed}/${docs.length})`);

        // Rate limit: wait 2s between requests (free tier)
        if (processed < docs.length) {
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (docErr) {
        failed++;
        const errMsg = docErr instanceof Error ? docErr.message : "Unknown error";
        errors.push({ id: doc.id, title: doc.title, error: errMsg });
        console.error(`✗ Failed: ${doc.title} - ${errMsg}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, total: docs.length, processed, failed, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("backfill-embeddings error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
