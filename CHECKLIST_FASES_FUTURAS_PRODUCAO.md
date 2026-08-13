# OctaClin - Checklist vivo de fases futuras ate producao

Atualizado em 2026-08-13 com o aceite de schema em integracao da Fase 237.

Este arquivo deve guiar Codex, Claude Code ou qualquer outro agente de IA. Ele deve ser atualizado a cada fase concluida.

## Regras obrigatorias de manutencao

- Ao iniciar uma nova fase, manter o numero da fase e trabalhar em ordem, salvo decisao explicita do usuario.
- Ao concluir uma fase, marcar o item como concluido, registrar commit, data e principais validacoes.
- Ao criar uma fase nova no meio do caminho, inserir aqui antes ou junto do commit da implementacao.
- Ao terminar uma fase, atualizar tambem `RESUMO_FASES_CONCLUIDAS.md` quando a fase virar capacidade consolidada.
- Nao remover itens pendentes sem registrar justificativa.
- Se outro agente assumir, ele deve ler este arquivo, `RESUMO_FASES_CONCLUIDAS.md`, os arquivos `fase-*.md` recentes e o `git log`.

## Definicao de pronto para producao

O OctaClin pode comecar a receber clientes reais de consultoria quando todos os blocos criticos abaixo estiverem concluidos:

- Autenticacao, autorizacao e permissoes finas testadas por papel.
- Portal do cliente capaz de gerenciar conta, usuarios, convites e dados basicos.
- Portal do profissional com rotinas essenciais validadas.
- Portal do paciente com onboarding, formularios, historico e LGPD funcionando.
- Agenda, email e WhatsApp com fluxos confiaveis, observaveis e reprocessaveis.
- Billing/assinatura e limites de plano definidos.
- Monitoramento, backups, logs, alertas e runbooks operacionais ativos.
- Politicas LGPD, seguranca e termos de uso revisados.
- QA E2E de jornadas reais em staging.
- Deploy de producao com dominio, SSL, variaveis e banco separados de staging.

## Proximas fases propostas

### Bloco 0 - Governanca tecnica

- [x] Fase 94 - Preflight de producao.
  - Consolidar checklist de prontidao por area critica.
  - Criar validacao local padronizada para documentacao, backend e web.
  - Registrar gates de inicio e conclusao de fases.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-22.
  - Validacoes: `powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly`.
  - Saida entregue: `PREFLIGHT_PRODUCAO.md`, `validar-preflight.ps1`, `pnpm validate` e roadmap renumerado.

### Bloco A - Portal do cliente e administracao SaaS

- [x] Fase 95 - Perfis e permissoes finas para usuarios administrativos.
  - Separar capacidades de `Client`, `Professional` e `Collaborator`.
  - Criar matriz operacional clara para cliente, profissional, recepcao/assistente e admin interno.
  - Validar rotas backend/BFF/frontend por permissao, nao apenas por papel.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-22.
  - Validacoes: `pnpm --dir octaclin-backend exec jest permissoes.spec.ts guarda-permissoes.spec.ts servico-usuarios-cliente.spec.ts --runInBand`, `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-web test:authz`, `pnpm --dir octaclin-web typecheck`.
  - Saida entregue: testes de permissao, guard backend, BFF protegido, middleware por permissao e UI escondendo acoes indevidas.

- [x] Fase 96 - Configuracoes da conta do cliente.
  - Permitir editar nome da clinica, dados basicos, timezone, idioma e canais padrao.
  - Preparar configuracoes de marca simples: nome exibido, email remetente e identidade visual basica.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-22.
  - Validacoes: `pnpm --dir octaclin-backend exec jest servico-portal-cliente.spec.ts --runInBand`, `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-web typecheck`, `pnpm --dir octaclin-web test:authz`, `pnpm --dir octaclin-web exec playwright test tests/visual/portal-cliente.spec.mjs --reporter=list`.
  - Saida entregue: tela `Configuracoes`, endpoints backend/BFF seguros e persistencia em `tenant_configuracoes`.

- [x] Fase 97 - Perfil da empresa/consultoria e dados fiscais.
  - Adicionar dados de pessoa juridica/fisica, responsavel, endereco e contatos.
  - Preparar base para notas/recibos futuros, mesmo sem gateway fiscal imediato.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-22.
  - Validacoes: `pnpm --dir octaclin-backend exec jest servico-portal-cliente.spec.ts controlador-portal-cliente.spec.ts --runInBand`, `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-web typecheck`, `pnpm --dir octaclin-web test:authz`, `pnpm --dir octaclin-web exec playwright test tests/visual/portal-cliente.spec.mjs --reporter=list`.
  - Saida entregue: tela `Perfil fiscal`, endpoints backend/BFF seguros, persistencia por tenant e auditoria sem replicar documento em metadados.

- [x] Fase 98 - Convite, reenvio e revogacao com auditoria operacional completa.
  - Evoluir payload atual para tela de historico completo.
  - Exibir quem convidou, quem reenviou, quem revogou e quando.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-22.
  - Validacoes: `pnpm --dir octaclin-backend exec jest servico-usuarios-cliente.spec.ts controlador-portal-cliente.spec.ts --runInBand`, `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-web typecheck`, `pnpm --dir octaclin-web test:authz`, `pnpm --dir octaclin-web build`, `pnpm --dir octaclin-web exec playwright test tests/visual/portal-cliente.spec.mjs --reporter=list`.
  - Saida entregue: historico completo de convites por usuario, auditoria das acoes e exportacao CSV simples.

### Bloco B - Assinaturas, planos e limites

- [x] Fase 99 - Modelo de planos e limites SaaS.
  - Definir planos: gratuito/teste, profissional, clinica, enterprise.
  - Limites: usuarios, pacientes, envios WhatsApp/email, formularios, armazenamento.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-22.
  - Validacoes: `pnpm --dir octaclin-backend exec jest servico-portal-cliente.spec.ts --runInBand`, `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-web typecheck`, `pnpm --dir octaclin-web test:authz`, `pnpm --dir octaclin-web exec playwright test tests/visual/portal-cliente.spec.mjs --reporter=list`, `pnpm --dir octaclin-web build`.
  - Saida entregue: configuracao de plano por tenant, catalogo de planos, calculo de uso real, alertas, checagem backend de limite e resumo visual no portal do cliente.

- [x] Fase 100 - Tela de assinatura e uso no portal do cliente.
  - Melhorar a tela de assinatura com CTA de upgrade/downgrade e estados comerciais.
  - Preparar administracao manual de assinatura sem gateway definitivo.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-22.
  - Validacoes: `pnpm --dir octaclin-backend exec jest servico-portal-cliente.spec.ts controlador-portal-cliente.spec.ts --runInBand`, `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-web typecheck`, `pnpm --dir octaclin-web test:authz`, `pnpm --dir octaclin-web exec playwright test tests/visual/portal-cliente.spec.mjs --reporter=list`, `pnpm --dir octaclin-web build`.
  - Saida entregue: plano recomendado, CTAs de upgrade/revisao, endpoint backend/BFF, persistencia manual em `tenant_configuracoes` e auditoria.

- [x] Fase 101 - Integracao de pagamento sem custo inicial ou gateway definitivo.
  - Escolher estrategia: Stripe, Mercado Pago, Asaas ou controle manual inicial.
  - Para MVP, permitir assinatura manual administrativa se gateway atrasar.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-22.
  - Validacoes: `pnpm --dir octaclin-backend exec jest servico-operacoes.spec.ts servico-portal-cliente.spec.ts controlador-portal-cliente.spec.ts --runInBand`, `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-web typecheck`, `pnpm --dir octaclin-web test:authz`, `pnpm --dir octaclin-web build`, `pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "operacoes (LGPD|assinatura)" --project=desktop-chromium --project=mobile-chromium --reporter=list`, `powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly`.
  - Saida entregue: controle manual administrativo de assinatura via painel operacional, endpoints backend/BFF e encerramento da solicitacao comercial.

- [x] Fase 102 - Bloqueios suaves por inadimplencia/limite.
  - Alertas antes de bloquear.
  - Bloqueio de novas acoes sem impedir acesso a dados essenciais.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-22.
  - Validacoes: `pnpm --dir octaclin-backend exec jest servico-portal-cliente.spec.ts servico-usuarios-cliente.spec.ts servico-pacientes.spec.ts --runInBand`, `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-web typecheck`, `pnpm --dir octaclin-web test:authz`, `pnpm --dir octaclin-web build`, `pnpm --dir octaclin-web exec playwright test tests/visual/portal-cliente.spec.mjs --project=desktop-chromium --project=mobile-chromium --reporter=list`.
  - Saida entregue: bloqueios suaves para criacao de usuarios administrativos e pacientes, assinatura suspensa/cancelada bloqueando novas acoes e aviso no portal do cliente.

### Bloco C - Jornada do profissional e rotina clinica

- [x] Fase 103 - Dashboard inicial do profissional.
  - Resumo de agenda, pacientes recentes, formularios pendentes e mensagens.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-22.
  - Validacoes: `pnpm --dir octaclin-backend exec jest permissoes.spec.ts --runInBand`, `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-web test:authz`, `pnpm --dir octaclin-web typecheck`, `pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "dashboard profissional" --project=desktop-chromium --project=mobile-chromium --reporter=list`, `pnpm --dir octaclin-web build`, `pnpm --dir octaclin-backend build`.
  - Saida entregue: primeira tela util para atendimento diario, com indicadores e listas de agenda, pacientes, formularios e mensagens.

- [x] Fase 104 - Prontuario/linha do tempo do paciente para profissional.
  - Consolidar dados do paciente, formularios, respostas, mensagens e agenda.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-22.
  - Validacoes: `pnpm --dir octaclin-backend exec jest servico-pacientes.spec.ts --runInBand`, `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-web typecheck`, `pnpm --dir octaclin-web test:authz`, `pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "prontuario do paciente" --project=desktop-chromium --project=mobile-chromium --reporter=list`, `pnpm --dir octaclin-web build`, `pnpm --dir octaclin-backend build`.
  - Saida entregue: visao longitudinal para consultoria com dados cadastrais, resumo e linha do tempo de agenda, formularios, respostas e mensagens.

- [x] Fase 105 - Evolucoes/anotacoes clinicas.
  - Criar notas privadas do profissional com historico e auditoria.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-22.
  - Validacoes: `pnpm --dir octaclin-backend exec jest servico-pacientes.spec.ts --runInBand`, `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-web typecheck`, `pnpm --dir octaclin-web test:authz`, `pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "permite registrar evolucao clinica privada|exibe linha do tempo clinica consolidada" --project=desktop-chromium --project=mobile-chromium --reporter=list`, `pnpm --dir octaclin-web build`, `pnpm --dir octaclin-backend build`, `powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly`.
  - Saida entregue: registro privado de evolucao clinica no prontuario, conteudo criptografado, auditoria e linha do tempo atualizada.

- [x] Fase 106 - Planos de acompanhamento e tarefas do paciente.
  - Metas, tarefas, materiais e check-ins.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-22.
  - Validacoes: `pnpm --dir octaclin-backend exec jest servico-pacientes.spec.ts --runInBand`, `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-web typecheck`, `pnpm --dir octaclin-web test:authz`, `pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "permite prescrever tarefa de acompanhamento|permite registrar evolucao clinica privada|exibe linha do tempo clinica consolidada" --project=desktop-chromium --project=mobile-chromium --reporter=list`, `pnpm --dir octaclin-backend build`, `pnpm --dir octaclin-web build`.
  - Saida entregue: profissional consegue prescrever tarefas/metas/check-ins no prontuario, com resumo de pendencias, auditoria, criptografia da descricao e timeline atualizada.

- [x] Fase 107 - Biblioteca de materiais e envio ao paciente.
  - PDFs, links, orientacoes e materiais por categoria.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-22.
  - Validacoes: `pnpm --dir octaclin-backend exec jest servico-materiais.spec.ts servico-pacientes.spec.ts permissoes.spec.ts --runInBand`, `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-web typecheck`, `pnpm --dir octaclin-web test:authz`, `pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "permite criar material e enviar ao paciente|permite prescrever tarefa de acompanhamento|permite registrar evolucao clinica privada|exibe linha do tempo clinica consolidada" --project=desktop-chromium --project=mobile-chromium --reporter=list`.
  - Saida entregue: biblioteca tenant-aware de materiais reutilizaveis, envio ao paciente pelo prontuario, observacao criptografada, auditoria e base para visibilidade futura no portal do paciente.

### Bloco D - Agenda, comunicacoes e automacoes

- [x] Fase 108 - Agenda de producao.
  - Conflitos, remarcacao, cancelamento, recorrencia e disponibilidade.
  - Sincronizacao bidirecional minima com Google Calendar.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-22.
  - Validacoes: `pnpm --dir octaclin-backend test --runInBand servico-agenda.spec.ts servico-google-calendar.spec.ts`, `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-web typecheck`, `pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "permite remarcar e cancelar consulta agendada|agrega rotina diaria do profissional" --project=desktop-chromium --project=mobile-chromium --reporter=list`.
  - Saida entregue: conflitos locais por profissional, remarcacao, cancelamento, auditoria, historico no payload e sincronizacao OctaClin -> Google Calendar para criar/atualizar/cancelar eventos.
  - Observacao: recorrencia avancada e importacao inbound por `syncToken` seguem como aprofundamento futuro antes do go-live amplo.

- [x] Fase 109 - Templates aprovados e mapeamento Meta WhatsApp.
  - Mapear templates aprovados manualmente na Meta.
  - Criar configuracao no OctaClin para usar templates corretos por evento.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-22.
  - Validacoes: `pnpm --dir octaclin-backend test --runInBand servico-agenda.spec.ts servico-google-calendar.spec.ts`, `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-web typecheck`, `powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly`.
  - Saida entregue: cadastro de templates WhatsApp com evento, idioma e parametros, selecao automatica do template `agenda.consulta.agendada` e montagem de `components` para Meta.

- [x] Fase 110 - Automacoes de lembrete e confirmacao de consulta.
  - Lembretes por email/WhatsApp.
  - Confirmacao, cancelamento e reagendamento.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-22.
  - Validacoes: `pnpm --dir octaclin-backend test --runInBand servico-lembretes-agenda.spec.ts processador-lembretes-agenda.spec.ts servico-webhook-whatsapp.spec.ts servico-agenda.spec.ts`, `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-web typecheck`, `powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly`.
  - Saida entregue: lembrete automatico 24h por email/WhatsApp, cron por tenant ativo, logs em `notificacoes`/`payload.automacoes`, reprocessamento pelo outbox existente, confirmacao simples via resposta WhatsApp e status visivel na agenda.
  - Observacao: cancelamento e reagendamento por resposta livre ficam para fluxo assistido futuro, sem alterar agenda automaticamente nesta fase.

- [x] Fase 111 - Preferencias de comunicacao por paciente.
  - Opt-in/opt-out, canal preferido e horarios.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-22.
  - Validacoes: `pnpm --dir octaclin-backend test --runInBand servico-portal-paciente.spec.ts servico-lembretes-agenda.spec.ts processador-lembretes-agenda.spec.ts servico-agenda.spec.ts`, `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-web typecheck`, `pnpm --dir octaclin-web build`, `powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly`.
  - Saida entregue: portal do paciente edita preferencias de comunicacao, contato criptografado preserva canal preferido/horario, lembrete 24h respeita opt-in, canal preferido e janela permitida.

- [x] Fase 112 - Central de falhas de comunicacao.
  - Reprocessar falhas de email, WhatsApp, calendario e outbox.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-22.
  - Validacoes: `pnpm --dir octaclin-backend test --runInBand servico-operacoes.spec.ts`, `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-web typecheck`, `pnpm --dir octaclin-backend build`, `pnpm --dir octaclin-web build`, `cd octaclin-web; .\node_modules\.bin\playwright.cmd test tests/visual/console-regression.spec.mjs -g "operacoes LGPD" --project=desktop-chromium --reporter=list` com servidor Next temporario, `powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly`.
  - Saida entregue: central operacional consolidando falhas de mensagens, WhatsApp, email, Google Calendar e outbox, com filtros, resumo por canal e reprocessamento unificado.

### Bloco E - Portal do paciente pronto para clientes reais

- [x] Fase 113 - UX final do primeiro acesso do paciente.
  - Status: concluida em 2026-07-22.
  - Saida entregue: primeiro acesso com estados claros para link sem token, convite expirado e convite invalido, com acoes para solicitar novo acesso ou ir ao login.

- [x] Fase 114 - Area de tarefas e materiais no portal do paciente.
  - Status: concluida em 2026-07-22.
  - Saida entregue: portal do paciente exibe tarefas/metas ativas, materiais enviados, status, vencimentos, observacoes e links externos quando disponiveis.

- [x] Fase 115 - Check-ins e diario rapido de acompanhamento.
  - Status: concluida em 2026-07-23.
  - Saida entregue: paciente registra check-in rapido com humor, adesao, sintomas e observacoes; portal exibe diario recente e backend vincula automaticamente ao paciente logado.

- [x] Fase 116 - Notificacoes do paciente.
  - Status: concluida em 2026-07-23.
  - Saida entregue: portal do paciente exibe notificacoes pendentes e historico de comunicacoes por canal, status, evento, datas e erros quando existirem.

### Bloco F - LGPD, seguranca e compliance

- [x] Fase 117 - Politicas, termos e consentimentos versionados.
  - Status: concluida em 2026-07-23.
  - Saida entregue: primeiro acesso e portal do paciente registram termos de uso, politica de privacidade e consentimento LGPD como aceites separados, versionados e rastreaveis por perfil.

- [x] Fase 118 - Retencao e exclusao programada de dados.
  - Status: concluida em 2026-07-23.
  - Saida entregue: console operacional exibe politicas de retencao por tipo de dado, itens vencidos por corte temporal e permite programar retencao LGPD com protocolo auditavel sem exclusao fisica automatica.

- [x] Fase 119 - Exportacao LGPD completa por titular.
  - Status: concluida em 2026-07-23.
  - Saida entregue: portal do paciente gera pacote LGPD estruturado por titular, com perfil, consultas, formularios detalhados, comunicacoes, acompanhamento, trilha LGPD e hash SHA-256 de integridade.

- [x] Fase 120 - Hardening de secrets e variaveis.
  - Status: concluida em 2026-07-23.
  - Saida entregue: scanner local de secrets com teste, execucao no preflight, runbook de rotacao para Meta, Gmail, Google Calendar, OpenAI, Neon/Postgres, Upstash/Redis, JWT e criptografia.

- [x] Fase 121 - Rate limiting, lockout e protecoes anti-abuso.
  - Login, recuperacao de senha, convites e APIs sensiveis.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-23.
  - Validacoes: `pnpm --dir octaclin-backend exec jest src/modulos/auth/aplicacao/servico-protecao-abuso.spec.ts src/modulos/auth/aplicacao/servico-auth.spec.ts src/modulos/auth/aplicacao/servico-recuperacao-senha.spec.ts src/modulos/clientes/aplicacao/servico-usuarios-cliente.spec.ts --runInBand`, `pnpm --dir octaclin-backend typecheck`, `powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly`.
  - Saida entregue: servico anti-abuso em memoria, lockout de login por falha, throttle de recuperacao de senha antes de consulta sensivel e limite para criacao/reenvio de convites administrativos.
  - Observacao: migrar contadores para Redis/Upstash antes de producao multi-replica.

- [x] Fase 122 - Revisao de autorizacao multi-tenant.
  - Testes negativos para vazamento cross-tenant.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-23.
  - Validacoes: `pnpm --dir octaclin-backend test --runInBand src/modulos/pacientes/aplicacao/servico-pacientes.spec.ts src/modulos/comunicacoes/aplicacao/servico-comunicacoes.spec.ts`, `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-backend build`, `powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly`.
  - Saida entregue: testes negativos e bloqueios para impedir vinculo paciente-profissional cross-tenant e disparo de comunicacao para paciente de outro tenant.

### Bloco G - Observabilidade, operacao e suporte

- [x] Fase 123 - Monitoramento e healthchecks de producao.
  - Health detalhado para backend, banco, Redis, email, WhatsApp e Calendar.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-23.
  - Validacoes: `pnpm --dir octaclin-backend test --runInBand src/modulos/saude/servico-saude.spec.ts`, `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-backend build`, `powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly`.
  - Saida entregue: `/health` para liveness e `/health/detalhado` para readiness/diagnostico com checks de backend, banco, Redis, email, WhatsApp Meta e Google Calendar sem expor secrets.

- [x] Fase 124 - Logs estruturados e correlacao.
  - Request ID, tenant ID seguro, usuario e acao.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-23.
  - Validacoes: `pnpm --dir octaclin-backend test --runInBand src/infraestrutura/observabilidade/contexto-requisicao.spec.ts src/infraestrutura/observabilidade/middleware-correlacao.spec.ts src/infraestrutura/observabilidade/interceptor-log-requisicao.spec.ts src/infraestrutura/auditoria/servico-auditoria.spec.ts`, `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-backend build`, `npm run security:secrets`, `powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly`.
  - Saida entregue: request ID por requisicao, header `x-request-id` de resposta, logs HTTP estruturados com tenant/usuario quando autenticados, auditoria correlacionavel e sanitizacao para evitar PII em rota/query/mensagem de erro.

- [x] Fase 125 - Alertas operacionais.
  - Alertas para falha de deploy, queda de servico, filas paradas e falhas de integracao.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-23.
  - Validacoes: `pnpm --dir octaclin-backend test --runInBand src/modulos/operacoes/aplicacao/servico-operacoes.spec.ts src/modulos/operacoes/apresentacao/controlador-operacoes.spec.ts`, `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-web typecheck`, `pnpm --dir octaclin-backend build`, `pnpm --dir octaclin-web build`, `pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "operacoes LGPD" --project=desktop-chromium --reporter=list`, `npm run security:secrets`, `powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly`.
  - Saida entregue: endpoint `/operacoes/alertas`, BFF `/api/operacoes/alertas`, painel visual de alertas operacionais e regras para health critico/degradado, outbox atrasado, falhas de comunicacao e metadados de deploy em producao.

- [x] Fase 126 - Backups e restore testado.
  - Politica Neon/Postgres, periodicidade e teste real de restore.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-23.
  - Validacoes: `pnpm test:backup`, `pnpm security:secrets`, `powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly`.
  - Saida entregue: `RUNBOOK_BACKUP_RESTORE.md`, planejador seguro `scripts/backup-restore-plan.mjs`, teste `scripts/test-backup-restore-plan.mjs`, executor `validar-backup-restore.ps1`, `backups/` ignorado no Git e procedimento de restore em banco dedicado.
  - Observacao: a execucao operacional real foi aprovada posteriormente na Fase 158; manter teste semanal e antes de cada go-live relevante.

- [x] Fase 127 - Runbooks de suporte.
  - Login, convite, falha WhatsApp, falha email, falha agenda, recuperacao de senha.
  - Saida esperada: manual operacional para atendimento.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-23.
  - Validacoes: `pnpm test:suporte`, `pnpm security:secrets`, `powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly`.
  - Saida entregue: `RUNBOOK_SUPORTE.md`, teste documental `scripts/test-runbook-suporte.mjs`, script `pnpm test:suporte`, referencias nos runbooks/checklists e orientacao segura para triagem/escalonamento.

### Bloco H - QA, dados reais e go-live

- [x] Fase 128 - Suite E2E de jornadas criticas.
  - Cliente cria usuario, profissional cria paciente, paciente acessa portal, consulta agenda e comunicacao dispara.
  - Saida esperada: Playwright/API cobrindo jornada real.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-23.
  - Validacoes: `pnpm test:e2e:criticas`, `pnpm security:secrets`, `powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly`.
  - Saida entregue: suite Playwright `jornadas-criticas.spec.mjs` e validador `validar-jornadas-criticas.ps1` cobrindo convite administrativo, criacao de paciente, agendamento com email/WhatsApp/Google Calendar e portal do paciente com notificacoes/plano.

- [x] Fase 129 - Staging com dados realistas.
  - Criar massa de dados sem PII real.
  - Saida esperada: ambiente para demonstracao e QA.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-23.
  - Validacoes: `pnpm test:staging-fixtures`, `pnpm --dir octaclin-backend typecheck`, `pnpm security:secrets`, `powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly`.
  - Saida entregue: fixture `staging-fixtures.json`, seed `seed-staging.ts`, runbook `RUNBOOK_STAGING_DADOS.md` e comandos `pnpm test:staging-fixtures`/`pnpm seed:staging`.
  - Observacao: aplicacao no Neon staging exige `DATABASE_URL` de staging e nao foi executada nesta sessao.

- [x] Fase 130 - Piloto interno controlado.
  - Criar a estrutura operacional para o piloto: runbook, controle de acompanhamento, criterios de sucesso/bloqueio e processo de aceite.
  - Commit: registrado no historico Git desta fase.
  - Data: 2026-07-23.
  - Validacoes: `pnpm test:piloto`, `pnpm security:secrets`, `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-backend test --runInBand` (204 testes), `pnpm --dir octaclin-web typecheck`, `pnpm --dir octaclin-web test:authz`, `powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly`.
  - Saida entregue: `RUNBOOK_PILOTO_INTERNO.md`, `PILOTO_INTERNO_CONTROLE.md`, validador `scripts/test-piloto-interno.mjs`, comando `pnpm test:piloto`, conexao com `CHECKLIST_GO_LIVE.md`/`PREFLIGHT_PRODUCAO.md`/`TESTES_E_VALIDACOES.md`, e rodada 1 do piloto executada e aprovada (5 bugs reais encontrados e corrigidos: BUG-001 a BUG-005, incluindo escopo de dados por profissional responsavel aplicado em pacientes, agenda, gamificacao, profissionais, questionarios, materiais, comunicacoes e automacoes).
  - Observacao: aceite do piloto registrado em `PILOTO_INTERNO_CONTROLE.md` (aprovado por `octavioomarostica@gmail.com` em 2026-07-23). Fase 131 liberada para iniciar.

- [x] Fase 131 - Producao isolada de staging.
  - Banco, Redis, Render service/env, dominio e secrets separados.
  - Saida esperada: ambiente de producao independente.
  - Status: aceita em 2026-07-26. Banco Neon, Redis Upstash e os servicos Render de producao estao isolados e em live; credenciais expostas foram rotacionadas, ambiente/banco auditados sem staging e runtime revalidado.
  - Ressalva: Google Calendar continua degradado pelo callback OAuth da Fase 136, sem bloquear o isolamento de producao aceito nesta fase.

- [ ] Fase 132 - Dominio, SSL e identidade de envio.
  - Dominio oficial, remetente, SPF/DKIM/DMARC quando aplicavel.
  - Saida esperada: comunicacoes confiaveis e marca consistente.
  - Status: preparacao iniciada sem dominio. Nao configurar DNS, SPF, DKIM ou
    DMARC ate existir um dominio oficial; manter as URLs Render temporarias e
    preparar a decisao de dominio, hospedagem DNS e provedor/remetente.

- [x] Fase 133 - Checklist juridico/comercial para clientes.
  - Termos, politica, contrato de consultoria, suporte e SLA basico.
  - Saida entregue: pacote documental, minuta contratual, rascunho de politica,
    mapa inicial de papeis LGPD, SLA e checklist de onboarding.
  - Validacoes: `pnpm test:juridico-comercial` e `pnpm validate:docs`.
  - Observacao: revisao juridica, identidade empresarial e publicacao final
    continuam obrigatorias em `CHECKLIST_GO_LIVE.md`; esta fase nao autoriza
    convidar clientes reais isoladamente.

- [ ] Fase 134 - Go-live assistido.
  - Ativar primeiros clientes reais.
  - Monitorar logs, mensagens, agenda e suporte diariamente.
  - Saida esperada: OctaClin em producao acompanhada.

- [ ] Fase 135 - Pos-go-live e melhoria continua.
  - Coletar feedback, priorizar bugs, acompanhar custos e performance.
  - Saida esperada: backlog de evolucao pos-producao.

### Bloco I - Melhorias adicionais (nao bloqueiam go-live)

- [x] Fase 136 - Sincronizacao em tempo real com a Google Agenda pessoal do profissional.
  - Cada profissional conecta a propria conta Google via OAuth; mudancas
    feitas direto na Google Agenda pessoal (remarcar/cancelar consulta,
    criar compromisso pessoal) refletem no OctaClin quase em tempo real via
    notificacao push do Google, complementando o fluxo outbound que ja
    existe. Fecha o debito tecnico registrado na Fase 108.
  - Escopo adicional, decidido pelo usuario em 2026-07-24 fora da ordem
    sequencial de go-live (nao bloqueia nem depende das Fases 132-135).
  - Design aprovado via skill `brainstorming` em 2026-07-24; implementado via
    `superpowers:subagent-driven-development` em 2026-07-25.
  - Commits de fechamento: `5e1c33a` (onda final da revisao) e `701ed6b`
    (configuracao segura de producao), sobre a base funcional `7762537`; ver
    `fase-136-sincronizacao-google-agenda-profissional.md` para o historico
    completo de commits e os achados corrigidos.
  - Segunda onda de correcao (2026-07-26), apos revisao final de todo o
    branch: 2 Critical + 7 Important, mais 3 Important de segunda ordem
    encontrados pela propria revisao final - todos corrigidos, commits
    `4ec4825`..`fc2c3b7`.
  - Data: 2026-07-26.
  - Validacoes: `pnpm --dir octaclin-backend typecheck`, `pnpm --dir
    octaclin-backend test --runInBand` (47 suites/242 testes), `pnpm --dir
    octaclin-web typecheck`, `pnpm --dir octaclin-web build`, `pnpm
    --dir octaclin-web smoke:ui`, `smoke:e2e:bff`, `smoke:visual` (58 testes),
    `pnpm security:secrets`, `validar-preflight.ps1 -DocsOnly` e GitHub Actions
    verde para backend, web, mobile, IA e demo local smoke.
  - Pendente para habilitacao produtiva: cadastrar `GOOGLE_CALENDAR_CLIENT_ID`,
    `GOOGLE_CALENDAR_CLIENT_SECRET`, `OCTACLIN_BACKEND_URL` e
    `OCTACLIN_WEB_URL` no backend Render; registrar
    `https://octaclin-backend-producao.onrender.com/agenda/google/callback`
    no Google Cloud Console; validar uma conexao OAuth ponta-a-ponta com um
    profissional real. O callback tem fallback seguro para
    `RENDER_EXTERNAL_URL` e o health aceita OAuth individual sem refresh token
    global; ver `fase-136-sincronizacao-google-agenda-profissional.md`.

### Bloco J - Melhoria continua e qualidade de engenharia

- [x] Fase 143 - Onboarding de profissionais por convite.
  - O convite `Professional` cria, na mesma transacao, o usuario, o perfil
    clinico e o token de primeiro acesso.
  - Nome obrigatorio; registro profissional e especialidade opcionais.
  - Saida entregue: profissional convidado entra com vinculo pronto para
    agenda, escopo de dados e Google Calendar; colaboradores permanecem no
    fluxo administrativo existente.
  - Validacoes: teste unitario do convite, typecheck backend/web, suite
    completa backend, build web, preflight documental e scanner de secrets.
  - Ressalva: convites Professional anteriores nao sao retroativamente
    vinculados por ausencia de nome clinico confiavel; ver
    `fase-143-onboarding-profissionais.md`.

- [x] Fase 144 - Agendamento publico por solicitacao.
  - Link publico permite solicitar horario sem reservar a agenda de imediato;
    a aprovacao manual segue pelo painel interno da agenda.
  - O profissional precisa selecionar explicitamente um paciente existente para
    aprovar; a solicitacao publica so vira consulta, Google Calendar e
    notificacoes depois da criacao normal da agenda.
  - O token bruto do link nunca e persistido. Em sessao nova, a URL copiavel so
    reaparece apos rotacao confirmada.
  - Data: 2026-07-27.
  - Validacoes: `pnpm --dir octaclin-backend test --runInBand` (52 suites/273 testes), `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-web lint`, `pnpm --dir octaclin-web typecheck`, `pnpm --dir octaclin-web build`, `pnpm --dir octaclin-web test:e2e:criticas` (8 testes), `pnpm security:secrets`, `powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly`.
  - Saida entregue: `fase-144-agendamento-publico-solicitacao.md` e regressao Playwright cobrindo solicitacao publica, aprovacao interna obrigando paciente explicito e reflexo da consulta/notificacoes no portal.

- [x] Fase 137 - Gate de qualidade do frontend.
  - ESLint nao interativo com regras estritas do Next.js, correcoes de tipos e
    inclusao do lint no CI web.
  - Data: 2026-07-26.
  - Validacoes: `pnpm --dir octaclin-web lint`, `pnpm --dir octaclin-web typecheck`, `pnpm --dir octaclin-web test:authz` e `pnpm --dir octaclin-web build`.
  - Saida entregue: configuracao ESLint, 18 erros de lint removidos, contratos
    de rotas/notificacoes mais tipados e CI impedindo novas regressoes estaticas.

- [x] Fase 138 - Atualizacao controlada de dependencias vulneraveis.
  - Corrigir vulnerabilidades de producao em `multer`, `lodash`, `typeorm` e
    `postcss`; planejar a migracao major do Next.js separadamente, com testes
    visuais e de autenticacao completos.
  - Saida esperada: inventario de risco, lockfiles atualizados e validacao
    integral sem upgrade massivo nao revisado.
  - Status: concluida em 2026-07-26. NestJS foi atualizado para 11.1.28 e
    TypeORM para 1.1.0; a auditoria de producao do backend caiu de 6 altas,
    9 moderadas e 1 baixa para zero vulnerabilidades. A migracao major do
    Next.js permanece fase separada por risco de frontend.

- [x] Fase 139 - Fortalecimento de contratos de dominio e fronteiras BFF.
  - Reduzir `any` residual, normalizar DTOs compartilhados e cobrir limites de
    erro nos BFFs criticos.
  - Saida esperada: menor risco de regressao em agenda, pacientes, portal e
    comunicacoes.
  - Status: concluida em 2026-07-26. Removidos os `any` de producao do backend:
    contratos de notificacao da agenda e gerenciador transacional de convites
    agora sao tipados. A fronteira BFF foi revisada: `requisitarBackendAutenticado`
    centraliza sessao, renovacao, indisponibilidade de rede e HTML indevido em
    resposta JSON 502; as rotas continuam delegando a esse contrato unico.
  - Validacoes: backend 47 suites/244 testes, typecheck/build; web lint,
    typecheck, `test:authz` e build.

- [x] Fase 140 - Cobertura de confiabilidade e regressao.
  - Priorizar testes negativos para autorizacao, tenant, operacoes e falhas de
    integracao; definir metas de cobertura por modulo de risco.
  - Saida esperada: matriz rastreavel de risco, testes focados e sinais de CI
    para regressao critica.
  - Status: concluida em 2026-07-26. Criada matriz de riscos/testes com
    validador `pnpm test:confiabilidade`, cobrindo isolamento multi-tenant,
    autenticacao/autorizacao, BFF/sessao, integracoes, portal clinico e
    operacoes. A suite existente ja contem cenarios negativos para os riscos
    prioritarios e agora esta rastreada por comando e gate.

- [x] Fase 141 - Migracao major do TypeORM e eliminacao de dependencia transitiva vulneravel.
  - Avaliar e executar o codemod oficial do TypeORM 0.3 para 1.x em branch
    isolado, removendo a cadeia `typeorm -> glob -> brace-expansion` que ainda
    aparece na auditoria de producao.
  - Status: concluida em 2026-07-26. TypeORM 1.1.0 aplicado com codemod
    oficial sem transformacoes pendentes, `dotenv/config` explicito para o
    datasource CLI e `migration:run --help` validado sem tocar em banco.
  - Saida entregue: audit de producao do backend sem vulnerabilidades, build,
    typecheck e 47 suites/244 testes aprovados.

- [x] Fase 142 - Migracao controlada do Next.js e remediacao de vulnerabilidades web.
  - Next.js 15.5.22 com React 18.3.1, codemod oficial de APIs dinamicas,
    `typedRoutes` estavel e limite de output tracing explicito.
  - Parametros dinamicos e `searchParams` passaram a usar o contrato assincrono;
    gate `pnpm --dir octaclin-web test:next15` impede regressoes.
  - Overrides de `postcss` 8.5.23 e `sharp` 0.35.3 zeraram a auditoria de
    producao do frontend. `sharp` foi autorizado explicitamente na politica
    restritiva de scripts do pnpm.
  - Pendencia futura: remover o shim temporario `UnsafeUnwrappedCookies` na
    migracao dedicada para Next.js 16/React 19.

- [x] Fase 145 - Painel clinico do profissional e desmarcamento/cancelamento distintos.
  - Painel clinico diario por profissional (rotina do dia, sem retorno 30/60/90+,
    risco alto prioritario, tarefas vencidas, formularios pendentes, solicitacoes
    publicas e comunicacoes em alerta), com acoes rapidas auditadas via
    `origem: dashboard_clinico`. `SuperAdmin` pode selecionar profissional em
    contexto (auditado); nenhum outro papel acessa dados de terceiro.
  - `cancelada` continua o unico desfecho terminal da agenda; o historico da
    consulta passou a registrar a origem (`profissional`, `paciente` ou
    `google`), que decide a comunicacao: cancelamento pelo profissional notifica
    o paciente por e-mail/WhatsApp conforme preferencia; desmarcamento pelo
    paciente (portal, sessao autenticada, nunca id vindo do navegador) libera o
    horario, cancela o evento Google uma unica vez e cria um alerta
    operacional sem PHI para o profissional responsavel, sem notificar o
    proprio paciente; cancelamento originado no Google nao gera novo envio.
  - Status: concluida em 2026-07-27. Tasks 1-4 (painel clinico, formularios,
    resumo agregado, BFF/UI) e Task 5 (desmarcamento/cancelamento, commit
    `22e161b`) aprovadas por revisao SDD.
  - Validacoes: `pnpm --dir octaclin-backend typecheck` e `test --runInBand`
    (59 suites/318 testes), `pnpm --dir octaclin-web typecheck`, `lint`,
    `build`, `test:authz` e `test:e2e:criticas` (10 jornadas, desktop/mobile).
  - Pendencia: nenhuma dependencia externa (credencial/dominio/OAuth) para esta
    fase; `desconectar()` do Google Calendar segue sem limpar o canal de watch
    (debito ja registrado na Fase 136, nao reintroduzido nem agravado aqui).

- [x] Fase 147 - Foco visivel explicito nos inputs crus da agenda.
  - Endereça de forma explicita o achado da Fase 146: os 4 inputs nativos de
    `painel-agenda.tsx` (checkbox de notificacoes, nova data/hora, nova
    duracao, novo local) ganharam a mesma classe `focus-visible:outline...`
    ja usada em `portal-shell.tsx`/`modal.tsx`, em vez de depender apenas da
    regra global `:focus-visible` trazida incidentalmente pela Fase 144.
  - Escopo unico: `octaclin-web/components/agenda/painel-agenda.tsx`. Nenhuma
    logica, rota ou dado alterado.
  - Data: 2026-07-27.
  - Validacoes: `pnpm --dir octaclin-web typecheck`, `pnpm --dir octaclin-web lint`, `pnpm --dir octaclin-web test:a11y` (10 passed).
  - Saida entregue: `fase-147-foco-visivel-inputs-agenda.md`.
  - Observacao: os componentes compartilhados `Campo`, `AreaTexto`, `Selecao`
    e `Botao` ainda nao tem classe `focus-visible` propria e continuam
    dependendo da regra global; nao fazia parte do achado desta fase.

- [x] Fase 148 - Foco visivel proprio nos componentes compartilhados de formulario/botao.
  - `Campo`, `AreaTexto`, `Selecao` (`components/ui/campo.tsx`) e `Botao`
    (`components/ui/botao.tsx`) passam a ter a mesma classe
    `focus-visible:outline...` da Fase 147, em vez de depender so da regra
    global. Esses 4 componentes sao usados em 23 arquivos/37 imports do
    `octaclin-web`.
  - Data: 2026-07-27.
  - Validacoes: `pnpm --dir octaclin-web typecheck`, `lint`, `build`, `test:a11y` (10 passed), `pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs --project=desktop-chromium --reporter=list` (21 passed).
  - Saida entregue: `fase-148-foco-visivel-componentes-compartilhados.md`.

- [x] Fase 149 - Limpeza do canal de watch do Google Calendar ao desconectar.
  - Fecha o debito das Fases 136/145: `desconectar()` agora chama
    `pararCanalWatch` (tolerante a falha, so loga warning) e remove o
    registro de `GoogleCanalWatchOrm` antes de limpar os campos locais,
    em vez de so limpar o estado local sem avisar o Google.
  - Escopo: `servico-conexao-google-calendar.ts` + teste. Sem mudanca de
    assinatura publica.
  - Data: 2026-07-27.
  - Validacoes: `pnpm --dir octaclin-backend typecheck`, `test --runInBand` (59 suites/321 testes), `pnpm --dir octaclin-backend build`.
  - Saida entregue: `fase-149-limpeza-canal-watch-google-calendar.md`.
  - Observacao: recorrencia avancada e importacao inbound por `syncToken`
    (tambem citadas na Fase 136) continuam pendentes, fora do escopo desta
    fase.

- [x] Fase 154 - Hardening de seguranca OAuth e bootstrap.
  - OAuth Google exige segredo HMAC dedicado e forte; producao recusa
    configuracao parcial e o bootstrap administrativo exige chave AES.
  - Data: 2026-07-29. Saida: `fase-154-hardening-seguranca-oauth.md`.

- [x] Fase 155 - RLS dos canais de watch Google Calendar.
  - `google_canais_watch` recebeu RLS forcado; webhook e worker resolvem o
    tenant pelo identificador de canal antes da leitura.
    - Validacoes da release: 29 testes focados, typecheck, build e scanner de
      secrets aprovados.
    - Aceite operacional: cinco migrations Google aplicadas no banco usado
      pelo backend; RLS/`FORCE RLS` e policy de tenant confirmados pelo papel
      de aplicacao, com health `200` e login invalido `401`.
  - Data: 2026-07-29. Saida: `fase-155-rls-canais-watch-google.md`.

- [x] Fase 157 - Papel PostgreSQL restrito.
  - Staging e producao usam logins de aplicacao sem `BYPASSRLS`; a validacao
    operacional confirmou health, login controlado e isolamento RLS.
  - Data: 2026-07-29. Registro operacional mantido no runbook privado.

- [x] Fase 158 - Restore real em banco dedicado.
  - Dump custom da producao validado com 481 itens e restaurado em
    `octaclin_restore_fase158`, sem escrita na origem.
  - O restore exclui apenas `timescaledb`, extensao gerenciada pelo Neon;
    13 tabelas criticas, 54 politicas RLS e 2 usuarios autenticaveis foram
    equivalentes entre origem e destino.
  - Saida entregue: `fase-158-restore-real-banco-dedicado.md` e
    `scripts/executar-restore-dedicado.ps1`; dump temporario removido.

- [x] Fase 159 - Revisao juridico-operacional preparatoria.
  - Feita revisao documental frente a LGPD e orientacoes publicas da ANPD;
    evidencias tecnicas, bloqueadores e aceite externo ficaram rastreaveis.
  - Saida entregue: Termo de Uso, Anexo de Tratamento de Dados e
    `REVISAO_JURIDICO_OPERACIONAL_FASE_159.md`, alem do reforco das minutas,
    onboarding e teste documental.
  - Pendencia inegociavel: aprovacao por advogado, identidade empresarial,
    encarregado/canal, bases legais, suboperadores/transferencias e publicacao
    final em dominio oficial.

- [x] Fase 160 - Redesenho UX/UI e especificacao Penpot.
  - Fonte de verdade visual criada no Penpot para sistema visual, portais,
    agenda, console clinico, gestao, comunicacoes e modulos avancados.
  - A especificacao preserva dados sinteticos, foco visivel, responsividade e
    a regra de nao expor score clinico no portal do paciente.
  - Data: 2026-07-30. Saida: `fase-160-redesenho-ux-penpot.md`.

- [x] Fase 161 - Base visual e navegacao compartilhada.
  - Console agrupado em Clinica, Relacionamento e Administracao; controles
    compartilhados com alvo de toque de 44 px e portal do paciente sem score
    de risco clinico.
  - Data: 2026-07-30. Saida: `fase-161-base-visual-navegacao.md`.

- [x] Fase 162 - Portal do paciente orientado a prioridades.
  - Resumo reorganizado em proxima acao, proxima consulta e plano em andamento,
    usando apenas dados ja disponiveis no portal.
  - Data: 2026-07-30. Saida: `fase-162-portal-paciente-prioridades.md`.

- [x] Fase 163 - Navegacao mobile do portal do paciente.
  - Barra inferior com os cinco destinos essenciais no celular; abas completas preservadas no desktop.
  - Data: 2026-07-30. Saida: `fase-163-navegacao-mobile-portal.md`.

- [x] Fase 164 - Etapas do agendamento publico.
  - Fluxo publico explicita escolha de horario e envio de solicitacao, sem antecipar confirmacao.
  - Data: 2026-07-30. Saida: `fase-164-etapas-agendamento-publico.md`.

- [x] Fase 165 - Progresso do formulario publico.
  - Exibe progresso das perguntas obrigatorias sem alterar contrato ou envio.
  - Data: 2026-07-30. Saida: `fase-165-progresso-formulario-publico.md`.

- [x] Fase 166 - Painel clinico para leitura diaria.
  - Indicadores agrupados e controles de rotina com toque/foco consistentes.
  - Data: 2026-07-30. Saida: `fase-166-painel-clinico-leitura-diaria.md`.

- [x] Fase 167 - Agenda interna visual.
  - Grade semanal por profissional, horarios ocupados e Google tratado como
    integracao opcional; a agenda interna continua ativa sem conexao externa.
  - Data: 2026-07-30. Saida: `fase-167-agenda-interna-visual.md`.

- [x] Fase 168 - Acesso comercial e onboarding.
  - Login e recuperacao solicitam apenas email/senha e email,
    respectivamente; API e tenant sao resolvidos pelo BFF.
  - Primeiro acesso por convite e aceites legais continuam sendo o onboarding
    oficial ja validado para pacientes e profissionais.
  - Implementacao local, publicacao e validacao em producao concluidas em
    2026-07-30.
  - Render web configurado com backend de producao e tenant `octaclin-admin`;
    deploy `5558a4d` Live e smoke do BFF aprovado.
  - Saida: `fase-168-acesso-comercial-onboarding.md`.

- [x] Fase 169 - Disponibilidade e feed completo da agenda.
  - Filtrar o feed por periodo/profissional e retornar projecao minima.
  - Exibir bloqueios Google como `Indisponivel`, sem detalhes privados.
  - Criar bloqueios internos manuais para intervalos, reunioes e ferias.
  - Adicionar visoes de dia e mes sem drag-and-drop nesta etapa.
  - Data: 2026-07-30. Saida: `fase-169-disponibilidade-feed-agenda.md`.
  - Commit: `25811de`, `5bfec09`.
  - Validacao de producao: migrations 1002 a 1004 e 1006 alinhadas no Neon;
    bloqueio interno confirmado e web em live com acao de liberar horario.

- [x] Fase 170 - Integridade historica de formularios.
  - Guardar versao e snapshot da estrutura em cada envio.
  - Renderizar respostas antigas pelo snapshot imutavel.
  - Data: 2026-07-30. Saida: `fase-170-integridade-historica-formularios.md`.
  - Validacoes: Jest de questionarios/datasource, typecheck e build do backend.
  - Producao: migration `1720000001007` aplicada e registrada no Neon;
    backend publicado pelo Render no commit `ceffdce`.

- [x] Fase 171 - Biblioteca de perguntas reutilizaveis.
  - Busca, categoria, chave clinica estavel e inclusao em questionarios.
  - Persistir visibilidade sem introduzir motor condicional ainda.
  - Data: 2026-07-30. Saida: `fase-171-biblioteca-perguntas-reutilizaveis.md`.
  - Validacoes: Jest de questionarios/datasource, typecheck e build de backend/web.
  - Producao: migration `1720000001008` aplicada e registrada no Neon;
    backend e web publicados pelo Render no commit `af7d337`.

- [x] Fase 172 - Check-ins recorrentes por paciente.
  - Vincular o agendamento do questionario ao paciente escolhido.
  - Evitar disparo automatico para todos os pacientes ativos do tenant.
  - Data: 2026-07-30. Saida: `fase-172-checkins-recorrentes-paciente.md`.
  - Validacoes: Jest de questionarios/datasource, typecheck e build de backend/web.
  - Producao: migration `1720000001009` aplicada e registrada no Neon; backend
    e web publicados pelo Render no commit `56bc06d`.

- [x] Fase 173 - Matriz longitudinal de respostas.
  - Filtros por paciente, periodo, questionario e categoria.
  - Comparar indicadores estaveis e calcular delta apenas para metricas
    numericamente comparaveis.
  - Data: 2026-07-30. Saida: `fase-173-matriz-longitudinal-respostas.md`.
  - Validacoes: Jest de questionarios/controlador, typecheck e build de backend/web.
  - Producao: sem migration; backend e web publicados pelo Render no commit
    `b34113f`, com health checks `200`.

- [x] Fase 174 - Check-ins consolidados no prontuario.
  - Unificar a leitura dos formularios e do diario rapido sem migracao
    prematura dos dois armazenamentos existentes.
  - Data: 2026-07-30. Saida: `fase-174-checkins-consolidados-prontuario.md`.
  - Validacoes: Jest de pacientes/controlador, typecheck e build de backend/web.
  - Producao: sem migration; backend e web publicados pelo Render no commit
    `0eb4d43`, com health checks `200`.

- [x] Fase 175 - Separacao UX do modulo de formularios.
  - Dividir Biblioteca, Montagem/Preview, Distribuicao e Respostas.
  - Reutilizar os endpoints e componentes atuais antes de criar novos.
  - Data: 2026-07-30. Saida: `fase-175-separacao-ux-formularios.md`.
  - Validacoes: BFF de revisao, preview, typecheck e build da web.
  - Producao: sem migration; backend e web publicados pelo Render no commit
    `84bbbef`, com health checks `200`.

## Roadmap UX/UI canonico apos a Fase 175

As Fases 168 e 169 ja foram usadas para acesso comercial e disponibilidade da
agenda. As Fases 170 a 175 tambem ja foram concluidas com os escopos registrados
acima. Este bloco preserva essa numeracao e registra o proximo ciclo sem
renumerar ou reinterpretar entregas ja publicadas. A validacao ponta a ponta
abaixo precede o redesenho transversal porque confirma o ciclo clinico ja
publicado antes de ampliar a superficie de mudancas visuais.

- [x] Fase 176 - Validacao ponta a ponta de formularios e check-ins.
  - Validar o ciclo de montar formulario, reutilizar biblioteca, distribuir,
    responder como paciente, analisar respostas e matriz longitudinal.
  - Confirmar a entrada correspondente no prontuario, em desktop e celular,
    corrigindo somente defeitos comprovados durante a jornada.
  - Correcao confirmada: BFF autenticado passou a aguardar `cookies()` no
    Next.js 15, eliminando falha de sessao nas rotas de agenda e demais rotas
    autenticadas que usam a mesma fronteira.
  - Validacoes: 43 testes backend, 22 testes BFF/autorizacao, 3 testes de
    preview e 10 jornadas criticas Playwright (desktop/mobile), alem de
    `test:next15`, typecheck e build da web.
  - Data: 2026-07-30. Saida: `fase-176-validacao-ponta-a-ponta-formularios-checkins.md`.
  - Producao: web publicada no commit `9e6f227`; `/health` retornou `200`.

- [x] Fase 177 - Qualidade transversal e componentes compartilhados.
  - Consolidar campos, selects, textareas, badges, tabs, feedback, modais e
    estados de carregamento, vazio, erro, sucesso e permissao negada.
  - Validar foco, teclado, contraste, leitores de tela e responsividade antes
    de redesenhar telas maiores.
  - Entregue: campos com estados invalido/desabilitado, feedback semantico de
    sucesso/carregamento/permissao e abas reutilizaveis com setas, Home e End.
  - O editor de formularios passou a usar as primitivas de feedback e abas.
  - Validacoes: typecheck, preview de questionarios, `test:next15`, 10 testes
    Playwright de acessibilidade em desktop/mobile e build da web.
  - Data: 2026-07-30. Saida: `fase-177-qualidade-transversal-componentes.md`.
  - Producao: web publicada no commit `ebd7887`; `/health` retornou `200`.

- [x] Fase 178 - Agenda profissional completa.
  - Evoluir as visoes existentes de dia, semana, mes e lista com contexto
    operacional, painel lateral ou modal para criacao e edicao e conflitos
    visiveis.
  - Incluir acoes rapidas para concluir, reagendar, falta, cancelar ou liberar
    horario, preservando agenda interna sem exigir Google Agenda.
  - Entregue: a lista foi adicionada as visoes internas; horarios ocupados
    abrem detalhes e remarcacao em modal; desfechos clinicos usam confirmacao
    acessivel e o cancelamento explicita a liberacao do horario interno.
  - Validacoes: quatro cenarios Playwright de agenda em desktop/mobile,
    typecheck, 10 cenarios de acessibilidade, 22 testes de autorizacao e build
    da web.
  - Data: 2026-07-30. Saida: `fase-178-agenda-profissional-completa.md`.
  - Producao: web publicada no commit `b0e3144`; `/health` retornou `200`.

- [x] Fase 179 - Lista de pacientes.
  - Criar busca central, filtros salvos, risco, responsavel, ultima consulta e
    proxima acao; manter cadastro fora da tabela principal.
  - Tornar linhas acionaveis no desktop e a lista adequada ao celular.
  - Entregue: resumo de ultima consulta concluida e proxima consulta no retorno
    protegido; busca, filtros por risco/responsavel/situacao e atalhos de
    prioridade; tabela desktop e lista mobile com acoes diretas.
  - Validacoes: 17 testes do servico de pacientes, dois cenarios Playwright da
    lista em desktop/mobile, typecheck de backend/web, 10 cenarios de
    acessibilidade, 22 testes de autorizacao e build da web.
  - Data: 2026-07-30. Saida: `fase-179-lista-pacientes.md`.
  - Producao: backend e web publicados no commit `0dcb17a`; ambos os health
    checks retornaram `200`.

- [x] Fase 180 - Prontuario clinico.
  - Aplicar cabecalho persistente com paciente, situacao e acoes rapidas.
  - Organizar resumo, evolucoes, plano, formularios, mensagens, materiais e
    historico, incluindo a linha de cuidado e menos informacao simultanea.
  - Entregue: cabecalho clinico fixo, comandos rapidos, abas acessiveis e
    linha de cuidado compacta; os contextos filtram a mesma linha do tempo sem
    duplicar dados ou endpoints.
  - Validacoes: oito cenarios Playwright do prontuario em desktop/mobile,
    typecheck, 10 cenarios de acessibilidade, 22 testes de autorizacao e build
    da web.
  - Data: 2026-07-30. Saida: `fase-180-prontuario-clinico.md`.
  - Producao: web publicada no commit `a0b3f1a`; `/health` retornou `200`.

- [x] Fase 181 - Portal completo do paciente.
  - Organizar consulta, plano, check-ins, tarefas, materiais, formularios,
    mensagens e privacidade por tarefas claras e linguagem nao tecnica.
  - Nunca expor score ou classificacao de risco clinico ao paciente.
  - Entregue: navegacao por tarefas no desktop e celular para agenda,
    check-ins, plano, formularios, mensagens, perfil e privacidade.
  - Validacoes: quatro cenarios Playwright do portal em desktop/mobile,
    typecheck, acessibilidade, autorizacao e build aprovados.
  - Data: 2026-07-30. Saida: `fase-181-portal-completo-paciente.md`.
  - Producao: web publicada no commit `9549a50`; `/health` retornou `200` em
    2026-07-31.

- [x] Fase 182 - Agendamento e formularios publicos.
  - Aplicar identidade da clinica, fuso horario, indisponibilidade, escolha de
    data/horario no celular e resumo final da solicitacao.
  - Evoluir rascunho e retomada de formularios somente quando o backend
    suportar a persistencia segura.
  - Entregue: fuso explicito, selecao anunciada e resumo honesto de solicitacao;
    a falha de envio do formulario nao descarta respostas preenchidas.
  - Limite: a API ainda nao oferece identidade visual de clinica nem rascunho
    persistente seguro; ambos permanecem fora deste incremento.
  - Validacoes: quatro cenarios Playwright desktop/mobile, typecheck e build.
  - Data: 2026-07-31. Saida: `fase-182-agendamento-formularios-publicos.md`.
  - Producao: publicacao acionada pelo Render no commit `c869591`; health check
    do artefato atualizado deve ser confirmado apos o deploy.

- [x] Fase 183 - Editor de formularios completo.
  - Evoluir a separacao ja entregue na Fase 175 com estrutura, edicao, preview,
    distribuicao e respostas claramente independentes.
  - Adicionar preview simultaneo, reordenacao acessivel, versao publicada,
    rascunho e alteracoes pendentes.
  - Entregue: versao e estado do formulario visiveis; alteracoes pendentes de
    formulario e pergunta diferenciadas; foco visivel no controle de
    reordenacao por teclado; preview mantido durante a edicao.
  - Validacoes: tres testes de preview, typecheck e build da web.
  - Data: 2026-07-31. Saida: `fase-183-editor-formularios-completo.md`.
  - Producao: publicacao acionada pelo Render no commit `edb2391`; health check
    do artefato atualizado deve ser confirmado apos o deploy.

- [x] Fase 184 - Central de comunicacoes.
  - Estruturar lista de conversas, conversa ativa e contexto do paciente.
  - Incluir filtros por canal, responsavel, pendencia e falha, templates,
    respostas rapidas, entrega e navegacao progressiva no celular.
  - Entregue: inbox com contexto, status de entrega, templates e notas; busca e
    filtros de entrada, acompanhamento e falha.
  - Data: 2026-07-31. Saida: `fase-184-central-comunicacoes.md`.
  - Producao: deploy acionado pelo Render no commit `72e6d18`.

- [x] Fase 185 - Profissionais, permissoes e integracoes.
  - Exibir diretorio de profissionais, situacao do acesso e permissoes por
    capacidade, sem jargao tecnico.
  - Mostrar Google Agenda por profissional e restringir troca de painel ao
    SuperAdmin, de forma identificavel.
  - Entregue: capacidade de gerenciar equipe explicitada, ID interno removido e
    situacao Google por profissional exclusiva ao SuperAdmin.
  - Validacoes: typecheck backend e web.
  - Data: 2026-07-31. Saida: `fase-185-profissionais-permissoes-integracoes.md`.

- [x] Fase 186 - Conta, assinatura e ativacao do cliente.
  - Separar conta, equipe, assinatura, uso, configuracoes e dados fiscais.
  - Explicar limites, consumo e proximos passos sem exibir IDs ou detalhes
    internos no fluxo comercial.
  - Validacoes: typecheck da web. Data: 2026-07-31.
  - Saida: `fase-186-conta-assinatura-ativacao.md`; deploy acionado pelo Render
    no commit `0954847`.

- [x] Fase 187 - Modulos avancados.
  - Reorganizar automacoes, IA, operacoes mobile, gamificacao e operacoes
    administrativas como fluxos de produto, com revisao humana para IA.
  - Validacoes: typecheck da web. Data: 2026-07-31.
  - Saida: `fase-187-modulos-avancados.md`; deploy acionado pelo Render no
    commit `43d59df`.

- [x] Fase 188 - Validacao de usabilidade.
  - Exercitar primeiro acesso, novo paciente, agendamento, prontuario,
    formulario e comunicacao com dados sinteticos.
  - Registrar screenshots desktop/mobile e corrigir dificuldades observadas.
  - Validacoes: 10 jornadas criticas, 10 testes de acessibilidade e 22 testes
    de autorizacao/BFF. Saida: `fase-188-validacao-usabilidade.md`.

- [ ] Fase 189 - Consolidacao visual no Penpot e rollout progressivo.
  - Atualizar o sistema de design e o mapeamento entre componentes Penpot e
    frontend.
  - Registrar permissoes e comportamentos definitivos e liberar telas por
    etapas em producao.
  - Consolidacao local: `fase-189-consolidacao-visual-rollout.md`; falta
    gravacao no Penpot quando o MCP de escrita estiver disponivel.

- [x] Fase 190 - Arquitetura de navegacao e sistema visual definitivo.
  - Reorganizar o console em Clinica, Relacionamento, Gestao e SuperAdmin,
    removendo IA, Mobile e Gamificacao da navegacao principal quando nao forem
    jornadas autonomas de uso diario.
  - Evoluir o shell compartilhado com contexto da clinica e do profissional,
    acoes rapidas, notificacoes, perfil e comportamento responsivo previsivel.
  - Consolidar tokens, tipografia, densidade, paineis laterais, menus,
    tooltips, skeletons, feedback e estados de permissao sem criar um segundo
    sistema de componentes.
  - Preservar Figtree/Noto Sans, alvos de toque de 44 px, foco visivel e a
    paleta semantica; usar a Linha de cuidado como assinatura visual funcional.
  - Aceite: navegacao por permissao validada em desktop e celular, componentes
    compartilhados documentados e nenhuma regressao nos gates de autorizacao,
    acessibilidade e jornadas criticas.
  - Entregue: menu diario reorganizado, modulos avancados fora da navegacao
    principal, contexto da sessao, atalhos por permissao, menu de conta,
    skeleton compartilhado e estado ativo consistente.
  - Validacoes: contrato visual, typecheck, 48 cenarios Playwright do console,
    10 de acessibilidade, 22 de autorizacao/BFF e build de producao.
  - Data: 2026-07-31. Saida:
    `fase-190-arquitetura-navegacao-sistema-visual.md`. Implementacao:
    `e371ae0`.

- [x] Fase 191 - Acesso e ativacao do usuario.
  - Unificar login, recuperacao de senha e primeiro acesso em um shell de
    autenticacao consistente, sem API, tenant ou detalhes internos.
  - Adicionar exibicao de senha, aviso de Caps Lock, tratamento de token
    expirado e ativacao orientada por etapas para senha, dados e aceites.
  - Manter o login objetivo e operacional, sem transformar a tela em pagina de
    marketing ou transmitir credenciais para destinos externos.
  - Aceite: fluxos de sucesso, erro, expiracao e retorno ao login cobertos em
    desktop e celular, com teclado e leitores de tela.
  - Status: concluida em 2026-07-31. `AuthShell` unificou as 4 rotas;
    `CampoSenha` adicionou mostrar/ocultar senha e aviso de Caps Lock;
    `classificarFalhaToken`/`EstadoFalhaToken` unificaram o tratamento de link
    expirado/invalido entre recuperacao de senha e primeiro acesso; primeiro
    acesso passou a ter 2 etapas (senha, aceites) com foco movido por
    leitor de tela a cada transicao. Etapa de "dados" nao criada por falta de
    contrato de backend com campos coletaveis nesse ponto (ver
    `fase-191-acesso-ativacao-usuario.md`).
  - Data: 2026-07-31. Saida: `fase-191-acesso-ativacao-usuario.md`.
  - Validacoes: `pnpm --dir octaclin-web typecheck`, `lint`, Playwright
    (`acesso-ativacao.spec.mjs`, `primeiro-acesso-paciente.spec.mjs`,
    `acessibilidade.spec.mjs` = 28 testes; `jornadas-criticas.spec.mjs` = 10
    testes), `test:authz` (22 verificacoes), `build`, `security:secrets`,
    `validar-preflight.ps1 -DocsOnly`. Revisao de seguranca focada (agente
    `ecc:security-reviewer`, opus): sem achado confirmado introduzido por esta
    fase.

- [x] Fase 192 - Centro clinico diario e agenda profissional.
  - Reorganizar o dashboard em Agora, Proximos e Pendentes, priorizando fila
    clinica e acoes rapidas antes de indicadores agregados.
  - Tornar o calendario a superficie principal da agenda; mover criacao e
    edicao para painel lateral ou modal e manter dia, semana, mes e lista.
  - Exibir conflitos, bloqueios, solicitacoes publicas, integracao Google e
    notificacoes no contexto sem tornar o Google obrigatorio.
  - Preservar concluir, reagendar, falta, cancelar e liberar horario, com
    confirmacao e sincronizacao apenas quando configurada.
  - Aceite: jornadas completas de criar, editar, bloquear, liberar, concluir,
    faltar e cancelar validadas em desktop e celular.
  - Status: concluida em 2026-07-31. Dashboard reagrupado em Agora/Proximos/
    Pendentes (indicadores agregados movidos para o final); criacao de
    consulta virou modal ("Nova consulta"); edicao duplicada na lista
    consolidada num botao "Gerenciar consulta" que abre o modal ja usado pelo
    calendario; liberar horario reservado ganhou confirmacao. Corrigido de
    quebra um bug real de mobile no componente `Modal` compartilhado (sem
    scroll/max-height, formulario ficava inacessivel em tela curta).
  - Data: 2026-07-31. Saida: `fase-192-centro-clinico-agenda-profissional.md`.
  - Validacoes: `pnpm --dir octaclin-web typecheck`, `lint`, `build`,
    Playwright (`jornadas-criticas`, `console-regression`, `acessibilidade` =
    68 testes), `test:authz` (22 verificacoes), `security:secrets`,
    `validar-preflight.ps1 -DocsOnly`. Sem mudanca de backend nesta fase.

- [x] Fase 193 - Pacientes e prontuario orientados a conduta.
  - Evoluir a lista com busca dominante, filtros realmente persistidos,
    cadastro em painel lateral, risco, responsavel e proxima acao.
  - Refinar o prontuario com cabecalho persistente, conduta atual, timeline
    filtravel, Linha de cuidado e protecao contra perda de evolucao em edicao.
  - Manter resumo, evolucoes, plano, formularios, mensagens, materiais e
    historico separados, reduzindo cartoes e informacao simultanea.
  - Aceite: novo paciente, busca, filtro, agendamento de retorno, evolucao,
    tarefa e consulta ao historico cobertos por testes de jornada e permissao.
  - Status: concluida em 2026-07-31. Risco/responsavel/proxima acao,
    cabecalho persistente, Linha de cuidado e abas ja vinham das Fases
    179/180. Novo nesta fase: filtros da lista sincronizados na URL,
    cadastro/edicao de paciente em modal, protecao contra perda de evolucao
    (beforeunload + confirmacao ao trocar de aba/sair), e correcao dos
    atalhos `#novo-paciente`/`#novo-agendamento` do dashboard que tinham
    parado de funcionar apos as Fases 190/192.
  - Data: 2026-07-31. Saida: `fase-193-pacientes-prontuario-conduta.md`.
  - Validacoes: `pnpm --dir octaclin-web typecheck`, `lint`, `build`,
    Playwright (`jornadas-criticas`, `console-regression`, `acessibilidade` =
    68 testes), `test:authz` (22 verificacoes), `security:secrets`,
    `validar-preflight.ps1 -DocsOnly`.

- [x] Fase 194 - Formularios, editor e leitura longitudinal.
  - Separar o modulo em Formularios, Editor, Biblioteca, Distribuicoes e
    Respostas, reduzindo responsabilidades do componente atual.
  - Organizar o editor com estrutura, edicao e preview simultaneo; preservar
    versoes, rascunho, publicacao, reordenacao por teclado e aviso de alteracao
    nao salva.
  - Substituir regra cron exposta por configuracao de recorrencia em linguagem
    comum e manter o contrato tecnico encapsulado.
  - Priorizar leitura clinica, comparacao longitudinal e revisao nas respostas,
    sem duplicar dados do prontuario.
  - Aceite: montar, publicar, distribuir, responder, revisar e comparar um
    formulario de ponta a ponta em desktop e celular.
  - Status: concluida em 2026-08-01. `EditorQuestionario` (1593 linhas, ~35
    `useState`) virou container de ~60 linhas: estado extraido para o hook
    `useWorkspaceQuestionarios`, UI dividida em `AreaFormularios`,
    `AreaEditor`, `AreaBiblioteca`, `AreaDistribuicao`, `AreaRespostas`.
    Preview do paciente passou a ser simultaneo (3 colunas, sem toggle).
    Cron cru substituido por `SeletorRecorrencia` em linguagem comum
    (frequencia/dia da semana/horario), sem mudar o contrato do backend.
    Corrigida a guarda de alteracoes nao salvas, que so tinha um banner de
    texto sem `beforeunload`/confirmacao real (mesmo padrao da Fase 193).
    Versao, leitura clinica e matriz longitudinal ja estavam prontas e so
    foram realocadas.
  - Data: 2026-08-01. Saida:
    `fase-194-formularios-editor-leitura-longitudinal.md`.
  - Validacoes: `pnpm --dir octaclin-web typecheck`, `lint`, `build`,
    Playwright novo (`questionarios-editor.spec.mjs` = 6 testes),
    `test:questionarios-revisao:bff`, `test:questionarios-preview`,
    `test:authz` (22 verificacoes), Playwright de regressao
    (`jornadas-criticas`, `console-regression`, `acessibilidade` = 68
    testes), `security:secrets`.

- [x] Fase 195 - Portal do paciente e jornadas publicas.
  - Reduzir a pagina inicial do portal a proxima consulta, proxima acao e
    progresso do plano, substituindo excesso de cartoes por areas orientadas a
    tarefa e navegacao inferior no celular.
  - Refinar agenda, check-ins, tarefas, materiais, formularios, mensagens,
    perfil e privacidade com linguagem simples e sem risco clinico exposto.
  - Aplicar identidade configuravel da clinica, servico, local, fuso horario e
    resumo final no agendamento publico quando a API oferecer esses dados.
  - Implementar rascunho e retomada de formulario somente com persistencia
    segura no backend; nao simular continuidade entre dispositivos.
  - Aceite: portal, desmarcacao, solicitacao publica e formulario publico
    validados com dados sinteticos em desktop e celular.
  - Status: concluida em 2026-08-01 nos blocos 195A, 195B e 195C. Portal
    dividido em nove rotas com bootstrap unico; agendamento publico com
    identidade, fuso e confirmacao; formulario publico com rascunho
    versionado no backend, retomada, validacao estrutural, limite de abuso e
    limpeza ao responder ou expirar.
  - Data: 2026-08-01. Saida:
    `fase-195-portal-paciente-jornadas-publicas.md`.
  - Validacoes: backend 64 suites/351 testes, typechecks, lint, build, authz
    (23), Next dinamico (50), Playwright desktop/mobile (14), acessibilidade
    do portal (2), `security:secrets` e `test:confiabilidade`.

- [x] Fase 196 - Comunicacoes, equipe e conta do cliente.
  - Estruturar comunicacoes em conversas, mensagem ativa e contexto do
    paciente; mover canais e templates para configuracoes administrativas.
  - Separar profissionais em diretorio, acesso, permissoes, disponibilidade e
    integracoes, mantendo troca de contexto exclusiva do SuperAdmin.
  - Dividir o portal comercial em ativacao, assinatura, consumo, equipe,
    configuracoes, marca, integracoes e perfil fiscal.
  - Aceite: responder conversa, tratar falha, convidar usuario, ajustar
    permissao e compreender plano/limites sem IDs ou jargao tecnico.
  - Status: concluida em 2026-08-01. Comunicacoes foram separadas em
    conversas, nova mensagem e configuracoes com nova tentativa por mensagem
    falha e erro tecnico oculto. Profissionais foram separados em diretorio,
    disponibilidade e integracoes; arquivar agora revoga o acesso. A conta
    comercial foi dividida em oito areas e ganhou ajuste auditado de papel com
    revogacao de sessoes antigas.
  - Data: 2026-08-01. Saida:
    `fase-196-comunicacoes-equipe-conta.md`.
  - Validacoes: backend 65 suites/358 testes, lint, typechecks, builds,
    autorizacao/BFF (23), Next dinamico (50), Playwright desktop/mobile (12),
    acessibilidade da conta (2), `security:secrets` e
    `test:confiabilidade`.

- [x] Fase 197 - Racionalizacao dos modulos avancados.
  - Integrar IA aos fluxos clinicos e de comunicacao, com origem, limitacoes e
    decisao obrigatoria de aceitar, editar ou rejeitar a sugestao.
  - Transformar Automacoes em modelos e regras descritas como Quando/Fazer,
    com simulacao e historico antes da ativacao.
  - Absorver operacoes mobile tecnicas na area administrativa e manter
    Gamificacao opcional, priorizando metas individuais e adesao; comunidade e
    ranking permanecem desativados por padrao ate validacao de produto.
  - Reorganizar Operacoes, exclusiva do SuperAdmin, em Saude, Incidentes,
    Comunicacoes, LGPD, Auditoria e Filas com detalhes progressivos.
  - Aceite: nenhum modulo tecnico sem uso recorrente ocupa a navegacao
    principal; IA nunca executa conduta sem revisao humana registrada.
  - Status: concluida, validada localmente e publicada na PR #10 em 2026-08-01. Sugestoes de IA
    agora informam fonte/limitacoes e ficam pendentes ate aceitar, editar ou
    rejeitar; automacoes nascem como rascunho e exigem simulacao persistida;
    Mobile foi absorvido por Operacoes com escopo por papel; Gamificacao virou
    opt-in com comunidade/ranking desligados; e Operacoes foi dividida nas seis
    areas planejadas.
  - Data: 2026-08-01. Saida:
    `fase-197-racionalizacao-modulos-avancados.md`.
  - Validacoes: backend 69 suites/395 testes, lint, typechecks, builds,
    autorizacao/BFF (23), Next dinamico (53), Playwright da fase em desktop e
    celular (6), smoke BFF real, testes Python da IA (2), `security:secrets` e
    `test:confiabilidade`.
  - Operacao: migrations `1011` e `1012` devem ser aplicadas antes do primeiro
    deploy da fase quando a execucao automatica estiver desabilitada.

- [x] Fase 198 - Validacao final de usabilidade e consolidacao visual.
  - Executar jornadas completas com profissional, administrador e paciente
    usando dados sinteticos, incluindo primeiro acesso, agenda, prontuario,
    formulario, comunicacao, equipe e conta.
  - Capturar screenshots Playwright em desktop e celular, validar contraste,
    teclado, foco, leitores de tela, estados vazios, erro, sucesso e permissao.
  - Atualizar Penpot, mapeamento de componentes e documentacao com o resultado
    implementado, registrando divergencias deliberadas entre desenho e codigo.
  - Liberar o redesenho progressivamente em producao, com health checks,
    observabilidade e plano de reversao por incremento.
  - Aceite: gates funcionais, visuais, acessibilidade, autorizacao e build
    aprovados; checklist, resumo de fases e documento individual atualizados.
  - Status: concluida por aceite do usuario em 2026-08-02. Os resultados
    tecnicos permanecem rastreados nas Fases 191 a 197; este aceite nao
    registra execucoes adicionais de testes.
  - Saida: `fase-198-validacao-usabilidade-consolidacao-visual.md`.

- [x] Fase 199 - Busca, filtros e paginacao server-side.
  - Implementar busca sobre PII cifrada com indice cego de tokens/prefixos,
    filtros no backend e paginacao real para pacientes, profissionais e
    formularios.
  - Aceite: 500 pacientes sinteticos pesquisaveis em menos de 1s, sem vazamento
    entre tenants ou profissionais; migration e backfill reversiveis.
  - Concluida em 2026-08-02: codigo e banco de integracao aprovados; 503
    pacientes reindexados e busca pos-backfill em 133,7 ms, isolada por
    profissional. Em producao, a migration `1013` foi aplicada e o backfill
    atualizou 1 paciente; a repeticao idempotente atualizou 0.

- [x] Fase 200 - Upload seguro e anexos clinicos.
  - Escolher o provedor de objetos, usar URL pre-assinada curta e confirmar o
    objeto no backend antes de contabilizar ou exibir o anexo.
  - Aceite: metadados do cliente nao alteram cota; anexos respeitam escopo,
    auditoria, retencao e exclusao.
  - Concluida em 2026-08-02: implementacao local, jornadas desktop/mobile e
    migration `1014` validadas; bucket privado Backblaze B2, CORS, lifecycle e
    smoke S3 real aprovados. PR `#13`, CI e deploy de backend/web no merge
    `369fffc` aprovados, com health `200`. O defeito de compatibilidade visto no
    primeiro smoke foi corrigido pelo PR `#14`, merge `9e2478b`; prontuario e
    formulario publico passaram em producao, com exclusao dos dados sinteticos.
    A migration foi confirmada em producao e aplicada no banco de integracao
    `octaclin_test_fase150b`, cujo historico terminou com 27 de 27 migrations.
  - Saida: `fase-200-upload-seguro-anexos-clinicos.md`.

- [ ] Fase 201 - Confiabilidade dos processadores em multiplas instancias.
  - Consolidar infraestrutura de filas/agendadores, separar papeis web/worker
    e aplicar idempotencia e deduplicacao persistentes.
  - Aceite: duas instancias concorrentes produzem no maximo um efeito externo
    por evento; nao escalar o backend antes deste gate.
  - Codigo e testes concluidos em 2026-08-02; falta executar o rollout Render
    documentado em `fase-201-confiabilidade-processadores-multiplas-instancias.md`
    e registrar uma entrega sintetica unica antes de marcar como concluida.

- [x] Fase 202 - Sistema visual: tokens, tipografia e elevacao.
  - Consolidar tokens semanticos, hierarquia tipografica, foco, espacamento,
    elevacao e estados visuais sem criar um segundo design system.
  - Concluida em 2026-08-02; ver `fase-202-sistema-visual-tokens-tipografia-elevacao.md`.
    Lint, typecheck, build, gate de acessibilidade (10/10) e regressao do
    portal do cliente (8/8) aprovados.

- [x] Fase 203 - Componentes compartilhados e fim dos sistemas paralelos.
  - Reusar primitives existentes e consolidar aviso, status, avatar, tooltip,
    menu, cabecalho de secao e metricas; eliminar confirmacoes nativas.
  - Concluida em 2026-08-03 (2 rodadas): zero `window.confirm` no repo,
    botoes ad hoc migrados para `classesBotao`, `Aviso`/`Metrica` adotados
    nos pontos citados, tooltips migrados para `Dica`. Ver
    `fase-203-componentes-compartilhados-fim-sistemas-paralelos.md`. Ficam
    como debito tecnico de baixo risco (nao bloqueiam producao): linhas de
    1000+ caracteres de `painel-dashboard.tsx` e adocao ampla de
    `CabecalhoSecao` nas demais telas.

- [x] Fase 204 - Data fetching, resiliencia e code splitting.
  - Cancelar requisicoes obsoletas, adicionar loading/error boundaries e
    carregar apenas as secoes necessarias das rotas extensas.
  - Concluida (escopo de resiliencia) em 2026-08-03 (2 rodadas): hook
    `useRequisicaoCancelavel` criado e validado com teste de race condition;
    aplicado em todo loader com risco real de sobreposicao de requisicoes —
    `portal-cliente.tsx` (5 loaders), `agenda-semanal.tsx` (feed),
    `painel-operacoes.tsx` (9 loaders / 7 endpoints) e `portal-paciente.tsx`
    (detalhe de formulario). `error.tsx`/`loading.tsx` na raiz, 2 Suspense
    com fallback nulo corrigidos, 2 estados derivados movidos para render.
    Ficam fora de escopo (nao tem risco de corrida ou exigem refactor maior):
    next/dynamic no portal do paciente (precisa extrair 9 subcomponentes
    antes), Server Components para cliente/operacoes,
    `painel-comunicacoes.tsx`/`portal-contexto.tsx` (fetch unico no mount,
    sem re-trigger). Ver `fase-204-data-fetching-resiliencia-code-splitting.md`.

- [x] Fase 205 - Recall automatico de retorno.
  - Adicionar gatilho de inatividade ao motor de automacoes, respeitando
    profissional responsavel, opt-in, simulacao e limite de frequencia.
  - Concluida em 2026-08-03: gatilho `paciente.inativo` no motor existente,
    com dominio puro de selecao (`recall-inatividade.ts`), servico de
    simulacao/envio, cron diario e rota `POST /automacoes/recall/simulacoes`.
    Simulacao lista os pacientes que seriam contatados e o motivo de cada
    exclusao. Teto contra spam: intervalo minimo entre recalls (padrao 30
    dias) e limite por rodada (padrao 25, maximo 200), presos em faixa no
    servidor. Leitura de preferencias de comunicacao extraida para
    `comunicacoes/dominio/preferencias-comunicacao.ts`, compartilhada com os
    lembretes de agenda. Revisoes `ecc:silent-failure-hunter` (3 achados
    corrigidos, incluindo um critico de furo no teto de frequencia) e
    `ecc:security-reviewer` (sem achados criticos/altos) executadas.
    Rodada extra fechou o achado de timeout: `rodada-por-tenant.ts` novo
    isola falha e aplica timeout por tenant nos 5 crons do backend — dois
    deles (`processador-agendamentos`, `processador-outbox-comunicacoes`) nao
    tinham isolamento nenhum e abortavam a rodada inteira na primeira excecao.
    457 testes de backend, 84 de regressao visual e a11y 10/10 aprovados. Ver
    `fase-205-recall-automatico-retorno.md`.

- [x] Fase 206 - Teleconsulta por link na consulta.
  - Adicionar modalidade e link externo seguro, reutilizando agenda,
    lembretes, comunicacoes e portal; nao construir video proprio.
  - Concluida em 2026-08-04: `agenda_consultas` ganhou `modalidade`
    (`presencial`/`online`) e `link_teleconsulta`, com CHECK no banco travando
    a invariante de que consulta presencial nunca guarda link. Dominio puro
    `agenda/dominio/teleconsulta.ts` aceita so `https` e libera o link ao
    paciente apenas de 1h antes ate 30min depois do fim, nunca em consulta
    cancelada ou encerrada — fora da janela o campo nem sai do backend. Link
    entra na confirmacao, no lembrete de 24h (payload e texto, inclusive como
    parametro de template WhatsApp) e na descricao do evento Google do
    profissional; nao entra em log, auditoria nem mensagem de cancelamento.
    Painel da agenda troca o campo Local por Link da sala conforme a
    modalidade, com copia rapida no card e no modal; portal mostra "Entrar na
    consulta" so na janela valida. Decisao de nao construir video proprio
    registrada como ADR-020 em `DECISOES_ARQUITETURA.md`. Revisao
    `ecc:security-reviewer`: sem achado critico; um alto corrigido — a rota de
    desmarcar do portal devolvia o DTO completo do console ao paciente (link
    cru fora da janela, contatos e ids do Google no `payload`), agora devolve
    so `{ id, status }`. 475 testes de backend e 136 de regressao visual/a11y
    aprovados. Ver `fase-206-teleconsulta-por-link.md`.

- [x] Fase 207 - Antropometria e evolucao de medidas.
  - Modelar avaliacoes seriadas, protocolos registrados e visualizacao
    longitudinal acessivel no prontuario e portal.
  - Concluida em 2026-08-05, em duas rodadas. Dominio
    `pacientes/dominio/antropometria.ts` com 5 protocolos de composicao
    corporal (Pollock 3 e 7 dobras, Faulkner, Guedes, Siri), IMC com corte por
    faixa etaria, RCQ e circunferencia de cintura. Tabela
    `avaliacoes_antropometricas` append-only com RLS: o calculo acontece uma vez
    na gravacao e vai criptografado junto do protocolo, da formula, do sexo e da
    idade usados, entao ler o historico nunca recalcula. Aba de antropometria no
    prontuario revela so as dobras que o protocolo exige para o sexo informado.
    Grafico `components/ui/grafico-evolucao.tsx` em SVG inline, **sem
    dependencia nova**, com tabela alternativa e navegacao por teclado; portal do
    paciente ganhou a curva de peso, so peso e data.
  - Serie unica com seletor de metrica, decidido pelo validador da skill
    `dataviz`: a paleta categorica dos tokens da Fase 202 **reprova** no teste de
    daltonismo (`sucesso` x `alerta` com dE 4,7 sob protanopia). Serie unica
    tambem elimina o eixo duplo que peso e percentual exigiriam.
  - Revisao `ecc:healthcare-reviewer`: coeficientes e sitios de dobra de todos os
    protocolos conferidos contra as publicacoes originais, todos corretos. Dois
    achados criticos corrigidos nas bordas: Pollock invertia acima do vertice da
    quadratica (mais gordura medida devolvia menos percentual, em obesidade
    grave) e o limiar "moderado" de RCQ nao existia na OMS 2008 e estava citado
    como se fosse.
  - Corrigido vazamento anterior a esta fase: `scoreRisco` ia no payload do
    portal do paciente, contra a regra da Fase 161. O teste existente afirmava o
    score como esperado; foi invertido para guardar a regra.
  - 515 testes de backend e 138 de regressao visual/a11y aprovados. Ver
    `fase-207-antropometria-evolucao-medidas.md`.

- [x] Fase 208 - Documentos clinicos gerados.
  - Gerar declaracoes e relatorios auditados com identidade da clinica,
    impressao/PDF e entrega pelos canais existentes.
  - Concluida em 2026-08-05. Dominio `pacientes/dominio/documentos-clinicos.ts`
    com dois tipos (declaracao de comparecimento e relatorio de alta), modelo
    padrao em codigo e override por tenant em `tenant_configuracoes` — sem tabela
    de modelos e sem seed, entao clinica nova emite no primeiro dia. Variavel
    desconhecida no modelo do tenant e erro de salvamento, nao aviso: modelo com
    typo sairia com buraco no lugar do nome e so o paciente descobriria.
  - Tabela `documentos_emitidos` append-only com RLS forcada, corpo e cabecalho
    criptografados. Guarda o texto **renderizado**, nao modelo mais variaveis:
    modelo editado depois nao reescreve documento que ja esta na mao de terceiro.
    Duas invariantes no banco — declaracao exige `consulta_id`, e indice unico
    parcial impede duas declaracoes vivas para a mesma consulta.
  - Declaracao so sai de consulta `concluida` (criterio de aceite), auditoria em
    toda rota **inclusive na leitura**, e impressao por `@media print` sem
    nenhuma biblioteca de PDF.
  - Atestado ficou de fora de proposito: e ato privativo de medico e o produto
    atende tambem nutricionista, psicologo e educador fisico.
  - Revisao `ecc:healthcare-reviewer`: tres achados altos corrigidos. Documento
    podia sair sem nome nem registro de conselho do profissional, e o unico aviso
    tinha a classe `nao-imprimir` — nao saia na folha. Relatorio de alta somava
    consultas e metas de **todos** os profissionais, contando a quem recebe o
    papel que o paciente tambem e atendido por outra especialidade. E a alta
    podia sair sob o registro de um profissional escrita por outro; agora exige
    que quem emite seja o creditado, e profissional arquivado nao assina.
  - Revisao `ecc:security-reviewer`: isolamento por tenant e por profissional,
    RLS e ausencia de IDOR confirmados. Corrigido na origem um defeito
    compartilhado — o adaptador SMTP reexpandia variaveis sobre texto ja
    renderizado, entao paciente chamado `{{destino}}` receberia o proprio e-mail
    no lugar do nome; **a agenda usava o mesmo caminho** e um nome contendo
    `{{linkTeleconsulta}}` vazaria o link da sala. Valor de variavel passou a ser
    escapado no corpo HTML, e `emitidoPor` deixou de escapar do DTO.
  - Seguimento ja entregue, em commit separado: `mensagens_notificacao` ganhou
    `conteudo_criptografado`. Texto, assunto, nomes, parametros de template
    WhatsApp e link de teleconsulta sairam do jsonb em claro; ficou no `payload`
    so o que a infra roteia e o que o webhook consulta em SQL. A divisao usa
    **allowlist do que fica em claro**, entao campo novo e criptografado por
    padrao. Alcance maior que a fase: confirmacao e lembrete de consulta ja
    gravavam nome e texto em claro, e a mensagem recebida gravava o que o
    paciente escreveu. Dois testes afirmavam o vazamento como esperado e foram
    invertidos. `destino`/`remetente` seguem em claro (casamento por contato
    depende deles) e linhas antigas nao foram cifradas — coluna nulavel, leitura
    cai no payload em claro.
  - 555 testes de backend e 140 de regressao visual/a11y aprovados. Ver
    `fase-208-documentos-clinicos-gerados.md`.

- [x] Fase 209 - Financeiro da consulta e pacote de sessoes.
  - Registrar valores, pagamentos, recibos, recebimentos e pacotes opcionais;
    manter gateway e NFS-e fora deste MVP.
  - Concluida em 2026-08-05. Dinheiro e **inteiro em centavos em todo lugar**
    (`agenda/dominio/financeiro-consulta.ts`); nao existe casa decimal
    atravessando servico, banco ou HTTP, porque `0.1 + 0.2` fecharia o mes errado
    por centavos inexplicaveis. Valor fracionado, negativo ou acima do teto e
    recusado, nao arredondado.
  - Migration `1720000001019` poe duas invariantes no banco: `"pago" exige
    pago_em` (e vice-versa), porque pago sem data nao fecha conciliacao; e
    consulta de pacote com valor proprio e proibida, porque faria o mesmo
    atendimento entrar duas vezes no total do mes. `pacotes_sessao` nasce com RLS
    forcada.
  - Consulta cancelada **nunca** entra no faturamento (criterio de aceite),
    aplicado na soma e tambem no registro de pagamento. Consulta isenta conta
    como atendimento mas nao vira "a receber" que ninguem vai cobrar.
  - Recibo entrou como terceiro tipo do gerador da Fase 208, **sem codigo de
    geracao novo**, com indice unico parcial por consulta: dois recibos vivos do
    mesmo atendimento e o caminho para o paciente declarar a mesma despesa duas
    vezes. Recibo so sai de consulta com pagamento registrado.
  - Pacote de sessoes: `falta` consome sessao, `cancelada` devolve a vaga,
    consulta ja agendada conta como reservada — pacote de 10 nao aceita a 11a.
    Pacote vencido nao recebe consulta nova, e a validade e por data, entao
    "31/12" vale o dia 31 inteiro.
  - Aba Financeiro em `/cliente` com recebido, a receber, isentos e quebra por
    profissional. Consultas e pacotes em linhas separadas, pelo mesmo motivo da
    invariante do banco.
  - Permissao nova `agenda.financeiro.ler` (SuperAdmin, Professional, Client).
    Collaborator registra pagamento e nao ve o faturamento da casa. Professional
    so ve o proprio: o escopo sobrescreve o `profissionalId` pedido pelo cliente.
    Toda rota de dinheiro audita, inclusive a leitura.
  - Sem gateway (o pendente e o da assinatura do tenant, outro fluxo) e sem
    NFS-e (prefeitura por municipio nao cabe em MVP). Recibo sai sem CPF do
    pagador: o cadastro de paciente nao guarda CPF.
  - 596 testes de backend aprovados, typecheck e lint limpos. Ver
    `fase-209-financeiro-consulta-pacote-sessoes.md`.

- [x] Fase 210 - Notificacoes in-app e tempo real.
  - Implementar central de notificacoes e atualizacao automatica com isolamento
    por tenant/profissional e fallback por recarga periodica.
  - Concluida em 2026-08-06. Tabela `notificacoes` (migration `1720000001020`)
    com RLS forcada e **uma linha por usuario destinatario**: lido/nao lido e
    coluna, nao join. O sino do console deixou de ser link estatico e passou a
    contar de verdade.
  - A tabela **nao tem coluna de titulo nem de corpo**. O texto vem do `tipo` na
    interface e o nome do paciente e resolvido na leitura, sob o escopo de quem
    le; sem isso o centro de notificacoes seria uma segunda copia em claro
    exatamente do que a Fase 208 passou a cifrar.
  - Isolamento em funcao pura testada: SuperAdmin e Collaborator recebem tudo do
    tenant; Professional so quando e o dono identificado do evento; evento **sem**
    dono nao vai para profissional nenhum, em vez de ir para todos. Patient e
    Client nunca recebem. Na leitura, o filtro e o `usuarioId` do JWT — inclusive
    ao marcar como lida, onde o id vem do cliente.
  - Indice unico `(tenant, usuario, tipo, recurso)` com `orIgnore`: webhook da
    Meta reentregue e outbox reprocessado nao inflam o contador. A publicacao
    entra na mesma transacao do fato de origem.
  - **SSE trocado por polling** (5s no sino, 20s nos paineis), por decisao
    explicita do usuario: a Fase 201 esta com rollout pendente e roda uma
    instancia so, entao o fan-out via Redis resolveria problema inexistente; SSE
    aberto por aba manteria a instancia Render acordada 24/7; e o criterio de
    aceite ja exigia recarga periodica como fallback. Retomar SSE quando a Fase
    201 estiver em producao com mais de uma instancia.
  - Poll so com aba visivel, recarga imediata ao voltar, e falha de poll nao
    pinta erro na tela — vale tambem durante cold start do backend.
  - Sem permissao nova (`console.acessar` basta) e sem auditoria de leitura: a
    notificacao carrega ponteiro, nao dado clinico.
  - 620 testes de backend, typecheck, lint, `test:authz`, `test:next15` e build
    web aprovados. Ver `fase-210-notificacoes-in-app-tempo-real.md`.
  - Rollout de producao concluido em 2026-08-06: migrations `1015` a `1020`
    aplicadas apos backup validado; RLS, policies, indices e saude detalhada do
    backend conferidos.

- [x] Fase 211 - Importacao em massa e exportacoes do cliente.
  - Importar pacientes com preview e idempotencia; exportar dados autorizados
    com auditoria e relatorio de erros.
  - Concluida em 2026-08-06. CSV unificado em `infraestrutura/exportacao/csv.ts`
    com defesa contra injecao de formula e leitor de CSV sujo (BOM, CRLF, `;`,
    tab, campo multilinha) que preserva o numero da linha original. Importacao em
    duas etapas (`/pacientes/importar/previa` nao grava nada) com relatorio de
    **uma entrada por linha**, deduplicacao por nome + nascimento dentro da
    carteira do responsavel (reimportar nao duplica), teto de 500 linhas, corpo
    de 1 MB e respeito ao restante do plano. Professional so importa para a
    propria carteira: o responsavel vindo do corpo e ignorado. Exportacao de
    pacientes, respostas de formulario e agenda reaproveita a listagem que ja tem
    o escopo, registra o volume na auditoria e exclui bloqueio do Google do CSV
    da agenda. Criterio de aceite coberto por teste: 200 pacientes com 5 linhas
    invalidas produzem 195 criados e as 5 linhas identificadas.
  - Extensao concluida em 2026-08-08: coluna opcional `anexo` usa o upload
    assinado da Fase 200 depois da criacao do paciente, com falha isolada por
    linha; convite opcional de portal e criado depois do commit do paciente,
    devolve o link no relatorio e registra a quantidade na auditoria. A previa
    avisa contatos sem e-mail. 688 testes de backend, typecheck, lint,
    `test:authz`, `test:next15`, `test:importacao-pacientes` e build web
    aprovados. Sem migration. Ver
    `fase-211-importacao-massa-exportacoes-cliente.md`.

- [x] Fase 212 - Desfazer, lixeira e restauracao.
  - Concluida em 2026-08-08. Pacientes e profissionais agora possuem lixeira,
    restauracao auditada e desfazer imediato na web. Paciente restaurado
    preserva os vinculos, respeita carteira e limite do plano; novos
    arquivamentos preservam a situacao clinica. Profissional restaurado reativa
    o login sem reviver refresh tokens revogados. Gestao da equipe permanece
    exclusiva de SuperAdmin e todos os BFFs falham fechados por permissao.
    697 testes de backend, typechecks, lint, `test:authz`, `test:next15` e build
    web aprovados. Sem migration. Ver
    `fase-212-desfazer-lixeira-restauracao.md`.

- [x] Fase 213 - Command palette e atalhos de teclado.
  - Concluida em 2026-08-08. Paleta global por botao ou `Ctrl/Cmd+K`, navegacao
    e acoes filtradas por papel/permissao, sequencias `G`/`N` e busca
    server-side de pacientes escopada pela Fase 199. Setas, Enter, Escape,
    restauracao de foco, estados de busca e responsividade cobertos em 6 testes
    Playwright desktop/mobile. `test:authz` (35), base visual, Next 15,
    typecheck, lint e build aprovados. Sem backend ou migration. Ver
    `fase-213-paleta-comandos-atalhos.md`.

- [x] Fase 214 - Refatoracao dos monolitos.
  - Concluida em 2026-08-08. `portal-cliente` passou de 1.797 para 111 linhas e
    `painel-operacoes`, de 1.565 para 100, com hooks de orquestracao, dominio,
    formatadores e areas visuais coesas. APIs, permissoes, textos, abas e testes
    permaneceram compativeis. Os 14 cenarios Playwright confiaveis passaram
    antes e depois da extracao em desktop/mobile; typecheck, lint, base visual,
    `test:authz` (35), Next 15 (69 arquivos) e build (116 paginas) aprovados.
    Sem backend ou migration. Ver `fase-214-refatoracao-monolitos.md`.

- [x] Fase 215 - Performance de backend.
  - Resumo/limites do cliente agregados em uma transacao tenant; pool,
    readiness, timeout, metricas e shutdown controlado adicionados.
  - Benchmark no banco dedicado: 150 leituras por execucao, concorrencias
    1/5/10, zero erro e zero fila maxima. Canario confirmou role sem
    `BYPASSRLS`, RLS forcado e zero pacientes visiveis sem tenant.
  - Cache foi conscientemente adiado por falta de gargalo medido. Sem migration
    ou alteracao em producao. Saida: `fase-215-performance-backend.md`.

- [x] Fase 216 - Plano alimentar e calculo nutricional (MVP).
  - Concluida em 2026-08-08. Editor profissional no prontuario e plano
    publicado no portal do paciente, com rascunho, revisao humana, publicacao,
    versoes imutaveis, historico, arquivamento, refeicoes e substituicoes.
  - Calculo server-side com Mifflin-St Jeor, Harris-Benedict revisada e
    FAO/OMS/UNU, fonte e versao registradas. Condicao especial bloqueia o fluxo
    automatico; formula exige confirmacao de aplicabilidade pelo profissional.
  - Catalogo TACO oficial versionado: 583 alimentos; ausencia de fibra/sodio
    continua ausente e nao vira zero. Snapshot de composicao e calculo fica
    criptografado na versao publicada.
  - Migration `1720000001021`: sete tabelas, RLS forcada nas cinco clinicas,
    FKs compostas por tenant, uma policy por tabela, triggers de imutabilidade e
    publicacao, e auditoria transacional.
  - Banco de integracao `octaclin_test_fase150b` atualizado de 27/34 para 34/34
    migrations; RLS/policies/triggers e carga TACO validados.
  - Rollout de producao concluido em 2026-08-08 no banco
    `Octaclin-db-producao`: migration `1021`, RLS forcada, cinco policies, seis
    triggers, indices e TACO versionado com 583 alimentos confirmados.
  - Revisao independente concluida: concorrencia na reatribuicao, selecao da
    publicacao mais recente, identidade do catalogo, descarte de rascunho,
    chaves de reordenacao, impressao e permissoes da aba foram endurecidos.
  - 107 suites e 770 testes backend, typechecks, lint, BFF 5/5, authz, Next 15
    e build web de 116 paginas aprovados. Ver
    `fase-216-plano-alimentar-calculo-nutricional.md`.
  - Correcao transversal de 2026-08-08: o build limpo deixou de incluir
    `scripts` na raiz compilada, voltou a gerar `dist/main.js` e agora valida o
    artefato antes de liberar o deploy. A auditoria de acesso tambem tornou IA,
    metas/adesao e recebimentos proprios encontraveis para `Professional`, sem
    alterar as permissoes. Backend e web confirmados `Live` no commit `ed5ae4f`;
    smoke publico e aceite visual autenticado aprovados. Ver
    `AUDITORIA_ACESSO_PROFISSIONAL_2026-08-08.md`.

- [x] Fase 217 - PWA do portal do paciente.
  - Portal instalavel com manifest, icones, service worker de cache publico e
    tela offline neutra.
  - Check-in e formulario sem anexo usam fila IndexedDB cifrada, chave apenas
    em memoria, repeticao idempotente e limpeza no logout/HTTP 401.
  - APIs, HTML protegido e dados clinicos nao entram no Cache Storage. O app
    nativo `octaclin-mobile` permanece separado. Ver
    `fase-217-pwa-portal-paciente.md`.

- [x] Fase 218 - API publica, chaves por tenant e webhooks.
  - [x] Superficie `/v1` para pacientes e agenda com projecoes minimas.
  - [x] Chaves por tenant com hash, escopos, expiracao, rotacao e revogacao.
  - [x] Idempotencia concorrente de escrita por `referenciaExterna`.
  - [x] Rate limit Redis por IP/chave com falha fechada.
  - [x] Webhooks assinados, outbox deduplicada, seis tentativas e historico.
  - [x] Protecao SSRF, RLS forcada, auditoria sem secrets e gestao no portal.
  - [x] Contrato tecnico e runbook documentados.
  - [x] Migration `1022` aplicada com owner e validada em producao: 35/35,
    RLS forcada, policies, indices, FKs e colunas aprovados em 2026-08-08.
  - [x] Builds, push/deploy e smoke real de chave/escopos/revogacao aprovados;
    assinatura, retry, lease e SSRF aprovados na suite. Entrega a receptor
    externo fica no onboarding da primeira integracao aprovada.
  - Evidencias: `fase-218-api-publica-chaves-webhooks.md` e
    `API_PUBLICA_V1.md`.

- [x] Fase 219 - Backup automatizado, retencao e restore recorrente.
  - [x] Workflow diario/manual, validacao segura de configuracao e testes de
    contrato implementados.
  - [x] Dump PostgreSQL 18, checksum, cifragem, verificacao remota e limpeza
    efemera implementados.
  - [x] Retencao 8/29/93 dias declarada por prefixo e validada pelo workflow.
  - [x] Restore semanal/forcado em banco dedicado com verificacao de dados,
    migrations e RLS implementado.
  - [x] Role Neon de backup, bucket/chave B2 e banco de restore provisionados.
  - [x] Environment `production-backup` configurado sem expor secrets.
  - [x] Execucao manual completa `31346127174` aprovada em 2026-08-09.
  - [x] Cron habilitado e caminho operacional comum aprovado na execucao
    `31346290507`; a primeira ocorrencia automatica segue como monitoramento
    operacional, sem pendencia de implementacao.
  - Evidencia: `fase-219-backup-automatizado-retencao-restore.md`.

- [x] Fase 220 - Observabilidade e alertas externos de producao.
  - [x] Monitor externo de readiness, dependencias e login implementado.
  - [x] Incidentes deduplicados de saude e backup implementados em GitHub
    Issues, com fechamento automatico na recuperacao.
  - [x] Contrato local, permissoes minimas e varredura de secrets aprovados.
  - [x] Variaveis do repositorio configuradas, execucao manual `31346835747`
    aprovada e cron habilitado.
  - Evidencia: `fase-220-observabilidade-alertas-externos.md`.

- [x] Fase 221 - Regressao E2E em producao isolada.
  - [x] Gate reutilizavel, explicito e somente leitura implementado.
  - [x] Papel `Professional` aprovado em todos os nove modulos autorizados e
    bloqueado em `/operacoes`.
  - [x] Papel `Client` aprovado no portal do cliente e bloqueado no console.
  - [x] Papel `SuperAdmin` aprovado depois do deploy da correcao que impede
    gerenciar a conexao Google individual do profissional.
  - [x] Papel `Patient` aprovado em todas as areas do portal e bloqueado no
    console.
  - [x] Acesso `SuperAdmin` legado desativado e refresh tokens revogados
    somente depois do novo acesso ser aprovado em producao.
  - [x] Ativacao transacional do paciente corrigida e validada em producao com
    os tres aceites legais sinteticos; sessao inicial revogada depois do smoke.
  - [x] Gates finais, commit e push aprovados.
  - Evidencia: `fase-221-regressao-e2e-producao-isolada.md`.

- [x] Fase 222 - Confiabilidade Google Agenda e Gmail.
  - [x] Diagnosticar conexao, canal watch, `syncToken` e bloqueios externos em
    producao sem expor credenciais.
  - [x] Garantir carga inicial no callback e reconciliacao manual autenticada.
  - [x] Limitar a carga inicial sem combinar `timeMin` com `syncToken`.
  - [x] Limitar recorrencias a uma janela movel e limpar bloqueios fora dela.
  - [x] Expor `Sincronizar agora` na agenda do profissional.
  - [x] Endurecer o helper de renovacao Gmail para nao imprimir refresh token.
  - [x] Validar espelhamento Google para OctaClin depois do deploy.
  - [x] Renovar o OAuth Gmail e validar uma entrega real controlada.
  - [x] Confirmar `OCTACLIN_PROCESSO=all` enquanto o worker dedicado estiver
    adiado.
  - Evidencia: `fase-222-confiabilidade-google-agenda-gmail.md`.

### Bloco pos-222 - Go-live comercial assistido

- [x] Fase 223 - Verdade operacional do go-live.
  - Reconciliar checklist, preflight, resumo, status e handoffs com as
    evidencias das Fases 200 a 222.
  - Distinguir capacidade entregue, validacao somente leitura, validacao
    mutavel, dependencia externa e decisao comercial.
  - Confirmar que gateway de pagamento pode permanecer posterior ao primeiro
    piloto assistido, pois o controle manual de assinatura e limites existe.
  - Data: 2026-08-10.
  - Evidencia: `fase-223-verdade-operacional-go-live.md`.

- [x] Fase 224 - Oferta comercial, planos e ativacao assistida. [BLOQUEADOR RESOLVIDO]
  - Definir ICP, oferta inicial, preco, inclusoes/exclusoes, limite por plano,
    politica de upgrade/cancelamento e responsavel comercial.
  - Transformar o controle manual ja entregue em roteiro de venda, cobranca e
    ativacao que uma pessoa consiga executar sem depender de memoria tecnica.
  - Contrato operacional e checklist entregues em 2026-08-10:
    `CAPACIDADE_OFERTA_COMERCIAL_ATIVACAO_ASSISTIDA.md` e
    `CHECKLIST_ONBOARDING_COMERCIAL.md`.
  - Aceite comercial em 2026-08-11: Profissional R$ 99 trimestral/R$ 119 mensal;
    Clinica R$ 199 trimestral/R$ 249 mensal; PIX antecipado; demonstracao
    sintetica; cancelamento com aviso de 30 dias; migracao por escopo; WhatsApp
    fora da oferta inicial e suporte reforcado de 48 horas.
  - Criterio de aceite: uma clinica sintetica percorre proposta, aceite,
    contrato, configuracao, criacao de usuarios e confirmacao de ativacao.

- [ ] Fase 225 - Dominio, identidade e comunicacoes transacionais. [BLOQUEADOR]
  - Configurar dominio oficial, DNS, SSL, remetente, SPF, DKIM, DMARC, paginas
    publicas e redirecionamentos autorizados de OAuth.
  - Atualizar origens CORS/cookies e executar smoke controlado de email e
    Google Calendar no dominio definitivo.

- [ ] Fase 226 - Fechamento juridico e privacidade comercial. [BLOQUEADOR]
  - Submeter minutas ao advogado, completar dados empresariais, encarregado,
    canal LGPD, suboperadores, transferencias e publicacao controlada.
  - Registrar versoes e aceite das politicas aplicaveis a cada cliente.

- [ ] Fase 227 - Gateway de pagamento e conciliacao automatica. [NAO BLOQUEADOR]
  - Avaliar gateway, notas/recibos, webhooks, dunning e conciliacao sem
    substituir o controle manual antes de sua necessidade comercial comprovada.
  - Nao iniciar sem decisao de provedor, modelo fiscal e titularidade.

- [ ] Fase 228 - Onboarding e suporte assistido. [BLOQUEADOR]
  - Executar a ativacao de ponta a ponta com dados sinteticos: clinica,
    profissionais, pacientes, convite, permissao, agenda, formulario e canal
    de suporte.
  - Exercitar `RUNBOOK_SUPORTE.md`, definir responsavel e registrar SLA de
    primeira resposta e escalonamento.

- [ ] Fase 229 - Fechamento de seguranca operacional. [BLOQUEADOR]
  - Verificar variaveis ativas de cookie, CORS, JWT/refresh, AES, secrets e
    escopos de integracao sem imprimir valores; registrar somente a evidencia.
  - Rodar revisao de dependencias, secrets e permissoes de ambientes antes da
    primeira conta real.

- [ ] Fase 230 - Aceite WhatsApp de producao. [CONDICIONAL]
  - Necessaria se WhatsApp estiver incluido na oferta inicial: token permanente,
    webhook, templates aprovados, lembrete, recebimento e reprocessamento.
  - Se o canal ficar fora da oferta inicial, manter desligado ou claramente em
    beta ate o aceite.

- [ ] Fase 231 - Jornadas E2E mutaveis em staging. [BLOQUEADOR]
  - Validar criacao, edicao, cancelamento/reagendamento, formulario, convite,
    upload e comunicacao com massa sintetica e isolamento por tenant.
  - Manter producao apenas para smokes controlados e sem mutacao de negocio.

- [ ] Fase 232 - Operacao de lancamento. [BLOQUEADOR]
  - Definir janela, responsavel de monitoramento, triagem de incidentes,
    acompanhamento de backups/alertas e plano de rollback comunicacional.
  - Realizar exercicio de incidente com dados sinteticos antes do primeiro
    cliente.

- [ ] Fase 233 - Primeiro cliente piloto assistido. [BLOQUEADOR]
  - Selecionar um cliente, colher contrato/consentimento, ativar manualmente e
    acompanhar as primeiras 48 horas com feedback priorizado.
  - Criterio de aceite: nenhuma falha P0/P1 aberta e decisao explicita de
    expandir, corrigir ou pausar a comercializacao.

- [ ] Fase 234 - Editor de planos alimentares avancado e catalogo multifonte. [IMPORTANTE - POS PILOTO]
  - Evoluir o MVP da Fase 216 com editor de refeicoes, modelos, grupos de
    substituicao, resumo nutricional persistente, lista de compras e projecao
    simplificada para o paciente.
  - Estruturar catalogo versionado e rastreavel para TACO, TBCA versao 7.3,
    IBGE/POF e Tucunduva. TBCA 7.3 e versao da TBCA, nao uma fonte separada.
  - Nao carregar fonte externa sem artefato oficial, checksum, origem, versao,
    direito de uso comercial aprovado e teste de importacao. Tucunduva fica
    bloqueada ate haver licenca escrita e entrega estruturada.
  - Criterio de aceite: fontes ativas com proveniencia; planos existentes
    imutaveis; busca multifonte sem mescla silenciosa; substituicoes auditaveis
    e portal expondo somente alternativas liberadas.
  - Especificacao: `fase-234-editor-planos-alimentares-avancado-multifonte.md`.

- [~] Fase 235 - Prontuario clinico integrado e navegacao orientada a conduta. [IMPORTANTE - POS PILOTO]
  - Consolidar em seis areas: Resumo, Atendimentos, Avaliacoes, Plano,
    Documentos e Financeiro, reaproveitando os modulos entregues sem criar uma
    segunda fonte de verdade.
  - Incremento 1 concluido: navegacao principal/subareas, acoes rapidas e
    financeiro condicionado por permissao.
  - Incremento 2 concluido: BFF autenticado e timeline paginada por cursor,
    com metadados minimos, ordenacao `data/id`, limite de 20 (maximo 50),
    auditoria e sem descricao descriptografada no historico.
  - Incremento 3 concluido: cadastro inicial separado em identificacao, contato
    e responsavel/acompanhamento; convite de portal mantido como proxima acao
    segura apos salvar.
  - Incremento 4 concluido: timeline filtra por tipo e periodo no servidor,
    com DTO validado e cursor estavel preservado no recorte.
  - Incremento 5 concluido: atalhos da timeline levam para agenda ou subarea
    clinica correspondente sem criar outra fonte de verdade.
  - Incremento 6 concluido: anexos privados podem ser filtrados por categoria,
    com contagens e estado vazio contextual.
  - Incremento 7 concluido: resumo destaca proxima conduta acionavel e proxima
    consulta a partir de dados existentes, sem inferencia clinica nova.
  - Incremento 8 concluido: cabecalho contextual oferece agenda, formularios e
    anexos, preservando paciente na agenda e confirmacao antes de descartar
    rascunho clinico.
  - Incremento 9 concluido: anexos podem guardar vinculo clinico tipado; o
    backend valida origem no mesmo tenant e paciente, e a tela permite ligar o
    upload a consulta sem criar outra fonte de verdade.
  - Incremento 10 concluido: migration aditiva `1023` criou
    `pacientes_perfis` com blocos cifrados por finalidade, unicidade por
    tenant/paciente e RLS forcada. Aplicada e verificada em producao sem
    backfill; contratos, autorizacao por secao e tela progressiva permanecem
    pendentes.
  - Incremento 11 concluido: contratos e BFF separados para identificacao,
    contato e operacao; fiscal permanece fora da leitura comum e exige tambem
    `agenda.financeiro.ler`. Cada secao e cifrada e auditada sem gravar seus
    valores; falta conectar a interface de cadastro progressivo.
  - Incremento 12 concluido: prontuario oferece cadastro por secoes com
    salvamento explicito, feedback e bloco fiscal condicionado a permissao.
    O formulario legado continua compativel durante a adocao gradual; faltam
    testes de jornada em staging e a ativacao de portal apos revisao cadastral.
  - Incremento 13 concluido: ficha robusta inclui nome, apelido, sexo,
    nascimento, contato estruturado, endereco, Instagram, categoria/tags e
    condicao biologica opcional para sexo feminino. CPF segue cifrado e
    restrito ao bloco fiscal; falta validar a jornada autenticada em staging.
  - Incremento 14 concluido: a ficha permite criar o convite de portal a partir
    do e-mail salvo; cada nova emissao revoga os convites pendentes anteriores
    do paciente, sem registrar ou reexibir token em claro.
  - Entregar cabecalho persistente, resumo priorizado, timeline paginada por
    metadados autorizados, filtros, acoes rapidas e deep links, com protecao
    integral por tenant, papel e responsavel.
  - Reestruturar cadastro em identificacao/contato, responsavel/operacao,
    ativacao do portal e dados fiscais opcionais, sem misturar campos clinicos,
    fiscais e de acesso ou expor identificadores fora de sua permissao.
  - Exames/fotos, prescricoes e acompanhamento gestacional permanecem fora do
    escopo e seguem nas Fases 236, 237 e 238, respectivamente.
  - Criterio de aceite: profissional encontra a proxima conduta em uma tela;
    timeline respeita permissoes e imutabilidade; paciente nao recebe dados
    internos; desktop/mobile passam as jornadas e a acessibilidade.
  - Especificacao: `fase-235-prontuario-clinico-integrado.md`.

- [~] Fase 236 - Exames laboratoriais e evolucao fotografica. [IMPORTANTE - POS PILOTO]
  - Fundacao definida: exames por coleta/marcador e fotos por protocolo usam
    anexos privados, RLS forcada, auditoria, consentimento separado e retencao
    documentada; nao ha diagnostico automatico nem acesso pelo portal.
  - Incremento 1 concluido: migration aditiva `1024` cria coletas,
    marcadores, consentimentos e series de fotos com valores clinicos cifrados,
    RLS forcada e indices. Nao ha backfill.
  - Incremento 2 concluido localmente: servico e rotas de exames registram
    coleta/marcadores cifrados, respeitam carteira, permissao e auditoria, sem
    interpretar resultado ou expor dados ao portal.
  - Incremento 3 concluido localmente: BFF autenticado e contrato de frontend
    de exames foram adicionados sem tela ou chamada automatica, mantendo o
    deploy compativel ate a aplicacao da migration `1024` em staging.
  - Correcao de entrega: a migration `1024` foi registrada na lista explicita
    do TypeORM em 2026-08-12, pois sem esse registro o CLI nao a carregava.
  - Aceite de schema concluido em `octaclin_test_fase150b`: migrations
    `1022`--`1024` aplicadas; `1024` teve RLS forcada, quatro policies e os
    indices esperados verificados sem inserir dados clinicos.
  - Aceite de schema concluido em `Octaclin-db-producao` em 2026-08-12:
    somente a `1024` estava pendente; apos a aplicacao, 37/37 migrations, RLS
    forcada, quatro policies, indices esperados e health detalhado ficaram
    aprovados, sem inserir dados clinicos.
  - Incremento 4 concluido localmente: subaba profissional de exames no
    prontuario lista coletas/marcadores e registra nova coleta pelo BFF, sem
    classificacao clinica nem exposicao ao portal.
  - Incremento 5 concluido localmente: gate de BFF cobre sessao ausente,
    codificacao do paciente, criacao e preservacao de erro do backend sem usar
    dados clinicos ou producao.
  - Incremento 6 concluido localmente: consentimento fotografico versionado,
    cifrado e revogavel, com prazo de retencao e auditoria sem evidencia.
  - Incremento 7 concluido localmente: BFF e subaba profissional registram,
    exibem e revogam consentimento sem expor evidencia ou habilitar captura.
  - Gate local de BFF aprovado: sessao ausente, registro e revogacao foram
    exercitados sem acessar backend ou dados clinicos.
  - Incremento 8 aplicado em producao: migration `1025` cria vinculo unico,
    isolado por tenant, entre serie fotografica e arquivo privado. O schema
    foi validado com RLS habilitada e forcada, policy propria, indice da serie
    e restricoes compostas de tenant/serie e tenant/arquivo.
  - Incremento 9 publicado em producao: profissional cria serie cifrada e envia
    imagem privada somente com consentimento ativo; a confirmacao exige serie,
    paciente, tipo de midia, prazo de retencao e grava o vinculo na mesma
    transacao tenant-scoped. A abertura usa URL assinada temporaria.
  - Correcao operacional em 2026-08-13: o reset da tela usa a referencia do
    formulario capturada antes dos `await`s, evitando erro apos um upload ja
    confirmado.
  - Incremento 10 concluido localmente: protocolos fotograficos padronizados
    (`Frontal`, `Lateral`, `Costas` e `Total`) separam as series; `Adicionar`
    revela campo para categoria personalizada. A exclusao confirmada remove o
    objeto privado, os vinculos, o registro de upload e a serie; a auditoria
    preserva somente identificadores tecnicos e quantidade de arquivos.
  - Validacoes do Incremento 10: teste unitario de exclusao privada, gate BFF
    de sessao/encaminhamento, typecheck, lint e builds de backend/frontend
    aprovados localmente. Nao exige migration.
  - Pendente de aceite operacional: exercitar em producao uma imagem sintetica
    com conta de teste, sem expor foto no portal nem criar URL permanente.
  - Especificacao: `fase-236-exames-evolucao-fotografica.md`.

- [~] Fase 237 - Condutas terapeuticas versionadas. [IMPORTANTE - POS PILOTO]
  - Incremento 1 concluido localmente: metas, orientacoes, suplementos,
    produtos e formulas manipuladas possuem rascunho, publicacao, nova versao,
    arquivamento, autoria, validade, cifra, auditoria e RLS forcada por tenant.
  - A subarea profissional fica em Prontuario > Plano. Nao ha exposicao ao
    portal, envio a terceiros, recomendacao automatica, dose, catalogo ou
    assinatura digital neste incremento.
  - Aceite de schema em integracao concluido: `1025` e `1026` foram aplicadas
    em `octaclin_test_fase150b` com `neondb_owner`; historico `39/39`, RLS
    forcada, policies por tenant e indices de versao publicada foram aprovados
    sem inserir dados clinicos.
  - Pendente de producao: aplicar `1026` com `neondb_owner`, backup/restore
    recente e validacao operacional sintetica; nao ha backfill.
  - Especificacao: `fase-237-condutas-terapeuticas-versionadas.md`.

- [ ] Fase 238 - Acompanhamento gestacional especializado. [OPCIONAL - CLINICO]
  - Criar somente apos protocolo, consentimentos, curvas e limites de uso serem
    validados pelo responsavel clinico; nao reutilizar regras genericas.

- [ ] Fase 239 - Validacao clinica e de usabilidade do prontuario. [IMPORTANTE - POS PILOTO]
  - Validar jornadas sinteticas e aceite com profissionais antes de expandir a
    superficie clinica para pacientes reais.

## Backlog pos-producao

- App mobile real ou PWA avancado.
- IA clinica com guardrails e revisao humana.
- Relatorios financeiros e de performance por cliente.
- Marketplace de modelos de questionarios.
- White-label por clinica.
- Multi-unidade por tenant.
- Integracoes adicionais: Outlook Calendar, meios de pagamento locais, CRM e BI.

## Registro de conclusao de fases futuras

Use o formato abaixo ao concluir uma fase:

```text
Fase XXX - Nome:
- Status: concluida
- Commit: <hash>
- Data: YYYY-MM-DD
- Validacoes: <comandos principais>
- Observacoes: <decisoes ou pendencias>
```

- Fase 169 - Disponibilidade e feed completo da agenda:
  - Status: validada em producao.
  - Commit: `25811de`, `5bfec09`.
  - Data: 2026-07-30.
  - Validacoes: backend Jest, typechecks, lint, Playwright desktop/mobile e
    bloqueio interno manual em producao.
  - Observacoes: migrations 1002 a 1004 e 1006 aplicadas e registradas no
    Neon; web em live com controle de liberacao sempre acessivel.
