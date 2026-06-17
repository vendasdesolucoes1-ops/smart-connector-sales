-- Schedule the ai-follow-up edge function to run periodically via pg_cron.
-- pg_cron and pg_net are already enabled (see 20260226044720_*.sql).
--
-- Secrets are NOT hardcoded here. Before this migration takes effect, a
-- super admin must store the following in Supabase Vault (SQL editor):
--
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<value of CRON_SECRET edge function secret>', 'cron_secret');
--
-- If the secrets are missing, the cron job's http call fails harmlessly
-- (ai-follow-up itself fails closed without CRON_SECRET configured).

SELECT cron.schedule(
  'ai-follow-up-every-10-minutes',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/ai-follow-up',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
