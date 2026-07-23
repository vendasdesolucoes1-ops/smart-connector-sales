import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

/**
 * Blocks the authenticated app for any user who isn't a platform super admin
 * and doesn't have a used invitation. Access is invite-only — this is the
 * final gate after a session exists but before any app content renders.
 */
export function InvitationGate({ children }: { children: React.ReactNode }) {
  const { hasValidInvitation, signOut } = useAuth();

  if (hasValidInvitation === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background gradient-mesh p-4">
        <div className="w-full max-w-md glass rounded-2xl p-8 space-y-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
            <ShieldAlert className="h-7 w-7 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Acesso restrito</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Seu email não tem um convite ativo. Entre em contato com a VS Soluções
              para solicitar acesso.
            </p>
          </div>
          <Button onClick={signOut} variant="outline" className="rounded-xl w-full">
            Sair
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
