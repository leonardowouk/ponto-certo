-- Fase 2: processo de admissão digital

CREATE TABLE IF NOT EXISTS public.admission_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'em_admissao',
  data_prevista_inicio date,
  observacoes text,
  concluido_em timestamptz,
  concluido_por uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admission_processes TO authenticated;
GRANT ALL ON public.admission_processes TO service_role;
ALTER TABLE public.admission_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admission_select" ON public.admission_processes FOR SELECT TO authenticated
  USING (
    (public.is_admin_or_rh(auth.uid()) AND company_id IN (SELECT public.get_user_company_ids(auth.uid())))
    OR employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
  );
CREATE POLICY "admission_write" ON public.admission_processes FOR ALL TO authenticated
  USING (public.is_admin_or_rh(auth.uid()) AND company_id IN (SELECT public.get_user_company_ids(auth.uid())))
  WITH CHECK (public.is_admin_or_rh(auth.uid()) AND company_id IN (SELECT public.get_user_company_ids(auth.uid())));

CREATE TABLE IF NOT EXISTS public.admission_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES public.admission_processes(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  categoria text NOT NULL DEFAULT 'admissao',
  obrigatorio boolean NOT NULL DEFAULT true,
  requer_assinatura boolean NOT NULL DEFAULT true,
  file_url text,
  status text NOT NULL DEFAULT 'pendente',
  document_id uuid REFERENCES public.employee_documents(id) ON DELETE SET NULL,
  enviado_em timestamptz,
  assinado_em timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admission_documents TO authenticated;
GRANT ALL ON public.admission_documents TO service_role;
ALTER TABLE public.admission_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admission_docs_select" ON public.admission_documents FOR SELECT TO authenticated
  USING (
    (public.is_admin_or_rh(auth.uid()) AND company_id IN (SELECT public.get_user_company_ids(auth.uid())))
    OR employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
  );
CREATE POLICY "admission_docs_write" ON public.admission_documents FOR ALL TO authenticated
  USING (public.is_admin_or_rh(auth.uid()) AND company_id IN (SELECT public.get_user_company_ids(auth.uid())))
  WITH CHECK (public.is_admin_or_rh(auth.uid()) AND company_id IN (SELECT public.get_user_company_ids(auth.uid())));

CREATE TRIGGER trg_admission_processes_updated BEFORE UPDATE ON public.admission_processes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_admission_documents_updated BEFORE UPDATE ON public.admission_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_admission_processes_company ON public.admission_processes (company_id, status);
CREATE INDEX IF NOT EXISTS idx_admission_documents_process ON public.admission_documents (process_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admission_processes_employee_open
  ON public.admission_processes (employee_id) WHERE status <> 'concluida';