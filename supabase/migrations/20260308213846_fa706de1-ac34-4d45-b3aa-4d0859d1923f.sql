
-- Allow authenticated employees to upload atestados to documentos bucket
CREATE POLICY "Colaborador pode fazer upload de atestados"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documentos' AND
  (storage.foldername(name))[1] = 'atestados'
);

-- Allow authenticated users to read their own atestados
CREATE POLICY "Colaborador pode ver seus atestados no storage"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documentos'
);
