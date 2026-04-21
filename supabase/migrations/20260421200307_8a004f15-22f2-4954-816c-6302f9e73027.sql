SELECT cron.schedule(
  'dispatch-checklists-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vvwxfwltugwbnkurjcvs.supabase.co/functions/v1/dispatch-checklists',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);