
-- 1. user_roles: allow reading own roles; restrict admin management to super_admin OR same-company admins
DROP POLICY IF EXISTS "Admin pode gerenciar roles" ON public.user_roles;

CREATE POLICY "Users can read own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Super admin manages any role"
ON public.user_roles FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Company admin manages roles within same company"
ON public.user_roles FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND role <> 'super_admin'::app_role
  AND EXISTS (
    SELECT 1 FROM public.user_company_access uca
    WHERE uca.user_id = user_roles.user_id
      AND uca.company_id IN (SELECT public.get_user_company_ids(auth.uid()))
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND role <> 'super_admin'::app_role
  AND EXISTS (
    SELECT 1 FROM public.user_company_access uca
    WHERE uca.user_id = user_roles.user_id
      AND uca.company_id IN (SELECT public.get_user_company_ids(auth.uid()))
  )
);

-- 2. Storage: selfies_ponto — remove open INSERT (only edge function w/ service role uploads)
DROP POLICY IF EXISTS "Sistema pode fazer upload de selfies" ON storage.objects;

-- 2b. selfies_ponto — scope admin/RH SELECT to their company
DROP POLICY IF EXISTS "Admin/RH podem ver selfies" ON storage.objects;
CREATE POLICY "Admin/RH podem ver selfies (empresa)"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'selfies_ponto'
  AND public.is_admin_or_rh(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id::text = (storage.foldername(name))[1]
      AND e.company_id IN (SELECT public.get_user_company_ids(auth.uid()))
  )
);

-- 3. selfies_assinatura — restrict INSERT to the employee themself OR admin/RH of their company
DROP POLICY IF EXISTS "Authenticated users can upload signature selfies" ON storage.objects;
CREATE POLICY "Signature selfies restricted upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'selfies_assinatura'
  AND (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id::text = (storage.foldername(name))[1]
        AND e.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id::text = (storage.foldername(name))[1]
        AND public.is_admin_or_rh(auth.uid())
        AND e.company_id IN (SELECT public.get_user_company_ids(auth.uid()))
    )
  )
);

-- 3b. selfies_assinatura — scope admin/RH read to their company
DROP POLICY IF EXISTS "Admin RH can read signature selfies" ON storage.objects;
CREATE POLICY "Admin RH can read signature selfies (empresa)"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'selfies_assinatura'
  AND public.is_admin_or_rh(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id::text = (storage.foldername(name))[1]
      AND e.company_id IN (SELECT public.get_user_company_ids(auth.uid()))
  )
);

-- 4. documentos — scope admin/RH policies by company (first folder segment is company_id)
DROP POLICY IF EXISTS "Admin/RH podem ver documentos storage" ON storage.objects;
DROP POLICY IF EXISTS "Admin/RH podem fazer upload de documentos" ON storage.objects;
DROP POLICY IF EXISTS "Admin/RH podem deletar documentos storage" ON storage.objects;

CREATE POLICY "Admin/RH ver documentos (empresa)"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documentos'
  AND public.is_admin_or_rh(auth.uid())
  AND ((storage.foldername(name))[1])::uuid IN (SELECT public.get_user_company_ids(auth.uid()))
);

CREATE POLICY "Admin/RH upload documentos (empresa)"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documentos'
  AND public.is_admin_or_rh(auth.uid())
  AND ((storage.foldername(name))[1])::uuid IN (SELECT public.get_user_company_ids(auth.uid()))
);

CREATE POLICY "Admin/RH deletar documentos (empresa)"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documentos'
  AND public.is_admin_or_rh(auth.uid())
  AND ((storage.foldername(name))[1])::uuid IN (SELECT public.get_user_company_ids(auth.uid()))
);

-- 5. fotos_cadastro — scope admin/RH policies by company
DROP POLICY IF EXISTS "Admin/RH podem ver fotos cadastro" ON storage.objects;
DROP POLICY IF EXISTS "Admin/RH podem fazer upload fotos cadastro" ON storage.objects;
DROP POLICY IF EXISTS "Admin/RH podem deletar fotos cadastro" ON storage.objects;

CREATE POLICY "Admin/RH ver fotos cadastro (empresa)"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'fotos_cadastro'
  AND public.is_admin_or_rh(auth.uid())
  AND ((storage.foldername(name))[1])::uuid IN (SELECT public.get_user_company_ids(auth.uid()))
);

CREATE POLICY "Admin/RH upload fotos cadastro (empresa)"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'fotos_cadastro'
  AND public.is_admin_or_rh(auth.uid())
  AND ((storage.foldername(name))[1])::uuid IN (SELECT public.get_user_company_ids(auth.uid()))
);

CREATE POLICY "Admin/RH deletar fotos cadastro (empresa)"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'fotos_cadastro'
  AND public.is_admin_or_rh(auth.uid())
  AND ((storage.foldername(name))[1])::uuid IN (SELECT public.get_user_company_ids(auth.uid()))
);
