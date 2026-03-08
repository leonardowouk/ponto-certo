

## Módulo de Fechamento Mensal

### Visão Geral
Criar um módulo completo de fechamento mensal com 3 etapas: (1) tela de conferência/revisão por colaborador, (2) consolidação e fechamento, (3) geração de espelho para assinatura (PDF-like printable).

### Database

Nova tabela `monthly_closings`:
- `id` UUID PK
- `company_id` UUID NOT NULL
- `employee_id` UUID NOT NULL
- `ref_month` DATE NOT NULL (primeiro dia do mês)
- `total_worked_minutes` INT
- `total_expected_minutes` INT
- `total_balance_minutes` INT
- `total_break_minutes` INT
- `days_worked` INT
- `days_absent` INT
- `days_pending` INT
- `status` ENUM (`pendente`, `conferido`, `fechado`) default `pendente`
- `closed_by` UUID (user que fechou)
- `closed_at` TIMESTAMPTZ
- `reviewed_by` UUID
- `reviewed_at` TIMESTAMPTZ
- `notes` TEXT
- `created_at` TIMESTAMPTZ default now()
- UNIQUE(employee_id, ref_month)

Enum: `closing_status` = pendente, conferido, fechado

RLS: admin/RH com filtro por company via employee join.

### Frontend

**1. Nova página `src/pages/admin/MonthlyClosing.tsx`**
- Rota: `/admin/closing`
- Menu item no sidebar: "Fechamento Mensal" com ícone `FileCheck`

**2. Fluxo da página (3 estados):**

**Estado 1 - Lista de conferência:**
- Seletor de mês (reutiliza pattern do Timesheet)
- Tabela com todos colaboradores da empresa e resumo mensal:
  - Nome, Dias trabalhados, Horas trabalhadas, Horas esperadas, Saldo, Dias pendentes/revisão, Status do fechamento
- Badge indicando status: `pendente` (amarelo), `conferido` (azul), `fechado` (verde)
- Botão "Conferir" em cada linha para abrir a revisão detalhada
- Botão "Fechar Mês" (só habilita quando todos estão `conferido`)

**Estado 2 - Tela de conferência individual (modal ou drawer):**
- Cabeçalho: Nome do colaborador, mês de referência
- Tabela dia-a-dia com todas as batidas do mês (reutiliza dados de `timesheets_daily`)
- Totais consolidados ao final
- Botão "Marcar como Conferido" → atualiza status para `conferido`
- Botão "Voltar à lista"

**Estado 3 - Espelho para assinatura (print view):**
- Botão "Gerar Espelho" por colaborador (após fechado)
- Abre uma view printable (nova janela ou dialog full-screen) com:
  - Cabeçalho: empresa, colaborador, mês
  - Tabela de todos os dias do mês com batidas, trabalhado, esperado, saldo
  - Totais no rodapé
  - Linhas de assinatura: "Colaborador: ___" e "Responsável: ___"
  - Botão "Imprimir" (window.print)

**3. Lógica de consolidação:**
- Ao entrar na página, calcula o resumo mensal de cada colaborador a partir de `timesheets_daily`
- Upsert no `monthly_closings` com os totais calculados
- "Fechar Mês" marca todos como `fechado` e registra `closed_by` e `closed_at`

### Arquivos a criar/editar:
1. **Migração SQL**: criar enum `closing_status` e tabela `monthly_closings` com RLS
2. **`src/pages/admin/MonthlyClosing.tsx`**: página principal com lista + conferência + espelho
3. **`src/components/admin/EmployeeReviewModal.tsx`**: modal de conferência individual
4. **`src/components/admin/TimesheetPrintView.tsx`**: componente de espelho para impressão
5. **`src/App.tsx`**: adicionar rota `/admin/closing`
6. **`src/components/admin/AdminLayout.tsx`**: adicionar item de menu "Fechamento"

