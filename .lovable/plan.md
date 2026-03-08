

# Plano: Painel de Notificações WhatsApp Configurável

## Objetivo
Criar um sistema onde o admin pode ativar/desativar cada tipo de notificação WhatsApp individualmente, com templates editáveis, e integrar os disparos automáticos nos fluxos existentes.

## Mudanças no Banco de Dados

**Nova tabela `notification_settings`** — armazena as preferências de notificação por empresa:

```text
notification_settings
├── id (uuid PK)
├── company_id (uuid FK → companies)
├── notification_type (text) — ex: 'new_document', 'correction_approved', 'correction_rejected', 'punch_reminder', 'monthly_closing', 'certificate_received'
├── is_enabled (boolean, default true)
├── message_template (text) — template com variáveis como {nome}, {documento}, {data}
├── schedule_time (time, nullable) — horário para lembretes agendados (ex: punch_reminder às 09:00)
├── created_at / updated_at
└── UNIQUE(company_id, notification_type)
```

RLS: Admin/RH da empresa podem gerenciar.

## Componente de Configuração (UI)

**Novo componente `NotificationSettings.tsx`** na página de Settings, abaixo do Z-API:
- Lista todos os tipos de notificação com Switch para ativar/desativar cada um
- Campo de template editável com variáveis disponíveis (ex: `{nome}`, `{documento}`)
- Para "Lembrete de Ponto": campo de horário configurável
- Salva tudo na tabela `notification_settings`

```text
┌─────────────────────────────────────────────┐
│ 🔔 Notificações WhatsApp                   │
│ Configure quais notificações enviar         │
├─────────────────────────────────────────────┤
│ ☑ Novo documento disponível          [ON]  │
│   Template: "📄 Olá {nome}! Novo..."       │
│                                             │
│ ☑ Correção de ponto aprovada         [ON]  │
│   Template: "✅ {nome}, sua correção..."    │
│                                             │
│ ☑ Correção de ponto rejeitada        [ON]  │
│   Template: "❌ {nome}, sua correção..."    │
│                                             │
│ ☑ Lembrete de ponto                  [OFF] │
│   Horário: [09:00]                          │
│   Template: "⏰ {nome}, registre..."        │
│                                             │
│ ☑ Fechamento mensal disponível       [ON]  │
│   Template: "📊 {nome}, seu espelho..."     │
│                                             │
│ ☑ Atestado recebido (para RH)        [ON]  │
│   Template: "🏥 Novo atestado de {nome}..." │
│                                             │
│              [Salvar Configurações]         │
└─────────────────────────────────────────────┘
```

## Integração nos Fluxos Existentes

1. **Documentos** (`Documents.tsx`): após upload/distribuição, chamar `send-whatsapp` com `action: 'notify_document'` se notificação habilitada
2. **Correções** (tela admin de revisão): ao aprovar/rejeitar, chamar `send-whatsapp` com `action: 'notify_correction'`
3. **Atestados** (`upload-certificate` edge function): ao receber atestado, notificar RH
4. **Fechamento mensal** (`MonthlyClosing.tsx`): ao fechar mês, notificar colaboradores

## Edge Function Atualizada

Expandir `send-whatsapp` para:
- Aceitar novas actions: `notify_correction`, `notify_certificate`, `notify_closing`
- Consultar `notification_settings` para verificar se a notificação está habilitada antes de enviar
- Usar o template configurado (ou fallback para template padrão)
- Substituir variáveis `{nome}`, `{documento}`, `{data}` no template

## Campo Telefone no Cadastro

Adicionar campo `telefone` no formulário de cadastro/edição de colaboradores em `Employees.tsx`, já que a coluna existe no banco mas o campo não aparece na UI.

## Arquivos Afetados
- `supabase/migrations/` — nova tabela `notification_settings`
- `src/components/admin/NotificationSettings.tsx` — novo componente
- `src/pages/admin/Settings.tsx` — incluir NotificationSettings
- `src/pages/admin/Employees.tsx` — campo telefone
- `supabase/functions/send-whatsapp/index.ts` — novas actions + consulta settings
- `src/pages/admin/Documents.tsx` — disparo após upload
- `src/pages/admin/MonthlyClosing.tsx` — disparo ao fechar

