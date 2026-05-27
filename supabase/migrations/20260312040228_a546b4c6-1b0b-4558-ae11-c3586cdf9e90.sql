CREATE POLICY "Service can delete instances" ON public.integration_instances
  FOR DELETE TO public USING (true);

CREATE POLICY "Service can update instances" ON public.integration_instances
  FOR UPDATE TO public USING (true);