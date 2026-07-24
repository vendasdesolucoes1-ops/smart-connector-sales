import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
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
      // Approve existing user — idempotent: create org only if they don't already have one
      userId = existing_user_id;

      // Fetch auth user to get canonical email
      const { data: authUserRes } = await supabaseAdmin.auth.admin.getUserById(userId);
      userEmail = email || authUserRes?.user?.email || "";

      // Guard against duplicate approval: check profile OR any membership OR any owned org
      const [{ data: profile }, { data: existingRole }, { data: existingOwnedOrg }] = await Promise.all([
        supabaseAdmin.from("profiles").select("org_id, full_name").eq("user_id", userId).maybeSingle(),
        supabaseAdmin.from("user_roles").select("org_id").eq("user_id", userId).neq("role", "admin").limit(1).maybeSingle(),
        supabaseAdmin.from("organizations").select("id").eq("owner_id", userId).limit(1).maybeSingle(),
      ]);

      const existingOrgId = profile?.org_id || existingRole?.org_id || existingOwnedOrg?.id || null;

      let orgId = existingOrgId;
      if (!orgId) {
        const userName = full_name || profile?.full_name || (userEmail ? userEmail.split("@")[0] : "Organização");
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
        orgId = org.id;

        // Default CRM stages for the new org
        const defaultStages = [
          { name: "Novo Lead", stage_order: 0, org_id: orgId },
          { name: "Qualificação", stage_order: 1, org_id: orgId },
          { name: "Proposta", stage_order: 2, org_id: orgId },
          { name: "Negociação", stage_order: 3, org_id: orgId },
          { name: "Fechado", stage_order: 4, org_id: orgId },
        ];
        await supabaseAdmin.from("crm_stages").insert(defaultStages);
      }

      // Upsert profile so admin-list-users sees org_id and stops flagging as pending
      await supabaseAdmin
        .from("profiles")
        .upsert(
          { user_id: userId, org_id: orgId, full_name: full_name || profile?.full_name || null },
          { onConflict: "user_id" }
        );

      // Ensure member role exists (idempotent)
      const { data: hasMemberRole } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("org_id", orgId)
        .eq("role", "member")
        .maybeSingle();
      if (!hasMemberRole) {
        await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: userId, org_id: orgId, role: "member" });
      }

      // Mark invitation as used so InvitationGate lets the user in
      if (userEmail) {
        await supabaseAdmin
          .from("invitations")
          .upsert(
            { email: userEmail, invited_by: caller.id, used_at: new Date().toISOString() },
            { onConflict: "email" }
          );
      }

      return new Response(
        JSON.stringify({ success: true, user_id: userId, email: userEmail, org_id: orgId, plan, already_approved: Boolean(existingOrgId) }),
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

    // Upsert profile with org_id (profile row may not exist yet)
    if (org) {
      await supabaseAdmin
        .from("profiles")
        .upsert(
          { user_id: userId, org_id: org.id, full_name: full_name || "" },
          { onConflict: "user_id" }
        );

      // Add member role
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, org_id: org.id, role: "member" });

      // Mark invitation as used so InvitationGate lets the user in
      await supabaseAdmin
        .from("invitations")
        .upsert(
          { email: userEmail, invited_by: caller.id, used_at: new Date().toISOString() },
          { onConflict: "email" }
        );
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
