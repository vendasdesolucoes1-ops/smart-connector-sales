import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/Logo";
import { ArrowRight, ShieldAlert } from "lucide-react";

type InviteStatus = "loading" | "valid" | "invalid";

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<InviteStatus>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    supabase.rpc("get_invitation_by_token" as any, { p_token: token }).then(({ data, error }) => {
      if (error || !data?.valid) {
        setStatus("invalid");
        return;
      }
      setEmail(data.email);
      setStatus("valid");
    });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      const { error: redeemError } = await supabase.rpc("redeem_invitation" as any, { p_token: token });
      if (redeemError) throw redeemError;

      toast({ title: "Conta criada!", description: "Bem-vindo ao VS Sales." });
      navigate("/onboarding");
    } catch (error: any) {
      toast({ title: "Erro ao criar conta", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background gradient-mesh p-4">
        <div className="w-full max-w-md glass rounded-2xl p-8 space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
            <ShieldAlert className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Convite inválido</h1>
          <p className="text-sm text-muted-foreground">
            Este link de convite não existe, já foi usado ou expirou. Solicite um novo convite.
          </p>
          <Button variant="outline" className="rounded-xl w-full" onClick={() => navigate("/auth")}>
            Ir para o login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background gradient-mesh p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <Logo className="h-10 w-auto mb-2" />
          <p className="text-sm text-muted-foreground">Você foi convidado para o VS Sales</p>
        </div>

        <div className="glass rounded-2xl p-8 space-y-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Criar sua conta</h1>
            <p className="text-sm text-muted-foreground mt-1">Defina uma senha para {email}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Email</Label>
              <Input value={email} disabled className="h-11 rounded-xl bg-secondary/30 border-border/30" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                className="h-11 rounded-xl bg-secondary/30 border-border/30"
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full h-11 rounded-xl gradient-primary hover:opacity-90 font-semibold">
              {submitting ? "Criando conta..." : (
                <span className="flex items-center gap-2">
                  Criar conta e continuar
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
