

# Multi-Empresa: Admin Central Gerencia Tudo

## Resumo

Adicionar suporte a multiplas empresas no sistema, onde um super-admin central pode cadastrar empresas e alternar entre elas. Cada empresa tera seus proprios colaboradores, setores, dispositivos e configuracoes. Admins locais veem apenas dados da sua empresa.

## O que muda para voce

- Uma nova pagina "Empresas" no painel admin para cadastrar e gerenciar empresas
- Um seletor de empresa no topo do painel para alternar entre elas
- Cada empresa tem seus proprios colaboradores, setores, dispositivos e batidas
- Um novo tipo de usuario "super_admin" que pode ver e gerenciar todas as empresas

## Etapas de Implementacao

### 1. Criar tabela `companies` e adicionar role `super_admin`

Nova tabela para armazenar empresas:

```text
companies
---------
id (uuid, PK)
nome (text)
cnpj_hash (text, unique)  -- CNPJ hasheado para privacidade
ativo (boolean, default true)
created_at (timestamptz)
```

Adicionar `company_id` nas tabelas existentes:
- `employees` -- vincula colaborador a empresa
- `sectors` -- vincula setor a empresa
- `time_devices` -- vincula dispositivo a empresa
- `time_punches` -- herda da batida
- `timesheets_daily` -- herda do colaborador
- `hour_bank_ledger` -- herda do colaborador

Adicionar nova role `super_admin` ao enum `app_role`.

Criar tabela `user_company_access` para vincular admins locais a empresas.

### 2. Atualizar politicas RLS

- Admins locais so veem dados da(s) empresa(s) que tem acesso
- Super-admins veem todas as empresas
- Criar funcao `get_user_company_ids()` (security definer) que retorna IDs das empresas que o usuario pode acessar

### 3. Criar pagina de Empresas no Admin

- Listar, cadastrar e editar empresas
- Apenas super_admin pode acessar
- Campos: nome, CNPJ, status (ativo/inativo)

### 4. Adicionar seletor de empresa no AdminLayout

- Dropdown no header para alternar entre empresas
- Armazenar empresa selecionada em estado (React Context)
- Todas as queries filtram pela empresa selecionada

### 5. Atualizar todas as paginas admin

- Colaboradores, Setores, Dashboard, Timesheet, Banco de Horas e Configuracoes filtram por `company_id`
- Formularios de cadastro enviam `company_id` automaticamente

### 6. Atualizar Edge Functions

- `ponto-validate`: incluir `company_id` ao registrar batidas
- Dispositivos vinculados a empresa especifica

### 7. Migrar dados existentes

- Criar empresa padrao "Cookie do Boleta" (ou nome que preferir)
- Vincular todos os registros existentes a essa empresa
- Tornar o usuario Thiago um `super_admin`

---

## Detalhes Tecnicos

### Nova role no enum

```sql
ALTER TYPE public.app_role ADD VALUE 'super_admin';
```

### Tabela companies

```sql
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj_hash text UNIQUE,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
```

### Coluna company_id nas tabelas existentes

```sql
ALTER TABLE employees ADD COLUMN company_id uuid REFERENCES companies(id);
ALTER TABLE sectors ADD COLUMN company_id uuid REFERENCES companies(id);
ALTER TABLE time_devices ADD COLUMN company_id uuid REFERENCES companies(id);
```

### Tabela de acesso por empresa

```sql
CREATE TABLE public.user_company_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE(user_id, company_id)
);
```

### React Context para empresa ativa

Um `CompanyContext` sera criado para compartilhar a empresa selecionada entre todas as paginas admin, evitando passar props manualmente.

### Arquivos que serao modificados

- `src/components/admin/AdminLayout.tsx` -- seletor de empresa + context provider
- `src/pages/admin/Employees.tsx` -- filtro por company_id
- `src/pages/admin/Sectors.tsx` -- filtro por company_id
- `src/pages/admin/Dashboard.tsx` -- filtro por company_id
- `src/pages/admin/Timesheet.tsx` -- filtro por company_id
- `src/pages/admin/HourBank.tsx` -- filtro por company_id
- `src/pages/admin/Settings.tsx` -- configuracoes por empresa
- `supabase/functions/ponto-validate/index.ts` -- company_id nas batidas
- **Novo:** `src/pages/admin/Companies.tsx`
- **Novo:** `src/contexts/CompanyContext.tsx`
- **Novo:** `src/App.tsx` -- rota /admin/companies

