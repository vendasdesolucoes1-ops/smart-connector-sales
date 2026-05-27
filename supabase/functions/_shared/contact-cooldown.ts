// Verifica se número está em cooldown
export const isInCooldown = async (
  supabase: any,
  phone: string,
  orgId: string
): Promise<boolean> => {
  const { data } = await supabase
    .from("contact_cooldown")
    .select("last_contacted_at, cooldown_hours")
    .eq("phone", phone)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!data) return false;

  const hoursSince =
    (Date.now() - new Date(data.last_contacted_at).getTime()) /
    (1000 * 60 * 60);
  return hoursSince < data.cooldown_hours;
};

// Registra contato realizado
export const registerContact = async (
  supabase: any,
  phone: string,
  orgId: string,
  cooldownHours: number = 24
): Promise<void> => {
  await supabase
    .from("contact_cooldown")
    .upsert(
      {
        phone,
        org_id: orgId,
        last_contacted_at: new Date().toISOString(),
        cooldown_hours: cooldownHours,
      },
      { onConflict: "phone,org_id" }
    );
};
