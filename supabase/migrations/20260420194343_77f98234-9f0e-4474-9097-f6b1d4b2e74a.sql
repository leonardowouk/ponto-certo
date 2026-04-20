-- Allow admin/RH to insert punches manually during monthly closing adjustments
CREATE POLICY "Admin/RH podem inserir batidas manuais"
ON public.time_punches FOR INSERT TO authenticated
WITH CHECK (is_admin_or_rh(auth.uid()));

-- Allow admin/RH to delete punches (for clearing wrong entries)
CREATE POLICY "Admin/RH podem deletar batidas"
ON public.time_punches FOR DELETE TO authenticated
USING (is_admin_or_rh(auth.uid()));

-- Allow device_id and selfie_url to be NULL for manual adjustments
ALTER TABLE public.time_punches ALTER COLUMN device_id DROP NOT NULL;
ALTER TABLE public.time_punches ALTER COLUMN selfie_url DROP NOT NULL;