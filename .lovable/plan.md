
# Plano: Horários por Setor

## Objetivo
Criar uma estrutura para definir jornadas de trabalho por **setor** (departamento), permitindo que funcionários herdem automaticamente o horário ao serem vinculados a um setor.

## Arquitetura Proposta

```text
+----------------+       +-------------------+       +-------------+
|    sectors     | <---- | sector_schedules  |       |  employees  |
+----------------+       +-------------------+       +-------------+
| id (PK)        |       | id (PK)           |       | id (PK)     |
| nome           |       | sector_id (FK)    |       | nome        |
| ativo          |       | expected_start    |       | sector_id   | ---> sectors
| created_at     |       | expected_end      |       | cargo       |
+----------------+       | break_minutes     |       | ...         |
                         | tolerance_early   |       +-------------+
                         | tolerance_late    |
                         | weekly_days       |
                         +-------------------+
```

## Mudancas no Banco de Dados

### 1. Nova tabela `sectors`
Armazena os setores/departamentos da empresa:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | Chave primaria |
| nome | text | Nome do setor (ex: Producao, Administrativo) |
| ativo | boolean | Se o setor esta ativo |
| created_at | timestamp | Data de criacao |

### 2. Nova tabela `sector_schedules`
Define o horario padrao de cada setor:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | Chave primaria |
| sector_id | uuid | FK para sectors |
| expected_start | time | Horario de entrada (ex: 08:00) |
| expected_end | time | Horario de saida (ex: 18:00) |
| break_minutes | integer | Duracao do intervalo em minutos |
| tolerance_early_minutes | integer | Tolerancia para chegada antecipada |
| tolerance_late_minutes | integer | Tolerancia para atraso |
| weekly_days | jsonb | Dias da semana trabalhados |
| created_at | timestamp | Data de criacao |
| updated_at | timestamp | Data de atualizacao |

### 3. Alterar tabela `employees`
Substituir o campo texto `setor` por referencia ao setor:

- Adicionar coluna `sector_id` (uuid, FK para sectors)
- Manter campo `setor` (texto) para compatibilidade temporaria

## Mudancas na Interface

### 1. Nova pagina `/admin/sectors`
Gerenciamento de setores com:
- Lista de setores cadastrados
- Botao "Novo Setor"
- Formulario para criar/editar setor:
  - Nome do setor
  - Horario de entrada
  - Horario de saida
  - Intervalo (minutos)
  - Tolerancia (minutos)
  - Dias da semana trabalhados (checkboxes)
- Acoes: editar, ativar/desativar

### 2. Atualizar pagina `/admin/employees`
No formulario de colaborador:
- Substituir campo texto "Setor" por dropdown/select
- Listar setores ativos cadastrados
- Ao selecionar setor, funcionario herda horario automaticamente

### 3. Atualizar menu lateral (AdminLayout)
Adicionar item "Setores" no menu com icone Building2

## Logica de Heranca de Horario

Quando o sistema precisar do horario de um funcionario (ex: ao bater ponto):

1. Verificar se funcionario tem `work_schedule` individual
2. Se nao, buscar horario do setor via `sector_id` -> `sector_schedules`
3. Se nao, usar horario padrao (8h-18h, 60min intervalo)

## Arquivos a Criar/Modificar

| Arquivo | Acao |
|---------|------|
| `src/pages/admin/Sectors.tsx` | Criar - pagina de gestao de setores |
| `src/pages/admin/Employees.tsx` | Modificar - dropdown de setor |
| `src/components/admin/AdminLayout.tsx` | Modificar - adicionar menu Setores |
| `src/App.tsx` | Modificar - adicionar rota /admin/sectors |
| `supabase/functions/ponto-validate/index.ts` | Modificar - buscar horario do setor |

## Detalhes Tecnicos

### Migracao SQL
```sql
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

-- RLS policies
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sector_schedules ENABLE ROW LEVEL SECURITY;

-- Policies para Admin/RH
CREATE POLICY "Admin/RH podem ver setores" ON sectors FOR SELECT USING (is_admin_or_rh(auth.uid()));
CREATE POLICY "Admin/RH podem gerenciar setores" ON sectors FOR ALL USING (is_admin_or_rh(auth.uid()));
CREATE POLICY "Admin/RH podem ver horarios setores" ON sector_schedules FOR SELECT USING (is_admin_or_rh(auth.uid()));
CREATE POLICY "Admin/RH podem gerenciar horarios setores" ON sector_schedules FOR ALL USING (is_admin_or_rh(auth.uid()));
```

### Componente Sectors.tsx
- Usar mesma estrutura de Employees.tsx (Table, Dialog, Form)
- Icone: Building2 do lucide-react
- Campos do formulario:
  - Nome do setor (obrigatorio)
  - Horario entrada (time input)
  - Horario saida (time input)
  - Intervalo (number input)
  - Tolerancia (number input)
  - Dias da semana (checkboxes para seg-dom)

### Dropdown de Setor em Employees
```tsx
<Select value={formData.sector_id} onValueChange={(v) => setFormData({...formData, sector_id: v})}>
  <SelectTrigger>
    <SelectValue placeholder="Selecione o setor" />
  </SelectTrigger>
  <SelectContent>
    {sectors.map(s => (
      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

### Atualizacao do ponto-validate
Na funcao `recalculateTimesheet`, modificar a busca de horario:

```typescript
// 1. Tentar horario individual
let schedule = await supabase.from('work_schedules').select(...).eq('employee_id', employeeId);

// 2. Se nao existir, buscar do setor
if (!schedule) {
  const { data: emp } = await supabase.from('employees').select('sector_id').eq('id', employeeId);
  if (emp?.sector_id) {
    schedule = await supabase.from('sector_schedules').select(...).eq('sector_id', emp.sector_id);
  }
}

// 3. Usar padrao se nenhum encontrado
if (!schedule) {
  schedule = { expected_start: '08:00', expected_end: '18:00', break_minutes: 60 };
}
```

## Beneficios
- Configuracao centralizada de horarios por departamento
- Menos trabalho ao cadastrar funcionarios
- Facilidade para alterar horario de todo um setor de uma vez
- Flexibilidade: funcionarios podem ter horario individual se necessario
