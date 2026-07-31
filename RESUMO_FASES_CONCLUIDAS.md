# OctaClin - Resumo das fases concluidas

Atualizado em 2026-07-30 apos a Fase 174 - check-ins consolidados no prontuario.

Fase 136 (2026-07-25) adicionou sincronizacao em tempo real com a Google
Agenda pessoal de cada profissional: conexao OAuth individual, notificacao
push do Google, bloqueio de horario para eventos externos e aplicacao
automatica de mudancas feitas direto no Google na consulta correspondente.
Ver `fase-136-sincronizacao-google-agenda-profissional.md`.

Este arquivo e um handoff executivo do que ja foi construido no OctaClin. Ele deve ajudar outro agente de IA ou desenvolvedor a entender rapidamente a evolucao do projeto sem precisar reprocessar todo o historico de commits.

## Estado geral do produto

O OctaClin ja possui uma base SaaS multi-tenant com backend NestJS, frontend Next.js, BFF com cookies HttpOnly, login unificado por perfil, console operacional, portal do paciente, portal do cliente, formularios/questionarios, agenda interna, integracoes de email, Google Calendar e WhatsApp Meta, LGPD operacional e fluxo inicial de usuarios/convites administrativos para clientes.

## Decisoes de arquitetura ja consolidadas

- Nome do produto: OctaClin.
- LiveClin foi usado como referencia/modelo, nao como nome do projeto.
- Backend: NestJS, TypeORM, PostgreSQL/Neon, isolamento por tenant.
- Frontend: Next.js App Router, BFF interno e cookies HttpOnly.
- Autenticacao: JWT/refresh token, login unificado e roteamento por papel.
- Papeis principais: `SuperAdmin`, `Professional`, `Collaborator`, `Patient`, `Client`.
- Tenant seguro: tenant derivado do JWT; nao confiar em header externo de tenant.
- Comunicacoes: outbox, Gmail/SMTP/Gmail API, WhatsApp Meta Cloud API e webhooks.
- Agenda: agenda interna integrada ao Google Calendar.
- LGPD: consentimentos, solicitacoes, exportacao, resposta e visibilidade por portal.
- Deploy/staging: GitHub privado, Render, Neon PostgreSQL, Upstash Redis e variaveis de ambiente.

## Resumo por bloco de fases

### Fundacao e nucleo inicial

- Fase 0 - Fundacao de arquitetura: base backend, estrutura modular, tenancy, seguranca e primeiros contratos.
- Fase 1 - Nucleo comercial: base de cadastros e operacoes essenciais.
- Fase 2 - Motor de questionarios: estrutura inicial para questionarios e agendamentos de envio.
- Fase 3 - Comunicacao omnichannel: camada inicial de canais e notificacoes.
- Fase 4 - IA e gamificacao: bases iniciais para recursos de IA, gamificacao e engajamento.
- Fase 5 - Experiencia mobile: bases para funcionalidades mobile e sincronizacao.
- Fase 6 - Polimento e deploy: preparacao inicial para empacotamento e execucao.

### Hardening, operacoes e console

- Fase 7 - Hardening end-to-end: reforco geral de seguranca, contratos e fluxos.
- Fase 8 - Operacoes e confiabilidade: bases operacionais, auditoria e confiabilidade.
- Fase 9 - Integracao real da tela de operacoes: operacoes conectadas ao backend.
- Fase 10 - Login web operacional: login funcional no frontend.
- Fase 11 - Renovacao automatica de sessao web: refresh token e continuidade de sessao.
- Fase 12 - Seed demo operacional: dados demo para validar jornada.
- Fase 13 - Smoke operacional ponta a ponta: roteiro de validacao operacional.
- Fase 14 - BFF com cookies HttpOnly: protecao de sessao no frontend.
- Fase 15 - Middleware de rotas web: protecao e redirecionamento por sessao.
- Fase 16 - Console administrativo web: primeira camada do console.
- Fase 17 - Cadastros via BFF: cadastros passando pelo BFF.
- Fase 18 - DTOs autorizados com nomes descriptografados: respostas seguras para UI.
- Fase 19 - Auditoria de leitura sensivel: trilha para acesso a dados sensiveis.
- Fase 20 - Console de auditoria operacional: leitura operacional da auditoria.
- Fase 21 - Smoke E2E BFF e auditoria: validacao integrada.
- Fase 22 - Cadastros com criacao e edicao: CRUD operacional ampliado.
- Fase 23 - Questionarios via BFF real: questionarios conectados ao backend.
- Fase 24 - Correcao de login e API URL: login ajustado para backend informado.
- Fase 25 - Operacao demo completa: fluxo demo funcional.
- Fase 26 - Execucao local assistida: comandos e ambiente local documentados.
- Fase 27 - Hardening de UX operacional: ajustes de experiencia no console.
- Fase 28 - Arquivamento controlado: exclusao logica/arquivamento seguro.

### Consoles de dominio e QA

- Fase 29 - Console de comunicacoes: UI operacional de comunicacoes.
- Fase 30 - Console de automacoes: UI operacional de automacoes.
- Fase 31 - Console de IA: UI operacional de IA.
- Fase 32 - Console mobile: UI operacional mobile.
- Fase 33 - Console de gamificacao: UI operacional de gamificacao.
- Fase 34 - QA visual e navegacao: validacoes visuais e navegacao.
- Fase 35 - Persistencia e listagens de gamificacao: persistencia do dominio.
- Fase 36 - Persistencia e listagens de IA e mobile: persistencia dos dominios.
- Fase 37 - Historico de comunicacoes e automacoes: historico operacional.
- Fase 38 - Hardening operacional do BFF: maior robustez no BFF.
- Fase 39 - Auditoria de mutacoes backend: trilha para alteracoes.
- Fase 40 - Filtros e exportacao operacional: filtros e CSV/exportacoes.
- Fase 41 - Testes automatizados de dominio e BFF: cobertura focada.
- Fase 42 - Qualidade visual e UX operacional: polimento visual.
- Fase 43 - Regressao UI e handoff QA: regressao e handoff.
- Fase 44 - Documentacao de arquitetura e handoff: documentacao tecnica.
- Fase 45 - CI local e validacao consolidada: comandos locais de CI.
- Fase 46 - GitHub Actions CI: CI no GitHub.
- Fase 47 - Regressao visual Playwright: testes visuais automatizados.
- Fase 48 - Plano de staging privado: desenho de staging.
- Fase 49 - Compatibilidade cloud para staging: ajustes cloud.

### Infra cloud, email, WhatsApp e staging

- Fase 50 - Neon PostgreSQL staging: banco cloud conectado.
- Fase 51 - Redis Upstash staging: cache/fila Redis cloud.
- Fase 52 - WhatsApp Meta Cloud em staging: configuracao Meta inicial.
- Fase 53 - Webhook WhatsApp Meta: recebimento de eventos.
- Fase 54 - Persistencia de status WhatsApp: status de mensagens salvo.
- Fase 55 - Status WhatsApp no console: status visivel na UI.
- Fase 56 - Validacao manual Meta/WhatsApp: etapa operacional validada manualmente, sem arquivo de fase no repo.
- Fase 57 - Conversas WhatsApp: persistencia de conversas recebidas.
- Fase 58 - Token permanente Meta WhatsApp: token permanente documentado/configurado.
- Fase 59 - Transicao operacional: sem arquivo de fase no repo; contexto consolidado nas fases 58 e 60.
- Fase 60 - Inbox WhatsApp: caixa de entrada WhatsApp.
- Fase 61 - Associacao manual de contatos WhatsApp: vinculo contato-paciente.
- Fase 62 - Notas internas WhatsApp: notas e status de atendimento.
- Fase 63 - Agenda interna e Google Calendar: agenda conectada ao Google Calendar, email e mensagens no agendamento.

### Acesso, pacientes, formularios e LGPD

- Fase 64 - Matriz de acesso e permissoes: papeis e permissoes.
- Fase 65 - Convite e primeiro acesso do paciente: ativacao de portal do paciente.
- Fase 66 - Recuperacao de senha e seguranca: fluxo seguro de senha.
- Fase 67 - Login unificado e roteamento por perfil: entrada unica por papel.
- Fase 68 - Configuracao por tipo e opcoes de pergunta: melhoria do editor.
- Fase 69 - Preview do formulario como paciente: simulacao de experiencia do paciente.
- Fase 70 - Secoes e duplicacao de questionarios: organizacao e produtividade.
- Fase 71 - Modelos de questionarios: modelos reutilizaveis.
- Fase 72 - Coleta de respostas de formularios: recebimento de respostas.
- Fase 73 - Painel de respostas de formularios: acompanhamento operacional.
- Fase 74 - Leitura clinica de respostas: interpretacao clinica das respostas.
- Fase 75 - Portal autenticado do paciente: portal protegido.
- Fase 76 - Historico e perfil do portal do paciente: historico e dados do paciente.
- Fase 77 - Detalhe do formulario respondido no portal: detalhe de resposta.
- Fase 78 - Perfil editavel do paciente: edicao de perfil pelo paciente.
- Fase 79 - Hardening LGPD do portal do paciente: privacidade reforcada.
- Fase 80 - Regressao visual do portal do paciente: Playwright visual.
- Fase 81 - Onboarding real do paciente: ativacao real de paciente.
- Fase 82 - Central do paciente com linha do tempo: jornada e timeline.
- Fase 83 - UX do portal do cliente: primeira melhoria visual do cliente.
- Fase 84 - LGPD avancado do paciente: recursos LGPD avancados.
- Fase 85 - Painel operacional LGPD: console para solicitacoes.
- Fase 86 - Detalhe e exportacao de protocolo LGPD: detalhe/exportacao.
- Fase 87 - Resposta LGPD ao paciente: resposta operacional visivel.
- Fase 88 - Protocolos LGPD no portal do paciente: paciente acompanha protocolos.

### Portal do cliente e administracao da conta

- Fase 89 - Base do portal do cliente: rota e estrutura inicial do portal.
- Fase 90 - Resumo real do portal do cliente: dados reais da conta, assinatura e usuarios.
- Fase 91 - Gestao inicial de usuarios do cliente: listar, criar e desativar usuarios administrativos.
- Fase 92 - Convites para usuarios administrativos: convite por email e primeiro acesso sem senha manual.
- Fase 93 - Auditoria e controle de convites administrativos: listar, reenviar e revogar convites pendentes.
- Fase 94 - Preflight de producao: prontidao por area, gates de fase e validacao local padronizada.
- Fase 95 - Permissoes finas para usuarios administrativos: matriz refinada para Client, Professional e Collaborator, guard backend por permissao, BFF protegido e UI escondendo acoes indevidas.
- Fase 96 - Configuracoes da conta do cliente: tela e endpoints para nome, marca, timezone, idioma e canais padrao, persistidos em `tenant_configuracoes`.
- Fase 97 - Perfil da empresa/consultoria e dados fiscais: tela e endpoints para pessoa fisica/juridica, responsavel, endereco, contatos e base de recibos/notas, persistidos por tenant e auditados.
- Fase 98 - Historico de convites administrativos: historico completo por usuario, auditoria de criar/reenvio/revogacao e exportacao CSV simples sem expor tokens.
- Fase 99 - Modelo de planos e limites SaaS: planos gratuito/profissional/clinica/enterprise por tenant, limites de usuarios, pacientes, mensagens, formularios e armazenamento, calculo de uso real, alertas e checagem backend de limite com resumo visivel no portal do cliente.
- Fase 100 - Tela de assinatura e uso no portal do cliente: plano recomendado, CTAs de upgrade/revisao de limite, endpoint backend/BFF para solicitacao comercial manual, persistencia em `tenant_configuracoes` e auditoria da solicitacao.
- Fase 101 - Controle manual de assinatura: painel operacional para listar solicitacoes comerciais, aplicar plano SaaS manualmente por tenant, atualizar `plano_saas` e concluir a solicitacao sem gateway pago inicial.
- Fase 102 - Bloqueios suaves por inadimplencia/limite: criacao de usuarios administrativos e pacientes passa por checagem de limite/status da assinatura, assinatura suspensa/cancelada bloqueia novas acoes e o portal do cliente exibe aviso sem impedir acesso a dados existentes.
- Fase 103 - Dashboard inicial do profissional: nova rota `/dashboard`, destino inicial operacional, permissao `dashboard.ler`, indicadores de agenda/pacientes/formularios/mensagens e links para a rotina diaria.
- Fase 104 - Prontuario/linha do tempo do paciente: endpoint consolidado e tela `/pacientes/[id]` com dados cadastrais, resumo e eventos cronologicos de consultas, formularios, respostas e mensagens, com auditoria de leitura sensivel.
- Fase 105 - Evolucoes/anotacoes clinicas: registro privado do profissional no prontuario, conteudo criptografado, listagem auditada e eventos de evolucao clinica na linha do tempo.
- Fase 106 - Planos de acompanhamento e tarefas do paciente: tarefas/metas/check-ins prescritos no prontuario, descricao criptografada, resumo de pendencias, auditoria e base para exibir o plano no portal do paciente.
- Fase 107 - Biblioteca de materiais e envio ao paciente: cadastro de materiais educativos reutilizaveis por tenant, envio ao paciente pelo prontuario, observacao criptografada e base para exibir materiais no portal do paciente.
- Fase 108 - Agenda de producao: conflitos locais por profissional, remarcacao, cancelamento, historico/auditoria e sincronizacao Google Calendar para criar, atualizar e cancelar eventos.
- Fase 109 - Templates Meta WhatsApp por evento: cadastro de templates aprovados com evento, idioma e parametros na tela de comunicacoes, selecao automatica do template `agenda.consulta.agendada` pela agenda e montagem de `components` para envio Meta.
- Fase 110 - Automacoes de lembrete e confirmacao de consulta: cron de lembrete 24h por tenant ativo, envio email/WhatsApp com template `agenda.consulta.lembrete`, idempotencia/logs em `notificacoes` e `payload.automacoes`, confirmacao simples por resposta WhatsApp e status visivel na agenda.
- Fase 111 - Preferencias de comunicacao por paciente: portal do paciente permite editar opt-in de email/WhatsApp, canal preferido e horario permitido; backend persiste isso no contato criptografado e automacoes de lembrete respeitam consentimento, canal preferido e janela de horario.
- Fase 112 - Central de falhas de comunicacao: painel operacional consolida falhas de mensagens, WhatsApp, email, Google Calendar e outbox, com filtros, resumo por canal e reprocessamento unificado por item.
- Fase 113 - UX final do primeiro acesso do paciente: primeiro acesso diferencia link sem token, convite expirado e convite invalido, exibindo copy acionavel e caminhos para novo acesso ou login; smoke visual cobre caminho feliz e falhas esperadas.
- Fase 114 - Area de tarefas e materiais no portal do paciente: resumo do portal passa a incluir tarefas/metas ativas e materiais enviados ao paciente; UI adiciona navegacao `Plano`, contadores, secao de plano de acompanhamento, materiais com status/observacao/link e eventos na linha do tempo.
- Fase 115 - Check-ins e diario rapido de acompanhamento: portal do paciente permite registrar check-in rapido com humor, adesao ao plano, sintomas e observacoes; backend vincula pelo usuario logado, atualiza `ultimoCheckinEm`, lista diarios recentes e inclui eventos de check-in na linha do tempo.
- Fase 116 - Notificacoes do paciente: portal do paciente passa a exibir notificacoes pendentes e historico de comunicacoes por canal, status, evento, datas e erros, com contadores `notificacoesPendentes` e `notificacoesHistorico` derivados de `mensagens_notificacao`.
- Fase 117 - Politicas, termos e consentimentos versionados: primeiro acesso e portal do paciente passam a registrar `termos_uso`, `politica_privacidade` e `consentimento_lgpd` como aceites separados por versao, perfil e origem, usando `consentimentos_lgpd` como trilha rastreavel.
- Fase 118 - Retencao e exclusao programada de dados: painel operacional LGPD passa a exibir politicas versionadas de retencao por tipo de dado, itens vencidos por corte temporal e programacao auditavel com protocolo `RET-*`, registrada em `consentimentos_lgpd` sem apagar dados automaticamente nesta fase.
- Fase 119 - Exportacao LGPD completa por titular: exportacao do portal do paciente passa a gerar pacote `octaclin.lgpd.exportacao_paciente.v1` por categorias, incluindo perfil, consultas, formularios respondidos com respostas, comunicacoes, acompanhamento, LGPD e hash SHA-256 de integridade.
- Fase 120 - Hardening de secrets e variaveis: adicionado scanner local `scripts/scan-secrets.mjs`, teste `scripts/test-scan-secrets.mjs`, scripts `security:secrets`/`test:security`, execucao no preflight e runbook de rotacao de secrets para provedores criticos.
- Fase 121 - Rate limiting, lockout e protecoes anti-abuso: servico anti-abuso em memoria com politicas para login, recuperacao de senha e convites administrativos; login bloqueia apos falhas, recuperacao limita antes de consultar dados sensiveis e convites limitam criacao/reenvio repetidos.
- Fase 122 - Revisao de autorizacao multi-tenant: adicionados testes negativos e correcoes para impedir vinculo de paciente a profissional de outro tenant e disparo de comunicacao para paciente fora do tenant atual.
- Fase 123 - Monitoramento e healthchecks de producao: `/health` mantido como liveness simples e `/health/detalhado` criado para readiness/diagnostico de backend, banco, Redis, email, WhatsApp Meta e Google Calendar sem expor secrets.
- Fase 124 - Logs estruturados e correlacao: backend passa a atribuir `requestId` por requisicao, devolver `x-request-id`, emitir logs HTTP estruturados com tenant/usuario quando autenticados e gravar `requestId` em auditoria para diagnostico sem expor PII.
- Fase 125 - Alertas operacionais: console de operacoes passa a exibir alertas consolidados de health critico/degradado, outbox atrasado, falhas de comunicacao e metadados de deploy ausentes em producao, com severidade, metricas e acao sugerida.
- Fase 126 - Backups e restore testado: politica PostgreSQL/Neon documentada, `backups/` ignorado no Git, planejador seguro sem vazamento de senha, script `validar-backup-restore.ps1` para `pg_dump`/`pg_restore --list` e restore opcional em banco dedicado com confirmacao explicita.
- Fase 127 - Runbooks de suporte: criado `RUNBOOK_SUPORTE.md` com triagem segura, atendimento de login, convites, recuperacao de senha, WhatsApp, email, agenda e criterio de escalonamento; adicionado teste documental `pnpm test:suporte`.
- Fase 128 - Suite E2E de jornadas criticas: adicionada suite Playwright para cliente convidar usuario, profissional criar paciente, agenda disparar email/WhatsApp/Google Calendar e paciente visualizar consulta, notificacoes e plano no portal.
- Fase 129 - Staging com dados realistas: criada massa ficticia `octaclin-staging` sem PII real, seed `seed-staging.ts`, validador `test-staging-fixtures.mjs` e runbook para aplicar no Neon staging.
- Fase 130 - Piloto interno controlado: criado `RUNBOOK_PILOTO_INTERNO.md` com participantes, perfis, jornadas, criterios de sucesso/bloqueio e processo de aceite, alem de `PILOTO_INTERNO_CONTROLE.md` como acompanhamento vivo da rodada do piloto e validador documental `test-piloto-interno.mjs`. Rodada 1 executada e aprovada em 2026-07-23: todas as jornadas manuais testadas, 5 bugs reais encontrados e corrigidos (BUG-001 a BUG-005), com destaque para o escopo de dados por profissional responsavel (`pacientes_responsaveis`) aplicado e testado em pacientes, agenda, gamificacao, profissionais, questionarios, materiais, comunicacoes e automacoes via o helper `resolverProfissionalIdDoUsuario`.
- Fase 131 - Producao isolada de staging: banco Neon, Redis Upstash e servicos Render de producao foram aceitos em 2026-07-26 apos rotacao de credenciais, auditoria sem referencias/dados de staging e revalidacao de backend, banco, Redis, email, WhatsApp e web. Google Calendar continua pendente na Fase 136 e nao deve ser habilitado para clientes reais ate o callback OAuth ser validado.
- Fase 133 - Checklist juridico/comercial para clientes: pacote operacional com minuta de contrato, rascunho de politica de privacidade, matriz de papeis LGPD, proposta de SLA e checklist de onboarding. As minutas exigem revisao juridica e dados empresariais finais antes do go-live.
- Fase 136 - Sincronizacao em tempo real com a Google Agenda pessoal do profissional: OAuth individual, canais push, sincronizacao inbound resiliente com paginacao e recuperacao de `syncToken`, bloqueios externos, desconexao segura para token revogado, state OAuth com expiracao/uso unico e protecao de webhook. O callback agora usa a URL publica do Render quando a URL explicita nao estiver configurada, e o health reconhece OAuth individual sem refresh token global. A habilitacao final ainda exige credenciais OAuth e redirect URI no Google Cloud de producao.
- Fase 137 - Gate de qualidade do frontend: configurado ESLint nao interativo com `next/core-web-vitals` e `next/typescript`; corrigidos casts inseguros de rotas, tipagem de notificacoes da agenda, dependencias de hooks e imports mortos. O lint passou a ser etapa obrigatoria no job web do GitHub Actions; lint, typecheck, build e teste de autorizacao passaram em 2026-07-26.
- Fase 138 - Atualizacao controlada de dependencias vulneraveis: backend atualizado para NestJS 11.1.28 e TypeORM 0.3.31; a compatibilidade mais estrita de JWT passou a validar duracoes de ambiente e recebeu testes. A auditoria de producao caiu de 6 achados altos, 9 moderados e 1 baixo para um unico achado transitorio.
- Fase 141 - Migracao major do TypeORM: TypeORM 1.1.0 substituiu a linha 0.3, removendo a cadeia transitoria vulneravel; o codemod oficial nao encontrou APIs a transformar e `dotenv/config` foi tornado explicito para o datasource do CLI. Build, typecheck, CLI de migrations e 47 suites/244 testes passaram; o audit de producao backend ficou sem vulnerabilidades.
- Fase 139 - Fortalecimento de contratos de dominio e fronteiras BFF: removidos os `any` de codigo backend de producao com contrato explicito para notificacoes de agenda e `EntityManager` nos convites administrativos. A revisao confirmou que o BFF preserva uma fronteira unica para sessao, renovacao, falha de rede e resposta HTML indevida; backend e web passaram em suas suites e builds completos.
- Fase 140 - Cobertura de confiabilidade e regressao: criada `MATRIZ_CONFIABILIDADE_TESTES.md` e o validador `pnpm test:confiabilidade`, tornando rastreaveis os riscos de tenant, autorizacao, BFF, integracoes, portal clinico e operacoes, seus testes e gates de execucao.
- Fase 142 - Migracao controlada do Next.js: frontend atualizado para Next.js 15.5.22 mantendo React 18.3.1; o codemod oficial converteu APIs dinamicas para `Promise`/`await`, `typedRoutes` foi estabilizado e o output tracing foi delimitado ao frontend. Overrides de PostCSS 8.5.23 e Sharp 0.35.3 eliminaram os achados de auditoria de producao web. O gate `pnpm --dir octaclin-web test:next15` protege parametros dinamicos assincronos. A migracao para Next 16/React 19 permanece futura, pois exige remover o shim temporario de cookies no BFF.
- Fase 143 - Onboarding de profissionais por convite: o portal do cliente solicita nome, registro profissional opcional e especialidade opcional ao convidar um `Professional`; o backend cria em uma unica transacao o usuario, o perfil profissional e o convite. O primeiro login ja recebe escopo de profissional, agenda propria e base para conectar Google Calendar.
- Fase 144 - Agendamento publico por solicitacao: o profissional pode compartilhar um link publico para receber pedidos de horario sem reservar a agenda na hora. A solicitacao fica pendente, a aprovacao interna exige paciente explicito do tenant e a consulta/notificacoes so nascem quando o fluxo normal de agenda cria a consulta aprovada. O token bruto do link nao e persistido; uma nova sessao exige rotacao confirmada para voltar a exibir uma URL copiavel.
- Fase 145 - Painel clinico do profissional e desmarcamento/cancelamento distintos: o dashboard do profissional passou a agregar rotina diaria, pacientes sem retorno (30/60/90+ dias, com risco), tarefas vencidas, formularios pendentes, solicitacoes publicas e comunicacoes em alerta, com `SuperAdmin` podendo selecionar profissional em contexto (sempre auditado). A agenda passou a registrar a origem de cada cancelamento (profissional, paciente ou Google) no historico: o profissional cancela e notifica o paciente pelos canais habilitados; o paciente desmarca a propria consulta pelo portal (identidade so da sessao) e gera um alerta operacional sem PHI ao profissional, sem se autonotificar; o Google cancela sem novo envio. `cancelada` continua o unico desfecho terminal do banco.
- Fase 146 - Gate de acessibilidade e navegacao por teclado (feita pelo Codex na `main`, trazida por merge): suite Playwright cobrindo login, dashboard, agenda interna, portal do paciente e portal do cliente (5 rotas x 2 projetos) valida `main` unico, nome acessivel de botoes/campos, navegacao por Tab sem perda de foco e ausencia de overflow horizontal. Ver `fase-146-gate-acessibilidade.md`.
- Fase 147 - Foco visivel explicito nos inputs crus da agenda: os 4 inputs nativos de `painel-agenda.tsx` (checkbox de notificacoes, nova data/hora, nova duracao, novo local) ganharam a mesma classe `focus-visible:outline...` ja usada em `portal-shell.tsx`/`modal.tsx`, endereçando de forma explicita o achado documentado na Fase 146 em vez de depender apenas da regra CSS global. Ver `fase-147-foco-visivel-inputs-agenda.md`.
- Fase 148 - Foco visivel proprio nos componentes compartilhados de formulario/botao: `Campo`, `AreaTexto`, `Selecao` e `Botao` (usados em 23 arquivos/37 imports do app) ganharam a mesma classe de foco da Fase 147, deixando de depender exclusivamente da regra CSS global. Ver `fase-148-foco-visivel-componentes-compartilhados.md`.
- Fase 149 - Limpeza do canal de watch do Google Calendar ao desconectar: `desconectar()` passou a chamar `pararCanalWatch` (parada tolerante a falha, so loga warning) e a remover o registro de `google_canais_watch` antes de limpar os campos locais, fechando o debito das Fases 136/145 em que a desconexao so limpava estado local sem avisar o Google. Ver `fase-149-limpeza-canal-watch-google-calendar.md`.
- Fase 154 - Hardening OAuth e bootstrap: producao passou a exigir state HMAC
  dedicado no OAuth Google e chave AES no bootstrap administrativo.
- Fase 155 - RLS dos canais de watch Google Calendar: a tabela passou a ter
  isolamento forcado por tenant e os consumidores de webhook/worker foram
  adaptados para estabelecer o contexto correto antes de ler ou renovar canais.
- Fase 157 - Papel PostgreSQL restrito: os backends de staging e producao usam
  logins de aplicacao sem `BYPASSRLS`, permitindo que as policies sejam
  efetivas no runtime.
- Fase 158 - Restore real em banco dedicado: dump custom de `Octaclin-db-producao`
  validado (481 itens) e restaurado em `octaclin_restore_fase158`, sem escrita
  na origem. O procedimento exclui somente `timescaledb`, gerenciado pelo Neon;
  13 tabelas criticas, 54 politicas RLS e 2 usuarios autenticaveis ficaram
  equivalentes. O dump temporario foi removido apos a validacao.

- Fase 159 - Revisao juridico-operacional preparatoria: o pacote passou a ter Termo de Uso, Anexo de Tratamento de Dados e uma revisao rastreavel dos bloqueadores juridicos. O trabalho confirmou aceites versionados, exportacao, auditoria e controles tecnicos, mas preservou como bloqueio a aprovacao por advogado, identidade empresarial, canal de privacidade, bases legais, inventario de suboperadores/transferencias e decisao sobre menores.

- Fase 160 - Redesenho UX/UI e especificacao Penpot: definida a fonte de verdade visual para os portais, agendamento, formularios, console clinico, gestao e modulos avancados. O sistema visual preserva Figtree/Noto Sans, foco visivel, responsividade, componentes reutilizaveis e exemplos exclusivamente sinteticos; o portal do paciente nao deve expor score de risco clinico.

- Fase 161 - Base visual e navegacao compartilhada: o console passou a agrupar modulos em Clinica, Relacionamento e Administracao sem alterar permissoes; `Botao`, `Campo` e `Selecao` adotaram alvo minimo de 44 px e o portal do paciente deixou de exibir score de risco clinico.

- Fase 162 - Portal do paciente orientado a prioridades: a tela inicial passou a destacar proxima acao, proxima consulta e plano em andamento em vez de oito indicadores dispersos, reutilizando os dados existentes e preservando os detalhes nas secoes abaixo.

- Fase 163 - Navegacao mobile do portal do paciente: o celular passou a usar barra inferior com os cinco destinos essenciais, mantendo as abas detalhadas no desktop.

- Fase 164 - Etapas do agendamento publico: o fluxo passou a deixar explicito que a escolha de horario precede o envio da solicitacao e nao confirma consulta automaticamente.

- Fase 165 - Progresso do formulario publico: o paciente passou a ver quantas perguntas obrigatorias ja respondeu, com barra de progresso acessivel e sem nova persistencia.

- Fase 166 - Painel clinico para leitura diaria: indicadores ganharam agrupamento explicito e os controles diarios passaram a respeitar toque e foco consistentes.

- Fase 167 - Agenda interna visual: a agenda profissional ganhou grade semanal
  por profissional, navegacao de semanas e blocos de horario para consultas
  ativas. O Google passou a ser apresentado explicitamente como integracao
  opcional; criacao, remarcacao e cancelamento comunicam o efeito na agenda
  interna.

- Fase 168 - Acesso comercial e onboarding: login e recuperacao de senha
  deixaram de expor API e tenant ao usuario final; o BFF passou a resolver
  backend e organizacao por configuracao exclusiva do servidor, com falha
  fechada em producao. O Render web foi configurado para o backend de producao
  e tenant `octaclin-admin`; deploy e smoke funcional foram aprovados.


- Fase 169 - Disponibilidade e feed completo da agenda: o feed filtra por
  periodo e profissional, apresenta eventos externos apenas como
  `Indisponivel` e permite reservar ou liberar intervalos internos. A agenda
  ganhou visoes de dia, semana e mes. Em producao, as migrations pendentes
  foram alinhadas no Neon e a web foi publicada com acao de liberar horario
  sempre visivel nos bloqueios internos.

- Fase 170 - Integridade historica de formularios: cada envio novo preserva
  um snapshot imutavel da versao, titulo, descricao, perguntas, configuracoes
  e opcoes. Formularios publicos e a leitura de respostas preferem essa
  estrutura historica, com fallback compativel para envios anteriores. A
  migration `1720000001007` foi aplicada no Neon de producao e o backend
  publicado pelo Render no commit `ceffdce`.

- Fase 171 - Biblioteca de perguntas reutilizaveis: perguntas do tenant podem
  receber chave clinica e visibilidade na biblioteca, ser encontradas por busca
  ou categoria e incluidas como copias independentes com configuracao e opcoes.
  A migration `1720000001008` foi aplicada no Neon de producao e backend/web
  foram publicados pelo Render no commit `af7d337`.

- Fase 172 - Check-ins recorrentes por paciente: a recorrencia passou a exigir
  e persistir o paciente alvo, criando somente um envio por execucao. Regras
  legadas sem paciente sao desativadas e profissionais respeitam o paciente sob
  sua responsabilidade. A migration `1720000001009` foi aplicada no Neon de
  producao e o commit `56bc06d` foi publicado pelo Render.

- Fase 173 - Matriz longitudinal de respostas: filtros por paciente,
  questionario, categoria e periodo agora comparam valores atuais e anteriores
  somente de indicadores numericos estaveis, preservando o escopo do
  profissional e a compatibilidade com respostas historicas. Backend e web
  foram publicados pelo Render no commit `b34113f`.

- Fase 174 - Check-ins consolidados no prontuario: respostas de formularios e
  registros de diario rapido agora compartilham a mesma linha do tempo clinica,
  sem migracao entre tabelas e com contador proprio no resumo do paciente.
  Backend e web foram publicados pelo Render no commit `0eb4d43`.

## Estado atual de uso

O sistema esta em producao isolada aceita, com massa ficticia mantida fora do banco de producao, piloto interno aprovado, restore real validado e pacote juridico ampliado. A agenda agora tambem aceita solicitacoes publicas com aprovacao manual segura, sem reservar horario nem persistir token bruto, e distingue cancelamento pelo profissional de desmarcamento pelo paciente e de cancelamento originado no Google. O profissional conta com um painel clinico diario agregando prioridades da propria agenda de pacientes. Ainda nao deve ser tratado como 100% pronto para clientes reais de consultoria: faltam recorrencia operacional de backup, dominio/identidade de envio, aceite juridico formal e go-live assistido.

## Como atualizar este arquivo

- Ao concluir uma nova fase, adicionar uma linha objetiva na secao correspondente.
- Se uma fase alterar uma decisao arquitetural, atualizar tambem `Decisoes de arquitetura ja consolidadas`.
- Manter linguagem factual, sem depender de memoria da conversa.
