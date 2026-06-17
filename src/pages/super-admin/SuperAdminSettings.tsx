import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Settings, Eye, EyeOff, Loader2, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type SettingField = { key: string; label: string; placeholder: string; sensitive: boolean };

const fields: SettingField[] = [
  { key: "evolution_api_url", label: "Evolution API URL", placeholder: "https://vssolutions-evolution-api.fjsxhg.easypanel.host/", sensitive: false },
  { key: "evolution_api_key", label: "Evolution API Key (global)", placeholder: "Cole aqui a API key global", sensitive: true },
  { key: "firecrawl_api_key", label: "Firecrawl API Key", placeholder: "Cole aqui a chave do Firecrawl", sensitive: true },
  { key: "hasdata_api_key", label: "HasData API Key", placeholder: "Cole aqui a chave do HasData", sensitive: true },
  { key: "perplexity_api_key", label: "Perplexity API Key", placeholder: "Cole aqui a chave do Perplexity", sensitive: true },
];

export default function SuperAdminSettings() {
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  useEffect(() => {
    supabase.rpc("get_platform_settings" as any).then(({ data, error }) => {
      if (!error && data) {
        const map: Record<string, string> = {};
        (data as { key: string; value: string }[]).forEach((row) => { map[row.key] = row.value || ""; });
        setValues(map);
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const field of fields) {
        const { error } = await supabase.rpc("set_platform_setting" as any, {
          p_key: field.key,
          p_value: values[field.key] || "",
        });
        if (error) throw error;
      }
      toast({ title: "Configurações salvas!" });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações globais</h1>
          <p className="text-muted-foreground text-sm">Credenciais de infraestrutura compartilhadas entre todas as organizações</p>
        </div>
      </div>

      <div className="glass rounded-2xl p-6 space-y-4">
        {fields.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label className="text-xs font-medium">{field.label}</Label>
            <div className="relative">
              <Input
                type={field.sensitive && !reveal[field.key] ? "password" : "text"}
                placeholder={field.placeholder}
                value={values[field.key] || ""}
                onChange={(e) => setValues((p) => ({ ...p, [field.key]: e.target.value }))}
                className="rounded-xl bg-secondary/30 border-border/30 pr-10"
              />
              {field.sensitive && (
                <button
                  type="button"
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setReveal((p) => ({ ...p, [field.key]: !p[field.key] }))}
                >
                  {reveal[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>
        ))}

        <Button onClick={handleSave} disabled={saving} className="rounded-xl gradient-primary hover:opacity-90 gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}
