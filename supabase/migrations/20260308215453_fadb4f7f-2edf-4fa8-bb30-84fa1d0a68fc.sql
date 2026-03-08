
CREATE TABLE public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  message_template TEXT,
  schedule_time TIME WITHOUT TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, notification_type)
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/RH podem gerenciar notification_settings"
ON public.notification_settings
FOR ALL
TO authenticated
USING (
  is_admin_or_rh(auth.uid()) 
  AND company_id IN (SELECT get_user_company_ids(auth.uid()))
)
WITH CHECK (
  is_admin_or_rh(auth.uid()) 
  AND company_id IN (SELECT get_user_company_ids(auth.uid()))
);
