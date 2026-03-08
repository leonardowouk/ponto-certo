-- Add auth_user_id to employees for portal login
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE;

-- Allow employees to read their own data
CREATE POLICY "Colaborador pode ver seus dados"
ON public.employees FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

-- Allow employees to read their own documents
CREATE POLICY "Colaborador pode ver seus documentos"
ON public.employee_documents FOR SELECT
TO authenticated
USING (employee_id IN (
  SELECT id FROM public.employees WHERE auth_user_id = auth.uid()
));

-- Allow employees to read their own signatures
CREATE POLICY "Colaborador pode ver suas assinaturas"
ON public.document_signatures FOR SELECT
TO authenticated
USING (employee_id IN (
  SELECT id FROM public.employees WHERE auth_user_id = auth.uid()
));

-- Allow employees to update their own signatures (for signing)
CREATE POLICY "Colaborador pode assinar documentos"
ON public.document_signatures FOR UPDATE
TO authenticated
USING (employee_id IN (
  SELECT id FROM public.employees WHERE auth_user_id = auth.uid()
));

-- Allow employees to read their own timesheets
CREATE POLICY "Colaborador pode ver seus espelhos"
ON public.timesheets_daily FOR SELECT
TO authenticated
USING (employee_id IN (
  SELECT id FROM public.employees WHERE auth_user_id = auth.uid()
));

-- Allow employees to read their own time punches
CREATE POLICY "Colaborador pode ver suas batidas"
ON public.time_punches FOR SELECT
TO authenticated
USING (employee_id IN (
  SELECT id FROM public.employees WHERE auth_user_id = auth.uid()
));

-- Allow employees to see their hour bank balance
CREATE POLICY "Colaborador pode ver seu saldo"
ON public.hour_bank_balance FOR SELECT
TO authenticated
USING (employee_id IN (
  SELECT id FROM public.employees WHERE auth_user_id = auth.uid()
));