
-- Create closing_status enum
CREATE TYPE public.closing_status AS ENUM ('pendente', 'conferido', 'fechado');

-- Create monthly_closings table
CREATE TABLE public.monthly_closings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  ref_month DATE NOT NULL,
  total_worked_minutes INTEGER DEFAULT 0,
  total_expected_minutes INTEGER DEFAULT 0,
  total_balance_minutes INTEGER DEFAULT 0,
  total_break_minutes INTEGER DEFAULT 0,
  days_worked INTEGER DEFAULT 0,
  days_absent INTEGER DEFAULT 0,
  days_pending INTEGER DEFAULT 0,
  status closing_status NOT NULL DEFAULT 'pendente',
  closed_by UUID,
  closed_at TIMESTAMPTZ,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, ref_month)
);

-- Enable RLS
ALTER TABLE public.monthly_closings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admin/RH podem ver fechamentos"
  ON public.monthly_closings FOR SELECT
  TO authenticated
  USING (is_admin_or_rh(auth.uid()) AND company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Admin/RH podem inserir fechamentos"
  ON public.monthly_closings FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_rh(auth.uid()) AND company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Admin/RH podem atualizar fechamentos"
  ON public.monthly_closings FOR UPDATE
  TO authenticated
  USING (is_admin_or_rh(auth.uid()) AND company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Admin/RH podem deletar fechamentos"
  ON public.monthly_closings FOR DELETE
  TO authenticated
  USING (is_admin_or_rh(auth.uid()) AND company_id IN (SELECT get_user_company_ids(auth.uid())));
