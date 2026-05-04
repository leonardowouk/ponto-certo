## Contexto rápido

Hoje o **banco de horas** já existe (`hour_bank_ledger` + `hour_bank_balance`):
- Lançamentos `automatico` são gerados a cada dia trabalhado (saldo = trabalhado − esperado).
- A enum `source` já suporta: `automatico`, `ajuste_manual`, `abono`, `atestado`, `compensacao`.
- Falta apenas **interface** para criar lançamentos manuais e amarrar com o fechamento mensal.

No **fechamento mensal**, no modal de revisão de cada colaborador, hoje existem 2 botões para dias sem ponto: **Falta** e **Abono**. Vamos adicionar um terceiro: **Folga compensada**.

---

## O que será feito

### 1. Tela Banco de Horas — dois botões de lançamento manual

Em `src/pages/admin/HourBank.tsx`, no card "Extrato de Lançamentos", adicionar dois botões no header:

- **"Lançar folga"** → modal com:
  - Colaborador (Select)
  - Data da folga (DatePicker)
  - Descrição (opcional, ex: "Folga compensatória")
  - Ao salvar, busca a jornada esperada do colaborador para o dia da semana (via `work_schedules` → `sector_schedules` → padrão 8h, mesma hierarquia já documentada) e debita esses minutos como `source = 'compensacao'`, `approval_status = 'aprovado'`.

- **"Novo ajuste manual"** → modal com:
  - Colaborador, Data, Tipo (`ajuste_manual` | `abono` | `atestado` | `compensacao`), Minutos (input livre, aceita negativo), Descrição.
  - Insere direto no ledger como aprovado.

Após qualquer inserção: recalcular `hour_bank_balance` do colaborador (somar todos os lançamentos `aprovado`) e recarregar listas.

### 2. Fechamento Mensal — opção "Folga compensada"

No `EmployeeReviewModal.tsx`, junto dos botões **Falta** / **Abono** dos dias sem ponto, adicionar **Folga compensada**:

- Marca o dia em `timesheets_daily` com `status = 'abono'` e `notes = 'Folga compensada do banco de horas'` (ou criar um novo valor `folga_compensada` no enum `timesheet_status` — ver pergunta abaixo).
- Cria um lançamento em `hour_bank_ledger`: `source = 'compensacao'`, `minutes = -expected_minutes do dia`, `ref_date = data do dia`, descrição automática.
- Recalcula `hour_bank_balance`.

O dia deixa de aparecer como "pendente" para liberar a conferência do mês.

### 3. Recálculo de saldo (helper compartilhado)

Criar função utilitária `recalculateHourBankBalance(employeeId)` em `src/lib/hourBank.ts` reutilizada pelos dois pontos acima — consulta o ledger aprovado e dá upsert no balance.

---

## Detalhes técnicos

**Arquivos alterados/criados:**
- `src/pages/admin/HourBank.tsx` — botões + 2 modais
- `src/components/admin/HourBankEntryModal.tsx` (novo) — modal de ajuste manual
- `src/components/admin/CompensationDayModal.tsx` (novo) — modal de folga rápida (com cálculo automático de minutos pela jornada)
- `src/components/admin/EmployeeReviewModal.tsx` — botão "Folga compensada" nos dias sem ponto
- `src/lib/hourBank.ts` (novo) — helper `recalculateHourBankBalance` e helper `getExpectedMinutesForDate`

**Banco de dados:** nenhuma migração obrigatória. A enum `source` já contempla todos os tipos. Os lançamentos serão `approval_status = 'aprovado'` por padrão.

**RLS:** já permite Admin/RH gerenciar `hour_bank_ledger` e fazer upsert em `hour_bank_balance` indiretamente via lógica do app — porém a tabela `hour_bank_balance` hoje tem RLS apenas de SELECT. Será necessária **uma migração** liberando INSERT/UPDATE para Admin/RH (`is_admin_or_rh(auth.uid())`), senão o recálculo falha.

**Multi-tenancy:** todos os Selects de colaborador continuam filtrando por `selectedCompanyId` via `CompanyContext`.

---

## Pergunta rápida antes de implementar

Para "Folga compensada" no fechamento mensal, prefere que o dia fique marcado como **`abono`** (status já existente, com nota explicativa) ou criar um novo valor **`folga_compensada`** no enum `timesheet_status` (mais explícito no espelho de ponto, mas exige migração e ajustes nas telas que renderizam status)?

Se preferir o caminho mais simples (`abono` + nota), implemento direto. Caso contrário, me avise e adiciono a migração do enum.
