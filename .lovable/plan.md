

# Plano: Certificação Robusta de Assinatura Digital

## Problema Atual

A assinatura atual tem fragilidades jurídicas significativas:
1. **Portal do colaborador** assina com um simples clique, sem verificação de identidade (sem PIN)
2. **IP do assinante** não é capturado de fato (campo existe mas nunca é preenchido)
3. **Não há hash do documento** — impossível provar que o documento não foi alterado após assinatura
4. **Não há user-agent** capturado (navegador, dispositivo)
5. **Não há termo de aceite** registrado — o texto que o colaborador concordou não é gravado
6. **Não há log de auditoria** imutável — se alguém alterar o registro de assinatura, não há rastro

## Solução Proposta

### 1. Nova tabela `signature_audit_log` (imutável)

Registro de auditoria que não pode ser alterado nem deletado. Cada assinatura gera um registro com todas as evidências:

- `signature_id` — referência à assinatura
- `employee_id`, `document_id`
- `action` — 'signed', 'refused', 'viewed'
- `ip_address` — IP real do assinante
- `user_agent` — navegador/dispositivo
- `document_hash` — SHA-256 do arquivo no momento da assinatura
- `acceptance_text` — texto exato do termo que o colaborador concordou
- `pin_verified` — se PIN foi verificado
- `signed_via` — 'portal', 'admin', 'kiosk'
- `auth_user_id` — usuário autenticado que executou
- `created_at` — timestamp imutável

RLS: somente INSERT (para registrar) e SELECT (para consultar). Sem UPDATE/DELETE.

### 2. Edge Function `sign-document` (server-side)

Mover toda a lógica de assinatura para uma Edge Function segura:
- Recebe: `signature_id`, `pin`, `acceptance_text`
- Captura IP real do request (`req.headers.get('x-forwarded-for')`)
- Captura user-agent (`req.headers.get('user-agent')`)
- Gera hash SHA-256 do arquivo no storage
- Verifica PIN do colaborador
- Atualiza `document_signatures` com todos os campos
- Insere registro em `signature_audit_log`
- Retorna sucesso ou erro

Isso garante que IP, hash e timestamp são gerados no servidor (não manipuláveis pelo cliente).

### 3. Melhorar colunas de `document_signatures`

Adicionar ao registro existente:
- `user_agent` TEXT
- `document_hash` TEXT — SHA-256 do arquivo
- `acceptance_text` TEXT — texto do termo aceito

### 4. Atualizar Portal do Colaborador

No `PortalDocuments.tsx`, substituir o AlertDialog simples por um fluxo mais robusto:
- Exibir o documento para leitura
- Mostrar termo de aceite completo: *"Declaro que li e estou de acordo com o conteúdo do documento {título}. Esta assinatura digital tem validade jurídica conforme Art. 10, §2º da MP 2.200-2/2001."*
- Checkbox obrigatório: "Li e concordo"
- Campo de PIN obrigatório
- Chamar a Edge Function `sign-document`

### 5. Atualizar Assinatura via Admin

No `DocumentSignatureModal.tsx`:
- Também chamar a Edge Function em vez de update direto
- Registrar que foi assinado "via admin" com o contexto completo

### 6. Tela de Comprovante de Assinatura

Componente para exibir/imprimir comprovante com:
- Nome do colaborador, CPF (parcial), documento assinado
- Data/hora da assinatura, IP, user-agent
- Hash SHA-256 do documento
- Texto do aceite
- Verificação de PIN: Sim/Não

## Arquivos Afetados

- **Migração SQL**: nova tabela `signature_audit_log` + novas colunas em `document_signatures`
- **`supabase/functions/sign-document/index.ts`**: nova Edge Function
- **`src/pages/portal/PortalDocuments.tsx`**: fluxo de assinatura robusto com PIN + aceite
- **`src/components/admin/DocumentSignatureModal.tsx`**: usar Edge Function
- **`src/components/admin/SignatureTracker.tsx`**: exibir novos campos (IP, hash, aceite)

## Valor Jurídico

Com essas mudanças, cada assinatura terá:
- Identificação do signatário (PIN + auth user)
- Prova de integridade do documento (hash SHA-256)
- Registro de intenção (termo de aceite gravado)
- Evidências técnicas (IP, user-agent, timestamp server-side)
- Trilha de auditoria imutável
- Conformidade com MP 2.200-2/2001 Art. 10, §2º (assinatura eletrônica com acordo entre as partes)

