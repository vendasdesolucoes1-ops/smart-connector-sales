import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Verify caller is admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !caller) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: roleData } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleData) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { user_id, delete_org_data } = await req.json();

  if (!user_id) {
    return new Response(JSON.stringify({ error: "user_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Prevent deleting yourself
  if (user_id === caller.id) {
    return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Get user's org_id from profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("org_id")
      .eq("user_id", user_id)
      .maybeSingle();

    const orgId = profile?.org_id;

    // If delete_org_data is true and user has an org, wipe all org-related data
    if (delete_org_data && orgId) {
      console.log(`Wiping all data for org ${orgId}...`);

      // Delete in dependency order (children first)
      // 1. broadcast_leads (depends on broadcasts)
      const { data: broadcasts } = await supabaseAdmin
        .from("broadcasts")
        .select("id")
        .eq("org_id", orgId);
      if (broadcasts && broadcasts.length > 0) {
        const broadcastIds = broadcasts.map((b: any) => b.id);
        await supabaseAdmin.from("broadcast_leads").delete().in("broadcast_id", broadcastIds);
      }

      // 2. broadcasts
      await supabaseAdmin.from("broadcasts").delete().eq("org_id", orgId);

      // 3. opportunities (depends on leads_raw, crm_stages)
      await supabaseAdmin.from("opportunities").delete().eq("org_id", orgId);

      // 4. conversation_tracker
      await supabaseAdmin.from("conversation_tracker").delete().eq("org_id", orgId);

      // 5. appointments
      await supabaseAdmin.from("appointments").delete().eq("org_id", orgId);

      // 6. follow_up_rules (depends on ai_configs)
      await supabaseAdmin.from("follow_up_rules").delete().eq("org_id", orgId);

      // 7. ai_knowledge_docs
      await supabaseAdmin.from("ai_knowledge_docs").delete().eq("org_id", orgId);

      // 8. ai_configs
      await supabaseAdmin.from("ai_configs").delete().eq("org_id", orgId);

      // 9. leads_raw
      await supabaseAdmin.from("leads_raw").delete().eq("org_id", orgId);

      // 10. crm_stages
      await supabaseAdmin.from("crm_stages").delete().eq("org_id", orgId);

      // 11. integrations
      await supabaseAdmin.from("integrations").delete().eq("org_id", orgId);

      // 12. company_profiles
      await supabaseAdmin.from("company_profiles").delete().eq("org_id", orgId);

      // 13. Other user profiles in same org
      // (only delete profiles of THIS user, not other members)

      // 14. user_roles for this user
      await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);

      // 15. profile
      await supabaseAdmin.from("profiles").delete().eq("user_id", user_id);

      // 16. organization itself
      await supabaseAdmin.from("organizations").delete().eq("id", orgId);

      console.log(`All org data wiped for org ${orgId}`);
    } else {
      // Just delete user-specific records
      await supabaseAdmin.from("profiles").delete().eq("user_id", user_id);
      await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
    }

    // Delete auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, org_deleted: delete_org_data && !!orgId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error deleting user:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
