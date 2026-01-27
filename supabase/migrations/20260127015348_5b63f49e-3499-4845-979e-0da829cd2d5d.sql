-- Enum para tipos de ponto
CREATE TYPE public.punch_type AS ENUM ('entrada', 'saida', 'intervalo_inicio', 'intervalo_fim');

-- Enum para status do ponto
CREATE TYPE public.punch_status AS ENUM ('ok', 'suspeito', 'ajustado', 'pendente');

-- Enum para tipo de jornada
CREATE TYPE public.schedule_type AS ENUM ('fixa', 'flexivel', 'escala');

-- Enum para status do timesheet
CREATE TYPE public.timesheet_status AS ENUM ('ok', 'pendente', 'revisao', 'ajustado', 'falta');

-- Enum para fonte do banco de horas
CREATE TYPE public.hour_bank_source AS ENUM ('automatico', 'ajuste_manual', 'abono', 'atestado', 'compensacao');

-- Enum para status de aprovação
CREATE TYPE public.approval_status AS ENUM ('aprovado', 'pendente', 'rejeitado');

-- Enum para roles do sistema
CREATE TYPE public.app_role AS ENUM ('admin', 'rh', 'gestor', 'colaborador');

-- =====================================================
-- TABELA: employees (Colaboradores)
-- =====================================================
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cpf_hash TEXT UNIQUE NOT NULL,
  cpf_encrypted TEXT,
  pin_hash TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  foto_cadastro_url TEXT,
  cargo TEXT,
  setor TEXT,
  data_admissao DATE,
  failed_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- TABELA: time_devices (Dispositivos autorizados)
-- =====================================================
CREATE TABLE public.time_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  unidade TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  device_secret_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- TABELA: time_punches (Batidas de ponto)
-- =====================================================
CREATE TABLE public.time_punches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES public.time_devices(id),
  unidade TEXT NOT NULL,
  punched_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  punch_type public.punch_type NOT NULL,
  selfie_url TEXT NOT NULL,
  status public.punch_status DEFAULT 'ok',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- TABELA: work_schedules (Jornada por colaborador)
-- =====================================================
CREATE TABLE public.work_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,
  schedule_type public.schedule_type NOT NULL DEFAULT 'fixa',
  weekly_days JSONB NOT NULL DEFAULT '{"mon":true,"tue":true,"wed":true,"thu":true,"fri":true,"sat":false,"sun":false}'::jsonb,
  expected_start TIME,
  expected_end TIME,
  break_minutes INTEGER DEFAULT 60,
  break_required BOOLEAN DEFAULT true,
  tolerance_late_minutes INTEGER DEFAULT 10,
  tolerance_early_minutes INTEGER DEFAULT 10,
  min_extra_minutes_to_count INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- TABELA: timesheets_daily (Resumo diário)
-- =====================================================
CREATE TABLE public.timesheets_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  first_punch_at TIMESTAMP WITH TIME ZONE,
  last_punch_at TIMESTAMP WITH TIME ZONE,
  worked_minutes INTEGER DEFAULT 0,
  break_minutes INTEGER DEFAULT 0,
  expected_minutes INTEGER DEFAULT 0,
  balance_minutes INTEGER DEFAULT 0,
  status public.timesheet_status DEFAULT 'pendente',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(employee_id, work_date)
);

-- =====================================================
-- TABELA: hour_bank_ledger (Lançamentos banco de horas)
-- =====================================================
CREATE TABLE public.hour_bank_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  ref_date DATE NOT NULL,
  minutes INTEGER NOT NULL,
  source public.hour_bank_source NOT NULL,
  description TEXT,
  created_by UUID,
  approval_status public.approval_status DEFAULT 'aprovado',
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- TABELA: hour_bank_balance (Saldo atual)
-- =====================================================
CREATE TABLE public.hour_bank_balance (
  employee_id UUID PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  balance_minutes INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- TABELA: user_roles (Roles do sistema)
-- =====================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

-- =====================================================
-- TABELA: login_attempts (Log de tentativas - segurança)
-- =====================================================
CREATE TABLE public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf_hash TEXT NOT NULL,
  device_id UUID REFERENCES public.time_devices(id),
  success BOOLEAN NOT NULL,
  ip_address TEXT,
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- ÍNDICES
-- =====================================================
CREATE INDEX idx_employees_cpf_hash ON public.employees(cpf_hash);
CREATE INDEX idx_employees_ativo ON public.employees(ativo);
CREATE INDEX idx_time_punches_employee ON public.time_punches(employee_id);
CREATE INDEX idx_time_punches_punched_at ON public.time_punches(punched_at);
CREATE INDEX idx_time_punches_employee_date ON public.time_punches(employee_id, punched_at);
CREATE INDEX idx_timesheets_employee_date ON public.timesheets_daily(employee_id, work_date);
CREATE INDEX idx_hour_bank_ledger_employee ON public.hour_bank_ledger(employee_id);
CREATE INDEX idx_login_attempts_cpf ON public.login_attempts(cpf_hash);

-- =====================================================
-- FUNÇÕES DE SEGURANÇA
-- =====================================================

-- Função para verificar se usuário tem role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Função para verificar se é admin ou RH
CREATE OR REPLACE FUNCTION public.is_admin_or_rh(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'rh')
  );
$$;

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_work_schedules_updated_at
  BEFORE UPDATE ON public.work_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_timesheets_daily_updated_at
  BEFORE UPDATE ON public.timesheets_daily
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hour_bank_balance_updated_at
  BEFORE UPDATE ON public.hour_bank_balance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Employees: Apenas Admin/RH podem gerenciar
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/RH podem ver todos colaboradores"
  ON public.employees FOR SELECT
  TO authenticated
  USING (public.is_admin_or_rh(auth.uid()));

CREATE POLICY "Admin/RH podem inserir colaboradores"
  ON public.employees FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_rh(auth.uid()));

CREATE POLICY "Admin/RH podem atualizar colaboradores"
  ON public.employees FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_rh(auth.uid()));

-- Time Devices: Apenas Admin pode gerenciar
ALTER TABLE public.time_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin pode ver dispositivos"
  ON public.time_devices FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin pode gerenciar dispositivos"
  ON public.time_devices FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Time Punches: Admin/RH podem ver todos
ALTER TABLE public.time_punches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/RH podem ver batidas"
  ON public.time_punches FOR SELECT
  TO authenticated
  USING (public.is_admin_or_rh(auth.uid()));

CREATE POLICY "Admin/RH podem atualizar batidas"
  ON public.time_punches FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_rh(auth.uid()));

-- Work Schedules: Admin/RH podem gerenciar
ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/RH podem ver jornadas"
  ON public.work_schedules FOR SELECT
  TO authenticated
  USING (public.is_admin_or_rh(auth.uid()));

CREATE POLICY "Admin/RH podem gerenciar jornadas"
  ON public.work_schedules FOR ALL
  TO authenticated
  USING (public.is_admin_or_rh(auth.uid()));

-- Timesheets Daily: Admin/RH podem ver
ALTER TABLE public.timesheets_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/RH podem ver timesheets"
  ON public.timesheets_daily FOR SELECT
  TO authenticated
  USING (public.is_admin_or_rh(auth.uid()));

CREATE POLICY "Admin/RH podem gerenciar timesheets"
  ON public.timesheets_daily FOR ALL
  TO authenticated
  USING (public.is_admin_or_rh(auth.uid()));

-- Hour Bank Ledger: Admin/RH podem gerenciar
ALTER TABLE public.hour_bank_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/RH podem ver banco de horas"
  ON public.hour_bank_ledger FOR SELECT
  TO authenticated
  USING (public.is_admin_or_rh(auth.uid()));

CREATE POLICY "Admin/RH podem gerenciar banco de horas"
  ON public.hour_bank_ledger FOR ALL
  TO authenticated
  USING (public.is_admin_or_rh(auth.uid()));

-- Hour Bank Balance: Admin/RH podem ver
ALTER TABLE public.hour_bank_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/RH podem ver saldo"
  ON public.hour_bank_balance FOR SELECT
  TO authenticated
  USING (public.is_admin_or_rh(auth.uid()));

-- User Roles: Apenas Admin pode gerenciar
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin pode gerenciar roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Login Attempts: Apenas Admin pode ver
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin pode ver tentativas"
  ON public.login_attempts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- STORAGE BUCKETS
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('selfies_ponto', 'selfies_ponto', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('fotos_cadastro', 'fotos_cadastro', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']);

-- Storage Policies para selfies_ponto (apenas admin/RH podem acessar)
CREATE POLICY "Admin/RH podem ver selfies"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'selfies_ponto' AND public.is_admin_or_rh(auth.uid()));

CREATE POLICY "Sistema pode fazer upload de selfies"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'selfies_ponto');

-- Storage Policies para fotos_cadastro
CREATE POLICY "Admin/RH podem ver fotos cadastro"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'fotos_cadastro' AND public.is_admin_or_rh(auth.uid()));

CREATE POLICY "Admin/RH podem fazer upload fotos cadastro"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'fotos_cadastro' AND public.is_admin_or_rh(auth.uid()));

CREATE POLICY "Admin/RH podem deletar fotos cadastro"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'fotos_cadastro' AND public.is_admin_or_rh(auth.uid()));