# OctaClin - Checklist vivo de fases futuras ate producao

Atualizado em 2026-07-30 apos a Fase 177 - qualidade transversal e componentes compartilhados.

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

- [ ] Fase 178 - Agenda profissional completa.
  - Evoluir as visoes existentes de dia, semana, mes e lista com contexto
    operacional, painel lateral ou modal para criacao e edicao e conflitos
    visiveis.
  - Incluir acoes rapidas para concluir, reagendar, falta, cancelar ou liberar
    horario, preservando agenda interna sem exigir Google Agenda.

- [ ] Fase 179 - Lista de pacientes.
  - Criar busca central, filtros salvos, risco, responsavel, ultima consulta e
    proxima acao; manter cadastro fora da tabela principal.
  - Tornar linhas acionaveis no desktop e a lista adequada ao celular.

- [ ] Fase 180 - Prontuario clinico.
  - Aplicar cabecalho persistente com paciente, situacao e acoes rapidas.
  - Organizar resumo, evolucoes, plano, formularios, mensagens, materiais e
    historico, incluindo a linha de cuidado e menos informacao simultanea.

- [ ] Fase 181 - Portal completo do paciente.
  - Organizar consulta, plano, check-ins, tarefas, materiais, formularios,
    mensagens e privacidade por tarefas claras e linguagem nao tecnica.
  - Nunca expor score ou classificacao de risco clinico ao paciente.

- [ ] Fase 182 - Agendamento e formularios publicos.
  - Aplicar identidade da clinica, fuso horario, indisponibilidade, escolha de
    data/horario no celular e resumo final da solicitacao.
  - Evoluir rascunho e retomada de formularios somente quando o backend
    suportar a persistencia segura.

- [ ] Fase 183 - Editor de formularios completo.
  - Evoluir a separacao ja entregue na Fase 175 com estrutura, edicao, preview,
    distribuicao e respostas claramente independentes.
  - Adicionar preview simultaneo, reordenacao acessivel, versao publicada,
    rascunho e alteracoes pendentes.

- [ ] Fase 184 - Central de comunicacoes.
  - Estruturar lista de conversas, conversa ativa e contexto do paciente.
  - Incluir filtros por canal, responsavel, pendencia e falha, templates,
    respostas rapidas, entrega e navegacao progressiva no celular.

- [ ] Fase 185 - Profissionais, permissoes e integracoes.
  - Exibir diretorio de profissionais, situacao do acesso e permissoes por
    capacidade, sem jargao tecnico.
  - Mostrar Google Agenda por profissional e restringir troca de painel ao
    SuperAdmin, de forma identificavel.

- [ ] Fase 186 - Conta, assinatura e ativacao do cliente.
  - Separar conta, equipe, assinatura, uso, configuracoes e dados fiscais.
  - Explicar limites, consumo e proximos passos sem exibir IDs ou detalhes
    internos no fluxo comercial.

- [ ] Fase 187 - Modulos avancados.
  - Reorganizar automacoes, IA, operacoes mobile, gamificacao e operacoes
    administrativas como fluxos de produto, com revisao humana para IA.

- [ ] Fase 188 - Validacao de usabilidade.
  - Exercitar primeiro acesso, novo paciente, agendamento, prontuario,
    formulario e comunicacao com dados sinteticos.
  - Registrar screenshots desktop/mobile e corrigir dificuldades observadas.

- [ ] Fase 189 - Consolidacao visual no Penpot e rollout progressivo.
  - Atualizar o sistema de design e o mapeamento entre componentes Penpot e
    frontend.
  - Registrar permissoes e comportamentos definitivos e liberar telas por
    etapas em producao.

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
