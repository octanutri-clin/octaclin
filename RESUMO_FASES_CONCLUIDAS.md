# OctaClin - Resumo das fases concluidas

Atualizado apos a Fase 130.

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
- Fase 130 - Piloto interno controlado: criado `RUNBOOK_PILOTO_INTERNO.md` com participantes, perfis, jornadas, criterios de sucesso/bloqueio e processo de aceite, alem de `PILOTO_INTERNO_CONTROLE.md` como acompanhamento vivo da rodada do piloto e validador documental `test-piloto-interno.mjs`. Nenhuma rodada real foi executada ainda.

## Estado atual de uso

O sistema esta em estado avancado de staging funcional, mas ainda nao deve ser tratado como 100% pronto para clientes reais de consultoria. Antes de producao real, ainda faltam executar restore real em banco dedicado, aplicar/validar a massa ficticia no Neon staging, executar a primeira rodada real do piloto interno controlado e registrar aceite, e separar formalmente staging/producao.

## Como atualizar este arquivo

- Ao concluir uma nova fase, adicionar uma linha objetiva na secao correspondente.
- Se uma fase alterar uma decisao arquitetural, atualizar tambem `Decisoes de arquitetura ja consolidadas`.
- Manter linguagem factual, sem depender de memoria da conversa.
