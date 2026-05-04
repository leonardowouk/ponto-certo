# Aprovação de Correções de Ponto (Admin)

Hoje a tabela `punch_corrections` recebe solicitações dos colaboradores via portal, mas **não há nenhuma tela admin** para visualizar/aprovar/rejeitar. Vamos criar essa tela e integrar com o fechamento mensal.

## 1. Nova página: `/admin/corrections`

Arquivo: `src/pages/admin/Corrections.tsx`

- Listar todas as solicitações de `punch_corrections` da empresa selecionada (join com `employees` para nome/setor).
- Abas por status: **Pendentes** (default) | Aprovadas | Rejeitadas | Todas.
- Cada linha mostra: colaborador, data, tipo de batida, horário solicitado, motivo, anexo (se houver), data da solicitação.
- Ações em pendentes: **Aprovar** / **Rejeitar** (com campo opcional de "observação do revisor").
- Ao **aprovar**:
  - Inserir uma `time_punches` manual com `employee_id`, `punch_type`, `punched_at = work_date + requested_time`, `unidade = 'manual'`, `status = 'ok'`.
  - Atualizar `punch_corrections`: `status='aprovado'`, `reviewed_by=auth.uid()`, `reviewed_at=now()`, `review_notes`.
  - Recalcular o dia: re-rodar a mesma lógica que `EmployeeReviewModal` usa para atualizar `timesheets_daily` daquele dia (extrair em util `recalculateDailyTimesheet(employee_id, work_date)`).
- Ao **rejeitar**: apenas atualiza status + notas (sem criar batida).

## 2. Sidebar e rota

- Adicionar item **"Correções de Ponto"** no `AdminLayout.tsx` (ícone `MessageSquareWarning` ou `ClipboardCheck`), entre "Espelho de Ponto" e "Extras".
- Mostrar **badge com contador** de pendentes ao lado do label (query rápida `count` filtrada por company + status='pendente').
- Registrar rota em `src/App.tsx`.

## 3. Integração no Fechamento Mensal

No `EmployeeReviewModal.tsx`, na lista de dias **sem ponto** (`missing-${dateStr}`):

- Ao montar a lista, buscar `punch_corrections` do colaborador no mês (status='pendente').
- Se existir uma solicitação pendente para aquele dia, exibir um **alerta inline amarelo** no card do dia: *"Solicitação de correção pendente: [tipo] às [hora] — [motivo]"* com botões **Aprovar** / **Rejeitar** (mesma lógica da página de Corrections).
- Aprovar transforma o "dia sem ponto" em um dia com batida e remove o alerta.

## 4. Helper compartilhado

Criar `src/lib/punchCorrections.ts` com:

- `approveCorrection(correctionId, reviewNotes?)` — cria `time_punches`, atualiza `punch_corrections`, recalcula `timesheets_daily` do dia.
- `rejectCorrection(correctionId, reviewNotes)` — apenas atualiza status.
- `recalculateDailyTimesheet(employeeId, workDate)` — re-agrega batidas do dia (entrada/saída/intervalos), grava `worked_minutes`, `balance_minutes`, etc. Pode ser uma versão simplificada chamando a mesma lógica já presente em outros pontos do código.

## 5. Migração

Nenhuma. RLS já permite Admin/RH ler e atualizar `punch_corrections`, e inserir em `time_punches`.

---

**Decisão pendente** (default se você não responder):
- *Aprovação automática como o banco de horas?* → **Não** — correções precisam de revisão humana porque criam batidas físicas no espelho. Default = **fluxo manual com aprovar/rejeitar**.
