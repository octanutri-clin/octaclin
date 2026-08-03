# OctaClin - Status atual do projeto

Atualizado em 2026-08-03.

## Snapshot

- Produto: OctaClin.
- Repositorio: `octanutri-clin/octaclin`.
- Branch principal: `main`.
- Fase 204 (parcial): data fetching e resiliencia, em 2026-08-03. Hook
  `useRequisicaoCancelavel` (AbortController + sequencia) extraido e
  aplicado em `portal-cliente.tsx` (5 loaders) e `agenda-semanal.tsx`
  (feed); `error.tsx`/`loading.tsx` na raiz; 2 Suspense com fallback nulo
  corrigidos; 2 estados derivados movidos para render; teste de race
  condition novo. Lint, typecheck, build, test:a11y (10/10) e 90 testes
  Playwright aprovados. Falta: `painel-operacoes.tsx` (~15 loaders),
  demais monolitos, next/dynamic no portal do paciente. Ver
  `fase-204-data-fetching-resiliencia-code-splitting.md`.
- Ultima fase concluida: Fase 203 - componentes compartilhados e fim dos
  sistemas paralelos, em 2026-08-03 (2 rodadas). 7 componentes novos
  (Aviso, EtiquetaStatus, Avatar, Dica, Menu, CabecalhoSecao, Metrica),
  zero `window.confirm` no repo, botoes ad hoc unificados via
  `classesBotao`, Aviso/Metrica adotados nos pontos citados no
  diagnostico, tooltips migrados para Dica; lint, typecheck, build,
  test:a11y (10/10) e 88 testes Playwright de regressao aprovados. Debito
  tecnico de baixo risco (nao bloqueia producao): linhas de 1000+
  caracteres de `painel-dashboard.tsx`, adocao ampla de CabecalhoSecao. Ver
  `fase-203-componentes-compartilhados-fim-sistemas-paralelos.md`.
- Fase 202: sistema visual (tokens, tipografia e
  elevacao), em 2026-08-02. Tokens semanticos, escala tipografica/raio/sombra,
  troca para IBM Plex Sans+Mono, cartao/sidebar/botao/agenda atualizados; lint,
  typecheck, build, gate de acessibilidade (10/10) e regressao do portal do
  cliente (8/8) aprovados. Ver `fase-202-sistema-visual-tokens-tipografia-elevacao.md`.
- Fase 200: upload seguro e anexos clinicos, em 2026-08-02. O bucket privado
  Backblaze B2, os fluxos autenticado e publico e a exclusao foram validados
  em producao. A migration `1014` esta aplicada em producao e no banco de
  integracao `octaclin_test_fase150b`, com historico de 27 de 27 migrations
  executadas.
- Fase 201: implementacao local concluida em 2026-08-02. O rollout ainda exige
  separar o backend Render como `web` e criar um `worker` com Redis compartilhado
  antes de permitir escala horizontal; ver
  `fase-201-confiabilidade-processadores-multiplas-instancias.md`.
- Fase 194: formularios, editor e leitura longitudinal (2026-08-01). O editor
  de questionarios (1593 linhas
  monoliticas) foi dividido em 5 areas (Formularios/Editor/Biblioteca/
  Distribuicoes/Respostas) sobre um hook unico de estado
  (`useWorkspaceQuestionarios`); o preview do paciente passou a ser
  simultaneo a edicao; o campo de cron cru virou um seletor de recorrencia
  em linguagem comum; e a guarda de alteracoes nao salvas (que so tinha
  banner de texto) ganhou `beforeunload` + confirmacao real, como na Fase
  193. Cobertura Playwright nova para essa pagina (0 testes antes, 6 agora).
- Fase 193: pacientes e prontuario orientados a conduta (2026-07-31).
  Filtros da lista de pacientes agora persistem na URL; cadastro/edicao de
  paciente virou modal; evolucao clinica em edicao ganhou protecao contra
  perda (beforeunload + confirmacao ao trocar de aba/sair). Corrigidos os
  atalhos `#novo-paciente`/`#novo-agendamento` do dashboard.
- Fase 192: centro clinico diario e agenda profissional (2026-07-31).
  Dashboard reagrupado em Agora/Proximos/Pendentes; agenda com criacao em
  modal, edicao consolidada num unico botao "Gerenciar consulta" e
  confirmacao ao liberar horario reservado. Corrigido tambem um bug de mobile
  no componente `Modal` compartilhado (sem scroll/max-height).
- Fase 191: acesso e ativacao do usuario (2026-07-31). Login, recuperacao de
  senha e primeiro acesso do paciente compartilham um shell de autenticacao
  unico, com mostrar/ocultar senha, aviso de Caps Lock, tratamento unificado
  de link expirado/invalido e ativacao do paciente em 2 etapas (senha, aceites
  legais).
- Fase 190: arquitetura de navegacao e sistema visual definitivo (2026-07-31).
  O console separa Clinica, Relacionamento, Gestao e SuperAdmin, com contexto
  da sessao e atalhos por permissao.
- Fase 148: Foco visivel proprio nos componentes compartilhados `Campo`/`AreaTexto`/`Selecao`/`Botao` (entregue em 2026-07-27, PR #5 aberto para `main`).
- Fase 147: Foco visivel explicito nos inputs crus da agenda (entregue em 2026-07-27). Antes dela, esta branch recebeu por merge a Fase 146 (gate de acessibilidade, feita pelo Codex na `main`).
- Fase 145: Painel clinico do profissional e desmarcamento/cancelamento distintos (entregue em 2026-07-27, commit `22e161b` da Task 5).
- Fase 131 aceita: producao isolada de staging confirmada em 2026-07-26, com Neon, Upstash e Render independentes, credenciais rotacionadas e ambiente/banco auditados sem staging. A integracao Google Calendar de producao foi posteriormente configurada, conectada e validada.
- Melhoria continua: Fases 138, 141 e 142 concluidas. NestJS 11.1.28, TypeORM 1.1.0 e Next.js 15.5.22 foram validados; as auditorias de producao de backend e web estao zeradas. A proxima migracao de framework sera Next.js 16/React 19, em fase dedicada por exigir refatoracao assincrona do BFF.
- Fase 139 concluida: contratos de agenda e convite administrativo passaram a ser tipados sem `any` em codigo de producao; o BFF preserva uma fronteira central para sessao, renovacao e falhas de backend.
- Fase 140 concluida: matriz rastreavel de riscos, testes e gates para tenant, autorizacao, BFF, integracoes, portal e operacoes.
- Fase 143 concluida: convites `Professional` agora criam o perfil clinico vinculado ao login, deixando agenda, escopo de dados e Google Calendar prontos apos o primeiro acesso.
- Fase 144 concluida: agenda publica por solicitacao entrou no fluxo critico com aprovacao manual segura. A solicitacao publica nao reserva horario, a aprovacao exige paciente explicito do tenant e consulta/notificacoes continuam sendo geradas apenas pela criacao normal da agenda. O token bruto do link nao e persistido e a URL copiavel requer rotacao confirmada em sessao nova.
- Fase 142 concluida: APIs dinamicas do App Router foram migradas para `Promise`/`await`, com gate de regressao, build de producao validado e auditoria web sem vulnerabilidades.
- Fase 145 concluida: painel clinico diario por profissional (filas de retorno,
  risco, tarefas, formularios, solicitacoes publicas e comunicacoes) e a agenda
  passou a distinguir cancelamento pelo profissional (notifica o paciente),
  desmarcamento pelo paciente (alerta nao-PHI ao profissional, sem notificar o
  proprio paciente) e cancelamento originado no Google (sem novo envio).
- Proxima fase critica: Fase 132 - Dominio, SSL e identidade de envio. A configuracao tecnica de DNS permanece pendente ate a definicao do dominio oficial.
- Estado: producao tecnica acessivel, mas ainda nao liberada para clientes reais.

## O que esta funcional

- Login unificado por perfil.
- Permissoes finas para Client, Professional e Collaborator.
- Ajuste auditado entre acesso profissional e equipe administrativa.
- BFF com cookies HttpOnly.
- Roteamento por papel.
- Console operacional.
- Dashboard inicial do profissional.
- Cadastros de pacientes e profissionais.
- Prontuario/linha do tempo do paciente para profissional.
- Evolucoes/anotacoes clinicas privadas no prontuario.
- Planos de acompanhamento com tarefas/metas/check-ins prescritos no prontuario.
- Biblioteca de materiais educativos e envio de materiais ao paciente pelo prontuario.
- Questionarios, modelos, preview, respostas e leitura clinica.
- Portal autenticado do paciente.
- Historico, perfil, LGPD e protocolos no portal do paciente.
- Portal do cliente.
- Resumo real da conta do cliente.
- Configuracoes da conta do cliente.
- Perfil fiscal da empresa/consultoria do cliente.
- Gestao de usuarios administrativos do cliente.
- Convites administrativos por email.
- Reenvio e revogacao de convites administrativos.
- Historico e exportacao CSV de convites administrativos.
- Modelo de planos SaaS por tenant.
- Calculo de uso, limites e alertas de assinatura no portal do cliente.
- Solicitacao comercial manual de upgrade/revisao de limite no portal do cliente.
- Controle manual administrativo de assinatura no painel operacional.
- Bloqueios suaves de assinatura/limite para novas criacoes de usuarios administrativos e pacientes.
- Agenda interna com integracao Google Calendar.
- Agenda com conflito local por profissional, remarcacao e cancelamento sincronizados com Google Calendar quando configurado.
- Agenda publica por solicitacao, com link compartilhavel, fila interna de aprovacao manual e criacao de consulta so apos selecao explicita de paciente.
- Comunicacoes por email.
- WhatsApp Meta com envio, webhook, status, inbox, associacao e notas.
- Painel operacional LGPD.
- Auditoria e outbox operacional.
- Sugestoes assistidas de IA com fonte, limitacoes e revisao humana obrigatoria.
- Automacoes em rascunho com simulacao persistida antes da ativacao.
- Gamificacao opcional por tenant, com comunidade e ranking desligados por padrao.
- Operacoes SuperAdmin separadas em Saude, Incidentes, Comunicacoes, LGPD,
  Auditoria e Filas; sincronizacao mobile fica nessa area administrativa.
- Runbooks de producao, backup/restore, rotacao de secrets e suporte.
- Suite Playwright de jornadas criticas com contratos BFF mockados.
- Massa ficticia de staging aplicada e validada no Neon staging (tenant `octaclin-staging`).
- Piloto interno controlado: runbook, controle de acompanhamento, validador documental e rodada 1 aprovada em 2026-07-23.
- Escopo de dados por profissional responsavel (`pacientes_responsaveis`) aplicado e testado em pacientes, agenda, gamificacao, profissionais, questionarios, materiais, comunicacoes e automacoes.
- Producao isolada de staging: banco Neon, Redis Upstash e servicos Render de producao aceitos; runtime, secrets exclusivos e ausencia de staging foram revalidados na Fase 131.
- Sincronizacao em tempo real com a Google Agenda pessoal do profissional (Fase 136, 2026-07-25): conexao OAuth individual por profissional, notificacao push do Google, eventos externos viram bloqueio de horario, mudancas feitas direto no Google aplicam automaticamente na consulta correspondente.
- CI do GitHub verde em `701ed6b` (2026-07-26): backend, web, mobile, IA e demo local smoke, incluindo UI, BFF e Playwright.
- Gate de qualidade web: lint nao interativo com as regras estritas recomendadas pelo Next.js, typecheck, build e teste de autorizacao de rotas; o lint agora tambem e exigido no CI.
- Regressao critica de agenda em 2026-07-27: 8 testes Playwright aprovados em desktop/mobile, incluindo a nova jornada publica -> aprovacao interna -> portal do paciente.

## O que ainda falta antes de producao real

- Gateway de pagamento definitivo, se a operacao manual deixar de ser suficiente.
- Recorrencia avancada e importacao inbound do Google Calendar por `syncToken`.
- Recorrencia operacional de backup e restore semanal conforme o runbook.
- Producao isolada de staging.
- Dominio, SSL e identidade de envio.
- Aceite juridico formal, identidade empresarial, canal de privacidade e publicacao das versoes legais.
- Go-live assistido.
- Migracao futura para Next.js 16/React 19, incluindo a remocao do shim temporario de cookies usado no BFF.

## Ambientes e provedores

- GitHub privado como fonte de verdade.
- Render para hospedagem.
- Neon PostgreSQL para banco.
- Upstash Redis para Redis/fila/cache.
- Gmail SMTP/Gmail API para email.
- Meta WhatsApp Cloud API para WhatsApp.
- Google Calendar para agenda.

## Arquivos essenciais

- `AGENTS.md`: guia para agentes de IA.
- `RESUMO_FASES_CONCLUIDAS.md`: retrospectiva.
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`: roadmap vivo.
- `DIAGNOSTICO_MELHORIAS_FASES_199_218.md`: diagnostico de design, frontend e
  produto feito em 2026-08-01 sobre o codigo real, com as Fases 199 a 218 em
  ordem de prioridade, skill/agente por fase e decisoes de "nao fazer".
- `PREFLIGHT_PRODUCAO.md`: prontidao por area e gates de fase.
- `HANDOFF-TECNICO-OCTACLIN.md`: handoff tecnico.
- `DECISOES_ARQUITETURA.md`: decisoes.
- `MAPA_ROTAS_PERMISSOES.md`: rotas e permissoes.
- `TESTES_E_VALIDACOES.md`: comandos de validacao.
- `RUNBOOK_PRODUCAO.md`: operacao.
- `RUNBOOK_BACKUP_RESTORE.md`: backup PostgreSQL/Neon e restore de teste.
- `RUNBOOK_SUPORTE.md`: suporte para login, convites, senha, WhatsApp, email e agenda.
- `RUNBOOK_STAGING_DADOS.md`: massa ficticia de staging para demonstracao e QA.
- `RUNBOOK_PILOTO_INTERNO.md`: processo do piloto interno controlado antes da producao real.
- `PILOTO_INTERNO_CONTROLE.md`: acompanhamento vivo da rodada atual do piloto interno.
- `RUNBOOK_PRODUCAO_ISOLADA.md`: como criar banco, Redis e servicos Render de producao separados de staging.
- `PRODUCAO_ISOLADA_CONTROLE.md`: acompanhamento vivo do provisionamento de producao isolada.
- `VARIAVEIS_AMBIENTE.md`: env vars sem secrets.
- `CHECKLIST_GO_LIVE.md`: liberacao para clientes reais.
- `ONBOARDING_DESENVOLVEDOR.md`: entrada de novos desenvolvedores/agentes.
- `COORDENACAO_DESENVOLVIMENTO_IA.md`: regras para trabalho alternado entre pessoas e IAs.
- `PACOTE_PROXIMAS_FASES_DESENVOLVEDOR.md`: pacote multifase para o desenvolvedor seguir enquanto outros agentes ficam pausados.
- `MENSAGEM_HANDOFF_DESENVOLVEDOR.md`: texto pronto para repassar o contexto do projeto.
- `FERRAMENTAS_E_PLUGINS_RECOMENDADOS.md`: ferramentas, plugins e acessos recomendados.
- `DEVELOPMENT_LOG.md`: diario curto de fases concluidas por desenvolvedores/agentes.
- `RETORNO_APOS_DESENVOLVEDOR.md`: checklist para retomada apos trabalho externo.

## Risco principal atual

O sistema ja tem muita capacidade funcional, piloto interno aprovado, producao isolada aceita, restore real validado e pacote juridico ampliado, mas ainda precisa de recorrencia operacional de backup, dominio/identidade de envio, aceite juridico formal e go-live assistido antes de uso comercial com clientes reais.

Proxima pendencia tecnica: rollout da Fase 201 no Render (separar os papeis
`web` e `worker` e registrar a entrega sintetica unica exigida pelo aceite)
e concluir a Fase 204 (aplicar o hook de cancelamento em
`painel-operacoes.tsx` e nos demais monolitos, next/dynamic no portal do
paciente).
