
-- Fix conversation_tracker FK to cascade on lead deletion
ALTER TABLE public.conversation_tracker 
  DROP CONSTRAINT conversation_tracker_lead_id_fkey;

ALTER TABLE public.conversation_tracker 
  ADD CONSTRAINT conversation_tracker_lead_id_fkey 
  FOREIGN KEY (lead_id) REFERENCES public.leads_raw(id) ON DELETE CASCADE;

-- Fix appointments FK to cascade (currently SET NULL which is fine, but let's also set cascade for clean deletion)
ALTER TABLE public.appointments
  DROP CONSTRAINT appointments_lead_id_fkey;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES public.leads_raw(id) ON DELETE SET NULL;
