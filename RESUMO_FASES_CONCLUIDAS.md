# OctaClin - Resumo das fases concluidas

Atualizado em 2026-08-01 apos a Fase 197 - racionalizacao dos modulos avancados.

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

- Fase 175 - Separacao UX do modulo de formularios: a experiencia foi dividida
  em Montagem, Biblioteca, Distribuicao e Respostas, mantendo os endpoints e
  componentes existentes e isolando a leitura clinica do trabalho de edicao.
  Backend e web foram publicados pelo Render no commit `84bbbef`.

- Fase 176 - Validacao ponta a ponta de formularios e check-ins: a cobertura
  de questionarios, check-ins e prontuario foi reexecutada junto das jornadas
  criticas desktop/mobile. A validacao revelou e corrigiu a leitura sincrona de
  `cookies()` no BFF, que causava sessao ausente em rotas autenticadas no
  Next.js 15. O acesso agora aguarda a API dinamica na fronteira compartilhada;
  os fluxos de agenda, portal e demais BFFs autenticados herdam a correcao.
  A web foi publicada no commit `9e6f227` e o health check retornou `200`.

- Fase 177 - Qualidade transversal e componentes compartilhados: campos,
  selects e textareas passaram a comunicar estados invalido e desabilitado;
  feedback agora inclui sucesso, carregamento anunciado e permissao negada.
  As abas reutilizaveis oferecem navegacao por setas, Home e End, com foco e
  relacionamentos ARIA; o editor de formularios foi migrado para essa base. A
  web foi publicada no commit `ebd7887` e o health check retornou `200`.

- Fase 178 - Agenda profissional completa: a agenda interna ganhou a visao de
  lista e detalhes de consulta em modal, mantendo dia, semana e mes. O modal
  concentra situacao da integracao Google, contato, local e remarcacao; os
  desfechos de concluir, falta e cancelamento usam confirmacao acessivel. Ao
  cancelar, o horario interno e liberado e somente as integracoes configuradas
  sao processadas. A web foi publicada no commit `b0e3144` e o health check
  retornou `200`.

- Fase 179 - Lista de pacientes: o retorno de pacientes agora inclui ultima
  consulta concluida e proxima consulta ativa dentro do tenant e do escopo do
  profissional. A lista passou a ter busca, filtros, atalhos de prioridade,
  proxima acao explicita, tabela desktop e leitura adequada no celular. Backend
  e web foram publicados no commit `0dcb17a`; ambos os health checks
  retornaram `200`.

- Fase 180 - Prontuario clinico: o prontuario passou a separar resumo,
  evolucoes, plano, formularios, mensagens, materiais e historico em abas
  acessiveis. O cabecalho clinico permanece visivel com acoes rapidas e o
  resumo abre com uma Linha de cuidado compacta, reduzindo a densidade sem
  duplicar dados. A web foi publicada no commit `a0b3f1a` e o health check
  retornou `200`.

- Fase 181 - Portal completo do paciente: navegacao por tarefas no desktop e
  celular passou a direcionar agenda, check-ins, plano, formularios, mensagens,
  perfil e privacidade sem expor risco clinico. A web foi publicada no commit
  `9549a50`; `/health` retornou `200`.

- Fase 182 - Agendamento e formularios publicos: o paciente visualiza fuso e
  horario selecionado com semantica acessivel e recebe confirmacao honesta de
  solicitacao, sem reserva prematura. Formularios publicos preservam respostas
  na tela apos falha de envio e mostram expiracao quando o backend a fornece.
  O commit `c869591` foi enviado para publicacao; rascunho persistente e marca
  configuravel da clinica aguardam suporte contratual da API.

- Fase 183 - Editor de formularios completo: o editor passou a indicar versao,
  rascunho/publicacao/arquivamento e alteracoes pendentes separadas para o
  formulario e a pergunta em edicao. Preview, distribuicao, biblioteca e
  respostas continuam isolados; a alca de reordenacao preserva teclado e foco
  visivel. O commit `edb2391` foi enviado para deploy no Render.

- Fase 184 - Central de comunicacoes: o inbox passou a permitir busca por
  paciente, contato ou mensagem e filtros para entrada, acompanhamento e falha,
  mantendo templates aprovados, contexto clinico e estados de entrega. O commit
  `72e6d18` foi enviado para deploy no Render.

- Fase 185 - Profissionais, permissoes e integracoes: a lista explica a
  capacidade de gerir equipe, nao expoe ID interno e mostra ao SuperAdmin o
  estado conectado/desconectado da Google Agenda por profissional. O contrato
  nao retorna tokens ou dados de calendario. O commit `806d676` foi enviado
  para deploy no Render.

- Fase 186 - Conta, assinatura e ativacao: o portal comercial consolida conta,
  equipe, assinatura, consumo, configuracoes e perfil fiscal por capacidade.
  Convites suportam a ativacao e o historico nao exibe IDs internos. O commit
  `0954847` foi enviado para deploy no Render.

- Fase 187 - Modulos avancados: automacoes, IA, operacoes, mobile e
  gamificacao mantem fluxos proprios; a IA agora explicita que seus resultados
  exigem revisao profissional antes de qualquer conduta. O commit `43d59df`
  foi enviado para deploy no Render.

- Fase 188 - Validacao de usabilidade: as 10 jornadas criticas e os 10 cenarios
  de acessibilidade desktop/mobile passaram, junto de 22 verificacoes de
  autorizacao. Os seletores das jornadas foram alinhados ao redesenho do portal.

- Fase 190 - Arquitetura de navegacao e sistema visual definitivo: o console
  passou a agrupar a rotina em Clinica, Relacionamento, Gestao e SuperAdmin,
  com contexto da sessao, atalhos por permissao, menu de conta e carregamento
  compartilhado. IA, Mobile e Gamificacao continuam autorizados por rota, mas
  sairam do menu diario. O commit de implementacao e `e371ae0`.

- Fase 191 - Acesso e ativacao do usuario: `/login`, `/esqueci-senha`,
  `/recuperar-senha` e `/primeiro-acesso` passaram a compartilhar um shell de
  autenticacao unico (`AuthShell`). Campos de senha ganharam botao de
  mostrar/ocultar e aviso de Caps Lock (`CampoSenha`). O tratamento de link
  expirado/invalido foi unificado entre recuperacao de senha e primeiro
  acesso (`classificarFalhaToken`/`EstadoFalhaToken`), e o primeiro acesso do
  paciente passou a ter 2 etapas (senha, aceites legais) com foco anunciado a
  leitor de tela em cada transicao. Revisao de seguranca focada nao encontrou
  achado introduzido pela fase.

- Fase 192 - Centro clinico diario e agenda profissional: o dashboard do
  profissional foi reagrupado em Agora, Proximos e Pendentes, priorizando fila
  clinica e atendimentos do dia acima dos indicadores agregados (movidos para
  o final). Na agenda, criacao de consulta virou modal ("Nova consulta") e a
  edicao duplicada na lista foi consolidada num unico botao "Gerenciar
  consulta" que abre o mesmo modal do calendario; liberar horario reservado
  passou a exigir confirmacao. A correcao encontrada durante a validacao (o
  componente `Modal` compartilhado sem scroll/max-height) beneficia todo uso
  existente de modal no app.

- Fase 193 - Pacientes e prontuario orientados a conduta: filtros da lista de
  pacientes passaram a sincronizar com a URL (persistem em reload/navegacao);
  cadastro/edicao de paciente virou modal; evolucao clinica em edicao ganhou
  protecao contra perda (aviso nativo ao fechar a aba, confirmacao ao trocar
  de aba do prontuario ou voltar para a lista). Corrigidos os atalhos do
  dashboard `#novo-paciente` e `#novo-agendamento`, que tinham parado de abrir
  o formulario correto apos os formularios virarem modal nas Fases 190/192.
- Fase 194 - Formularios, editor e leitura longitudinal: o editor de
  questionarios (1593 linhas, ~35 `useState` em um unico componente) foi
  dividido em 5 areas (Formularios/Editor/Biblioteca/Distribuicoes/
  Respostas) sobre um hook unico de estado (`useWorkspaceQuestionarios`).
  O preview do paciente passou a ficar simultaneo a edicao (sem toggle). O
  campo de cron cru, que aparecia duas vezes na tela, virou um seletor de
  recorrencia em linguagem comum (frequencia/dia da semana/horario) sem
  mudar o contrato do backend. A guarda de alteracoes nao salvas, que so
  tinha um banner de texto sem enforcement, ganhou `beforeunload` +
  confirmacao real (mesmo padrao da Fase 193). Ver
  `fase-194-formularios-editor-leitura-longitudinal.md`.
- Fase 195 - Portal do paciente e jornadas publicas: portal autenticado
  dividido em nove rotas com um unico bootstrap e navegacao mobile propria;
  inicio focado nas tres prioridades e sem score clinico. Agendamento publico
  com identidade/fuso e revisao antes da solicitacao. Formulario publico com
  rascunho versionado no backend, retomada apos reload, validacao estrutural,
  limite de abuso, BFF sem credenciais e limpeza ao responder ou expirar. Ver
  `fase-195-portal-paciente-jornadas-publicas.md`.
- Fase 196 - Comunicacoes, equipe e conta do cliente: comunicacoes passaram a
  abrir em conversas, com composicao e configuracoes separadas, nova tentativa
  pela mensagem falha e estado persistido de entrega. Profissionais ganharam
  diretorio, disponibilidade e integracoes; arquivamento revoga o acesso. O
  portal comercial foi dividido em oito tarefas e passou a permitir ajuste
  auditado entre equipe administrativa e profissional, sem IDs ou papeis
  internos na interface. Ver `fase-196-comunicacoes-equipe-conta.md`.
- Fase 197 - Racionalizacao dos modulos avancados: IA passou a persistir fonte,
  limitacoes e decisao humana de aceitar, editar ou rejeitar antes de liberar
  alerta ou acao subsequente. Automacoes nascem inativas e exigem simulacao
  persistida. Mobile foi absorvido por Operacoes e passou a respeitar escopo
  por paciente/profissional; a idempotencia tambem foi isolada por paciente.
  Gamificacao virou opt-in, com comunidade e ranking desligados por padrao.
  Operacoes foi dividida em Saude, Incidentes, Comunicacoes, LGPD, Auditoria e
  Filas. Ver `fase-197-racionalizacao-modulos-avancados.md`.
- Fase 198 - Validacao final de usabilidade e consolidacao visual: o usuario
  confirmou em 2026-08-02 o aceite das jornadas e gates do bloco 191-197. As
  evidencias tecnicas permanecem nos documentos individuais e em
  `TESTES_E_VALIDACOES.md`; o aceite nao declara execucoes adicionais de testes.
  Ver `fase-198-validacao-usabilidade-consolidacao-visual.md`.

- Fase 199 - Busca, filtros e paginacao server-side:
  pacientes ganharam indice cego por tenant para pesquisar nome e contato sem
  descriptografar a tabela; filtros e paginacao passaram a ocorrer no backend
  antes da resposta. Profissionais e formularios tambem ganharam paginacao
  server-side. No banco exclusivo `octaclin_test_fase150b`, a migration `1013`
  foi aplicada, 503 pacientes foram reindexados e a busca em 500 pacientes
  sinteticos levou 133,7 ms apos o backfill, sem atravessar o escopo do
  profissional. Em producao, a migration `1013` foi aplicada no banco
  explicitamente confirmado; o backfill atualizou 1 paciente e a repeticao
  idempotente atualizou 0.

## Estado atual de uso

O sistema esta em producao isolada aceita, com massa ficticia mantida fora do banco de producao, piloto interno aprovado, restore real validado e pacote juridico ampliado. A agenda agora tambem aceita solicitacoes publicas com aprovacao manual segura, sem reservar horario nem persistir token bruto, e distingue cancelamento pelo profissional de desmarcamento pelo paciente e de cancelamento originado no Google. O profissional conta com um painel clinico diario agregando prioridades da propria agenda de pacientes. Ainda nao deve ser tratado como 100% pronto para clientes reais de consultoria: faltam recorrencia operacional de backup, dominio/identidade de envio, aceite juridico formal e go-live assistido.

## Como atualizar este arquivo

- Ao concluir uma nova fase, adicionar uma linha objetiva na secao correspondente.
- Se uma fase alterar uma decisao arquitetural, atualizar tambem `Decisoes de arquitetura ja consolidadas`.
- Manter linguagem factual, sem depender de memoria da conversa.
