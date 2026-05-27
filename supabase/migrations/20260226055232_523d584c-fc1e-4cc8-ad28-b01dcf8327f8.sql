
-- Add customer message count to conversation_tracker for pipeline automation
ALTER TABLE public.conversation_tracker 
ADD COLUMN IF NOT EXISTS customer_msg_count integer NOT NULL DEFAULT 0;

-- Add pipeline_stage_key to track which CRM stage this conversation is linked to
ALTER TABLE public.conversation_tracker 
ADD COLUMN IF NOT EXISTS pipeline_stage_key text DEFAULT NULL;

-- Add automation_status to opportunities for tracking automation state
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS automation_status text DEFAULT 'idle';

-- Add enrichment_message to opportunities for storing the personalized message
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS personalized_message text DEFAULT NULL;

-- Add message_sent_at to track when automated WhatsApp was sent
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS message_sent_at timestamp with time zone DEFAULT NULL;
