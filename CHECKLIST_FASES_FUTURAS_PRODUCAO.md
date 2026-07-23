# OctaClin - Checklist vivo de fases futuras ate producao

Atualizado apos a Fase 112.

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

- [ ] Fase 121 - Rate limiting, lockout e protecoes anti-abuso.
  - Login, recuperacao de senha, convites e APIs sensiveis.
  - Saida esperada: protecao basica contra abuso.

- [ ] Fase 122 - Revisao de autorizacao multi-tenant.
  - Testes negativos para vazamento cross-tenant.
  - Saida esperada: suite de seguranca tenant-aware.

### Bloco G - Observabilidade, operacao e suporte

- [ ] Fase 123 - Monitoramento e healthchecks de producao.
  - Health detalhado para backend, banco, Redis, email, WhatsApp e Calendar.
  - Saida esperada: painel/check automatizavel.

- [ ] Fase 124 - Logs estruturados e correlacao.
  - Request ID, tenant ID seguro, usuario e acao.
  - Saida esperada: diagnostico mais rapido sem expor PII.

- [ ] Fase 125 - Alertas operacionais.
  - Alertas para falha de deploy, queda de servico, filas paradas e falhas de integracao.
  - Saida esperada: notificacao proativa.

- [ ] Fase 126 - Backups e restore testado.
  - Politica Neon/Postgres, periodicidade e teste real de restore.
  - Saida esperada: runbook de recuperacao.

- [ ] Fase 127 - Runbooks de suporte.
  - Login, convite, falha WhatsApp, falha email, falha agenda, recuperacao de senha.
  - Saida esperada: manual operacional para atendimento.

### Bloco H - QA, dados reais e go-live

- [ ] Fase 128 - Suite E2E de jornadas criticas.
  - Cliente cria usuario, profissional cria paciente, paciente acessa portal, consulta agenda e comunicacao dispara.
  - Saida esperada: Playwright/API cobrindo jornada real.

- [ ] Fase 129 - Staging com dados realistas.
  - Criar massa de dados sem PII real.
  - Saida esperada: ambiente para demonstracao e QA.

- [ ] Fase 130 - Piloto interno controlado.
  - Usar com poucos clientes ficticios/reais autorizados.
  - Registrar problemas e ajustar.
  - Saida esperada: lista de bugs de piloto zerada ou aceita.

- [ ] Fase 131 - Producao isolada de staging.
  - Banco, Redis, Render service/env, dominio e secrets separados.
  - Saida esperada: ambiente de producao independente.

- [ ] Fase 132 - Dominio, SSL e identidade de envio.
  - Dominio oficial, remetente, SPF/DKIM/DMARC quando aplicavel.
  - Saida esperada: comunicacoes confiaveis e marca consistente.

- [ ] Fase 133 - Checklist juridico/comercial para clientes.
  - Termos, politica, contrato de consultoria, suporte e SLA basico.
  - Saida esperada: pronto para convidar clientes de consultoria.

- [ ] Fase 134 - Go-live assistido.
  - Ativar primeiros clientes reais.
  - Monitorar logs, mensagens, agenda e suporte diariamente.
  - Saida esperada: OctaClin em producao acompanhada.

- [ ] Fase 135 - Pos-go-live e melhoria continua.
  - Coletar feedback, priorizar bugs, acompanhar custos e performance.
  - Saida esperada: backlog de evolucao pos-producao.

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
