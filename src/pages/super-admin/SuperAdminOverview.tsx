import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, Wifi, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type OrgRow = {
  id: string;
  name: string;
  owner_email: string | null;
  created_at: string;
  instance_name: string | null;
  instance_status: string | null;
};

type Overview = {
  total_orgs: number;
  total_users: number;
  total_connected_instances: number;
  organizations: OrgRow[];
};

const statusLabel = (status: string | null) => {
  if (status === "open") return { label: "Conectado", className: "bg-success/10 text-success border-success/30" };
  if (!status) return { label: "Sem instância", className: "text-muted-foreground" };
  return { label: status, className: "bg-warning/10 text-warning border-warning/30" };
};

export default function SuperAdminOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.rpc("get_admin_overview" as any).then(({ data, error }) => {
      if (!error) setData(data as unknown as Overview);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Visão geral</h1>
        <p className="text-muted-foreground text-sm">Status de todas as organizações na plataforma</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass rounded-2xl p-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{data?.total_orgs ?? 0}</p>
            <p className="text-xs text-muted-foreground">Organizações</p>
          </div>
        </div>
        <div className="glass rounded-2xl p-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{data?.total_users ?? 0}</p>
            <p className="text-xs text-muted-foreground">Usuários</p>
          </div>
        </div>
        <div className="glass rounded-2xl p-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
            <Wifi className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{data?.total_connected_instances ?? 0}</p>
            <p className="text-xs text-muted-foreground">WhatsApp conectados</p>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-muted-foreground mb-4">Organizações</h2>
        {!data?.organizations?.length ? (
          <p className="text-sm text-muted-foreground py-4">Nenhuma organização cadastrada ainda.</p>
        ) : (
          <div className="space-y-2">
            {data.organizations.map((org) => {
              const status = statusLabel(org.instance_status);
              return (
                <div key={org.id} className="flex items-center justify-between rounded-xl border border-border/30 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{org.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {org.owner_email} · criada em {new Date(org.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${status.className}`}>{status.label}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
