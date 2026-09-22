-- lovable-cron-fallback-reviewed: existing checklist dispatch/reminder jobs (unchanged cadence) re-created only to add an authentication header
CREATE TABLE IF NOT EXISTS public.internal_job_secrets (
  name text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.internal_job_secrets FROM anon, authenticated;
GRANT ALL ON public.internal_job_secrets TO service_role;

ALTER TABLE public.internal_job_secrets ENABLE ROW LEVEL SECURITY;

INSERT INTO public.internal_job_secrets (name, value)
VALUES ('cron', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

SELECT cron.unschedule('dispatch-checklists-every-5min');
SELECT cron.unschedule('checklist-reminders-every-5min');
SELECT cron.unschedule('checklist-daily-summary-hourly');

SELECT cron.schedule('dispatch-checklists-every-5min', '*/5 * * * *', $$
  SELECT net.http_post(
    url := 'https://vvwxfwltugwbnkurjcvs.supabase.co/functions/v1/dispatch-checklists',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', (SELECT value FROM public.internal_job_secrets WHERE name = 'cron')),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('checklist-reminders-every-5min', '*/5 * * * *', $$
  SELECT net.http_post(
    url := 'https://vvwxfwltugwbnkurjcvs.supabase.co/functions/v1/send-checklist-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', (SELECT value FROM public.internal_job_secrets WHERE name = 'cron')),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('checklist-daily-summary-hourly', '0 * * * *', $$
  SELECT net.http_post(
    url := 'https://vvwxfwltugwbnkurjcvs.supabase.co/functions/v1/send-checklist-daily-summary',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', (SELECT value FROM public.internal_job_secrets WHERE name = 'cron')),
    body := '{}'::jsonb
  );
$$);

DROP POLICY IF EXISTS audit_insert_auth ON public.audit_logs;
CREATE POLICY audit_insert_auth ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid());