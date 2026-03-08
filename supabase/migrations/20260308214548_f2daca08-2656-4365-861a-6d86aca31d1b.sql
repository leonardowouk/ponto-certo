
-- Add phone field to employees for WhatsApp notifications
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS telefone TEXT;
