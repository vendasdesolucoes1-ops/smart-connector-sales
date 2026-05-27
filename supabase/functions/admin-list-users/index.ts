import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: roleData } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleData) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    return new Response(JSON.stringify({ error: listError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: profiles } = await supabaseAdmin.from("profiles").select("*");
  const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

  const users = authUsers.users.map(u => {
    const profile = profileMap.get(u.id);
    const provider = u.app_metadata?.provider || "email";
    return {
      id: u.id,
      email: u.email,
      full_name: profile?.full_name || u.user_metadata?.full_name || null,
      org_id: profile?.org_id || null,
      provider,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    };
  });

  return new Response(JSON.stringify({ users }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
