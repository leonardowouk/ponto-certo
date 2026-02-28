
-- 1. Create companies table
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj_hash text UNIQUE,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 2. Create user_company_access table
CREATE TABLE public.user_company_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, company_id)
);
ALTER TABLE public.user_company_access ENABLE ROW LEVEL SECURITY;

-- 3. Add company_id to existing tables
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.sectors ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.time_devices ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- 4. Helper: is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  );
$$;

-- 5. Helper: get_user_company_ids
CREATE OR REPLACE FUNCTION public.get_user_company_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.companies
  WHERE EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
  UNION
  SELECT company_id FROM public.user_company_access
  WHERE user_id = _user_id
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  );
$$;

-- 6. Update is_admin_or_rh to include super_admin
CREATE OR REPLACE FUNCTION public.is_admin_or_rh(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'rh', 'super_admin')
  );
$$;

-- 7. Update has_role to treat super_admin as having all roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND (role = _role OR role = 'super_admin')
  );
$$;

-- 8. RLS for companies
CREATE POLICY "Super admin pode gerenciar empresas"
ON public.companies FOR ALL TO authenticated
USING (is_super_admin(auth.uid()));

CREATE POLICY "Usuarios veem suas empresas"
ON public.companies FOR SELECT TO authenticated
USING (id IN (SELECT get_user_company_ids(auth.uid())));

-- 9. RLS for user_company_access
CREATE POLICY "Super admin pode gerenciar acessos"
ON public.user_company_access FOR ALL TO authenticated
USING (is_super_admin(auth.uid()));

CREATE POLICY "Usuarios veem seus proprios acessos"
ON public.user_company_access FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 10. Update RLS on employees
DROP POLICY IF EXISTS "Admin/RH podem ver todos colaboradores" ON public.employees;
CREATE POLICY "Admin/RH podem ver colaboradores da empresa"
ON public.employees FOR SELECT TO authenticated
USING (
  is_admin_or_rh(auth.uid())
  AND (company_id IN (SELECT get_user_company_ids(auth.uid())) OR company_id IS NULL)
);

DROP POLICY IF EXISTS "Admin/RH podem inserir colaboradores" ON public.employees;
CREATE POLICY "Admin/RH podem inserir colaboradores da empresa"
ON public.employees FOR INSERT TO authenticated
WITH CHECK (
  is_admin_or_rh(auth.uid())
  AND (company_id IN (SELECT get_user_company_ids(auth.uid())) OR company_id IS NULL)
);

DROP POLICY IF EXISTS "Admin/RH podem atualizar colaboradores" ON public.employees;
CREATE POLICY "Admin/RH podem atualizar colaboradores da empresa"
ON public.employees FOR UPDATE TO authenticated
USING (
  is_admin_or_rh(auth.uid())
  AND (company_id IN (SELECT get_user_company_ids(auth.uid())) OR company_id IS NULL)
);

-- 11. Update RLS on sectors
DROP POLICY IF EXISTS "Admin/RH podem ver setores" ON public.sectors;
CREATE POLICY "Admin/RH podem ver setores da empresa"
ON public.sectors FOR SELECT TO authenticated
USING (
  is_admin_or_rh(auth.uid())
  AND (company_id IN (SELECT get_user_company_ids(auth.uid())) OR company_id IS NULL)
);

DROP POLICY IF EXISTS "Admin/RH podem inserir setores" ON public.sectors;
CREATE POLICY "Admin/RH podem inserir setores da empresa"
ON public.sectors FOR INSERT TO authenticated
WITH CHECK (
  is_admin_or_rh(auth.uid())
  AND (company_id IN (SELECT get_user_company_ids(auth.uid())) OR company_id IS NULL)
);

DROP POLICY IF EXISTS "Admin/RH podem atualizar setores" ON public.sectors;
CREATE POLICY "Admin/RH podem atualizar setores da empresa"
ON public.sectors FOR UPDATE TO authenticated
USING (
  is_admin_or_rh(auth.uid())
  AND (company_id IN (SELECT get_user_company_ids(auth.uid())) OR company_id IS NULL)
);

DROP POLICY IF EXISTS "Admin/RH podem deletar setores" ON public.sectors;
CREATE POLICY "Admin/RH podem deletar setores da empresa"
ON public.sectors FOR DELETE TO authenticated
USING (
  is_admin_or_rh(auth.uid())
  AND (company_id IN (SELECT get_user_company_ids(auth.uid())) OR company_id IS NULL)
);

-- 12. Update RLS on time_devices
DROP POLICY IF EXISTS "Admin pode gerenciar dispositivos" ON public.time_devices;
CREATE POLICY "Admin pode gerenciar dispositivos da empresa"
ON public.time_devices FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  AND (company_id IN (SELECT get_user_company_ids(auth.uid())) OR company_id IS NULL)
);

DROP POLICY IF EXISTS "Admin pode ver dispositivos" ON public.time_devices;
CREATE POLICY "Admin pode ver dispositivos da empresa"
ON public.time_devices FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  AND (company_id IN (SELECT get_user_company_ids(auth.uid())) OR company_id IS NULL)
);
