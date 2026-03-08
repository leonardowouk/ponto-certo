

# Módulo de Documentos e Assinatura Digital

## Visão Geral

Criar um módulo completo de gestão documental onde o RH pode enviar documentos (holerites, espelhos de ponto, contratos, etc.) para colaboradores, e os colaboradores assinam digitalmente pelo sistema. Tudo fica registrado com timestamp, IP e identificação.

## Arquitetura

```text
┌─────────────────────────────────────────────┐
│              Admin (RH/Gestor)              │
│  Upload docs → Vincula a colaboradores      │
│  Acompanha status de assinatura             │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │   employee_documents │  (metadados)
        │   document_signatures│  (registro)
        │   Storage: documentos│  (PDFs)
        └──────────┬──────────┘
                   │
┌──────────────────▼──────────────────────────┐
│           Colaborador (via Kiosk/Portal)     │
│  Visualiza docs pendentes → Confirma PIN    │
│  → Assinatura registrada com timestamp      │
└─────────────────────────────────────────────┘
```

## Database

### Novo enum `document_type`
Valores: `holerite`, `espelho_ponto`, `contrato`, `advertencia`, `comunicado`, `outro`

### Novo enum `signature_status`
Valores: `pendente`, `assinado`, `recusado`

### Tabela `employee_documents`
| Coluna | Tipo | Detalhes |
|--------|------|---------|
| id | UUID PK | |
| company_id | UUID NOT NULL | |
| employee_id | UUID NOT NULL | |
| document_type | document_type | |
| title | TEXT NOT NULL | Ex: "Holerite Fev/2026" |
| description | TEXT | |
| file_url | TEXT NOT NULL | Path no storage |
| ref_month | DATE | Mês de referência (para holerites/espelhos) |
| requires_signature | BOOLEAN DEFAULT true | |
| created_by | UUID | Quem enviou |
| created_at | TIMESTAMPTZ DEFAULT now() | |

RLS: Admin/RH com filtro por company via `get_user_company_ids()`

### Tabela `document_signatures`
| Coluna | Tipo | Detalhes |
|--------|------|---------|
| id | UUID PK | |
| document_id | UUID NOT NULL FK → employee_documents | |
| employee_id | UUID NOT NULL | |
| status | signature_status DEFAULT 'pendente' | |
| signed_at | TIMESTAMPTZ | |
| signed_via | TEXT | 'kiosk' ou 'portal' |
| ip_address | TEXT | |
| pin_verified | BOOLEAN DEFAULT false | Confirmou identidade via PIN |
| notes | TEXT | Observações ou motivo de recusa |

RLS: Admin/RH vê tudo da empresa; colaborador vê apenas os seus (futuro portal)

### Storage bucket `documentos`
Bucket privado para armazenar PDFs e arquivos.

## Frontend

### 1. Nova página `src/pages/admin/Documents.tsx`
- Rota: `/admin/documents`
- Menu item: "Documentos" com ícone `FileText`
- Duas abas: **Enviar Documentos** e **Acompanhar Assinaturas**

**Aba "Enviar Documentos":**
- Formulário: selecionar tipo de documento, título, mês de referência, upload do arquivo
- Seleção de destinatários: individual, por setor, ou todos da empresa
- Upload em lote (múltiplos colaboradores de uma vez)
- Tabela de documentos enviados com filtros por tipo/mês/status

**Aba "Acompanhar Assinaturas":**
- Tabela com: Documento, Colaborador, Status (badge colorido), Data assinatura
- Filtros por mês, tipo, status (pendente/assinado)
- Indicadores: X de Y assinados, % de conclusão
- Botão para reenviar notificação (futuro)

### 2. Componente `src/components/admin/DocumentUploadForm.tsx`
- Form com campos: tipo, título, descrição, mês referência, arquivo (drag & drop)
- Seletor de colaboradores com checkboxes (individual/setor/todos)
- Upload para bucket `documentos` com path: `{company_id}/{employee_id}/{type}_{ref_month}.pdf`

### 3. Componente `src/components/admin/SignatureTracker.tsx`
- Tabela de acompanhamento com progress bars por documento
- Expandir linha para ver detalhes de cada assinatura

### 4. Fluxo de assinatura no Kiosk (ou modal admin)
- Componente `src/components/admin/DocumentSignatureModal.tsx`
- Exibe o documento (PDF viewer ou link)
- Colaborador confirma identidade via PIN
- Ao confirmar, registra assinatura com timestamp e IP
- Também acessível pelo admin para coletar assinatura presencial

### 5. Integração com Fechamento Mensal
- Ao fechar o mês, gerar automaticamente o espelho de ponto como documento
- Criar registro em `employee_documents` com `document_type = 'espelho_ponto'`
- Já fica pendente de assinatura do colaborador

## Arquivos a criar/editar

1. **Migração SQL**: enums, tabelas `employee_documents` e `document_signatures`, bucket `documentos`, RLS
2. **`src/pages/admin/Documents.tsx`**: página principal com abas
3. **`src/components/admin/DocumentUploadForm.tsx`**: formulário de upload
4. **`src/components/admin/SignatureTracker.tsx`**: acompanhamento de assinaturas
5. **`src/components/admin/DocumentSignatureModal.tsx`**: modal de assinatura com PIN
6. **`src/App.tsx`**: rota `/admin/documents`
7. **`src/components/admin/AdminLayout.tsx`**: menu item "Documentos"
8. **`src/pages/admin/MonthlyClosing.tsx`**: integração para gerar espelho como documento ao fechar

