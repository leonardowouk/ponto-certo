
-- Add selfie_url to document_signatures
ALTER TABLE public.document_signatures ADD COLUMN IF NOT EXISTS selfie_url text;

-- Add selfie_url to signature_audit_log
ALTER TABLE public.signature_audit_log ADD COLUMN IF NOT EXISTS selfie_url text;

-- Create signature_otp table
CREATE TABLE public.signature_otp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  signature_id uuid NOT NULL REFERENCES public.document_signatures(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS on signature_otp
ALTER TABLE public.signature_otp ENABLE ROW LEVEL SECURITY;

-- Service role can insert/update OTPs (edge functions)
CREATE POLICY "Service role pode gerenciar OTPs"
  ON public.signature_otp
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Colaborador can read their own OTPs
CREATE POLICY "Colaborador pode ver seus OTPs"
  ON public.signature_otp
  FOR SELECT
  TO authenticated
  USING (employee_id IN (
    SELECT id FROM public.employees WHERE auth_user_id = auth.uid()
  ));

-- Create storage bucket for signature selfies
INSERT INTO storage.buckets (id, name, public) VALUES ('selfies_assinatura', 'selfies_assinatura', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload selfies
CREATE POLICY "Authenticated users can upload signature selfies"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'selfies_assinatura');

-- Service role can read signature selfies
CREATE POLICY "Service role can read signature selfies"
  ON storage.objects FOR SELECT TO service_role
  USING (bucket_id = 'selfies_assinatura');

-- Admin/RH can read signature selfies
CREATE POLICY "Admin RH can read signature selfies"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'selfies_assinatura' AND (SELECT is_admin_or_rh(auth.uid())));

-- Colaborador can read their own signature selfies
CREATE POLICY "Colaborador can read own signature selfies"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'selfies_assinatura' AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.employees WHERE auth_user_id = auth.uid()
  ));
