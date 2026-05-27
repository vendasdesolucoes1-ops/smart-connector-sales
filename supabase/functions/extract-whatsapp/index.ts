import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const formatPhone = (jid: string) => {
  const digits = jid.replace(/@.*/, "").replace(/\D/g, "");
  return digits ? `+${digits}` : null;
};

const formatJid = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { org_id, mode = "group", group_ids, instance_name, tags } = body;

    if (!org_id) return json({ error: "org_id is required" }, 400);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Use global Evolution API credentials from environment
    const apiKey = Deno.env.get("EVOLUTION_API_KEY") || "";
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL") || "";
    if (!apiKey || !evolutionUrl) {
      return json({ error: "Evolution API não configurada no sistema." }, 500);
    }

    const baseUrl = evolutionUrl.replace(/\/$/, "");
    const instance = instance_name || "default";

    // Verify instance is connected before any operation
    try {
      const stateResp = await fetch(`${baseUrl}/instance/connectionState/${instance}`, {
        method: "GET",
        headers: { apikey: apiKey },
      });
      if (!stateResp.ok) {
        const errText = await stateResp.text();
        console.error("Instance state check failed:", stateResp.status, errText);
        return json({ error: `Instância "${instance}" não encontrada. Verifique se ela existe e tente novamente.` }, 400);
      }
      const stateData = await stateResp.json();
      const connState = stateData?.instance?.state || stateData?.state;
      if (connState !== "open") {
        return json({ error: `Instância "${instance}" não está conectada (status: ${connState || "desconhecido"}). Conecte via QR Code primeiro.` }, 400);
      }
    } catch (e) {
      console.error("Instance state check error:", e);
      return json({ error: `Erro ao verificar instância "${instance}". Tente novamente.` }, 500);
    }

    // ============================================
    // MODE: list_groups - Return all groups for selection
    // ============================================
    if (mode === "list_groups") {
      console.log("Mode: list_groups | Fetching groups from:", baseUrl);

      const groupsResponse = await fetch(`${baseUrl}/group/fetchAllGroups/${instance}?getParticipants=false`, {
        method: "GET",
        headers: { apikey: apiKey },
      });

      if (!groupsResponse.ok) {
        const errText = await groupsResponse.text();
        console.error("Evolution groups error:", groupsResponse.status, errText);
        return json({ error: `Erro ao buscar grupos (${groupsResponse.status}). Verifique se o WhatsApp está conectado.`, details: errText }, 400);
      }

      const groups = await groupsResponse.json();
      const groupList = (Array.isArray(groups) ? groups : []).map((g: any) => ({
        id: g.id,
        name: g.subject || g.name || "Sem nome",
        size: g.size || g.participants?.length || 0,
      }));

      return json({ groups: groupList });
    }

    // ============================================
    // MODE: group - Extract participants from selected groups
    // ============================================
    if (mode === "group") {
      if (!group_ids || !Array.isArray(group_ids) || group_ids.length === 0) {
        return json({ error: "group_ids (array) is required for group mode" }, 400);
      }

      console.log("Mode: group | Extracting from groups:", group_ids.length);

      // Fetch all groups to get metadata
      const groupsResponse = await fetch(`${baseUrl}/group/fetchAllGroups/${instance}`, {
        method: "GET",
        headers: { apikey: apiKey },
      });

      if (!groupsResponse.ok) {
        return json({ error: `Erro ao buscar grupos: ${groupsResponse.status}` }, 502);
      }

      const allGroups = await groupsResponse.json();
      const groupsArr = Array.isArray(allGroups) ? allGroups : [];

      let totalNew = 0;
      let totalParticipants = 0;
      const groupNames: string[] = [];

      for (const groupId of group_ids) {
        const targetGroup = groupsArr.find((g: any) => g.id === groupId);
        const groupName = targetGroup?.subject || groupId;
        groupNames.push(groupName);

        const participantsResponse = await fetch(`${baseUrl}/group/participants/${instance}?groupJid=${groupId}`, {
          method: "GET",
          headers: { apikey: apiKey },
        });

        if (!participantsResponse.ok) {
          const errStatus = participantsResponse.status;
          const errText = await participantsResponse.text();
          console.error(`Failed to get participants for group ${groupId}:`, errStatus, errText);
          continue;
        }

        const participantsData = await participantsResponse.json();
        const participants = participantsData?.participants || participantsData || [];
        if (!Array.isArray(participants)) continue;

        totalParticipants += participants.length;

        const phones = participants.map((p: any) => formatPhone(p.id || "")).filter(Boolean);
        const { data: existingLeads } = await supabaseAdmin
          .from("leads_raw").select("phone").eq("org_id", org_id).in("phone", phones);
        const existingPhones = new Set((existingLeads || []).map((l) => l.phone));

        const newLeads = participants
          .map((p: any) => {
            const ph = formatPhone(p.id || "");
            if (!ph || existingPhones.has(ph)) return null;
            return {
              org_id,
              name: p.name || p.notify || null,
              phone: ph,
              source: "whatsapp" as const,
              status: "pending" as const,
              tags: Array.isArray(tags) && tags.length > 0 ? tags : [],
              enrichment_data: { group: groupName, group_id: groupId, extraction_type: "group" },
            };
          })
          .filter(Boolean);

        if (newLeads.length > 0) {
          const { error: insertError } = await supabaseAdmin.from("leads_raw").insert(newLeads);
          if (insertError) console.error("Insert error:", insertError);
          else totalNew += newLeads.length;
        }
      }

      return json({ count: totalNew, total_participants: totalParticipants, groups: groupNames });
    }

    // ============================================
    // MODE: list_conversations - Return all chats (name + phone)
    // ============================================
    if (mode === "list_conversations") {
      console.log("Mode: list_conversations | Fetching all chats from:", instance);

      const contactsResponse = await fetch(`${baseUrl}/chat/findContacts/${instance}`, {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ where: {} }),
      });

      if (!contactsResponse.ok) {
        return json({ error: `Erro ao buscar conversas: ${contactsResponse.status}` }, 502);
      }

      const contactsData = await contactsResponse.json();
      const contacts = Array.isArray(contactsData) ? contactsData : contactsData?.data || contactsData?.contacts || [];

      const conversations = contacts
        .filter((c: any) => {
          const jid = c.remoteJid || c.jid || "";
          return jid.endsWith("@s.whatsapp.net") && !jid.startsWith("0@") && !jid.startsWith("status@");
        })
        .map((c: any) => ({
          phone: formatPhone(c.remoteJid || c.jid || ""),
          name: c.pushName || c.name || c.verifiedName || c.notify || null,
        }))
        .filter((c: any) => c.phone);

      return json({ conversations });
    }

    // ============================================
    // MODE: conversation - Extract ALL conversations as leads
    // ============================================
    if (mode === "conversation") {
      console.log("Mode: conversation | Extracting all conversations from:", instance);

      const contactsResponse = await fetch(`${baseUrl}/chat/findContacts/${instance}`, {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ where: {} }),
      });

      if (!contactsResponse.ok) {
        return json({ error: `Erro ao buscar conversas: ${contactsResponse.status}` }, 502);
      }

      const contactsData = await contactsResponse.json();
      const contacts = Array.isArray(contactsData) ? contactsData : contactsData?.data || contactsData?.contacts || [];

      const individualContacts = contacts.filter((c: any) => {
        const jid = c.remoteJid || c.jid || "";
        return jid.endsWith("@s.whatsapp.net") && !jid.startsWith("0@") && !jid.startsWith("status@");
      });

      const phones = individualContacts.map((c: any) => formatPhone(c.remoteJid || c.jid || "")).filter(Boolean);

      // Deduplicate in batches
      let allExistingPhones = new Set<string | null>();
      for (let i = 0; i < phones.length; i += 500) {
        const batch = phones.slice(i, i + 500);
        const { data: existingLeads } = await supabaseAdmin
          .from("leads_raw").select("phone").eq("org_id", org_id).in("phone", batch);
        (existingLeads || []).forEach((l) => allExistingPhones.add(l.phone));
      }

      const newLeads = individualContacts
        .map((c: any) => {
          const ph = formatPhone(c.remoteJid || c.jid || "");
          if (!ph || allExistingPhones.has(ph)) return null;
          return {
            org_id,
            name: c.pushName || c.name || c.verifiedName || c.notify || null,
            phone: ph,
            source: "whatsapp" as const,
            status: "pending" as const,
            enrichment_data: { extraction_type: "conversation" },
          };
        })
        .filter(Boolean);

      let insertedCount = 0;
      for (let i = 0; i < newLeads.length; i += 500) {
        const batch = newLeads.slice(i, i + 500);
        const { error: insertError } = await supabaseAdmin.from("leads_raw").insert(batch);
        if (insertError) {
          console.error("Insert error at batch", i, insertError);
          return json({ error: insertError.message, partial_count: insertedCount }, 500);
        }
        insertedCount += batch.length;
      }

      return json({ count: insertedCount, total_conversations: individualContacts.length, already_existing: allExistingPhones.size });
    }

    // ============================================
    // MODE: contact - Import all saved contacts
    // ============================================
    if (mode === "contact") {
      console.log("Mode: contact | Fetching all saved contacts from:", instance);

      const contactsResponse = await fetch(`${baseUrl}/chat/findContacts/${instance}`, {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ where: {} }),
      });

      if (!contactsResponse.ok) {
        return json({ error: `Erro ao buscar contatos: ${contactsResponse.status}` }, 502);
      }

      const contactsData = await contactsResponse.json();
      const contacts = Array.isArray(contactsData) ? contactsData : contactsData?.data || contactsData?.contacts || [];

      // Saved contacts are ones that have a name (pushName/name/verifiedName)
      const savedContacts = contacts.filter((c: any) => {
        const jid = c.remoteJid || c.jid || "";
        const hasName = c.pushName || c.name || c.verifiedName;
        return jid.endsWith("@s.whatsapp.net") && !jid.startsWith("0@") && !jid.startsWith("status@") && hasName;
      });

      const phones = savedContacts.map((c: any) => formatPhone(c.remoteJid || c.jid || "")).filter(Boolean);

      let allExistingPhones = new Set<string | null>();
      for (let i = 0; i < phones.length; i += 500) {
        const batch = phones.slice(i, i + 500);
        const { data: existingLeads } = await supabaseAdmin
          .from("leads_raw").select("phone").eq("org_id", org_id).in("phone", batch);
        (existingLeads || []).forEach((l) => allExistingPhones.add(l.phone));
      }

      const newLeads = savedContacts
        .map((c: any) => {
          const ph = formatPhone(c.remoteJid || c.jid || "");
          if (!ph || allExistingPhones.has(ph)) return null;
          return {
            org_id,
            name: c.pushName || c.name || c.verifiedName || null,
            phone: ph,
            source: "whatsapp" as const,
            status: "pending" as const,
            enrichment_data: { extraction_type: "contact", profile_pic: c.profilePictureUrl || null },
          };
        })
        .filter(Boolean);

      let insertedCount = 0;
      for (let i = 0; i < newLeads.length; i += 500) {
        const batch = newLeads.slice(i, i + 500);
        const { error: insertError } = await supabaseAdmin.from("leads_raw").insert(batch);
        if (insertError) {
          console.error("Insert error at batch", i, insertError);
          return json({ error: insertError.message, partial_count: insertedCount }, 500);
        }
        insertedCount += batch.length;
      }

      return json({ count: insertedCount, total_contacts: savedContacts.length, already_existing: allExistingPhones.size });
    }

    return json({ error: `Modo inválido: ${mode}. Use 'list_groups', 'group', 'list_conversations', 'conversation' ou 'contact'.` }, 400);

  } catch (e) {
    console.error("extract-whatsapp error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
