
-- Enum: document_type
CREATE TYPE public.document_type AS ENUM ('holerite', 'espelho_ponto', 'contrato', 'advertencia', 'comunicado', 'outro');

-- Enum: signature_status
CREATE TYPE public.signature_status AS ENUM ('pendente', 'assinado', 'recusado');

-- Table: employee_documents
CREATE TABLE public.employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_type public.document_type NOT NULL DEFAULT 'outro',
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  ref_month DATE,
  requires_signature BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/RH podem ver documentos" ON public.employee_documents
  FOR SELECT TO authenticated
  USING (is_admin_or_rh(auth.uid()) AND company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Admin/RH podem inserir documentos" ON public.employee_documents
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_rh(auth.uid()) AND company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Admin/RH podem atualizar documentos" ON public.employee_documents
  FOR UPDATE TO authenticated
  USING (is_admin_or_rh(auth.uid()) AND company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Admin/RH podem deletar documentos" ON public.employee_documents
  FOR DELETE TO authenticated
  USING (is_admin_or_rh(auth.uid()) AND company_id IN (SELECT get_user_company_ids(auth.uid())));

-- Table: document_signatures
CREATE TABLE public.document_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.employee_documents(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  status public.signature_status NOT NULL DEFAULT 'pendente',
  signed_at TIMESTAMPTZ,
  signed_via TEXT,
  ip_address TEXT,
  pin_verified BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, employee_id)
);

ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/RH podem ver assinaturas" ON public.document_signatures
  FOR SELECT TO authenticated
  USING (is_admin_or_rh(auth.uid()) AND document_id IN (
    SELECT id FROM public.employee_documents WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))
  ));

CREATE POLICY "Admin/RH podem inserir assinaturas" ON public.document_signatures
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_rh(auth.uid()) AND document_id IN (
    SELECT id FROM public.employee_documents WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))
  ));

CREATE POLICY "Admin/RH podem atualizar assinaturas" ON public.document_signatures
  FOR UPDATE TO authenticated
  USING (is_admin_or_rh(auth.uid()) AND document_id IN (
    SELECT id FROM public.employee_documents WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))
  ));

CREATE POLICY "Admin/RH podem deletar assinaturas" ON public.document_signatures
  FOR DELETE TO authenticated
  USING (is_admin_or_rh(auth.uid()) AND document_id IN (
    SELECT id FROM public.employee_documents WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))
  ));

-- Storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documentos', 'documentos', false);

-- Storage RLS
CREATE POLICY "Admin/RH podem fazer upload de documentos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos' AND is_admin_or_rh(auth.uid()));

CREATE POLICY "Admin/RH podem ver documentos storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documentos' AND is_admin_or_rh(auth.uid()));

CREATE POLICY "Admin/RH podem deletar documentos storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documentos' AND is_admin_or_rh(auth.uid()));
