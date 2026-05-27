import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Building2, Upload, Globe, Instagram, Linkedin, Facebook, Phone, Mail,
  MapPin, FileText, Target, Users, Lightbulb, MessageSquare, ShieldCheck,
  Package, Save, Plus, X, HelpCircle, Sparkles, Loader2, Briefcase, ShoppingBag
} from "lucide-react";

type ProductItem = { name: string; description: string; price?: string };
type FaqItem = { question: string; answer: string };

type CompanyProfile = {
  id: string;
  org_id: string;
  company_name: string;
  logo_url: string | null;
  segment: string | null;
  description: string;
  mission: string;
  vision: string;
  values: string;
  products_services: ProductItem[];
  target_audience: string;
  differentials: string;
  tone_of_voice: string;
  website: string | null;
  instagram: string | null;
  linkedin: string | null;
  facebook: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  cnpj: string | null;
  founded_year: number | null;
  team_size: string | null;
  avg_ticket: string | null;
  sales_process: string;
  objections_faq: FaqItem[];
  // B2B/B2C
  business_models: string[];
  b2b_target_audience: string;
  b2b_products_services: ProductItem[];
  b2b_differentials: string;
  b2b_objections_faq: FaqItem[];
  b2b_sales_process: string;
  b2b_avg_ticket: string | null;
  b2b_tone_of_voice: string;
  b2c_target_audience: string;
  b2c_products_services: ProductItem[];
  b2c_differentials: string;
  b2c_objections_faq: FaqItem[];
  b2c_sales_process: string;
  b2c_avg_ticket: string | null;
  b2c_tone_of_voice: string;
};

const emptyProfile: Omit<CompanyProfile, "id" | "org_id"> = {
  company_name: "", logo_url: null, segment: null, description: "", mission: "", vision: "", values: "",
  products_services: [], target_audience: "", differentials: "", tone_of_voice: "",
  website: null, instagram: null, linkedin: null, facebook: null, phone: null, email: null, address: null,
  cnpj: null, founded_year: null, team_size: null, avg_ticket: null, sales_process: "", objections_faq: [],
  business_models: [],
  b2b_target_audience: "", b2b_products_services: [], b2b_differentials: "", b2b_objections_faq: [],
  b2b_sales_process: "", b2b_avg_ticket: null, b2b_tone_of_voice: "",
  b2c_target_audience: "", b2c_products_services: [], b2c_differentials: "", b2c_objections_faq: [],
  b2c_sales_process: "", b2c_avg_ticket: null, b2c_tone_of_voice: "",
};

// Reusable B2B/B2C profile editor
function BusinessModelSection({ prefix, label, icon: Icon, iconColor, data, update }: {
  prefix: "b2b" | "b2c";
  label: string;
  icon: any;
  iconColor: string;
  data: CompanyProfile;
  update: (field: keyof CompanyProfile, value: any) => void;
}) {
  const ta = `${prefix}_target_audience` as keyof CompanyProfile;
  const ps = `${prefix}_products_services` as keyof CompanyProfile;
  const diff = `${prefix}_differentials` as keyof CompanyProfile;
  const faq = `${prefix}_objections_faq` as keyof CompanyProfile;
  const sp = `${prefix}_sales_process` as keyof CompanyProfile;
  const at = `${prefix}_avg_ticket` as keyof CompanyProfile;
  const tv = `${prefix}_tone_of_voice` as keyof CompanyProfile;

  const products = (data[ps] as ProductItem[]) || [];
  const objections = (data[faq] as FaqItem[]) || [];

  return (
    <Card className="border-l-4" style={{ borderLeftColor: prefix === "b2b" ? "hsl(var(--primary))" : "hsl(var(--chart-4))" }}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Icon className={`h-5 w-5 ${iconColor}`} /> {label}
        </CardTitle>
        <CardDescription>
          {prefix === "b2b"
            ? "Configure como a IA aborda empresas, revendedores e parceiros comerciais."
            : "Configure como a IA aborda consumidores finais, eventos pessoais e experiências."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Target audience */}
        <div>
          <Label className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Público-Alvo ({label})</Label>
          <Textarea rows={3} value={(data[ta] as string) || ""} onChange={(e) => update(ta, e.target.value)}
            placeholder={prefix === "b2b" ? "Quem são os clientes empresariais ideais? Porte, segmento, cargo do decisor..." : "Quem são os consumidores ideais? Faixa etária, interesses, ocasiões de compra..."} />
        </div>

        {/* Tone of voice */}
        <div>
          <Label className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> Tom de Voz ({label})</Label>
          <Textarea rows={2} value={(data[tv] as string) || ""} onChange={(e) => update(tv, e.target.value)}
            placeholder={prefix === "b2b" ? "Ex: Profissional, consultivo, focado em dados e ROI" : "Ex: Amigável, leve, focado em experiência e momentos especiais"} />
        </div>

        {/* Differentials */}
        <div>
          <Label className="flex items-center gap-1"><Lightbulb className="h-3.5 w-3.5" /> Diferenciais ({label})</Label>
          <Textarea rows={3} value={(data[diff] as string) || ""} onChange={(e) => update(diff, e.target.value)}
            placeholder={prefix === "b2b" ? "O que diferencia para empresas? Logística, preço por volume, suporte..." : "O que diferencia para consumidores? Qualidade, experiência, praticidade..."} />
        </div>

        {/* Sales process */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Processo de Vendas ({label})</Label>
            <Textarea rows={3} value={(data[sp] as string) || ""} onChange={(e) => update(sp, e.target.value)}
              placeholder={prefix === "b2b" ? "Prospecção → Qualificação BANT → Proposta → Fechamento" : "Interesse → Recomendação → Pedido → Entrega"} />
          </div>
          <div>
            <Label>Ticket Médio ({label})</Label>
            <Input value={(data[at] as string) || ""} onChange={(e) => update(at, e.target.value)}
              placeholder={prefix === "b2b" ? "Ex: R$ 5.000/mês" : "Ex: R$ 200"} />
          </div>
        </div>

        <Separator />

        {/* Products */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> Produtos & Serviços ({label})</Label>
            <Button onClick={() => update(ps, [...products, { name: "", description: "", price: "" }])} variant="outline" size="sm" className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
          {products.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4 italic">
              Nenhum produto {prefix === "b2b" ? "B2B" : "B2C"} cadastrado.
            </p>
          )}
          {products.map((product, idx) => (
            <div key={idx} className="p-3 rounded-lg border bg-muted/20 space-y-2 mb-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-[10px]">Produto {idx + 1}</Badge>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => update(ps, products.filter((_, i) => i !== idx))}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={product.name} onChange={(e) => { const u = [...products]; u[idx] = { ...u[idx], name: e.target.value }; update(ps, u); }} placeholder="Nome" />
                <Input value={product.price || ""} onChange={(e) => { const u = [...products]; u[idx] = { ...u[idx], price: e.target.value }; update(ps, u); }} placeholder="Preço" />
              </div>
              <Textarea rows={2} value={product.description} onChange={(e) => { const u = [...products]; u[idx] = { ...u[idx], description: e.target.value }; update(ps, u); }} placeholder="Descrição" />
            </div>
          ))}
        </div>

        <Separator />

        {/* Objections */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="flex items-center gap-1"><HelpCircle className="h-3.5 w-3.5" /> Objeções & FAQ ({label})</Label>
            <Button onClick={() => update(faq, [...objections, { question: "", answer: "" }])} variant="outline" size="sm" className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
          {objections.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4 italic">
              Nenhuma objeção {prefix === "b2b" ? "B2B" : "B2C"} cadastrada.
            </p>
          )}
          {objections.map((item, idx) => (
            <div key={idx} className="p-3 rounded-lg border bg-muted/20 space-y-2 mb-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-[10px]">Objeção {idx + 1}</Badge>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => update(faq, objections.filter((_, i) => i !== idx))}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Input value={item.question} onChange={(e) => { const u = [...objections]; u[idx] = { ...u[idx], question: e.target.value }; update(faq, u); }} placeholder='Ex: "Está muito caro"' />
              <Textarea rows={2} value={item.answer} onChange={(e) => { const u = [...objections]; u[idx] = { ...u[idx], answer: e.target.value }; update(faq, u); }} placeholder="Como contornar..." />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CompanyProfile() {
  const { profile: userProfile } = useAuth();
  const [data, setData] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const orgId = userProfile?.org_id;

  const getCompleteness = () => {
    if (!data) return 0;
    const fields = [
      data.company_name, data.description, data.segment, data.mission,
      data.target_audience, data.differentials, data.tone_of_voice,
      data.phone, data.email, data.sales_process, data.logo_url,
      data.products_services.length > 0 ? "yes" : "",
      data.objections_faq.length > 0 ? "yes" : "",
      data.business_models.length > 0 ? "yes" : "",
      // Count B2B completion if active
      ...(data.business_models.includes("b2b") ? [
        data.b2b_target_audience, data.b2b_tone_of_voice,
        data.b2b_products_services.length > 0 ? "yes" : "",
      ] : []),
      // Count B2C completion if active
      ...(data.business_models.includes("b2c") ? [
        data.b2c_target_audience, data.b2c_tone_of_voice,
        data.b2c_products_services.length > 0 ? "yes" : "",
      ] : []),
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  };

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data: cp } = await supabase
        .from("company_profiles")
        .select("*")
        .eq("org_id", orgId)
        .maybeSingle();
      if (cp) {
        setData({
          ...cp,
          products_services: (cp.products_services as any) || [],
          objections_faq: (cp.objections_faq as any) || [],
          business_models: (cp as any).business_models || [],
          b2b_products_services: (cp as any).b2b_products_services || [],
          b2b_objections_faq: (cp as any).b2b_objections_faq || [],
          b2c_products_services: (cp as any).b2c_products_services || [],
          b2c_objections_faq: (cp as any).b2c_objections_faq || [],
        } as CompanyProfile);
      } else {
        setData({ ...emptyProfile, id: "", org_id: orgId } as CompanyProfile);
      }
      setLoading(false);
    })();
  }, [orgId]);

  const update = (field: keyof CompanyProfile, value: any) => {
    setData((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const toggleBusinessModel = (model: string) => {
    if (!data) return;
    const current = data.business_models || [];
    const updated = current.includes(model) ? current.filter(m => m !== model) : [...current, model];
    update("business_models", updated);
  };

  const handleSave = async () => {
    if (!data || !orgId) return;
    setSaving(true);
    const { id, ...rest } = data;
    const payload = { ...rest, org_id: orgId };

    if (id) {
      const { error } = await supabase.from("company_profiles").update(payload).eq("id", id);
      if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      else toast({ title: "Perfil salvo com sucesso!" });
    } else {
      const { data: inserted, error } = await supabase.from("company_profiles").insert(payload).select().single();
      if (error) toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
      else {
        setData({ ...data, id: inserted.id } as CompanyProfile);
        toast({ title: "Perfil da empresa criado!" });
      }
    }
    setSaving(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${orgId}/logo.${ext}`;
    const { error } = await supabase.storage.from("company-assets").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
    } else {
      const { data: urlData } = supabase.storage.from("company-assets").getPublicUrl(path);
      update("logo_url", urlData.publicUrl);
      toast({ title: "Logo enviada!" });
    }
    setUploading(false);
  };

  // Products CRUD (general)
  const addProduct = () => { if (!data) return; update("products_services", [...data.products_services, { name: "", description: "", price: "" }]); };
  const updateProduct = (idx: number, field: string, value: string) => { if (!data) return; const u = [...data.products_services]; (u[idx] as any)[field] = value; update("products_services", u); };
  const removeProduct = (idx: number) => { if (!data) return; update("products_services", data.products_services.filter((_, i) => i !== idx)); };

  // FAQ CRUD (general)
  const addFaq = () => { if (!data) return; update("objections_faq", [...data.objections_faq, { question: "", answer: "" }]); };
  const updateFaq = (idx: number, field: string, value: string) => { if (!data) return; const u = [...data.objections_faq]; (u[idx] as any)[field] = value; update("objections_faq", u); };
  const removeFaq = (idx: number) => { if (!data) return; update("objections_faq", data.objections_faq.filter((_, i) => i !== idx)); };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!data) return null;

  const completeness = getCompleteness();
  const hasB2B = data.business_models.includes("b2b");
  const hasB2C = data.business_models.includes("b2c");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" /> Minha Empresa
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure o perfil completo da sua empresa. Essas informações alimentam a IA de vendas.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Tudo
        </Button>
      </div>

      {/* Completeness bar */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Perfil de IA</span>
            </div>
            <Badge variant={completeness === 100 ? "default" : "secondary"}>
              {completeness}% completo
            </Badge>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${completeness}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Quanto mais completo, mais inteligente e personalizada será a IA de vendas para sua empresa.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="identity" className="space-y-4">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="identity" className="text-xs gap-1"><Building2 className="h-3.5 w-3.5" /> Identidade</TabsTrigger>
          <TabsTrigger value="business-models" className="text-xs gap-1"><Briefcase className="h-3.5 w-3.5" /> Modelos</TabsTrigger>
          <TabsTrigger value="products" className="text-xs gap-1"><Package className="h-3.5 w-3.5" /> Produtos</TabsTrigger>
          <TabsTrigger value="strategy" className="text-xs gap-1"><Target className="h-3.5 w-3.5" /> Estratégia</TabsTrigger>
          <TabsTrigger value="sales" className="text-xs gap-1"><MessageSquare className="h-3.5 w-3.5" /> Vendas</TabsTrigger>
          <TabsTrigger value="contact" className="text-xs gap-1"><Globe className="h-3.5 w-3.5" /> Contato</TabsTrigger>
        </TabsList>

        {/* IDENTITY */}
        <TabsContent value="identity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Identidade Visual & Institucional</CardTitle>
              <CardDescription>Logo, nome, segmento e cultura da empresa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo upload */}
              <div className="flex items-center gap-6">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative group h-24 w-24 rounded-xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors bg-muted/30"
                >
                  {data.logo_url ? (
                    <img src={data.logo_url} alt="Logo" className="h-full w-full object-contain p-2" />
                  ) : (
                    <Upload className="h-8 w-8 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                <div className="flex-1 space-y-3">
                  <div>
                    <Label>Nome da Empresa *</Label>
                    <Input value={data.company_name} onChange={(e) => update("company_name", e.target.value)} placeholder="Ex: VS Soluções" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Segmento</Label>
                      <Input value={data.segment || ""} onChange={(e) => update("segment", e.target.value)} placeholder="Ex: Tecnologia B2B" />
                    </div>
                    <div>
                      <Label>CNPJ</Label>
                      <Input value={data.cnpj || ""} onChange={(e) => update("cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <Label>Descrição da Empresa</Label>
                <Textarea rows={3} value={data.description} onChange={(e) => update("description", e.target.value)} placeholder="Descreva o que sua empresa faz..." />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="flex items-center gap-1"><Lightbulb className="h-3.5 w-3.5" /> Missão</Label>
                  <Textarea rows={2} value={data.mission} onChange={(e) => update("mission", e.target.value)} placeholder="Qual o propósito?" />
                </div>
                <div>
                  <Label className="flex items-center gap-1"><Target className="h-3.5 w-3.5" /> Visão</Label>
                  <Textarea rows={2} value={data.vision} onChange={(e) => update("vision", e.target.value)} placeholder="Onde quer chegar?" />
                </div>
                <div>
                  <Label className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Valores</Label>
                  <Textarea rows={2} value={data.values} onChange={(e) => update("values", e.target.value)} placeholder="O que guia a empresa?" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Ano de Fundação</Label>
                  <Input type="number" value={data.founded_year || ""} onChange={(e) => update("founded_year", e.target.value ? Number(e.target.value) : null)} placeholder="2020" />
                </div>
                <div>
                  <Label>Tamanho da Equipe</Label>
                  <Input value={data.team_size || ""} onChange={(e) => update("team_size", e.target.value)} placeholder="Ex: 10-50 pessoas" />
                </div>
                <div>
                  <Label>Ticket Médio (geral)</Label>
                  <Input value={data.avg_ticket || ""} onChange={(e) => update("avg_ticket", e.target.value)} placeholder="Ex: R$ 2.000/mês" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BUSINESS MODELS - NEW */}
        <TabsContent value="business-models" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" /> Modelos de Negócio
              </CardTitle>
              <CardDescription>
                Defina se sua empresa vende para outras empresas (B2B), para consumidores finais (B2C), ou ambos.
                Cada modelo terá seu próprio perfil de público, produtos, tom de voz e objeções — alimentando a IA de forma contextualizada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Toggle models */}
              <div className="grid grid-cols-2 gap-4">
                <div
                  onClick={() => toggleBusinessModel("b2b")}
                  className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${hasB2B ? "border-primary bg-primary/5 shadow-sm" : "border-muted hover:border-muted-foreground/30"}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Briefcase className={`h-5 w-5 ${hasB2B ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="font-semibold">B2B</span>
                    </div>
                    <Switch checked={hasB2B} onCheckedChange={() => toggleBusinessModel("b2b")} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Empresas, revendedores, distribuidores, parceiros comerciais. Foco em ROI, volume e parceria.
                  </p>
                </div>

                <div
                  onClick={() => toggleBusinessModel("b2c")}
                  className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${hasB2C ? "border-[hsl(var(--chart-4))] bg-[hsl(var(--chart-4))]/5 shadow-sm" : "border-muted hover:border-muted-foreground/30"}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className={`h-5 w-5 ${hasB2C ? "text-[hsl(var(--chart-4))]" : "text-muted-foreground"}`} />
                      <span className="font-semibold">B2C</span>
                    </div>
                    <Switch checked={hasB2C} onCheckedChange={() => toggleBusinessModel("b2c")} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Consumidores finais, eventos pessoais, aniversários, experiências. Foco em emoção e praticidade.
                  </p>
                </div>
              </div>

              {!hasB2B && !hasB2C && (
                <div className="text-center py-8 text-muted-foreground">
                  <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Ative pelo menos um modelo de negócio para configurar os perfis separados de B2B e B2C.</p>
                  <p className="text-xs mt-1">Isso permitirá que a IA adapte tom, produtos e abordagem para cada tipo de cliente.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* B2B Section */}
          {hasB2B && (
            <BusinessModelSection prefix="b2b" label="B2B" icon={Briefcase} iconColor="text-primary" data={data} update={update} />
          )}

          {/* B2C Section */}
          {hasB2C && (
            <BusinessModelSection prefix="b2c" label="B2C" icon={ShoppingBag} iconColor="text-[hsl(var(--chart-4))]" data={data} update={update} />
          )}
        </TabsContent>

        {/* PRODUCTS (general) */}
        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Produtos & Serviços (Geral)</CardTitle>
                  <CardDescription>Catálogo geral. Para produtos específicos B2B/B2C, use a aba "Modelos".</CardDescription>
                </div>
                <Button onClick={addProduct} variant="outline" size="sm" className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.products_services.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum produto cadastrado.</p>
                </div>
              )}
              {data.products_services.map((product, idx) => (
                <div key={idx} className="p-4 rounded-lg border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">Produto {idx + 1}</Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeProduct(idx)}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Nome</Label><Input value={product.name} onChange={(e) => updateProduct(idx, "name", e.target.value)} placeholder="Nome do produto" /></div>
                    <div><Label>Preço</Label><Input value={product.price || ""} onChange={(e) => updateProduct(idx, "price", e.target.value)} placeholder="Ex: R$ 497/mês" /></div>
                  </div>
                  <div><Label>Descrição</Label><Textarea rows={2} value={product.description} onChange={(e) => updateProduct(idx, "description", e.target.value)} placeholder="O que entrega?" /></div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* STRATEGY */}
        <TabsContent value="strategy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estratégia Comercial (Geral)</CardTitle>
              <CardDescription>Público, diferenciais e tom gerais. Para específicos, use "Modelos".</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Público-Alvo (Geral)</Label>
                <Textarea rows={3} value={data.target_audience} onChange={(e) => update("target_audience", e.target.value)} placeholder="Quem é o cliente ideal?" />
              </div>
              <div>
                <Label className="flex items-center gap-1"><Lightbulb className="h-3.5 w-3.5" /> Diferenciais</Label>
                <Textarea rows={3} value={data.differentials} onChange={(e) => update("differentials", e.target.value)} placeholder="O que diferencia?" />
              </div>
              <div>
                <Label className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> Tom de Voz</Label>
                <Textarea rows={2} value={data.tone_of_voice} onChange={(e) => update("tone_of_voice", e.target.value)} placeholder="Ex: Profissional mas acessível..." />
                <p className="text-xs text-muted-foreground mt-1">A IA seguirá esse tom em todas as interações com leads.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SALES */}
        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Processo de Vendas (Geral)</CardTitle>
              <CardDescription>Fluxo geral. Para processos específicos B2B/B2C, use "Modelos".</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Processo Comercial</Label>
                <Textarea rows={4} value={data.sales_process} onChange={(e) => update("sales_process", e.target.value)} placeholder="Descreva as etapas..." />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2"><HelpCircle className="h-5 w-5" /> Objeções & FAQ (Geral)</CardTitle>
                  <CardDescription>Objeções gerais. Para específicas B2B/B2C, use "Modelos".</CardDescription>
                </div>
                <Button onClick={addFaq} variant="outline" size="sm" className="gap-1"><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.objections_faq.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <HelpCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Adicione objeções comuns.</p>
                </div>
              )}
              {data.objections_faq.map((faq, idx) => (
                <div key={idx} className="p-4 rounded-lg border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">Objeção {idx + 1}</Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFaq(idx)}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                  <div><Label>Objeção</Label><Input value={faq.question} onChange={(e) => updateFaq(idx, "question", e.target.value)} placeholder='Ex: "Está muito caro"' /></div>
                  <div><Label>Resposta</Label><Textarea rows={2} value={faq.answer} onChange={(e) => updateFaq(idx, "answer", e.target.value)} placeholder="Como contornar..." /></div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTACT */}
        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contato & Redes Sociais</CardTitle>
              <CardDescription>Informações de contato e presença digital.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> Website</Label><Input value={data.website || ""} onChange={(e) => update("website", e.target.value)} placeholder="https://..." /></div>
                <div><Label className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> Email</Label><Input value={data.email || ""} onChange={(e) => update("email", e.target.value)} placeholder="contato@empresa.com" /></div>
                <div><Label className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Telefone</Label><Input value={data.phone || ""} onChange={(e) => update("phone", e.target.value)} placeholder="(11) 99999-9999" /></div>
                <div><Label className="flex items-center gap-1"><Instagram className="h-3.5 w-3.5" /> Instagram</Label><Input value={data.instagram || ""} onChange={(e) => update("instagram", e.target.value)} placeholder="@empresa" /></div>
                <div><Label className="flex items-center gap-1"><Linkedin className="h-3.5 w-3.5" /> LinkedIn</Label><Input value={data.linkedin || ""} onChange={(e) => update("linkedin", e.target.value)} placeholder="linkedin.com/company/..." /></div>
                <div><Label className="flex items-center gap-1"><Facebook className="h-3.5 w-3.5" /> Facebook</Label><Input value={data.facebook || ""} onChange={(e) => update("facebook", e.target.value)} placeholder="facebook.com/..." /></div>
              </div>
              <div><Label className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Endereço</Label><Input value={data.address || ""} onChange={(e) => update("address", e.target.value)} placeholder="Rua, número, cidade - estado" /></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end pb-8">
        <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Perfil da Empresa
        </Button>
      </div>
    </div>
  );
}
