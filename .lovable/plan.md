
# Plano de Melhorias - Modo Quiosque

## Resumo da Situacao Atual

O modo quiosque ja possui uma estrutura funcional com:
- Fluxo de 5 etapas: CPF -> PIN -> Confirmacao -> Selfie -> Sucesso
- Validacao segura via edge function
- Sistema de bloqueio apos 5 tentativas erradas (2 min)
- Cooldown de 3 minutos entre batidas
- Auto-reset apos 5 segundos na tela de sucesso

## Problemas Identificados e Melhorias Propostas

### 1. Tratamento de Erros e Feedback ao Usuario

**Problema:** Erros sao mostrados via `alert()` nativo, que nao combina com a UI e pode ser confuso
**Solucao:** Substituir todos os `alert()` por toasts elegantes ou mensagens inline

**Problema:** Falta loading visual durante validacao do PIN
**Solucao:** Adicionar estado de loading no botao "Confirmar"

---

### 2. Estabilidade da Camera (SelfieCapture)

**Problema:** A camera pode falhar silenciosamente em alguns dispositivos
**Solucao:** 
- Adicionar retry automatico quando a camera falha
- Mostrar instrucoes mais claras sobre permissoes
- Adicionar botao para tentar novamente ao acessar camera
- Tratar especificamente erros como "NotAllowedError" e "NotFoundError"

**Problema:** Memory leak potencial - stream nao e parado corretamente em todos os casos
**Solucao:** Garantir cleanup do stream em todos os cenarios (navegacao, erro, reset)

---

### 3. Timeout de Inatividade

**Problema:** Se o usuario abandonar o tablet no meio do fluxo, ele fica preso
**Solucao:** Adicionar timeout de inatividade (ex: 60 segundos) que volta para tela inicial

---

### 4. Estado Offline e Reconexao

**Problema:** Nao ha tratamento para quando o tablet perde conexao
**Solucao:** 
- Detectar estado offline
- Mostrar indicador visual de status de conexao
- Bloquear acoes quando offline
- Tentar reconectar automaticamente

---

### 5. Responsividade para Tablets

**Problema:** O layout pode nao funcionar bem em tablets de diferentes tamanhos
**Solucao:** 
- Ajustar tamanho dos botoes do teclado para telas maiores
- Garantir que a area de captura da camera use todo o espaco disponivel
- Testar em diferentes resolucoes

---

### 6. Acessibilidade e UX

**Problema:** Faltam algumas melhorias de UX
**Solucao:**
- Adicionar feedback haptico (vibracao) nos botoes
- Som de confirmacao ao registrar ponto
- Animacao de transicao entre telas
- Indicador de progresso (etapas 1/4, 2/4, etc.)

---

### 7. Seguranca do Device Secret

**Problema:** O device_secret esta hardcoded no codigo
**Solucao:** 
- Criar tela de configuracao inicial do tablet
- Armazenar device_secret no localStorage
- Permitir reset via codigo de administrador

---

### 8. Prevencao de Toques Acidentais

**Problema:** Toques acidentais podem enviar o formulario
**Solucao:**
- Adicionar confirmacao antes de acoes criticas
- Debounce nos botoes principais
- Desabilitar double-tap zoom

---

## Implementacao Tecnica

### Novos Componentes

```text
src/components/kiosk/
├── ConnectionStatus.tsx    (indicador de conexao)
├── ProgressIndicator.tsx   (passos 1-4)
├── InactivityTimeout.tsx   (hook para timeout)
├── KioskErrorBoundary.tsx  (tratamento de erros)
└── DeviceSetup.tsx         (configuracao inicial)
```

### Hooks Novos

```text
src/hooks/
├── useInactivityTimeout.ts  (reset apos inatividade)
├── useOnlineStatus.ts       (detectar offline)
└── useHapticFeedback.ts     (vibracao)
```

### Alteracoes na Edge Function

- Adicionar log mais detalhado para debug
- Retornar mensagens de erro mais especificas

---

## Ordem de Implementacao

1. **Prioridade Alta (Estabilidade)**
   - Timeout de inatividade com reset automatico
   - Melhorar tratamento da camera (retry, erros especificos)
   - Substituir alerts por toasts/mensagens inline
   - Adicionar loading durante validacao do PIN

2. **Prioridade Media (UX)**
   - Indicador de progresso (etapas)
   - Detector de conexao offline
   - Feedback visual melhorado

3. **Prioridade Baixa (Extras)**
   - Configuracao do device_secret
   - Feedback haptico
   - Sons de confirmacao

---

## Notas Tecnicas

- O projeto usa React 18 com hooks
- Tailwind CSS para estilos
- Animacoes ja configuradas: `animate-scale-in`, `animate-fade-in-up`, `animate-pulse-success`
- Edge function `ponto-validate` ja tem CORS configurado corretamente
- Banco de dados possui colaboradores ativos e dispositivo configurado

