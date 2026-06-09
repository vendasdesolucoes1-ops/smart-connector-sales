import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Zap, Sparkles, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AIControlTab({ orgId }: { orgId: string }) {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [metrics, setMetrics] = useState({ totalConversations: 0, activeConversations: 0, totalLeadsConverted: 0 });
  const [activities, setActivities] = useState<any[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data } = await supabase
        .from("ai_scenarios" as any)
        .select("enabled")
        .eq("org_id", orgId)
        .eq("enabled", true)
        .limit(1);
      setAiEnabled((data?.length || 0) > 0);
    })();
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      setLoadingMetrics(true);
      try {
        const { count: totalConvos } = await supabase
          .from("conversation_tracker")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId);

        const { count: activeConvos } = await supabase
          .from("conversation_tracker")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("follow_up_paused", false);

        const { count: leadsConverted } = await supabase
          .from("leads_raw")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("status", "converted");

        setMetrics({
          totalConversations: totalConvos || 0,
          activeConversations: activeConvos || 0,
          totalLeadsConverted: leadsConverted || 0,
        });
      } catch (e) { console.error(e); }
      setLoadingMetrics(false);
    })();
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("org_id", orgId)
        .like("action", "ia_%")
        .order("created_at", { ascending: false })
        .limit(20);
      setActivities(data || []);
    })();
  }, [orgId]);

  const toggleGlobalAI = async (enabled: boolean) => {
    setAiEnabled(enabled);
    const { error } = await supabase
      .from("ai_scenarios" as any)
      .update({ enabled })
      .eq("org_id", orgId);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      setAiEnabled(!enabled);
    } else {
      toast({ title: enabled ? "IA ativada!" : "IA desativada", description: enabled ? "Todos os cenários de IA foram ativados." : "Todos os cenários de IA foram pausados." });
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return "agora";
    if (diffMin < 60) return `${diffMin}min atrás`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h atrás`;
    return `${Math.floor(diffH / 24)}d atrás`;
  };

  const getActionLabel = (action: string) => {
    const map: Record<string, string> = {
      ia_config_salva: "Configuração salva",
      ia_chatbot_resposta: "Resposta enviada",
      ia_follow_up: "Follow-up disparado",
      ia_lead_qualificado: "Lead qualificado",
      ia_agendamento: "Agendamento criado",
      ia_erro: "Erro na IA",
    };
    return map[action] || action.replace("ia_", "").replace(/_/g, " ");
  };

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Disparador IA</h3>
              <p className="text-xs text-muted-foreground">Ative para que a IA inicie e gerencie conversas automaticamente</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={aiEnabled} onCheckedChange={toggleGlobalAI} />
            <Badge variant="outline" className={aiEnabled ? "bg-success/10 text-success border-success/30 text-xs" : "text-xs"}>
              {aiEnabled ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Conversas Rastreadas", value: loadingMetrics ? "..." : String(metrics.totalConversations), color: "text-primary" },
          { label: "Conversas Ativas", value: loadingMetrics ? "..." : String(metrics.activeConversations), color: "text-success" },
          { label: "Leads Convertidos", value: loadingMetrics ? "..." : String(metrics.totalLeadsConverted), color: "text-warning" },
        ].map((m) => (
          <div key={m.label} className="glass rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="glass-card p-5">
        <h3 className="text-sm font-medium mb-4">Log de Atividades da IA</h3>
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda</p>
            <p className="text-xs text-muted-foreground/60 mt-1">As ações da IA aparecerão aqui em tempo real</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {activities.map((act) => (
                <div key={act.id} className="flex items-start gap-3 p-3 rounded-xl border bg-secondary/20">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${act.success ? "bg-success/15" : "bg-destructive/15"}`}>
                    {act.success ? <Sparkles className="h-4 w-4 text-success" /> : <Zap className="h-4 w-4 text-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium truncate">{getActionLabel(act.action)}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(act.created_at)}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{act.description}</p>
                    {act.error_message && <p className="text-[10px] text-destructive mt-0.5">{act.error_message}</p>}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
