import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encrypt, decrypt } from "../_shared/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth — extract and validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { action, org_id, service_name, api_key, endpoint_url, integration_id } = await req.json();

    // Verify org membership
    const { data: profileData } = await supabaseAdmin
      .from("profiles")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!profileData || profileData.org_id !== org_id) {
      return new Response(JSON.stringify({ error: "Not a member of this organization" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ENCRYPTION_KEY = Deno.env.get("ENCRYPTION_KEY");
    if (!ENCRYPTION_KEY) {
      return new Response(JSON.stringify({ error: "Encryption not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "save") {
      const encryptedKey = api_key ? await encrypt(api_key, ENCRYPTION_KEY) : null;

      const payload = {
        org_id,
        service_name,
        api_key: encryptedKey,
        endpoint_url: endpoint_url || null,
        status: "active",
      };

      if (integration_id) {
        const { error } = await supabaseAdmin.from("integrations").update(payload).eq("id", integration_id);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, id: integration_id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        const { data: inserted, error } = await supabaseAdmin.from("integrations").insert(payload).select("id").single();
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, id: inserted.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (action === "load") {
      const { data: rows, error } = await supabaseAdmin
        .from("integrations")
        .select("*")
        .eq("org_id", org_id);

      if (error) throw error;

      const decrypted = await Promise.all(
        (rows || []).map(async (row) => {
          let decryptedKey = row.api_key || "";
          if (row.api_key && row.api_key.includes(":")) {
            try {
              decryptedKey = await decrypt(row.api_key, ENCRYPTION_KEY);
            } catch {
              // Legacy plain-text key — return as-is
              decryptedKey = row.api_key;
            }
          }
          return { ...row, api_key: decryptedKey };
        })
      );

      return new Response(JSON.stringify({ data: decrypted }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
