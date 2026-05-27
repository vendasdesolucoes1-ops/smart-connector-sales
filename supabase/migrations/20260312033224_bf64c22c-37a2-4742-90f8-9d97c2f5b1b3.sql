-- Remove duplicate message_ids keeping the latest row
DELETE FROM public.chat_messages a
USING public.chat_messages b
WHERE a.message_id IS NOT NULL
  AND a.message_id = b.message_id
  AND a.created_at < b.created_at;

-- Now add the unique constraint
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_message_id_unique UNIQUE (message_id);