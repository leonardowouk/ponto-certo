-- Adicionar coluna email aos colaboradores (opcional, para acesso ao painel)
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS email text;

-- Índice único para garantir que não haja emails duplicados
CREATE UNIQUE INDEX IF NOT EXISTS employees_email_unique ON public.employees(email) WHERE email IS NOT NULL;