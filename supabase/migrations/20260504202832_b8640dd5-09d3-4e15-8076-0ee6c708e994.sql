
CREATE POLICY "Admin/RH podem inserir saldo banco horas"
ON public.hour_bank_balance
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_rh(auth.uid()));

CREATE POLICY "Admin/RH podem atualizar saldo banco horas"
ON public.hour_bank_balance
FOR UPDATE
TO authenticated
USING (is_admin_or_rh(auth.uid()));
