
-- Allow employees to read their own documents from the 'documentos' bucket
CREATE POLICY "Colaborador pode ler seus documentos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documentos'
  AND (
    -- Admin/RH access
    is_admin_or_rh(auth.uid())
    OR
    -- Employee access: file path contains their employee_id via document lookup
    EXISTS (
      SELECT 1 FROM public.employee_documents ed
      JOIN public.employees e ON e.id = ed.employee_id
      WHERE e.auth_user_id = auth.uid()
      AND ed.file_url = name
    )
  )
);
