
-- Table to store WhatsApp messages for chat history viewing
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  instance_name TEXT NOT NULL,
  remote_jid TEXT NOT NULL,
  from_me BOOLEAN NOT NULL DEFAULT false,
  message_text TEXT NOT NULL DEFAULT '',
  message_type TEXT NOT NULL DEFAULT 'text',
  push_name TEXT,
  message_id TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by conversation
CREATE INDEX idx_chat_messages_conversation ON public.chat_messages (org_id, instance_name, remote_jid, timestamp DESC);

-- Index for dedup by message_id
CREATE UNIQUE INDEX idx_chat_messages_unique ON public.chat_messages (instance_name, message_id) WHERE message_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Org members can view chat messages"
  ON public.chat_messages FOR SELECT
  USING (is_org_member(org_id));

CREATE POLICY "Service role can insert chat messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (true);
