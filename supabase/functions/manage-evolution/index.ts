import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log("[manage-evolution] Request received");

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Global Evolution API credentials from secrets
    const baseUrl = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/$/, "");
    const apiKey = Deno.env.get("EVOLUTION_API_KEY") || "";
    const WEBHOOK_SECRET = Deno.env.get("EVOLUTION_WEBHOOK_SECRET") || "";

    if (!baseUrl || !apiKey) {
      return json({ error: "Evolution API não configurada no sistema." }, 500);
    }
    if (!WEBHOOK_SECRET) {
      return json({ error: "EVOLUTION_WEBHOOK_SECRET não configurado no sistema." }, 500);
    }

    // ai-whatsapp-hook validates this secret as a query param (Evolution's
    // webhook config has no reliable way to attach custom headers).
    const buildWebhookUrl = () => `${SUPABASE_URL}/functions/v1/ai-whatsapp-hook?secret=${encodeURIComponent(WEBHOOK_SECRET)}`;

    const setEvolutionWebhook = async (instName: string) => {
      const response = await fetch(`${baseUrl}/webhook/set/${instName}`, {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          webhook: {
            url: buildWebhookUrl(),
            enabled: true,
            webhook_by_events: false,
            webhook_base64: false,
            events: ["MESSAGES_UPSERT"],
          },
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`${response.status} - ${errText}`);
      }
    };

    // Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const userId = user.id;
    const body = await req.json();
    const { action, org_id, instance_name } = body;

    if (!org_id) return json({ error: "org_id is required" }, 400);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // One instance per org, deterministic name — no longer user-supplied.
    const orgInstanceName = `org_${String(org_id).replace(/-/g, "")}`;

    // Helper: get/set per-user instances stored in a global config record
    // We use a single "evolution_instances" record in integrations for the org,
    // but instances are tracked per-user in a simple separate table approach.
    // For simplicity, we store user->instances mapping in profiles or a lightweight approach.
    // Actually, let's use a simple key-value in the user's profile metadata isn't available,
    // so we'll store in a global config keyed by org_id in integrations table.
    
    // Get or create the integration record for this org (auto-provision)
    let { data: integration } = await supabaseAdmin
      .from("integrations")
      .select("id, config")
      .eq("org_id", org_id)
      .eq("service_name", "evolution")
      .maybeSingle();

    if (!integration) {
      // Auto-create integration record for this org
      const { data: newInt, error: insertErr } = await supabaseAdmin
        .from("integrations")
        .insert({
          org_id,
          service_name: "evolution",
          api_key: "global",
          endpoint_url: baseUrl,
          status: "active",
          config: { instances_by_user: {} },
        })
        .select("id, config")
        .single();
      if (insertErr) {
        console.error("Failed to auto-create integration:", insertErr);
        return json({ error: "Erro ao configurar integração" }, 500);
      }
      integration = newInt;
    }

    const currentConfig = (integration.config as any) || {};

    const getUserInstances = (): string[] => {
      return currentConfig.instances_by_user?.[userId] || [];
    };
    const setUserInstances = async (names: string[]) => {
      const byUser = currentConfig.instances_by_user || {};
      byUser[userId] = names;
      await supabaseAdmin
        .from("integrations")
        .update({ config: { ...currentConfig, instances_by_user: byUser } })
        .eq("id", integration!.id);
    };

    // ============================================
    // ACTION: create_instance — one deterministic instance per org
    // ============================================
    if (action === "create_instance") {
      const response = await fetch(`${baseUrl}/instance/create`, {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName: orgInstanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        // Instance may already exist from a previous attempt — treat as success.
        if (response.status !== 403 && !errText.includes("already")) {
          return json({ error: `Erro ao criar instância: ${response.status} - ${errText}` }, 502);
        }
      }

      await supabaseAdmin
        .from("integration_instances")
        .upsert(
          { instance_name: orgInstanceName, org_id, integration_id: integration!.id, status: "pending" },
          { onConflict: "instance_name" }
        );

      return json({ instance_name: orgInstanceName });
    }

    // ============================================
    // ACTION: setup_webhook — configure the org's instance webhook
    // ============================================
    if (action === "setup_webhook") {
      try {
        await setEvolutionWebhook(orgInstanceName);
      } catch (e) {
        return json({ error: `Erro ao configurar webhook: ${e instanceof Error ? e.message : "Unknown error"}` }, 502);
      }
      return json({ success: true });
    }

    // ============================================
    // ACTION: connect — generate QR code for the org's instance
    // ============================================
    if (action === "connect") {
      const response = await fetch(`${baseUrl}/instance/connect/${orgInstanceName}`, {
        method: "GET",
        headers: { apikey: apiKey },
      });

      if (!response.ok) {
        const errText = await response.text();
        return json({ error: `Erro ao gerar QR code: ${response.status} - ${errText}` }, 502);
      }

      const data = await response.json();
      return json({ qrcode: data.base64 || data.qrcode, code: data.code });
    }

    // ============================================
    // ACTION: get_status — connection state for the org's instance
    // ============================================
    if (action === "get_status") {
      const response = await fetch(`${baseUrl}/instance/connectionState/${orgInstanceName}`, {
        method: "GET",
        headers: { apikey: apiKey },
      });

      if (!response.ok) return json({ state: "unknown" });

      const data = await response.json();
      const state = data.instance?.state || data.state || "unknown";
      const owner = data.instance?.owner || data.owner || null;
      const phoneNumber = owner ? String(owner).replace(/@s\.whatsapp\.net$/, "").replace(/@.*/, "") : null;

      await supabaseAdmin
        .from("integration_instances")
        .update({ status: state, ...(phoneNumber ? { phone_number: phoneNumber } : {}) })
        .eq("instance_name", orgInstanceName);

      return json({ state, phone_number: phoneNumber });
    }

    // ============================================
    // ACTION: disconnect — delete the org's instance so it can be re-created
    // ============================================
    if (action === "disconnect") {
      const response = await fetch(`${baseUrl}/instance/delete/${orgInstanceName}`, {
        method: "DELETE",
        headers: { apikey: apiKey },
      });

      if (!response.ok && response.status !== 404) {
        const errText = await response.text();
        return json({ error: `Erro ao desconectar: ${response.status} - ${errText}` }, 502);
      }

      await supabaseAdmin.from("integration_instances").delete().eq("instance_name", orgInstanceName);

      return json({ success: true });
    }

    // ============================================
    // ACTION: create
    // ============================================
    if (action === "create") {
      if (!instance_name) return json({ error: "instance_name is required" }, 400);

      const response = await fetch(`${baseUrl}/instance/create`, {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName: instance_name,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return json({ error: `Erro ao criar instância: ${response.status} - ${errText}` }, 502);
      }

      const data = await response.json();

      const userInst = getUserInstances();
      if (!userInst.includes(instance_name)) {
        userInst.push(instance_name);
        await setUserInstances(userInst);
      }

      // Sync integration_instances table
      await supabaseAdmin
        .from("integration_instances")
        .upsert({ instance_name, org_id, integration_id: integration!.id }, { onConflict: "instance_name" });

      // Auto-configure webhook for AI responses
      let webhookWarning: string | null = null;
      try {
        await setEvolutionWebhook(instance_name);
        console.log(`Webhook configured for instance: ${instance_name}`);
      } catch (e) {
        console.error(`Failed to set webhook for ${instance_name}:`, e);
        webhookWarning = "Instância criada, mas a configuração do webhook falhou. O bot de IA não vai responder até o webhook ser reconfigurado (use a ação 'setup-webhook').";
      }

      return json({ instance: data.instance, qrcode: data.qrcode, hash: data.hash, warning: webhookWarning });
    }

    // ============================================
    // ACTION: qrcode
    // ============================================
    if (action === "qrcode") {
      if (!instance_name) return json({ error: "instance_name is required" }, 400);

      const response = await fetch(`${baseUrl}/instance/connect/${instance_name}`, {
        method: "GET",
        headers: { apikey: apiKey },
      });

      if (!response.ok) {
        const errText = await response.text();
        return json({ error: `Erro ao obter QR code: ${response.status}` }, 502);
      }

      const data = await response.json();
      return json({ qrcode: data.base64 || data.qrcode, code: data.code });
    }

    // ============================================
    // ACTION: status
    // ============================================
    if (action === "status") {
      if (!instance_name) return json({ error: "instance_name is required" }, 400);

      const response = await fetch(`${baseUrl}/instance/connectionState/${instance_name}`, {
        method: "GET",
        headers: { apikey: apiKey },
      });

      if (!response.ok) return json({ state: "unknown" });

      const data = await response.json();
      const state = data.instance?.state || data.state || "unknown";

      if (state === "open") {
        const userInst = getUserInstances();
        if (!userInst.includes(instance_name)) {
          userInst.push(instance_name);
          await setUserInstances(userInst);
        }

        // Ensure webhook is configured when instance connects
        try {
          await setEvolutionWebhook(instance_name);
        } catch (e) {
          console.error(`Failed to set webhook for ${instance_name}:`, e);
          return json({ state, warning: "Conectado, mas a configuração do webhook falhou. O bot de IA não vai responder até o webhook ser reconfigurado (use a ação 'setup-webhook')." });
        }
      }

      return json({ state });
    }

    // ============================================
    // ACTION: list
    // ============================================
    if (action === "list") {
      const userInstances = getUserInstances();

      let apiMap: Record<string, { state: string; owner: string | null }> = {};
      try {
        const response = await fetch(`${baseUrl}/instance/fetchInstances`, {
          method: "GET",
          headers: { apikey: apiKey },
        });
        if (response.ok) {
          const raw = await response.json();
          const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.instances) ? raw.instances : Array.isArray(raw?.data) ? raw.data : [];
          for (const inst of arr) {
            const name = inst?.instance?.instanceName || inst?.instanceName || inst?.name;
            if (name) {
              apiMap[name] = {
                state: inst?.instance?.state || inst?.state || "unknown",
                owner: inst?.instance?.owner || inst?.owner || null,
              };
            }
          }
        }
      } catch { /* ignore */ }

      let instances = userInstances.map((name) => ({
        name,
        state: apiMap[name]?.state || "unknown",
        owner: apiMap[name]?.owner || null,
      }));

      instances = await Promise.all(instances.map(async (inst) => {
        if (inst.state !== "unknown") return inst;
        try {
          const stateResp = await fetch(`${baseUrl}/instance/connectionState/${inst.name}`, {
            method: "GET",
            headers: { apikey: apiKey },
          });
          if (!stateResp.ok) return inst;
          const stateData = await stateResp.json();
          return { ...inst, state: stateData.instance?.state || stateData.state || "unknown" };
        } catch { return inst; }
      }));

      return json({ instances });
    }

    // ============================================
    // ACTION: delete
    // ============================================
    if (action === "delete") {
      if (!instance_name) return json({ error: "instance_name is required" }, 400);

      const response = await fetch(`${baseUrl}/instance/delete/${instance_name}`, {
        method: "DELETE",
        headers: { apikey: apiKey },
      });

      if (!response.ok) {
        const errText = await response.text();
        // If 404, the instance no longer exists on the API — treat as success and clean up locally
        if (response.status === 404) {
          const userInst = getUserInstances().filter((n) => n !== instance_name);
          await setUserInstances(userInst);
          await supabaseAdmin.from("integration_instances").delete().eq("instance_name", instance_name);
          return json({ success: true, message: "Instância já não existia na API, removida localmente." });
        }
        return json({ error: `Erro ao deletar: ${response.status} - ${errText}` }, 502);
      }

      const userInst = getUserInstances().filter((n) => n !== instance_name);
      await setUserInstances(userInst);
      await supabaseAdmin.from("integration_instances").delete().eq("instance_name", instance_name);

      return json({ success: true });
    }

    // ============================================
    // ACTION: fetch_messages - Get chat messages for a specific contact
    // ============================================
    if (action === "fetch_messages") {
      if (!instance_name) return json({ error: "instance_name is required" }, 400);
      const { remote_jid, limit: msgLimit } = body;
      if (!remote_jid) return json({ error: "remote_jid is required" }, 400);

      // Read from our own chat_messages table
      const { data: dbMessages, error: dbErr } = await supabaseAdmin
        .from("chat_messages")
        .select("id, from_me, message_text, message_type, push_name, message_id, timestamp")
        .eq("org_id", org_id)
        .or(`instance_name.eq.${instance_name},instance_name.like.${instance_name}__%`)
        .eq("remote_jid", remote_jid)
        .order("timestamp", { ascending: true })
        .limit(msgLimit || 200);

      if (dbErr) {
        console.error("fetch_messages db error:", dbErr);
        return json({ error: dbErr.message }, 500);
      }

      const messages = (dbMessages || []).map((m: any) => ({
        id: m.message_id || m.id,
        fromMe: m.from_me,
        text: m.message_text,
        timestamp: new Date(m.timestamp).getTime(),
        pushName: m.push_name,
        type: m.message_type || "text",
      }));

      return json({ messages });
    }

    // ============================================
    // ACTION: list_contacts - List all conversation contacts for this instance
    // ============================================
    if (action === "list_contacts") {
      if (!instance_name) return json({ error: "instance_name is required" }, 400);

      // Fetch conversations from conversation_tracker for this org + instance
      const { data: convos, error: convErr } = await supabaseAdmin
        .from("conversation_tracker")
        .select("remote_jid, push_name, customer_msg_count, last_customer_msg_at, last_bot_msg_at, pipeline_stage_key, detected_audience")
        .eq("org_id", org_id)
        .or(`instance_name.eq.${instance_name},instance_name.like.${instance_name}__%`)
        .order("updated_at", { ascending: false });

      if (convErr) {
        console.error("list_contacts db error:", convErr);
        return json({ error: convErr.message }, 500);
      }

      return json({ contacts: convos || [] });
    }

    // ============================================
    // ACTION: setup-webhook (force webhook config for existing instances)
    // ============================================
    if (action === "setup-webhook") {
      if (!instance_name) return json({ error: "instance_name is required" }, 400);

      try {
        await setEvolutionWebhook(instance_name);
      } catch (e) {
        return json({ error: `Erro ao configurar webhook: ${e instanceof Error ? e.message : "Unknown error"}` }, 502);
      }

      return json({ success: true, message: "Webhook configurado com sucesso" });
    }

    return json({ error: `Ação inválida: ${action}` }, 400);

  } catch (e) {
    console.error("manage-evolution error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
