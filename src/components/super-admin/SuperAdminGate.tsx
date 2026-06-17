import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export function SuperAdminGate({ children }: { children: ReactNode }) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.rpc("is_super_admin" as any).then(({ data, error }) => {
      setAuthorized(!error && Boolean(data));
    });
  }, []);

  if (authorized === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!authorized) {
    // The app's main authenticated route is "/" (no separate /dashboard route exists).
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
