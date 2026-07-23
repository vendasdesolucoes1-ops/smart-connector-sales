import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Lock, User, Shield } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function AdminAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate("/admin/panel");
    } catch (error: any) {
      toast({
        title: "Acesso negado",
        description: error.message || "Credenciais inválidas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: "#0E0E10" }}>
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(rgba(230,57,70,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(230,57,70,0.3) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-[#E63946]/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-[#E63946]/8 rounded-full blur-[100px]" />

      <div className="relative z-10 w-full max-w-sm mx-4">
        {/* Logo & Header */}
        <div className="flex flex-col items-center mb-8">
          <Logo className="h-14 w-auto mb-4" />
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-4 w-4 text-[#E63946]" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#E63946] font-semibold">Área Restrita</span>
          </div>
          <h1
            className="text-2xl font-bold text-white tracking-wide"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Painel Administrativo
          </h1>
          <p className="text-xs text-gray-500 mt-1">Acesso exclusivo para administradores</p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-[#2B2B31] bg-[#141417]/80 backdrop-blur-xl p-8 shadow-[0_0_60px_rgba(230,57,70,0.08)]">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="admin-email" className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                Usuário / Email
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
                <input
                  id="admin-email"
                  type="email"
                  placeholder="admin@vssolucoes.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#0E0E10] border border-[#2B2B31] text-sm text-white placeholder:text-gray-700 focus:outline-none focus:border-[#E63946]/50 focus:shadow-[0_0_20px_rgba(230,57,70,0.1)] transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="admin-password" className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
                <input
                  id="admin-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#0E0E10] border border-[#2B2B31] text-sm text-white placeholder:text-gray-700 focus:outline-none focus:border-[#E63946]/50 focus:shadow-[0_0_20px_rgba(230,57,70,0.1)] transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-[#E63946] to-[#C1121F] text-sm font-semibold text-white hover:shadow-[0_0_30px_rgba(230,57,70,0.3)] transition-all duration-300 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Autenticando...
                </span>
              ) : (
                "Acessar Painel"
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#2B2B31]">
            <p className="text-[10px] text-gray-600 text-center">
              Acesso protegido · VS Soluções © 2026
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <a href="/site" className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors">
            ← Voltar ao site
          </a>
        </div>
      </div>
    </div>
  );
}
