import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const SESSION_TIMEOUT_MS = 8000;

/**
 * OAuth landing page. Waits for the Supabase session created by the provider
 * redirect, then enforces the invitation gate: users without a valid
 * invitation (and who aren't platform admins — has_valid_invitation covers
 * both) are signed out and sent back to /auth with an explanation.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    let isActive = true;

    const validate = async (userId: string) => {
      if (handled.current) return;
      handled.current = true;
      try {
        const { data, error } = await supabase.rpc("has_valid_invitation" as any, { p_user_id: userId });
        if (error) throw error;
        if (data) {
          navigate("/", { replace: true });
        } else {
          await supabase.auth.signOut();
          navigate("/auth?error=no_invitation", { replace: true });
        }
      } catch (e) {
        console.error("Erro ao validar convite no callback OAuth:", e);
        await supabase.auth.signOut();
        navigate("/auth?error=no_invitation", { replace: true });
      }
    };

    // The session may already be present, or arrive via the auth listener as
    // Supabase finishes exchanging the OAuth code.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isActive && session?.user) validate(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isActive && session?.user) validate(session.user.id);
    });

    const timeout = setTimeout(() => {
      if (isActive && !handled.current) {
        handled.current = true;
        navigate("/auth", { replace: true });
      }
    }, SESSION_TIMEOUT_MS);

    return () => {
      isActive = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0E0E10] text-white">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-[#A8A8B0]">Validando seu acesso...</p>
    </div>
  );
}
