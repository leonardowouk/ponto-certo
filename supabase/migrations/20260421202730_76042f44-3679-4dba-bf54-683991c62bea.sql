-- 1) Campo de lembrete configurável por agendamento
ALTER TABLE public.checklist_agendamentos
  ADD COLUMN IF NOT EXISTS lembrete_apos_minutos integer;

-- 2) Marcador de envio de lembrete (evita duplicar)
ALTER TABLE public.checklist_execucoes
  ADD COLUMN IF NOT EXISTS lembrete_enviado_em timestamptz;

-- 3) Cron: lembretes a cada 5 minutos
SELECT cron.schedule(
  'checklist-reminders-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vvwxfwltugwbnkurjcvs.supabase.co/functions/v1/send-checklist-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- 4) Cron: resumo diário verifica a cada hora (a função filtra por horário configurado de cada empresa)
SELECT cron.schedule(
  'checklist-daily-summary-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vvwxfwltugwbnkurjcvs.supabase.co/functions/v1/send-checklist-daily-summary',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);