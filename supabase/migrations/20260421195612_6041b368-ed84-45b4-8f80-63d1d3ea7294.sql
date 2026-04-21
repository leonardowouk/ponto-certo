-- Extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Index for fast phone lookup
CREATE INDEX IF NOT EXISTS idx_employees_telefone ON public.employees(telefone) WHERE telefone IS NOT NULL;

-- WhatsApp conversation sessions
CREATE TABLE public.checklist_whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  execucao_id UUID REFERENCES public.checklist_execucoes(id) ON DELETE SET NULL,
  current_item_id UUID REFERENCES public.checklist_items(id) ON DELETE SET NULL,
  state TEXT NOT NULL DEFAULT 'idle',
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wpp_sessions_phone ON public.checklist_whatsapp_sessions(phone, company_id);
CREATE INDEX idx_wpp_sessions_expires ON public.checklist_whatsapp_sessions(expires_at);

ALTER TABLE public.checklist_whatsapp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/RH gerenciam sessoes wpp"
ON public.checklist_whatsapp_sessions
FOR ALL TO authenticated
USING (is_admin_or_rh(auth.uid()) AND company_id IN (SELECT get_user_company_ids(auth.uid())))
WITH CHECK (is_admin_or_rh(auth.uid()) AND company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Service role gerencia sessoes wpp"
ON public.checklist_whatsapp_sessions
FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE TRIGGER update_wpp_sessions_updated_at
BEFORE UPDATE ON public.checklist_whatsapp_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();