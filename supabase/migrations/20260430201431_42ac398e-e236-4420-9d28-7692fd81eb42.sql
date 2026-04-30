
-- Add interval columns to extra_time_records
ALTER TABLE public.extra_time_records
  ADD COLUMN saida_intervalo_at timestamptz,
  ADD COLUMN retorno_intervalo_at timestamptz,
  ADD COLUMN saida_intervalo_foto_url text,
  ADD COLUMN retorno_intervalo_foto_url text;

-- Update the trigger function to calculate total_minutes excluding interval
CREATE OR REPLACE FUNCTION public.set_extra_record_total_minutes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.saida_at IS NOT NULL AND NEW.entrada_at IS NOT NULL THEN
    -- Total = (saida_final - entrada) minus interval if both interval times exist
    DECLARE
      total_seconds numeric;
      interval_seconds numeric := 0;
    BEGIN
      total_seconds := EXTRACT(EPOCH FROM (NEW.saida_at - NEW.entrada_at));
      IF NEW.saida_intervalo_at IS NOT NULL AND NEW.retorno_intervalo_at IS NOT NULL THEN
        interval_seconds := EXTRACT(EPOCH FROM (NEW.retorno_intervalo_at - NEW.saida_intervalo_at));
      END IF;
      NEW.total_minutes := GREATEST(0, FLOOR((total_seconds - interval_seconds) / 60)::integer);
    END;
  ELSE
    NEW.total_minutes := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Now fix Maria's data: delete the two separate records and insert one combined record
DELETE FROM public.extra_time_records
WHERE extra_person_id = 'a27bd441-75b4-453b-937d-5838bf4174f3'
  AND record_date = '2026-04-29';

INSERT INTO public.extra_time_records (
  company_id, extra_person_id, record_date,
  entrada_at, saida_intervalo_at, retorno_intervalo_at, saida_at, total_minutes
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'a27bd441-75b4-453b-937d-5838bf4174f3',
  '2026-04-29',
  '2026-04-29T07:16:00-03:00',
  '2026-04-29T12:20:00-03:00',
  '2026-04-29T12:59:00-03:00',
  '2026-04-29T14:45:00-03:00',
  410
);
