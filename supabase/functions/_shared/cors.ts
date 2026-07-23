const ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

function buildAllowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS") || "";
  if (!raw.trim()) return [];
  return raw.split(",").map((o) => o.trim()).filter(Boolean);
}

function isTrustedLovableOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:") return false;
    return url.hostname.endsWith(".lovable.app") || url.hostname.endsWith(".lovableproject.com");
  } catch {
    return false;
  }
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const allowedOrigins = buildAllowedOrigins();

  // If ALLOWED_ORIGINS is not configured, fall back to wildcard (safe for dev)
  if (allowedOrigins.length === 0) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": ALLOW_HEADERS,
    };
  }

  const origin = req.headers.get("origin") || "";
  const matched = allowedOrigins.includes(origin) || isTrustedLovableOrigin(origin)
    ? origin
    : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": matched,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
  };
}
