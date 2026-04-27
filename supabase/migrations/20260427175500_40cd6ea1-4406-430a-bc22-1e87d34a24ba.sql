CREATE TABLE public.extra_people (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  nome_completo text NOT NULL,
  cpf_hash text NOT NULL,
  cpf_encrypted text,
  foto_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (company_id, cpf_hash)
);

CREATE TABLE public.extra_time_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  extra_person_id uuid NOT NULL REFERENCES public.extra_people(id) ON DELETE CASCADE,
  record_date date NOT NULL DEFAULT CURRENT_DATE,
  entrada_at timestamp with time zone NOT NULL DEFAULT now(),
  saida_at timestamp with time zone,
  total_minutes integer,
  entrada_foto_url text,
  saida_foto_url text,
  comprovante_pagamento_url text,
  observacao_admin text,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_extra_people_company_cpf ON public.extra_people(company_id, cpf_hash);
CREATE INDEX idx_extra_records_company_date ON public.extra_time_records(company_id, record_date DESC);
CREATE INDEX idx_extra_records_person_date ON public.extra_time_records(extra_person_id, record_date DESC);
CREATE INDEX idx_extra_records_open ON public.extra_time_records(company_id, extra_person_id) WHERE saida_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_extra_record_total_minutes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  IF NEW.saida_at IS NOT NULL THEN
    NEW.total_minutes := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NEW.saida_at - NEW.entrada_at)) / 60)::integer);
  ELSE
    NEW.total_minutes := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_extra_people_updated_at
BEFORE UPDATE ON public.extra_people
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_extra_record_total_minutes_trigger
BEFORE INSERT OR UPDATE ON public.extra_time_records
FOR EACH ROW
EXECUTE FUNCTION public.set_extra_record_total_minutes();

ALTER TABLE public.extra_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extra_time_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/RH gerenciam pessoas extras"
ON public.extra_people
FOR ALL
TO authenticated
USING (is_admin_or_rh(auth.uid()) AND company_id IN (SELECT get_user_company_ids(auth.uid())))
WITH CHECK (is_admin_or_rh(auth.uid()) AND company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Admin/RH gerenciam registros extras"
ON public.extra_time_records
FOR ALL
TO authenticated
USING (is_admin_or_rh(auth.uid()) AND company_id IN (SELECT get_user_company_ids(auth.uid())))
WITH CHECK (is_admin_or_rh(auth.uid()) AND company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Service role gerencia pessoas extras"
ON public.extra_people
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role gerencia registros extras"
ON public.extra_time_records
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('extra_fotos', 'extra_fotos', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('extra_comprovantes', 'extra_comprovantes', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin/RH acessam fotos extras"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'extra_fotos'
  AND EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.id IN (SELECT get_user_company_ids(auth.uid()))
      AND is_admin_or_rh(auth.uid())
  )
);

CREATE POLICY "Admin/RH enviam fotos extras"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'extra_fotos'
  AND EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.id IN (SELECT get_user_company_ids(auth.uid()))
      AND is_admin_or_rh(auth.uid())
  )
);

CREATE POLICY "Admin/RH acessam comprovantes extras"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'extra_comprovantes'
  AND EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.id IN (SELECT get_user_company_ids(auth.uid()))
      AND has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Admin envia comprovantes extras"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'extra_comprovantes'
  AND EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.id IN (SELECT get_user_company_ids(auth.uid()))
      AND has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Admin atualiza comprovantes extras"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'extra_comprovantes'
  AND EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.id IN (SELECT get_user_company_ids(auth.uid()))
      AND has_role(auth.uid(), 'admin'::app_role)
  )
)
WITH CHECK (
  bucket_id = 'extra_comprovantes'
  AND EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.id IN (SELECT get_user_company_ids(auth.uid()))
      AND has_role(auth.uid(), 'admin'::app_role)
  )
);