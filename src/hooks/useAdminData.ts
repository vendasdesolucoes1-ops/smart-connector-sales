import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function fetchAdminData() {
  const session = (await supabase.auth.getSession()).data.session;
  const [leadsRes, contentRes, usersRes, orgsRes] = await Promise.all([
    supabase.from("site_leads").select("*").order("created_at", { ascending: false }),
    supabase.from("site_content").select("*"),
    supabase.functions.invoke("admin-list-users", {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    }),
    supabase.from("organizations").select("*").order("created_at", { ascending: false }),
  ]);
  return {
    siteLeads: (leadsRes.data ?? []) as any[],
    siteContent: (contentRes.data ?? []) as any[],
    users: (usersRes.data?.users ?? []) as any[],
    organizations: (orgsRes.data ?? []) as any[],
  };
}

export function useAdminData() {
  return useQuery({
    queryKey: ["admin-data"],
    queryFn: fetchAdminData,
    staleTime: 30_000,
  });
}
