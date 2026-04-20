

## Problema

No modal de Conferência do Fechamento Mensal (`EmployeeReviewModal`), ao ajustar um dia em que o colaborador esqueceu uma batida (ex: saída do almoço), a função `saveEdit`:

1. **Só atualiza batidas que já existem** (`if (pu.existingId && pu.time)`). Se a batida estava faltando, o horário digitado é simplesmente ignorado e nada é gravado em `time_punches`.
2. **Não cria batidas novas** para intervalos ausentes.
3. **Não remove batidas** quando o admin limpa um campo.
4. Mesmo assim, **recalcula `worked_minutes` e `break_minutes`** em `timesheets_daily` assumindo que o intervalo existe — fazendo os totais ficarem inconsistentes com a lista real de batidas mostrada no espelho.
5. Não trata fuso horário corretamente: `${day.work_date}T${time}:00` cria timestamp sem timezone, que o Postgres pode interpretar como UTC, deslocando o horário em algumas horas.

Resultado: o cenário descrito (entrada 7:50, sem saída pro almoço, retorno 13:30, saída 18:25 → admin ajusta inserindo 12:00 como saída do intervalo) faz com que os horários apareçam "totalmente diferentes" porque as batidas no banco não refletem o que foi digitado.

## Solução

Refatorar `saveEdit` em `src/components/admin/EmployeeReviewModal.tsx` para tratar corretamente os 4 tipos de batida (entrada, intervalo_inicio, intervalo_fim, saída) com lógica completa:

**Para cada tipo de batida:**
- Se o admin digitou um horário **e existe** batida → `UPDATE` com novo horário.
- Se o admin digitou um horário **e NÃO existe** batida → `INSERT` nova batida (status `ajustado`, `unidade` = "ajuste-manual", `device_id` de um dispositivo "manual" ou nulo se permitido).
- Se o admin **deixou em branco e existe** batida → `DELETE` ou marca como removida.
- Se o admin deixou em branco e não existe → não faz nada.

**Correção de timezone:**
- Trocar `${day.work_date}T${time}:00` por construção que respeite o fuso local do navegador (ex: usar `new Date(year, month-1, day, hours, mins).toISOString()`), garantindo que a batida fique no horário pretendido.

**Validação de coerência:**
- Garantir que entrada < intervalo_inicio < intervalo_fim < saída antes de salvar; se inválido, exibir erro claro.
- Se só um dos dois horários de intervalo for preenchido, exibir erro ("preencha início e fim do intervalo, ou deixe ambos vazios").

**Recálculo robusto:**
- Após salvar/criar/remover batidas, recarregar as batidas do dia do banco e recalcular `worked_minutes`, `break_minutes` e `balance_minutes` a partir delas (não a partir dos campos do form), garantindo que `timesheets_daily` sempre reflita exatamente as batidas em `time_punches`.

**Observação preservada:**
- Manter a justificativa obrigatória e concatenar nos `notes` como já faz hoje.

**Restrição do INSERT em time_punches:**
- A tabela `time_punches` atualmente bloqueia INSERT para o usuário (RLS: "Can't INSERT records"). Será necessário adicionar uma política RLS permitindo `INSERT` por `is_admin_or_rh(auth.uid())` para que o ajuste manual possa criar batidas faltantes. Da mesma forma, adicionar política de DELETE para admin/RH se quisermos suportar remoção de batida.

## Detalhes técnicos

**Arquivos alterados:**
- `src/components/admin/EmployeeReviewModal.tsx` — refatorar `saveEdit` (~80 linhas) e helper `calculateMinutesFromTimes` para retornar também os timestamps usados.

**Migração de banco (SQL):**
```sql
-- Permitir admin/RH inserir batidas manualmente no fechamento
CREATE POLICY "Admin/RH podem inserir batidas manuais"
ON public.time_punches FOR INSERT TO authenticated
WITH CHECK (is_admin_or_rh(auth.uid()));

-- Permitir admin/RH deletar batidas (para correções)
CREATE POLICY "Admin/RH podem deletar batidas"
ON public.time_punches FOR DELETE TO authenticated
USING (is_admin_or_rh(auth.uid()));
```

**Fluxo de save (pseudocódigo):**
```text
1. Validar justificativa e ordem dos horários
2. Para cada tipo (entrada, intervalo_inicio, intervalo_fim, saida):
   - novo = editValues[tipo]
   - existente = day.punches.find(p => p.punch_type === tipo)
   - se novo && existente → UPDATE punched_at + status='ajustado'
   - se novo && !existente → INSERT (employee_id, punch_type, punched_at, status='ajustado', unidade='ajuste', device_id=null)
   - se !novo && existente → DELETE
3. Re-fetch batidas do dia
4. Recalcular worked/break/balance a partir das batidas reais
5. UPDATE timesheets_daily (totais + status='ajustado' + notes)
6. loadDays()
```

Essa abordagem elimina a divergência entre as batidas exibidas e os totais, e garante que ajustes manuais — inclusive criação de batidas esquecidas — funcionem corretamente.

