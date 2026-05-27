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
  const {
    data: { user: caller },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);
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

  // Parse request body
  const { email, full_name, plan, temp_password, existing_user_id } = await req.json();

  if (!email && !existing_user_id) {
    return new Response(JSON.stringify({ error: "Email or existing_user_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let userId: string;
    let userEmail: string;
    let password: string | null = null;

    if (existing_user_id) {
      // Approve existing user — just create org for them
      userId = existing_user_id;
      userEmail = email || existing_user_id;

      // Check if user already has an org
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("org_id, full_name")
        .eq("user_id", userId)
        .maybeSingle();

      if (profile?.org_id) {
        return new Response(
          JSON.stringify({ error: "User already has an organization" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userName = full_name || profile?.full_name || userEmail.split("@")[0];

      // Create organization
      const { data: org, error: orgError } = await supabaseAdmin
        .from("organizations")
        .insert({ name: userName, owner_id: userId })
        .select()
        .single();

      if (orgError) {
        console.error("Org creation error:", orgError);
        return new Response(
          JSON.stringify({ error: orgError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update profile with org_id
      await supabaseAdmin
        .from("profiles")
        .update({ org_id: org.id })
        .eq("user_id", userId);

      // Add member role
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, org_id: org.id, role: "member" });

      // Create default CRM stages
      const defaultStages = [
        { name: "Novo Lead", stage_order: 0, org_id: org.id },
        { name: "Qualificação", stage_order: 1, org_id: org.id },
        { name: "Proposta", stage_order: 2, org_id: org.id },
        { name: "Negociação", stage_order: 3, org_id: org.id },
        { name: "Fechado", stage_order: 4, org_id: org.id },
      ];
      await supabaseAdmin.from("crm_stages").insert(defaultStages);

      return new Response(
        JSON.stringify({ success: true, user_id: userId, email: userEmail, plan }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create new user
    password = temp_password || Math.random().toString(36).slice(-10) + "A1!";

    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: password ?? undefined,
        email_confirm: true,
        user_metadata: { full_name: full_name || "" },
      });

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    userId = newUser.user.id;
    userEmail = newUser.user.email!;

    // Create organization for the user
    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .insert({ name: full_name || email.split("@")[0], owner_id: userId })
      .select()
      .single();

    if (orgError) {
      console.error("Org creation error:", orgError);
    }

    // Update profile with org_id
    if (org) {
      await supabaseAdmin
        .from("profiles")
        .update({ org_id: org.id, full_name: full_name || "" })
        .eq("user_id", userId);

      // Add member role
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, org_id: org.id, role: "member" });
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        email: userEmail,
        temp_password: password,
        plan,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error creating user:", err);
    return new Response(
      JSON.stringify({ error: "Internal error creating user" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
