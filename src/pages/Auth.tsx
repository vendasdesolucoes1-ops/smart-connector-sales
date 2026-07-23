import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Zap, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

function GoogleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const noInvitation = searchParams.get("error") === "no_invitation";

  useEffect(() => {
    if (noInvitation) {
      // Keep the banner but clean the URL so a refresh doesn't re-show it forever
      const t = setTimeout(() => setSearchParams({}, { replace: true }), 100);
      return () => clearTimeout(t);
    }
  }, [noInvitation, setSearchParams]);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/auth/callback" },
      });
      if (error) throw error;
      // Browser will redirect to Google — keep the spinner on.
    } catch (error: any) {
      setGoogleLoading(false);
      toast({ title: "Erro ao entrar com Google", description: error.message, variant: "destructive" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate("/");
    } catch (error: any) {
      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-[30%] left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, hsl(174 70% 48%), transparent 70%)" }}
        />
        <div
          className="absolute -bottom-[20%] -right-[5%] w-[500px] h-[500px] rounded-full opacity-[0.05]"
          style={{ background: "radial-gradient(circle, hsl(262 80% 62%), transparent 70%)" }}
        />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: "60px 60px"
        }} />
      </div>

      {/* Login card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-[420px] mx-4"
      >
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
              <Logo className="h-8 w-auto" />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">
              VS SALES
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Plataforma inteligente de vendas
          </p>
        </div>

        {/* Card */}
        <div className="glass-card p-[1px] glow-border rounded-2xl">
          <div className="rounded-2xl px-7 py-8 sm:px-8 sm:py-9 bg-card">
            <h2 className="text-lg font-semibold mb-1">Bem-vindo de volta</h2>
            <p className="text-sm text-muted-foreground mb-7">Entre com suas credenciais para acessar</p>

            {noInvitation && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5">
                <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-foreground/90 leading-relaxed">
                  Seu email não tem um convite ativo. Entre em contato com a VS Soluções para solicitar acesso.
                </p>
              </div>
            )}

            {/* Google OAuth */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className="w-full h-11 rounded-xl text-sm font-semibold bg-white text-[#0E0E10] border border-border flex items-center justify-center gap-2.5 transition-all duration-200 hover:bg-[#FAFAF8] hover:border-primary/40 disabled:opacity-60"
            >
              {googleLoading ? (
                <div className="h-4 w-4 border-2 border-[#0E0E10]/30 border-t-[#0E0E10] rounded-full animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Continuar com Google
            </button>

            <div className="flex items-center gap-3 my-6">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground/60">ou</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground ml-0.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <input
                    type="email"
                    placeholder="nome@empresa.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full h-11 pl-10 pr-4 rounded-xl text-sm bg-secondary/30 border border-border/50 text-foreground placeholder:text-muted-foreground/40 outline-none transition-all duration-200 focus:border-primary/40 focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.08)]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground ml-0.5">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full h-11 pl-10 pr-11 rounded-xl text-sm bg-secondary/30 border border-border/50 text-foreground placeholder:text-muted-foreground/40 outline-none transition-all duration-200 focus:border-primary/40 focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.08)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 mt-2 group gradient-primary shadow-glow hover:shadow-glow-lg"
              >
                {loading ? (
                  <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 mt-8 text-xs text-muted-foreground/50">
          <Zap className="h-3 w-3" />
          <span>Powered by</span>
          <span className="font-semibold text-muted-foreground">VS Soluções</span>
        </div>

        <div className="text-center mt-4">
          <button
            onClick={() => navigate("/site")}
            className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            ← Voltar ao site
          </button>
        </div>
      </motion.div>
    </div>
  );
}
