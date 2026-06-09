import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Stage = { id: string; name: string; stage_order: number; stage_key: string | null };
type Opportunity = {
  id: string;
  stage_id: string;
  value: number | null;
  probability: number | null;
  notes: string | null;
  automation_status: string | null;
  personalized_message: string | null;
  message_sent_at: string | null;
  lead_id: string;
  lead: { name: string | null; phone: string | null; email: string | null; enrichment_data: any } | null;
};

const PIPELINE_STAGE_DEFAULTS = [
  { key: "lead", name: "Lead" },
  { key: "enriched", name: "Enriquecidas" },
  { key: "contacted", name: "Contato Feito" },
  { key: "prospecting", name: "Em Prospecção" },
  { key: "qualified", name: "Qualificado" },
  { key: "scheduled", name: "Agendado" },
  { key: "meeting", name: "Reunião/Proposta" },
  { key: "won", name: "Ganho" },
  { key: "lost", name: "Perdido" },
];

async function fetchCRMData(orgId: string): Promise<{ stages: Stage[]; opportunities: Opportunity[] }> {
  const [stagesRes, oppsRes] = await Promise.all([
    supabase.from("crm_stages").select("id, name, stage_order, stage_key").eq("org_id", orgId).order("stage_order"),
    supabase.from("opportunities")
      .select("id, stage_id, value, probability, notes, automation_status, personalized_message, message_sent_at, lead_id, lead:leads_raw(name, phone, email, enrichment_data)")
      .eq("org_id", orgId),
  ]);

  let currentStages = stagesRes.data ?? [];
  if (currentStages.length === 0) {
    const stagesToInsert = PIPELINE_STAGE_DEFAULTS.map((s, i) => ({ org_id: orgId, name: s.name, stage_order: i }));
    const { data: newStages } = await supabase.from("crm_stages").insert(stagesToInsert).select("id, name, stage_order, stage_key").order("stage_order");
    currentStages = newStages ?? [];
  }

  const opportunities = (oppsRes.data ?? []).map((o: any) => ({
    ...o,
    lead: Array.isArray(o.lead) ? o.lead[0] || null : o.lead,
  }));

  return { stages: currentStages, opportunities };
}

export function useCRMData(orgId: string | undefined) {
  return useQuery({
    queryKey: ["crm-data", orgId],
    queryFn: () => fetchCRMData(orgId!),
    enabled: !!orgId,
    staleTime: 30_000,
  });
}
