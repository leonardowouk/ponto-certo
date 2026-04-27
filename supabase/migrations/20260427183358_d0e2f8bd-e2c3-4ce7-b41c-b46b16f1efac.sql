DROP POLICY IF EXISTS "Colaborador pode ver seus atestados no storage" ON storage.objects;
DROP POLICY IF EXISTS "Colaborador pode fazer upload de atestados" ON storage.objects;

CREATE POLICY "Colaborador pode fazer upload de seus atestados"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[1] = 'atestados'
  AND EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.auth_user_id = auth.uid()
      AND e.id::text = (storage.foldername(name))[2]
  )
);

CREATE POLICY "Colaborador pode ver seus atestados vinculados"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[1] = 'atestados'
  AND EXISTS (
    SELECT 1
    FROM public.employee_documents ed
    JOIN public.employees e ON e.id = ed.employee_id
    WHERE e.auth_user_id = auth.uid()
      AND ed.file_url = name
  )
);