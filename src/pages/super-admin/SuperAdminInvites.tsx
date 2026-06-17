import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mail, Copy, Send, Loader2 } from "lucide-react";

type Invitation = {
  id: string;
  email: string;
  token: string;
  used_at: string | null;
  expires_at: string;
  created_at: string;
};

function inviteStatus(invite: Invitation): "pending" | "used" | "expired" {
  if (invite.used_at) return "used";
  if (new Date(invite.expires_at) < new Date()) return "expired";
  return "pending";
}

export default function SuperAdminInvites() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const loadInvites = async () => {
    setLoadingList(true);
    const { data, error } = await supabase
      .from("invitations" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setInvites((data as unknown as Invitation[]) || []);
    setLoadingList(false);
  };

  useEffect(() => { loadInvites(); }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const { data, error } = await supabase.rpc("create_invitation" as any, { p_email: email });
      if (error) throw error;

      const link = `${window.location.origin}/invite/${data.token}`;
      await navigator.clipboard.writeText(link).catch(() => {});
      toast({ title: "Convite gerado!", description: "O link foi copiado para a área de transferência." });
      setEmail("");
      loadInvites();
    } catch (error: any) {
      toast({ title: "Erro ao enviar convite", description: error.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Link copiado!" });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
          <Mail className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Convites</h1>
          <p className="text-muted-foreground text-sm">Gerencie quem pode acessar o VS Sales</p>
        </div>
      </div>

      <form onSubmit={handleInvite} className="glass rounded-2xl p-6 flex gap-3">
        <Input
          type="email"
          placeholder="email@cliente.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-11 rounded-xl bg-secondary/30 border-border/30"
        />
        <Button type="submit" disabled={sending} className="h-11 rounded-xl gradient-primary hover:opacity-90 shrink-0">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-2" />Enviar convite</>}
        </Button>
      </form>

      <div className="glass rounded-2xl p-6 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Convites enviados</h2>
        {loadingList ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : invites.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhum convite enviado ainda.</p>
        ) : (
          <div className="space-y-2">
            {invites.map((invite) => {
              const status = inviteStatus(invite);
              return (
                <div key={invite.id} className="flex items-center justify-between rounded-xl border border-border/30 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{invite.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Criado em {new Date(invite.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {status === "pending" && <Badge variant="outline" className="text-[10px]">Pendente</Badge>}
                    {status === "used" && <Badge className="bg-success/10 text-success border-success/30 text-[10px]" variant="outline">Usado</Badge>}
                    {status === "expired" && <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]" variant="outline">Expirado</Badge>}
                    {status !== "used" && (
                      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => copyLink(invite.token)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
