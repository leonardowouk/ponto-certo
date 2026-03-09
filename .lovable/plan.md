

# Plano: Foto com Timestamp + Código de Verificação por E-mail na Assinatura

## Análise

A ideia da foto com marcação de data/hora é excelente para reforçar a prova de identidade. Sobre o código por e-mail, é uma boa camada extra, mas precisa considerar:

- **Prós**: Dupla verificação (algo que sabe + algo que possui), padrão MFA
- **Contras**: Depende de o colaborador ter e-mail cadastrado e acessível no momento; adiciona atrito ao fluxo; nem todos os colaboradores podem ter e-mail

**Recomendação**: Implementar a foto obrigatória (forte valor probatório) e o código por e-mail como opcional (caso o colaborador tenha e-mail cadastrado). Se não tiver e-mail, segue só com PIN + foto.

## Mudanças

### 1. Captura de Selfie no Momento da Assinatura

Reutilizar o componente de câmera já existente no projeto (`SelfieCapture`). Ao assinar:
- Abrir a câmera no dialog de assinatura
- Capturar a foto e sobrepor um carimbo com data/hora/nome
- Enviar a foto para o storage (bucket `selfies_ponto` ou novo `selfies_assinatura`)
- Gravar a URL da selfie no `document_signatures` e no `signature_audit_log`

### 2. Código de Verificação por E-mail (OTP)

- Criar Edge Function `send-signature-otp` que gera código de 6 dígitos, salva hash + expiração numa tabela `signature_otp`, e envia por e-mail via Lovable AI
- No fluxo de assinatura: se o colaborador tem e-mail, adicionar etapa de "enviar código" e campo para digitar o OTP
- A Edge Function `sign-document` valida o OTP além do PIN

### 3. Migração de Banco

- Adicionar coluna `selfie_url` em `document_signatures` e `signature_audit_log`
- Criar tabela `signature_otp` (employee_id, code_hash, expires_at, used, signature_id)

### 4. Atualizar UI (PortalDocuments.tsx)

Novo fluxo em etapas no dialog:
1. Visualizar documento + aceitar termo
2. Capturar selfie (câmera com overlay de data/hora)
3. Enviar código por e-mail (se disponível) e validar
4. Digitar PIN e confirmar

### 5. Atualizar Edge Function `sign-document`

- Receber `selfie_url` e `otp_code` opcionais
- Validar OTP se fornecido
- Gravar selfie no audit log

### 6. Atualizar DocumentSignatureModal (admin)

- Mesma lógica: captura de selfie do colaborador presente + OTP opcional

## Arquivos Afetados

- **Migração SQL**: novas colunas + tabela `signature_otp`
- **`supabase/functions/send-signature-otp/index.ts`**: nova Edge Function
- **`supabase/functions/sign-document/index.ts`**: validar OTP + selfie
- **`src/pages/portal/PortalDocuments.tsx`**: fluxo com selfie + OTP
- **`src/components/admin/DocumentSignatureModal.tsx`**: selfie + OTP
- **`src/components/kiosk/SelfieCapture.tsx`**: reutilizar/adaptar para assinatura

