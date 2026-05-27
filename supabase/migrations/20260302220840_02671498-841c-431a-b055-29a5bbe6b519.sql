-- Create unique index for upsert on chat_messages
CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_instance_message_unique 
ON public.chat_messages (instance_name, message_id) 
WHERE message_id IS NOT NULL;