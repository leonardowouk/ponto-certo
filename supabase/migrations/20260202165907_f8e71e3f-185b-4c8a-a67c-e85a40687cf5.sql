-- Criar tabela sectors
CREATE TABLE public.sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Criar tabela sector_schedules
CREATE TABLE public.sector_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  expected_start time NOT NULL DEFAULT '08:00',
  expected_end time NOT NULL DEFAULT '18:00',
  break_minutes integer DEFAULT 60,
  tolerance_early_minutes integer DEFAULT 10,
  tolerance_late_minutes integer DEFAULT 10,
  weekly_days jsonb DEFAULT '{"mon":true,"tue":true,"wed":true,"thu":true,"fri":true,"sat":false,"sun":false}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(sector_id)
);

-- Adicionar sector_id em employees
ALTER TABLE public.employees ADD COLUMN sector_id uuid REFERENCES sectors(id);

-- RLS policies para sectors
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/RH podem ver setores" 
ON sectors FOR SELECT 
USING (is_admin_or_rh(auth.uid()));

CREATE POLICY "Admin/RH podem inserir setores" 
ON sectors FOR INSERT 
WITH CHECK (is_admin_or_rh(auth.uid()));

CREATE POLICY "Admin/RH podem atualizar setores" 
ON sectors FOR UPDATE 
USING (is_admin_or_rh(auth.uid()));

CREATE POLICY "Admin/RH podem deletar setores" 
ON sectors FOR DELETE 
USING (is_admin_or_rh(auth.uid()));

-- RLS policies para sector_schedules
ALTER TABLE sector_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/RH podem ver horarios setores" 
ON sector_schedules FOR SELECT 
USING (is_admin_or_rh(auth.uid()));

CREATE POLICY "Admin/RH podem inserir horarios setores" 
ON sector_schedules FOR INSERT 
WITH CHECK (is_admin_or_rh(auth.uid()));

CREATE POLICY "Admin/RH podem atualizar horarios setores" 
ON sector_schedules FOR UPDATE 
USING (is_admin_or_rh(auth.uid()));

CREATE POLICY "Admin/RH podem deletar horarios setores" 
ON sector_schedules FOR DELETE 
USING (is_admin_or_rh(auth.uid()));

-- Trigger para updated_at em sector_schedules
CREATE TRIGGER update_sector_schedules_updated_at
BEFORE UPDATE ON public.sector_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();