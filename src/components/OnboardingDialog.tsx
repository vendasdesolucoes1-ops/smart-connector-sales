import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building2, ArrowRight } from "lucide-react";

/**
 * Mandatory full-screen onboarding modal.
 * Renders automatically when the logged-in user has no organization
 * (profile loaded and org_id is null). Cannot be dismissed — the only
 * way forward is creating an organization.
 */
export function OnboardingDialog() {
  const { user, profile, profileLoading } = useAuth();
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Only show when we know for sure the user has no org
  if (profileLoading || !user || profile?.org_id) return null;

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
      // Refresh session + reload so all pages pick up the new org_id
      await supabase.auth.refreshSession();
      window.location.reload();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="glass rounded-2xl p-8 space-y-6 border border-border/50">
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary glow-primary">
              <Building2 className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Crie sua organização</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Para usar o VS Sales, configure o nome da sua empresa. Esse passo é obrigatório.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateOrg} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="orgNameOnboarding" className="text-xs font-medium">
                Nome da organização
              </Label>
              <Input
                id="orgNameOnboarding"
                placeholder="Minha Empresa Ltda"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="h-11 rounded-xl bg-secondary/50 border-border/50 focus:border-primary/50"
                autoFocus
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11 rounded-xl gradient-primary hover:opacity-90 transition-opacity font-semibold"
              disabled={loading}
            >
              {loading ? "Criando..." : (
                <span className="flex items-center gap-2">
                  Criar e começar
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
