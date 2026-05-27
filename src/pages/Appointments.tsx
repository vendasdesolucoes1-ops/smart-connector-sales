import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar, Clock, Plus, Loader2, CheckCircle2, XCircle, User, Phone,
  MapPin, Link, FileText, Trash2, Edit, ChevronLeft, ChevronRight, AlertCircle, Bot
} from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addMonths, subMonths, isSameDay, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type Appointment = {
  id: string;
  org_id: string;
  lead_id: string | null;
  title: string;
  description: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  location: string | null;
  meeting_url: string | null;
  notes: string | null;
  created_via: string;
  cancelled_reason: string | null;
  created_at: string;
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  scheduled: { label: "Agendado", color: "bg-primary/10 text-primary border-primary/30", icon: Clock },
  confirmed: { label: "Confirmado", color: "bg-success/10 text-success border-success/30", icon: CheckCircle2 },
  completed: { label: "Realizado", color: "bg-muted text-muted-foreground border-muted", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", color: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle },
  no_show: { label: "Não compareceu", color: "bg-warning/10 text-warning border-warning/30", icon: AlertCircle },
};

const EMPTY_FORM = {
  title: "", description: "", lead_name: "", lead_phone: "",
  scheduled_at: "", duration_minutes: 30, status: "scheduled",
  location: "", meeting_url: "", notes: "",
};

export default function Appointments() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const orgId = profile?.org_id;

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"calendar" | "list">("calendar");

  useEffect(() => {
    if (!orgId) return;
    loadAppointments();

    const channel = supabase
      .channel("appointments-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `org_id=eq.${orgId}` }, () => loadAppointments())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId]);

  const loadAppointments = async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .eq("org_id", orgId)
      .order("scheduled_at", { ascending: true });
    setAppointments((data as Appointment[]) || []);
    setLoading(false);
  };

  const openCreate = (date?: Date) => {
    const d = date || selectedDate;
    const dateStr = format(d, "yyyy-MM-dd") + "T10:00";
    setForm({ ...EMPTY_FORM, scheduled_at: dateStr });
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (apt: Appointment) => {
    setForm({
      title: apt.title,
      description: apt.description || "",
      lead_name: apt.lead_name || "",
      lead_phone: apt.lead_phone || "",
      scheduled_at: apt.scheduled_at.slice(0, 16),
      duration_minutes: apt.duration_minutes,
      status: apt.status,
      location: apt.location || "",
      meeting_url: apt.meeting_url || "",
      notes: apt.notes || "",
    });
    setEditingId(apt.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!orgId || !form.title || !form.scheduled_at) {
      toast({ title: "Preencha título e data/hora", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      org_id: orgId,
      title: form.title,
      description: form.description || null,
      lead_name: form.lead_name || null,
      lead_phone: form.lead_phone || null,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      duration_minutes: form.duration_minutes,
      status: form.status,
      location: form.location || null,
      meeting_url: form.meeting_url || null,
      notes: form.notes || null,
    };

    if (editingId) {
      const { error } = await supabase.from("appointments").update(payload).eq("id", editingId);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else toast({ title: "Agendamento atualizado!" });
    } else {
      const { error } = await supabase.from("appointments").insert({ ...payload, created_via: "manual" });
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else toast({ title: "Agendamento criado!" });
    }
    setSaving(false);
    setDialogOpen(false);
    loadAppointments();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("appointments").delete().eq("id", id);
    toast({ title: "Agendamento removido" });
    loadAppointments();
  };

  const handleStatusChange = async (id: string, status: string) => {
    await supabase.from("appointments").update({ status }).eq("id", id);
    loadAppointments();
  };

  // Calendar helpers
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays: Date[] = [];
  let d = calStart;
  while (d <= calEnd) { calendarDays.push(d); d = addDays(d, 1); }

  const getAppointmentsForDate = (date: Date) =>
    appointments.filter(a => isSameDay(parseISO(a.scheduled_at), date));

  const selectedDateAppointments = getAppointmentsForDate(selectedDate);

  // Stats
  const today = new Date();
  const upcoming = appointments.filter(a => new Date(a.scheduled_at) >= today && a.status !== "cancelled");
  const todayAppts = appointments.filter(a => isSameDay(parseISO(a.scheduled_at), today) && a.status !== "cancelled");
  const aiCreated = appointments.filter(a => a.created_via === "ai");

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Agendamentos</h1>
          <p className="page-description">Reuniões e compromissos — a IA também agenda via WhatsApp.</p>
        </div>
        <Button onClick={() => openCreate()} size="sm" className="gap-2">
          <Plus className="h-3.5 w-3.5" /> Novo
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Hoje", value: todayAppts.length, icon: Clock, color: "text-primary" },
          { label: "Próximos", value: upcoming.length, icon: Calendar, color: "text-success" },
          { label: "Criados por IA", value: aiCreated.length, icon: Bot, color: "text-warning" },
          { label: "Total", value: appointments.length, icon: FileText, color: "text-muted-foreground" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as any)}>
        <TabsList>
          <TabsTrigger value="calendar" className="gap-1"><Calendar className="h-3.5 w-3.5" /> Calendário</TabsTrigger>
          <TabsTrigger value="list" className="gap-1"><FileText className="h-3.5 w-3.5" /> Lista</TabsTrigger>
        </TabsList>

        {/* CALENDAR VIEW */}
        <TabsContent value="calendar" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Calendar grid */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <CardTitle className="text-base capitalize">
                    {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-px">
                  {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(day => (
                    <div key={day} className="text-center text-[10px] font-medium text-muted-foreground py-2">{day}</div>
                  ))}
                  {calendarDays.map((day, i) => {
                    const dayAppts = getAppointmentsForDate(day);
                    const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                    const isSelected = isSameDay(day, selectedDate);
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedDate(day)}
                        className={`relative p-1 min-h-[60px] text-left rounded-lg transition-colors border ${
                          isSelected ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/50"
                        } ${!isCurrentMonth ? "opacity-30" : ""}`}
                      >
                        <span className={`text-xs font-medium ${isToday(day) ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center" : ""}`}>
                          {format(day, "d")}
                        </span>
                        <div className="mt-0.5 space-y-0.5">
                          {dayAppts.slice(0, 2).map(a => (
                            <div key={a.id} className={`text-[8px] px-1 py-0.5 rounded truncate ${
                              a.status === "cancelled" ? "bg-destructive/10 text-destructive line-through" :
                              a.status === "confirmed" ? "bg-success/10 text-success" :
                              "bg-primary/10 text-primary"
                            }`}>
                              {format(parseISO(a.scheduled_at), "HH:mm")} {a.title}
                            </div>
                          ))}
                          {dayAppts.length > 2 && (
                            <div className="text-[8px] text-muted-foreground px-1">+{dayAppts.length - 2}</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Selected date detail */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm capitalize">
                    {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </CardTitle>
                  <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => openCreate(selectedDate)}>
                    <Plus className="h-3 w-3" /> Criar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {selectedDateAppointments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">Nenhum agendamento neste dia</p>
                  </div>
                ) : (
                  selectedDateAppointments.map(apt => {
                    const st = STATUS_MAP[apt.status] || STATUS_MAP.scheduled;
                    return (
                      <div key={apt.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium">{apt.title}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(parseISO(apt.scheduled_at), "HH:mm")} — {apt.duration_minutes}min
                            </p>
                          </div>
                          <Badge variant="outline" className={`text-[10px] ${st.color}`}>{st.label}</Badge>
                        </div>
                        {apt.lead_name && (
                          <p className="text-xs flex items-center gap-1"><User className="h-3 w-3" /> {apt.lead_name}</p>
                        )}
                        {apt.lead_phone && (
                          <p className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> {apt.lead_phone}</p>
                        )}
                        {apt.created_via === "ai" && (
                          <Badge variant="outline" className="text-[9px] gap-1 bg-warning/10 text-warning border-warning/30">
                            <Bot className="h-2.5 w-2.5" /> Criado pela IA
                          </Badge>
                        )}
                        <div className="flex gap-1.5 pt-1">
                          {apt.status === "scheduled" && (
                            <Button size="sm" variant="outline" className="text-[10px] h-6 rounded-lg" onClick={() => handleStatusChange(apt.id, "confirmed")}>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Confirmar
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-[10px] h-6" onClick={() => openEdit(apt)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-[10px] h-6 text-destructive" onClick={() => handleDelete(apt.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* LIST VIEW */}
        <TabsContent value="list" className="space-y-3">
          {appointments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum agendamento ainda.</p>
                <p className="text-xs mt-1">Crie manualmente ou deixe a IA agendar via WhatsApp.</p>
              </CardContent>
            </Card>
          ) : (
            appointments.map(apt => {
              const st = STATUS_MAP[apt.status] || STATUS_MAP.scheduled;
              const StIcon = st.icon;
              return (
                <Card key={apt.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-3 flex items-center gap-4">
                    <div className="flex flex-col items-center min-w-[50px]">
                      <span className="text-lg font-bold">{format(parseISO(apt.scheduled_at), "dd")}</span>
                      <span className="text-[10px] text-muted-foreground capitalize">{format(parseISO(apt.scheduled_at), "MMM", { locale: ptBR })}</span>
                      <span className="text-xs font-medium text-primary">{format(parseISO(apt.scheduled_at), "HH:mm")}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{apt.title}</p>
                        <Badge variant="outline" className={`text-[9px] shrink-0 ${st.color}`}>
                          <StIcon className="h-2.5 w-2.5 mr-0.5" /> {st.label}
                        </Badge>
                        {apt.created_via === "ai" && (
                          <Badge variant="outline" className="text-[9px] shrink-0 bg-warning/10 text-warning border-warning/30">
                            <Bot className="h-2.5 w-2.5" />
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {apt.lead_name && <span className="flex items-center gap-1"><User className="h-3 w-3" /> {apt.lead_name}</span>}
                        {apt.lead_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {apt.lead_phone}</span>}
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {apt.duration_minutes}min</span>
                        {apt.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {apt.location}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {apt.status === "scheduled" && (
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleStatusChange(apt.id, "confirmed")}>Confirmar</Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(apt)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(apt.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Agendamento" : "Novo Agendamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Reunião de apresentação" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data e Hora *</Label>
                <Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} />
              </div>
              <div>
                <Label>Duração (min)</Label>
                <Select value={String(form.duration_minutes)} onValueChange={v => setForm(f => ({ ...f, duration_minutes: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[15, 30, 45, 60, 90, 120].map(m => (
                      <SelectItem key={m} value={String(m)}>{m} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome do Lead</Label>
                <Input value={form.lead_name} onChange={e => setForm(f => ({ ...f, lead_name: e.target.value }))} placeholder="Nome do contato" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.lead_phone} onChange={e => setForm(f => ({ ...f, lead_phone: e.target.value }))} placeholder="(11) 99999-9999" />
              </div>
            </div>
            {editingId && (
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_MAP).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Local</Label>
                <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Escritório, online..." />
              </div>
              <div>
                <Label>Link da Reunião</Label>
                <Input value={form.meeting_url} onChange={e => setForm(f => ({ ...f, meeting_url: e.target.value }))} placeholder="https://meet.google.com/..." />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notas internas..." />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingId ? "Salvar Alterações" : "Criar Agendamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
