
-- Table to store Z-API credentials per company
CREATE TABLE public.company_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL DEFAULT 'zapi',
  instance_id TEXT,
  instance_token TEXT,
  client_token TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, integration_type)
);

ALTER TABLE public.company_integrations ENABLE ROW LEVEL SECURITY;

-- Admin can manage integrations for their companies
CREATE POLICY "Admin pode gerenciar integrações"
ON public.company_integrations FOR ALL
TO authenticated
USING (
  is_admin_or_rh(auth.uid()) AND company_id IN (SELECT get_user_company_ids(auth.uid()))
)
WITH CHECK (
  is_admin_or_rh(auth.uid()) AND company_id IN (SELECT get_user_company_ids(auth.uid()))
);

-- Trigger to update updated_at
CREATE TRIGGER update_company_integrations_updated_at
  BEFORE UPDATE ON public.company_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
