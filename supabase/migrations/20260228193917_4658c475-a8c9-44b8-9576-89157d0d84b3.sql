-- Add detected_audience column to conversation_tracker
-- Stores whether the lead was qualified as b2b or b2c (null = not yet qualified)
ALTER TABLE public.conversation_tracker 
ADD COLUMN detected_audience text DEFAULT NULL;