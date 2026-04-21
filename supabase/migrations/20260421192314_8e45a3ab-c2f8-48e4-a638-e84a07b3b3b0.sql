-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE public.checklist_item_type AS ENUM ('foto_ia', 'sim_nao');
CREATE TYPE public.checklist_execucao_status AS ENUM ('pendente', 'em_andamento', 'concluido', 'reprovado', 'revisar');
CREATE TYPE public.checklist_resposta_status AS ENUM ('pendente', 'aprovado', 'reprovado', 'revisar');

-- =====================================================
-- TABELAS
-- =====================================================
CREATE TABLE public.checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_checklists_company ON public.checklists(company_id);

CREATE TABLE public.checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 0,
  tipo public.checklist_item_type NOT NULL,
  descricao text NOT NULL,
  criterios_ia text,
  foto_modelo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_checklist_items_checklist ON public.checklist_items(checklist_id);

CREATE TABLE public.checklist_agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  checklist_id uuid NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  hora time NOT NULL,
  weekly_days jsonb NOT NULL DEFAULT '{"mon":true,"tue":true,"wed":true,"thu":true,"fri":true,"sat":false,"sun":false}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_checklist_agendamentos_company ON public.checklist_agendamentos(company_id);
CREATE INDEX idx_checklist_agendamentos_checklist ON public.checklist_agendamentos(checklist_id);

CREATE TABLE public.checklist_agendamento_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid NOT NULL REFERENCES public.checklist_agendamentos(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agendamento_id, employee_id)
);
CREATE INDEX idx_chk_ag_emp_emp ON public.checklist_agendamento_employees(employee_id);

CREATE TABLE public.checklist_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  agendamento_id uuid REFERENCES public.checklist_agendamentos(id) ON DELETE SET NULL,
  checklist_id uuid NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  status public.checklist_execucao_status NOT NULL DEFAULT 'pendente',
  iniciado_em timestamptz,
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_checklist_execucoes_company ON public.checklist_execucoes(company_id);
CREATE INDEX idx_checklist_execucoes_employee_data ON public.checklist_execucoes(employee_id, data);
CREATE INDEX idx_checklist_execucoes_status ON public.checklist_execucoes(status);

CREATE TABLE public.checklist_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id uuid NOT NULL REFERENCES public.checklist_execucoes(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  foto_url text,
  texto_resposta text,
  status_ia public.checklist_resposta_status,
  motivo_ia text,
  confianca_ia numeric,
  status_final public.checklist_resposta_status NOT NULL DEFAULT 'pendente',
  revisado_por uuid,
  revisado_em timestamptz,
  observacao_gestor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (execucao_id, item_id)
);
CREATE INDEX idx_checklist_respostas_exec ON public.checklist_respostas(execucao_id);

-- =====================================================
-- TRIGGERS updated_at
-- =====================================================
CREATE TRIGGER trg_checklists_updated BEFORE UPDATE ON public.checklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_checklist_items_updated BEFORE UPDATE ON public.checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_checklist_agendamentos_updated BEFORE UPDATE ON public.checklist_agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_checklist_execucoes_updated BEFORE UPDATE ON public.checklist_execucoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_checklist_respostas_updated BEFORE UPDATE ON public.checklist_respostas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_agendamento_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_execucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_respostas ENABLE ROW LEVEL SECURITY;

-- checklists
CREATE POLICY "Admin/RH gerenciam checklists" ON public.checklists FOR ALL TO authenticated
  USING (is_admin_or_rh(auth.uid()) AND company_id IN (SELECT get_user_company_ids(auth.uid())))
  WITH CHECK (is_admin_or_rh(auth.uid()) AND company_id IN (SELECT get_user_company_ids(auth.uid())));

-- checklist_items (via checklist -> company)
CREATE POLICY "Admin/RH gerenciam checklist_items" ON public.checklist_items FOR ALL TO authenticated
  USING (is_admin_or_rh(auth.uid()) AND checklist_id IN (
    SELECT id FROM public.checklists WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))
  ))
  WITH CHECK (is_admin_or_rh(auth.uid()) AND checklist_id IN (
    SELECT id FROM public.checklists WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))
  ));

-- checklist_agendamentos
CREATE POLICY "Admin/RH gerenciam agendamentos" ON public.checklist_agendamentos FOR ALL TO authenticated
  USING (is_admin_or_rh(auth.uid()) AND company_id IN (SELECT get_user_company_ids(auth.uid())))
  WITH CHECK (is_admin_or_rh(auth.uid()) AND company_id IN (SELECT get_user_company_ids(auth.uid())));

-- checklist_agendamento_employees (via agendamento -> company)
CREATE POLICY "Admin/RH gerenciam ag_employees" ON public.checklist_agendamento_employees FOR ALL TO authenticated
  USING (is_admin_or_rh(auth.uid()) AND agendamento_id IN (
    SELECT id FROM public.checklist_agendamentos WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))
  ))
  WITH CHECK (is_admin_or_rh(auth.uid()) AND agendamento_id IN (
    SELECT id FROM public.checklist_agendamentos WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))
  ));

-- checklist_execucoes
CREATE POLICY "Admin/RH gerenciam execucoes" ON public.checklist_execucoes FOR ALL TO authenticated
  USING (is_admin_or_rh(auth.uid()) AND company_id IN (SELECT get_user_company_ids(auth.uid())))
  WITH CHECK (is_admin_or_rh(auth.uid()) AND company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Colaborador ve suas execucoes" ON public.checklist_execucoes FOR SELECT TO authenticated
  USING (employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid()));

-- checklist_respostas (via execucao -> company)
CREATE POLICY "Admin/RH gerenciam respostas" ON public.checklist_respostas FOR ALL TO authenticated
  USING (is_admin_or_rh(auth.uid()) AND execucao_id IN (
    SELECT id FROM public.checklist_execucoes WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))
  ))
  WITH CHECK (is_admin_or_rh(auth.uid()) AND execucao_id IN (
    SELECT id FROM public.checklist_execucoes WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))
  ));

CREATE POLICY "Colaborador ve suas respostas" ON public.checklist_respostas FOR SELECT TO authenticated
  USING (execucao_id IN (
    SELECT id FROM public.checklist_execucoes
    WHERE employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
  ));

-- =====================================================
-- STORAGE BUCKET
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('checklist_fotos', 'checklist_fotos', false)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket: caminho começa com {company_id}/...
CREATE POLICY "Admin/RH leem checklist_fotos da empresa"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'checklist_fotos'
  AND is_admin_or_rh(auth.uid())
  AND ((storage.foldername(name))[1])::uuid IN (SELECT get_user_company_ids(auth.uid()))
);

CREATE POLICY "Admin/RH inserem checklist_fotos da empresa"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'checklist_fotos'
  AND is_admin_or_rh(auth.uid())
  AND ((storage.foldername(name))[1])::uuid IN (SELECT get_user_company_ids(auth.uid()))
);

CREATE POLICY "Admin/RH atualizam checklist_fotos da empresa"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'checklist_fotos'
  AND is_admin_or_rh(auth.uid())
  AND ((storage.foldername(name))[1])::uuid IN (SELECT get_user_company_ids(auth.uid()))
);

CREATE POLICY "Admin/RH apagam checklist_fotos da empresa"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'checklist_fotos'
  AND is_admin_or_rh(auth.uid())
  AND ((storage.foldername(name))[1])::uuid IN (SELECT get_user_company_ids(auth.uid()))
);