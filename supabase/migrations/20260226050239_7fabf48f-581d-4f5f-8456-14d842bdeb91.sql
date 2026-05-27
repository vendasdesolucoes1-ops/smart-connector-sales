
-- Appointments table for scheduling module
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads_raw(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  lead_name TEXT,
  lead_phone TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  location TEXT,
  meeting_url TEXT,
  notes TEXT,
  created_by UUID,
  created_via TEXT NOT NULL DEFAULT 'manual' CHECK (created_via IN ('manual', 'ai', 'api')),
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  cancelled_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view appointments"
  ON public.appointments FOR SELECT USING (is_org_member(org_id));

CREATE POLICY "Org members can create appointments"
  ON public.appointments FOR INSERT WITH CHECK (is_org_member(org_id));

CREATE POLICY "Org members can update appointments"
  ON public.appointments FOR UPDATE USING (is_org_member(org_id));

CREATE POLICY "Org members can delete appointments"
  ON public.appointments FOR DELETE USING (is_org_member(org_id));

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_appointments_org_date ON public.appointments(org_id, scheduled_at);
CREATE INDEX idx_appointments_status ON public.appointments(org_id, status);

-- Enable realtime for appointments
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
