
-- Add new columns to document_signatures
ALTER TABLE public.document_signatures 
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS document_hash text,
  ADD COLUMN IF NOT EXISTS acceptance_text text;

-- Create signature_audit_log table (immutable audit trail)
CREATE TABLE public.signature_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_id uuid REFERENCES public.document_signatures(id) ON DELETE RESTRICT NOT NULL,
  document_id uuid REFERENCES public.employee_documents(id) ON DELETE RESTRICT NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE RESTRICT NOT NULL,
  action text NOT NULL CHECK (action IN ('signed', 'refused', 'viewed')),
  ip_address text,
  user_agent text,
  document_hash text,
  acceptance_text text,
  pin_verified boolean DEFAULT false,
  signed_via text,
  auth_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.signature_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS: Only INSERT and SELECT, no UPDATE/DELETE
CREATE POLICY "Admin/RH podem ver audit log"
  ON public.signature_audit_log
  FOR SELECT
  TO authenticated
  USING (is_admin_or_rh(auth.uid()));

CREATE POLICY "Colaborador pode ver seu audit log"
  ON public.signature_audit_log
  FOR SELECT
  TO authenticated
  USING (employee_id IN (
    SELECT id FROM public.employees WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Service role pode inserir audit log"
  ON public.signature_audit_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);
