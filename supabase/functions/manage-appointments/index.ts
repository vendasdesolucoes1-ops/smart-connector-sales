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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { action, org_id, lead_name, lead_phone, date, time, duration_minutes, title, appointment_id, reason, _internal } = await req.json();

    // Allow internal calls (from ai-whatsapp-hook) via service role key in Authorization header
    const authHeader = req.headers.get("authorization");
    const isServiceCall = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;

    if (!isServiceCall) {
      // Verify caller is authenticated
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify user belongs to the org
      const supabaseCheck = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: profile } = await supabaseCheck
        .from("profiles")
        .select("org_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile || profile.org_id !== org_id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ACTION: check_availability — check if a time slot is free
    if (action === "check_availability") {
      const targetDate = new Date(`${date}T${time || "00:00"}:00`);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: existing } = await supabaseAdmin
        .from("appointments")
        .select("*")
        .eq("org_id", org_id)
        .gte("scheduled_at", startOfDay.toISOString())
        .lte("scheduled_at", endOfDay.toISOString())
        .neq("status", "cancelled")
        .order("scheduled_at");

      const slots = (existing || []).map((a: any) => ({
        time: new Date(a.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
        title: a.title,
        lead: a.lead_name,
        duration: a.duration_minutes,
        status: a.status,
      }));

      return new Response(JSON.stringify({
        success: true,
        date,
        total_appointments: slots.length,
        appointments: slots,
        message: slots.length === 0
          ? `Não há agendamentos para ${date}. Horário livre!`
          : `Existem ${slots.length} agendamentos para ${date}: ${slots.map(s => `${s.time} - ${s.title}`).join(", ")}`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ACTION: create — create a new appointment
    if (action === "create") {
      if (!date || !time) {
        return new Response(JSON.stringify({ success: false, error: "Data e hora são obrigatórios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const scheduledAt = new Date(`${date}T${time}:00`);
      
      // Try to find lead by phone
      let leadId = null;
      if (lead_phone) {
        const phone = lead_phone.replace(/\D/g, "");
        const { data: lead } = await supabaseAdmin
          .from("leads_raw")
          .select("id")
          .eq("org_id", org_id)
          .or(`phone.ilike.%${phone}%,phone.ilike.%${phone.slice(-8)}%`)
          .maybeSingle();
        if (lead) leadId = lead.id;
      }

      const { data: apt, error } = await supabaseAdmin
        .from("appointments")
        .insert({
          org_id,
          title: title || `Reunião com ${lead_name || "Lead"}`,
          lead_name: lead_name || null,
          lead_phone: lead_phone || null,
          lead_id: leadId,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: duration_minutes || 30,
          created_via: "ai",
          status: "scheduled",
        })
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const formattedDate = scheduledAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const formattedTime = scheduledAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

      return new Response(JSON.stringify({
        success: true,
        appointment: apt,
        message: `Agendamento criado: ${apt.title} em ${formattedDate} às ${formattedTime} (${duration_minutes || 30}min)`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ACTION: cancel — cancel an appointment
    if (action === "cancel") {
      let query = supabaseAdmin
        .from("appointments")
        .select("*")
        .eq("org_id", org_id)
        .neq("status", "cancelled");

      if (appointment_id) {
        query = query.eq("id", appointment_id);
      } else if (lead_phone) {
        const phone = lead_phone.replace(/\D/g, "");
        query = query.or(`lead_phone.ilike.%${phone}%,lead_phone.ilike.%${phone.slice(-8)}%`);
      } else if (lead_name) {
        query = query.ilike("lead_name", `%${lead_name}%`);
      }

      const { data: matches } = await query.order("scheduled_at", { ascending: true });

      if (!matches || matches.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          message: "Nenhum agendamento encontrado para cancelar.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Cancel the next upcoming one
      const nextApt = matches.find((a: any) => new Date(a.scheduled_at) >= new Date()) || matches[0];
      
      await supabaseAdmin
        .from("appointments")
        .update({ status: "cancelled", cancelled_reason: reason || "Cancelado via IA" })
        .eq("id", nextApt.id);

      return new Response(JSON.stringify({
        success: true,
        message: `Agendamento "${nextApt.title}" cancelado com sucesso.`,
        cancelled_appointment: nextApt,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ACTION: list_upcoming — list upcoming appointments for a lead
    if (action === "list_upcoming") {
      let query = supabaseAdmin
        .from("appointments")
        .select("*")
        .eq("org_id", org_id)
        .gte("scheduled_at", new Date().toISOString())
        .neq("status", "cancelled")
        .order("scheduled_at", { ascending: true })
        .limit(10);

      if (lead_phone) {
        const phone = lead_phone.replace(/\D/g, "");
        query = query.or(`lead_phone.ilike.%${phone}%,lead_phone.ilike.%${phone.slice(-8)}%`);
      } else if (lead_name) {
        query = query.ilike("lead_name", `%${lead_name}%`);
      }

      const { data: upcoming } = await query;

      if (!upcoming || upcoming.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          appointments: [],
          message: "Nenhum agendamento futuro encontrado.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const formatted = upcoming.map((a: any) => {
        const dt = new Date(a.scheduled_at);
        return {
          id: a.id,
          title: a.title,
          date: dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
          time: dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
          duration: a.duration_minutes,
          status: a.status,
          lead: a.lead_name,
        };
      });

      return new Response(JSON.stringify({
        success: true,
        appointments: formatted,
        message: `${formatted.length} agendamento(s) encontrado(s): ${formatted.map(f => `${f.date} ${f.time} - ${f.title}`).join("; ")}`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Ação inválida. Use: check_availability, create, cancel, list_upcoming" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("manage-appointments error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
