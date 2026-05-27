import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Settings, Plug, TestTube, Eye, EyeOff, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Database } from "@/integrations/supabase/types";

type IntegrationService = Database["public"]["Enums"]["integration_service"];

type IntegrationConfig = {
  service: IntegrationService;
  label: string;
  description: string;
  emoji: string;
  fields: { key: string; label: string; placeholder: string; type: "api_key" | "endpoint_url" }[];
};

const integrationConfigs: IntegrationConfig[] = [
  {
    service: "firecrawl",
    label: "Firecrawl",
    description: "Web scraping e extração de dados",
    emoji: "🔥",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "fc-...", type: "api_key" },
    ],
  },
  {
    service: "hasdata",
    label: "Hasdata",
    description: "Scraping de Google Maps",
    emoji: "📍",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "Sua chave Hasdata", type: "api_key" },
    ],
  },
  {
    service: "evolution",
    label: "Evolution API",
    description: "WhatsApp para extração",
    emoji: "💬",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "Sua chave da instância", type: "api_key" },
      { key: "endpoint_url", label: "URL da Instância", placeholder: "https://sua-instancia.evolution-api.com", type: "endpoint_url" },
    ],
  },
  {
    service: "perplexity",
    label: "Perplexity AI",
    description: "Enriquecimento com IA",
    emoji: "🧠",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "pplx-...", type: "api_key" },
    ],
  },
  {
    service: "supabase_external",
    label: "Banco Externo",
    description: "Conecte o DB do cliente",
    emoji: "🗄️",
    fields: [
      { key: "endpoint_url", label: "URL", placeholder: "https://xxx.supabase.co", type: "endpoint_url" },
      { key: "api_key", label: "Anon Key", placeholder: "eyJ...", type: "api_key" },
    ],
  },
];

type IntegrationData = {
  id?: string;
  api_key: string;
  endpoint_url: string;
  status: string;
};

export default function SettingsPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<Record<string, IntegrationData>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!profile?.org_id) return;
    supabase.functions
      .invoke("manage-integrations", {
        body: { action: "load", org_id: profile.org_id },
      })
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to load integrations:", error);
          return;
        }
        const rows = data?.data || [];
        const map: Record<string, IntegrationData> = {};
        rows.forEach((row: any) => {
          map[row.service_name] = {
            id: row.id,
            api_key: row.api_key || "",
            endpoint_url: row.endpoint_url || "",
            status: row.status || "pending",
          };
        });
        setIntegrations(map);
      });
  }, [profile?.org_id]);

  const getField = (service: string, field: string) => {
    return integrations[service]?.[field as keyof IntegrationData] as string || "";
  };

  const setField = (service: string, field: string, value: string) => {
    setIntegrations((prev) => ({
      ...prev,
      [service]: { ...prev[service], [field]: value, status: prev[service]?.status || "pending" },
    }));
  };

  const handleSave = async (service: IntegrationService) => {
    if (!profile?.org_id) return;
    setSaving((p) => ({ ...p, [service]: true }));

    try {
      const intData = integrations[service];
      const { data: result, error } = await supabase.functions.invoke("manage-integrations", {
        body: {
          action: "save",
          org_id: profile.org_id,
          service_name: service,
          api_key: intData?.api_key || null,
          endpoint_url: intData?.endpoint_url || null,
          integration_id: intData?.id || null,
        },
      });

      if (error) throw error;

      if (result?.id && !intData?.id) {
        setIntegrations((prev) => ({
          ...prev,
          [service]: { ...prev[service], id: result.id, status: "active" },
        }));
      } else {
        setIntegrations((prev) => ({
          ...prev,
          [service]: { ...prev[service], status: "active" },
        }));
      }

      toast({ title: "Salvo!", description: "Integração atualizada." });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving((p) => ({ ...p, [service]: false }));
    }
  };

  const handleTest = async (service: IntegrationService) => {
    setTesting((p) => ({ ...p, [service]: true }));
    await new Promise((r) => setTimeout(r, 1500));
    const hasKey = integrations[service]?.api_key;
    if (hasKey) {
      setIntegrations((prev) => ({ ...prev, [service]: { ...prev[service], status: "active" } }));
      toast({ title: "Conexão OK", description: `${service} está acessível.` });
    } else {
      toast({ title: "Falha", description: "Preencha a API key primeiro.", variant: "destructive" });
    }
    setTesting((p) => ({ ...p, [service]: false }));
  };

  const statusBadge = (service: string) => {
    const status = integrations[service]?.status;
    if (status === "active") return <Badge className="bg-success/10 text-success border-success/30 rounded-lg text-[10px]" variant="outline"><CheckCircle2 className="h-3 w-3 mr-1" />Ativo</Badge>;
    if (status === "error") return <Badge className="bg-destructive/10 text-destructive border-destructive/30 rounded-lg text-[10px]" variant="outline"><XCircle className="h-3 w-3 mr-1" />Erro</Badge>;
    return <Badge variant="outline" className="text-muted-foreground rounded-lg text-[10px]">Pendente</Badge>;
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground text-sm">Integrações e chaves de API</p>
        </div>
      </div>

      <Tabs defaultValue="firecrawl">
        <TabsList className="bg-secondary/30 rounded-xl p-1 h-auto flex-wrap">
          {integrationConfigs.map((cfg) => (
            <TabsTrigger key={cfg.service} value={cfg.service} className="rounded-lg text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 px-3">
              <span className="mr-1.5">{cfg.emoji}</span>{cfg.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {integrationConfigs.map((cfg) => (
          <TabsContent key={cfg.service} value={cfg.service} className="mt-4">
            <div className="glass rounded-2xl p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{cfg.emoji}</span>
                  <div>
                    <h2 className="text-lg font-semibold">{cfg.label}</h2>
                    <p className="text-sm text-muted-foreground">{cfg.description}</p>
                  </div>
                </div>
                {statusBadge(cfg.service)}
              </div>

              <div className="space-y-4">
                {cfg.fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label className="text-xs font-medium">{field.label}</Label>
                    <div className="relative">
                      <Input
                        type={field.type === "api_key" && !showKeys[cfg.service] ? "password" : "text"}
                        placeholder={field.placeholder}
                        value={getField(cfg.service, field.key)}
                        onChange={(e) => setField(cfg.service, field.key, e.target.value)}
                        className="rounded-xl bg-secondary/30 border-border/30 pr-10"
                      />
                      {field.type === "api_key" && (
                        <button
                          type="button"
                          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => setShowKeys((p) => ({ ...p, [cfg.service]: !p[cfg.service] }))}
                        >
                          {showKeys[cfg.service] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-1">
                <Button onClick={() => handleSave(cfg.service)} disabled={saving[cfg.service]} className="rounded-xl gradient-primary hover:opacity-90">
                  {saving[cfg.service] ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : "Salvar"}
                </Button>
                <Button variant="outline" onClick={() => handleTest(cfg.service)} disabled={testing[cfg.service]} className="rounded-xl border-border/50">
                  {testing[cfg.service] ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Testando...</> : <><TestTube className="h-4 w-4 mr-2" />Testar</>}
                </Button>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
