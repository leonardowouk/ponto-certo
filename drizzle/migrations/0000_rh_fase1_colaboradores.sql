-- Fase 1: estrutura de RH (aditivo, nada é removido)

-- 1. Novos campos no cadastro de colaboradores
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS matricula text,
  ADD COLUMN IF NOT EXISTS tipo_contrato text,
  ADD COLUMN IF NOT EXISTS situacao text DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS admission_status text DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS department_id uuid,
  ADD COLUMN IF NOT EXISTS position_id uuid,
  ADD COLUMN IF NOT EXISTS data_desligamento date;

-- 2. Departamentos
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "departments_select" ON public.departments FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "departments_write" ON public.departments FOR ALL TO authenticated
  USING (public.is_admin_or_rh(auth.uid()) AND company_id IN (SELECT public.get_user_company_ids(auth.uid())))
  WITH CHECK (public.is_admin_or_rh(auth.uid()) AND company_id IN (SELECT public.get_user_company_ids(auth.uid())));

-- 3. Cargos
CREATE TABLE IF NOT EXISTS public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positions TO authenticated;
GRANT ALL ON public.positions TO service_role;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "positions_select" ON public.positions FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "positions_write" ON public.positions FOR ALL TO authenticated
  USING (public.is_admin_or_rh(auth.uid()) AND company_id IN (SELECT public.get_user_company_ids(auth.uid())))
  WITH CHECK (public.is_admin_or_rh(auth.uid()) AND company_id IN (SELECT public.get_user_company_ids(auth.uid())));

ALTER TABLE public.employees
  ADD CONSTRAINT employees_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.employees
  ADD CONSTRAINT employees_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.positions(id) ON DELETE SET NULL;

-- 4. Categorias de documentos
CREATE TABLE IF NOT EXISTS public.document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  slug text NOT NULL,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_categories TO authenticated;
GRANT ALL ON public.document_categories TO service_role;
ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc_categories_select" ON public.document_categories FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "doc_categories_write" ON public.document_categories FOR ALL TO authenticated
  USING (public.is_admin_or_rh(auth.uid()) AND company_id IN (SELECT public.get_user_company_ids(auth.uid())))
  WITH CHECK (public.is_admin_or_rh(auth.uid()) AND company_id IN (SELECT public.get_user_company_ids(auth.uid())));

INSERT INTO public.document_categories (company_id, slug, nome, ordem)
SELECT NULL, v.slug, v.nome, v.ordem FROM (VALUES
  ('admissao','Admissão',1),
  ('contratos','Contratos',2),
  ('holerites','Holerites',3),
  ('beneficios','Benefícios',4),
  ('ferias','Férias',5),
  ('comunicados','Comunicados',6),
  ('politicas','Políticas e termos',7),
  ('outros','Outros',8)
) AS v(slug,nome,ordem)
WHERE NOT EXISTS (SELECT 1 FROM public.document_categories WHERE company_id IS NULL);

-- 5. Auditoria
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  actor_user_id uuid,
  actor_role text,
  actor_name text,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  document_id uuid,
  result text NOT NULL DEFAULT 'sucesso',
  ip_address text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select_admin" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_admin_or_rh(auth.uid()) AND (company_id IS NULL OR company_id IN (SELECT public.get_user_company_ids(auth.uid()))));
CREATE POLICY "audit_insert_auth" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_created ON public.audit_logs (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_employee ON public.audit_logs (employee_id, created_at DESC);

-- 6. Notificações internas
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  user_id uuid,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensagem text,
  link text,
  lida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
    OR (public.is_admin_or_rh(auth.uid()) AND company_id IN (SELECT public.get_user_company_ids(auth.uid())))
  );
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
    OR (public.is_admin_or_rh(auth.uid()) AND company_id IN (SELECT public.get_user_company_ids(auth.uid())))
  );
CREATE POLICY "notifications_insert_admin" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_rh(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_notifications_employee ON public.notifications (employee_id, created_at DESC);

-- 7. Triggers de updated_at
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_positions_updated BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_employees_data_nascimento ON public.employees (data_nascimento);
CREATE INDEX IF NOT EXISTS idx_employees_matricula ON public.employees (company_id, matricula);