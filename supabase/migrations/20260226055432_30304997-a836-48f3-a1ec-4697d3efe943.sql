
-- Create function to atomically increment customer message count
CREATE OR REPLACE FUNCTION public.increment_customer_msg_count(p_conv_id uuid)
RETURNS void
LANGUAGE sql
SET search_path TO 'public'
AS $$
  UPDATE public.conversation_tracker 
  SET customer_msg_count = customer_msg_count + 1
  WHERE id = p_conv_id;
$$;
