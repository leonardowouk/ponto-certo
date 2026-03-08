
-- Enum for correction request status
CREATE TYPE public.correction_status AS ENUM ('pendente', 'aprovado', 'rejeitado');

-- Table for punch correction requests
CREATE TABLE public.punch_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  current_punch_id UUID REFERENCES public.time_punches(id),
  requested_time TIME WITHOUT TIME ZONE NOT NULL,
  punch_type public.punch_type NOT NULL,
  reason TEXT NOT NULL,
  status public.correction_status NOT NULL DEFAULT 'pendente',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  attachment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.punch_corrections ENABLE ROW LEVEL SECURITY;

-- Colaborador can insert correction requests
CREATE POLICY "Colaborador pode solicitar correções"
ON public.punch_corrections FOR INSERT
TO authenticated
WITH CHECK (
  employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
);

-- Colaborador can view their own corrections
CREATE POLICY "Colaborador pode ver suas correções"
ON public.punch_corrections FOR SELECT
TO authenticated
USING (
  employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
);

-- Admin/RH can view all corrections from their companies
CREATE POLICY "Admin/RH podem ver correções"
ON public.punch_corrections FOR SELECT
TO authenticated
USING (
  is_admin_or_rh(auth.uid()) AND employee_id IN (
    SELECT id FROM public.employees WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))
  )
);

-- Admin/RH can update corrections (approve/reject)
CREATE POLICY "Admin/RH podem atualizar correções"
ON public.punch_corrections FOR UPDATE
TO authenticated
USING (
  is_admin_or_rh(auth.uid()) AND employee_id IN (
    SELECT id FROM public.employees WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))
  )
);
