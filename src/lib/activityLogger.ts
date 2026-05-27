import { supabase } from "@/integrations/supabase/client";

interface LogActivityParams {
  action: string;
  description: string;
  success?: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export async function logActivity({
  action,
  description,
  success = true,
  errorMessage,
  metadata = {},
}: LogActivityParams) {
  try {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.user) return;

    const user = session.user;
    const orgId = user.user_metadata?.org_id;

    // Get org_id from profile if not in metadata
    let resolvedOrgId = orgId;
    if (!resolvedOrgId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("user_id", user.id)
        .maybeSingle();
      resolvedOrgId = profile?.org_id;
    }

    await supabase.from("activity_logs").insert({
      user_id: user.id,
      user_email: user.email,
      user_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
      org_id: resolvedOrgId || null,
      action,
      description,
      success,
      error_message: errorMessage || null,
      metadata: {
        ...metadata,
        url: typeof window !== "undefined" ? window.location.href : null,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
    // Silent fail - logging should never break the app
  }
}
