import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Building2, AlertCircle } from "lucide-react";

export function OnboardingDialog() {
  const { user, profile } = useAuth();
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  // Only show if user has no org
  if (profile?.org_id) return null;

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({ name: orgName, owner_id: user.id })
        .select()
        .single();
      if (orgError) throw orgError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ org_id: org.id })
        .eq("user_id", user.id);
      if (profileError) throw profileError;

      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: user.id, org_id: org.id, role: "admin" });
      if (roleError) throw roleError;

      const stages = [
        { name: "Qualificação", stage_order: 0, org_id: org.id },
        { name: "Prospecção", stage_order: 1, org_id: org.id },
        { name: "Proposta", stage_order: 2, org_id: org.id },
        { name: "Negociação", stage_order: 3, org_id: org.id },
        { name: "Fechamento", stage_order: 4, org_id: org.id },
      ];
      await supabase.from("crm_stages").insert(stages);

      toast({ title: "Organização criada!", description: `${orgName} está pronta.` });
      setOpen(false);
      window.location.reload();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 rounded-lg text-xs font-medium text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 animate-pulse"
        >
          <AlertCircle className="h-3.5 w-3.5" />
          <span className="group-data-[collapsible=icon]:hidden">Configurar</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md glass rounded-2xl border-border/50">
        <DialogHeader className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary glow-primary">
            <Building2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <DialogTitle className="text-xl font-bold">Crie sua organização</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Configure o nome da sua empresa para acessar todas as funcionalidades.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateOrg} className="space-y-5 mt-2">
          <div className="space-y-2">
            <Label htmlFor="orgNameDialog" className="text-xs font-medium">
              Nome da organização
            </Label>
            <Input
              id="orgNameDialog"
              placeholder="Minha Empresa Ltda"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="h-11 rounded-xl bg-secondary/50 border-border/50 focus:border-primary/50"
              required
            />
          </div>
          <Button
            type="submit"
            className="w-full h-11 rounded-xl gradient-primary hover:opacity-90 transition-opacity font-semibold"
            disabled={loading}
          >
            {loading ? "Criando..." : "Criar e continuar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
