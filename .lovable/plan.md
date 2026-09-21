# Plataforma de RH — evolução do sistema de ponto

## O que já existe (e será reaproveitado, não recriado)

- Colaboradores (`employees`), empresas, setores, perfis de acesso (admin, RH, gestor, colaborador, super admin) com isolamento por empresa.
- Portal do colaborador já com login próprio, documentos, pontos, correções e atestados.
- Documentos (`employee_documents`) + assinatura com PIN, foto, OTP, hash do arquivo e log de auditoria (`signature_audit_log`).
- Envio de holerites em lote com separação por IA (já existe) e notificações por WhatsApp.
- Arquivos guardados em áreas privadas, acessados só por link temporário.

Ou seja: boa parte das fases 1, 3, 5 e 6 do pedido já está de pé. O plano abaixo preenche as lacunas e organiza tudo em um produto único, sem tocar nas regras de ponto.

## O que falta e será construído

### Fase 1 — Cadastro completo do colaborador
- Novos campos no cadastro: data de nascimento, matrícula, tipo de contrato, situação, status de admissão, status do acesso.
- Cargos e departamentos viram listas gerenciáveis (hoje cargo/setor são texto livre; o texto atual é preservado).
- Página de detalhes do colaborador com abas: Dados pessoais, Dados profissionais, Documentos, Admissão, Holerites, Ponto, Histórico.
- Busca por nome, CPF, matrícula, e-mail e filtros por status, departamento, cargo e data de admissão.

### Fase 2 — Admissão digital
- Novo menu "Admissões": abrir processo, etapa de cadastro inicial, etapa de envio dos documentos da contabilidade (vários arquivos de uma vez).
- Cada documento com tipo, descrição, se é obrigatório, se exige assinatura e ordem.
- Painel de acompanhamento mostrando exatamente o que falta para concluir.
- Status: pré-admissão, em admissão, aguardando assinatura, concluída, ativo, inativo, desligado.

### Fase 3 — Assinatura com provedor externo
- Camada de assinatura desacoplada, preparada para plugar um provedor de assinatura eletrônica (ex.: Clicksign, D4Sign, ZapSign) sem reescrever o sistema.
- Guarda separada de: documento original, documento assinado e evidências (signatário, CPF, e-mail, data/hora, IP, hash, identificador da transação, relatório do provedor).
- Endpoint seguro para receber as confirmações do provedor, com verificação de autenticidade e proteção contra eventos repetidos.
- Enquanto nenhum provedor estiver contratado, o método atual (PIN + foto + código) continua funcionando e fica identificado como assinatura interna — sem ser apresentado como assinatura qualificada.
- Área de configuração: provedor, credenciais (guardadas fora do aplicativo), ambiente de teste/produção, endereço de retorno.

### Fase 4 — Acesso automático
- Ao concluir a admissão, o acesso do colaborador é criado e vinculado automaticamente, com convite por link de ativação (senha nunca vai por e-mail).
- Se já existir acesso, apenas vincula/ativa. Sem contas duplicadas. Mesma conta serve para ponto e documentos.

### Fase 5 — Holerites
- Módulo próprio com competência (mês/ano), envio em lote, reconhecimento do colaborador pelo CPF ou matrícula no nome do arquivo e tela de conferência antes de processar.
- Portal: "Meus Holerites" agrupado por competência, com visualizar, baixar e aceite quando exigido.

### Fase 6 — Notificações, lembretes, auditoria e painéis
- Central de notificações no sistema, alimentada pelos eventos (documento enviado, visualizado, assinado, recusado, expirado, holerite novo, acesso criado).
- Lembretes automáticos configuráveis (prazo, intervalo, máximo de envios), sem repetir envio.
- Tela de auditoria (quem, perfil, ação, data/hora, IP, documento, colaborador, resultado), só para quem tem permissão.
- Painel do RH com indicadores e uma lista de pendências clicável; painel do colaborador com pendências em destaque.

### Fase 7 — Porta de entrada para a contabilidade
- Camada de recepção de documentos preparada para receber envios automáticos da contabilidade no futuro, com o envio manual continuando igual.

## Pontos técnicos

- Banco: novas tabelas `departments`, `positions`, `document_categories`, `admission_processes`, `admission_documents`, `signature_requests`, `signature_evidences`, `payslips`, `notifications`, `audit_logs`, `access_invites`. Colunas novas em `employees` são adicionadas de forma aditiva (nunca removendo nem renomeando as existentes). `employee_documents`, `document_signatures` e `signature_audit_log` são estendidos, não substituídos.
- Toda tabela nova com isolamento por empresa via `get_user_company_ids()` e permissões por perfil, no mesmo padrão já usado.
- Arquivos: buckets privados novos para admissão, holerites e documentos assinados; acesso só por link temporário gerado no servidor; validação de tipo e tamanho no envio.
- Validação de permissão sempre no servidor, nunca só na tela.
- Menus: admin/RH ganha Colaboradores, Admissões, Holerites, Assinaturas, Notificações, Auditoria; o portal ganha Meus Holerites e Pendências. Nada do ponto sai do lugar.
- Visual: mesma identidade atual, com o mesmo padrão de cores por status (verde concluído, amarelo pendente, azul em andamento, vermelho erro, cinza arquivado) e telas que funcionam bem no celular.

## Sequência de entrega

Entrego fase por fase, testando permissões, dados e fluxo ao fim de cada uma antes de seguir. Começo pela Fase 1.

## Decisões que preciso de você

- Qual provedor de assinatura a empresa pretende contratar (Clicksign, D4Sign, ZapSign, outro)? Sem isso, entrego a camada pronta e o método interno atual segue ativo.
- Hoje as notificações vão por WhatsApp. Quer também por e-mail? Nesse caso será preciso um serviço de envio (ex.: Resend) com um domínio seu.
