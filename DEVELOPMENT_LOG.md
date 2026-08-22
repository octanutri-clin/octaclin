# OctaClin - Development Log

Use este arquivo como diario curto quando outro desenvolvedor ou agente de IA assumir fases.

## Fase 254 - Incremento 3: visoes salvas e duplicidade

- Responsavel: Codex.
- Conclusao tecnica: 2026-08-22.
- Entrega: BFF e interface de visoes pessoais/clinica, filtro desatualizado,
  duplicidade consultiva com decisao humana e auditoria somente por UUID.
- Validacoes: backend 147 suites/1.018 testes; builds/typechecks; contratos,
  linguagem, base visual, Playwright 10/10 da fase e 10/10 de acessibilidade;
  smoke real; Chrome DevTools e Lighthouse 100 desktop/mobile.
- Revisao: achados independentes de seguranca/frontend corrigidos antes do PR;
  UUIDs de dispensa sao recalculados no backend e as jornadas provam debounce,
  anuncio acessivel, responsavel paginado e arquivamento confirmado.
- Integracao: PR `#102` integrado no merge `baf40ef`; CI `32590205628`
  integralmente aprovado, incluindo `Demo local smoke` em 4m18s.
- Proxima entrega: Fase 255 - prontuario clinico orientado a linha de cuidado.

## Fase 254 - Incremento 2: rotas e formulario proprio

- Responsavel: Codex.
- Conclusao: 2026-08-22.
- Entrega: rotas separadas de criacao/edicao, autorizacao especifica,
  componentes menores e rascunho de PII limitado a `sessionStorage`.
- Producao: PR `#101` integrado no merge `d0ec8c5`.

## Fase 254 - Incremento 1: fundacao de pacientes

- Responsavel: Claude Code, com aceite operacional do usuario.
- Conclusao: 2026-08-22.
- Entrega: filtros salvos pessoais/da clinica, verificacao compartilhada de
  duplicidade, rotas backend, RLS forcada e migration `1035`.
- Producao: PR `#93` integrado; migration aplicada e health com 48 migrations.
- Operacao relacionada: PRs `#98` e `#100` reduziram comandos Redis dos workers
  ociosos e documentaram as regras de Redis e DDL.
- Proxima entrega: Fase 254, Incremento 2 - rotas proprias e quebra do
  componente de pacientes.

## Regra

- Registrar uma entrada por fase concluida.
- Manter entradas objetivas.
- Nao registrar secrets, tokens, senhas, dumps ou dados reais de pacientes.
- O checklist oficial continua sendo `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`.

## Modelo de entrada

```md
## Fase XXX - Nome da fase

- Responsavel:
- Inicio:
- Conclusao:
- Commit:
- Push: sim/nao
- Validacoes:
- Arquivos principais:
- Pendencias:
- Proxima fase:
```

## Entradas

### Fase 253 - Agenda clinica confiavel e operacional

- Responsavel: Codex, com revisoes read-only de backend/seguranca e frontend.
- Inicio, conclusao e aceite de producao: 2026-08-21.
- Commits: `30fc9df`, `e469996`; merge `ea6ed129228cd10fd845cd01fed245cbce634a4e`.
- Push: PR `#91` integrada depois da migration e dos sete jobs verdes.
- Validacoes: 87 testes focados backend, builds backend/web, sete scripts de
  autorizacao, 2 jornadas Playwright, gate de acessibilidade, Chrome DevTools,
  preflight SQL isolado e varredura de segredos.
- Arquivos principais: servicos/controladores da agenda e Google, migration
  `1034`, BFF e componentes da agenda, testes e documento da fase.
- Migration: `1034` aplicada e verificada em producao com `neondb_owner`;
  TypeORM em 47/47, funcao minima e RLS/FORCE RLS aprovados.
- Producao: deploys saudaveis, 47 migrations registradas, BFF protegido, link
  publico com falha controlada e monitor `32508654126` aprovado.
- Pendencias: nenhuma da fase. Suite completa backend tem somente a falha TACO
  por `LF/CRLF` preexistente no Windows.
- Proxima fase: Fase 254 - lista e cadastro robusto de pacientes.

### Fase 252 - Arquitetura de navegacao e descoberta de funcionalidades

- Responsavel: Codex.
- Inicio e conclusao: 2026-08-21.
- Commit: registrado no historico Git desta fase.
- Push: por PR, conforme ruleset da `main`.
- Validacoes: typecheck, lint sem erros, build, autorizacao, base visual,
  linguagem, 4 cenarios Playwright, 10 cenarios de acessibilidade, Chrome
  DevTools, Lighthouse 100 e Penpot.
- Arquivos principais: catalogo canonico, shells, paleta, autorizacao de rotas,
  testes da navegacao e documento da fase.
- Pendencias: nenhuma da fase; Browser MCP apresentou falha local de bootstrap,
  coberta por Chrome DevTools e Playwright.
- Proxima fase: Fase 253 - agenda clinica confiavel e operacional.

### Fase 251 - Revisao integral de linguagem e microcopy

- Responsavel: Codex.
- Inicio e conclusao: 2026-08-21.
- Commit: registrado no historico Git desta fase.
- Push: por PR, conforme ruleset da `main`.
- Validacoes: gate AST e testes unitarios de linguagem, lint sem erros,
  typecheck, build, Playwright desktop/mobile, 10 cenarios de acessibilidade,
  regressoes das Fases 248/249 e Lighthouse 100.
- Arquivos principais: `GUIA_VOZ_MICROCOPY.md`, scripts de linguagem,
  superficies TSX, teste Playwright e CI.
- Pendencias: nenhuma da fase; 53 avisos preexistentes de hooks permanecem fora
  do escopo.
- Proxima fase: Fase 252 - arquitetura de navegacao e descoberta de
  funcionalidades.

### Fase 250 - Encerramento da divida Mobile e higiene de PRs

- Responsavel: Codex.
- Inicio e conclusao: 2026-08-20.
- Commit: registrado no historico Git desta fase.
- Push: por PR, conforme ruleset da `main`.
- Validacoes: advisories e npm revalidados; install congelado, Expo Doctor,
  typecheck, seis testes do gate, auditoria, alinhamento, bundles Android/iOS/web
  e 42 testes direcionados Mobile/IA aprovados.
- Arquivos principais: documentos vivos e
  `fase-250-encerramento-divida-mobile-higiene-prs.md`.
- Pendencias: dois advisories altos de `image-size` sem patch; Mobile permanece
  NO-GO e `mobile.sync=false`.
- Proxima fase: Fase 251 - revisao integral de linguagem e microcopy.

### Fase 249 - Densidade e responsividade do console clinico

- Responsavel: Codex.
- Inicio e conclusao: 2026-08-20.
- Commit: registrado no historico Git desta fase.
- Push: por PR, conforme ruleset da `main`.
- Validacoes: lint sem erros, typecheck, 3 cenarios Playwright em desktop e
  mobile, Chrome DevTools e Lighthouse 100 nas quatro categorias.
- Arquivos principais: `octaclin-web/components/ui/faixa-acoes.tsx`, shell,
  agenda, pacientes, prontuario, teste Playwright, Penpot e CI.
- Pendencias: nenhuma da fase; avisos React pre-existentes permanecem fora do
  escopo.
- Proxima fase: Fase 250 - encerramento da divida Mobile e higiene de PRs.

### Fase 248 - Estados e recuperacao das superficies clinicas

- Responsavel: Codex.
- Inicio e conclusao: 2026-08-20.
- Commit: registrado no historico Git desta fase.
- Push: por PR, conforme ruleset da `main`.
- Validacoes: lint sem erros, typecheck, 4 cenarios Playwright em desktop e
  mobile e Lighthouse com acessibilidade 100.
- Arquivos principais: `octaclin-web/lib/erros-interface.ts`, componentes de
  agenda/prontuario, teste Playwright e CI.
- Pendencias: nenhuma da fase; avisos React pre-existentes permanecem fora do
  escopo.
- Proxima fase: Fase 249 - densidade e responsividade do console clinico.

### Fase 243 - Modernizacao e hardening do Mobile

- Responsavel: Codex, com revisao independente read-only.
- Inicio e conclusao: 2026-08-20.
- Commit: `069b7ce`.
- Push: PR `#84`, merge `87b2f6a`.
- Validacoes: install congelado, typecheck, Expo Doctor, 6 testes do gate de
  seguranca, auditoria controlada, verificacao de alinhamento, introspeccao
  nativa e export Android/iOS/web.
- Arquivos principais: `octaclin-mobile`, CI e
  `fase-243-modernizacao-hardening-mobile.md`.
- Pendencias: dois avisos altos de `image-size` sem patch e todos os gates de
  distribuicao; `mobile.sync=false` permanece.
- CI: `32430036184`, sete jobs aprovados. PRs `#22`, `#24`, `#25`, `#29` e
  `#30` encerrados como superados.
- Proxima fase: Fase 248 - estados e recuperacao das superficies clinicas.

### Fase 246 - Operacao segura de repositorio publico e reconciliacao documental

- Responsavel: Codex.
- Inicio e conclusao: 2026-08-20.
- Commit: registrado no historico Git da Fase 246.
- Push: por PR, conforme ruleset da `main`.
- Validacoes: checkout sincronizado em `58229eb`; varredura local e historica
  sem segredo real versionado; Secret Scanning, Push Protection, Dependabot
  Security Updates, reporte privado e ruleset da `main` configurados; monitor e
  backup mais recentes aprovados.
- Arquivos principais: `AGENTS.md`, documentos vivos, `SECURITY.md` e
  `fase-246-repositorio-publico-governanca.md`.
- Pendencias: Fase 201 continua aberta ate worker dedicado no Render; Fase 243
  concentra os alertas Dependabot do Mobile e permanece fora da oferta.
- Proxima fase: adesao por refeicao e lista de compras da Fase 234, ou primeiro
  o rollout pago do worker da Fase 201.

### Fase 234 - Incremento 8: receitas e refeicoes prontas

- Responsavel: Codex.
- Inicio: 2026-08-20.
- Status: concluido em integracao e producao em 2026-08-20.
- Entrega: biblioteca pessoal/da clinica para receita e refeicao pronta,
  snapshots criptografados, auditoria, edicao e arquivamento. A interface copia
  itens para uma refeicao do rascunho e exige o salvamento normal para recalcular.
- Validacao: testes focados de servico e migration (10), BFF (20), typechecks,
  build backend com artefato e build Next.js aprovados.
- Validacao operacional: migration `1033` aplicada em `octaclin_test_fase150b`
  e `Octaclin-db-producao` com `neondb_owner`; RLS forcada, policy, indices e
  constraints confirmadas. Backup Neon: `backup-pre-migration-1033-20260820`.
- Aceite visual: profissional autenticado confirmou salvar, recarregar,
  inserir no rascunho, salvar o plano e arquivar uma receita sem alterar versao
  publicada. Backend e web responderam `200` depois do deploy manual no Render.
- Pendencias: adesao por refeicao e lista de compras permanecem os proximos
  incrementos da Fase 234.
- Documento: `fase-234-editor-planos-alimentares-avancado-multifonte.md`.

### Fase 234 - Incremento 7: leitura profissional da trilha de trocas

- Responsavel: Codex.
- Inicio e conclusao: 2026-08-20.
- Status: concluido localmente, sem migration.
- Entrega: rota clinica paginada de eventos append-only de substituicao,
  autorizada no escopo do paciente; BFF com allowlist e historico contextual no
  prontuario para versao, refeicao, item e retorno ao principal.
- Validacao: 44 testes backend/controlador, 17 testes BFF, typechecks backend e
  web, build Next.js 16 e Playwright desktop/mobile aprovados.
- Pendencias: receitas/refeicoes prontas, adesao por refeicao e lista de
  compras permanecem os proximos incrementos da Fase 234.
- Documento: `fase-234-editor-planos-alimentares-avancado-multifonte.md`.

### Fase 241 - Hardening da IA clinica

- Responsavel: Codex.
- Inicio e conclusao: 2026-08-13.
- Commit: `ec578a6`.
- Push: sim; PR `#40` com CI `31749993251` aprovado.
- Validacoes: 15 testes backend focados, suite completa com 130 suites/870
  testes, 6 testes FastAPI, lint,
  typechecks, builds, authz, seguranca, audits zerados e 8/8 Playwright em
  desktop/mobile.
- Arquivos principais: servico/controlador/DTOs de IA, contrato FastAPI,
  seletor de midia privada, runbook e variaveis de ambiente.
- Pendencias: configurar segredo nos dois servicos e executar aceite sintetico
  antes de habilitar `ia.clinica` no tenant piloto.
- Proxima fase: auditoria final da Fase 235; Mobile separado na Fase 243.

### Fase 242 - Observabilidade interna e rollout seguro

- Responsavel: Codex.
- Inicio e conclusao: 2026-08-13.
- Commits: `3bc948f` e `4052846`; merge `32559bd`.
- Push: sim; PR `#39` integrada e CI `31747184400` aprovado.
- Validacoes: 129 suites/862 testes backend, typechecks, builds, lint, authz,
  seguranca BFF, Playwright desktop/mobile e `test:rollout` aprovados.
- Arquivos principais: servicos de telemetria/flags/rollout, aba Rollout,
  `scripts/rollout-seguro.mjs` e runbooks.
- Pendencias: agregacao distribuida antes de multiplas instancias.
- Proxima fase: Fase 241 limitada ao hardening da IA.

### Fase 197 - Racionalizacao dos modulos avancados

- Responsavel: Codex com subagentes de Mobile/Gamificacao e revisao independente.
- Conclusao: 2026-08-01.
- Commit: `3117592`.
- Push: sim, branch publicada e PR draft #10 aberta contra `main`.
- Validacoes: backend 69 suites/395 testes, lint, typechecks, builds, authz,
  Next 15, Playwright desktop/mobile, smoke BFF real, IA Python, secrets e
  confiabilidade.
- Arquivos principais: servicos/controladores de IA, Automacoes, Mobile,
  Gamificacao e Operacoes; `painel-ia.tsx`, `painel-automacoes.tsx`,
  `painel-operacoes.tsx` e migrations `1011/1012`.
- Pendencias: aplicar migrations `1011/1012` antes do deploy se migrations
  automaticas estiverem desabilitadas; revisar e integrar a PR #10.
- Proxima fase: Fase 198 - Validacao final de usabilidade e consolidacao visual.

### Fase 196 - Comunicacoes, equipe e conta do cliente

- Responsavel: Codex com auditorias paralelas de comunicacoes, equipe e conta.
- Conclusao: 2026-08-01.
- Push: sim, branch publicada e integrada por PR em `main`.
- Validacoes: backend 65 suites/358 testes, lint, typechecks, builds, authz,
  Next 15, Playwright desktop/mobile, acessibilidade, secrets e confiabilidade.
- Arquivos principais: `painel-comunicacoes.tsx`,
  `lista-profissionais.tsx`, `portal-cliente.tsx`, servicos/controladores de
  comunicacoes, profissionais e usuarios do cliente.
- Pendencias: nenhuma migration; usuarios alterados devem autenticar novamente.
- Proxima fase: Fase 197 - Racionalizacao dos modulos avancados.

### Fase 195 - Portal do paciente e jornadas publicas

- Responsavel: Codex com subagente de portal e revisao independente de seguranca.
- Conclusao: 2026-08-01.
- Commits funcionais: `97c98ab`, `0da5738`, `cb6a491`.
- Push: sim, branch publicada e PR #8 aberta para integracao em `main`.
- Validacoes: backend 64 suites/351 testes, typechecks, lint, build, authz,
  Next 15, Playwright desktop/mobile, acessibilidade, secrets e confiabilidade.
- Arquivos principais: `components/portal`, agenda/formulario publico,
  migration 1010 e `segredo-formulario-publico.ts`.
- Pendencias: nenhuma migration foi executada manualmente contra banco
  ambiguo; o segredo dedicado foi configurado no Render sem exposicao.
- Proxima fase: Fase 196 - Comunicacoes, equipe e conta do cliente.

### Fase 168 - Acesso comercial e onboarding

- Responsavel: Codex.
- Conclusao: 2026-07-30.
- Commit: `5558a4d`.
- Push: sim.
- Validacoes: Playwright login/recuperacao desktop/mobile, acessibilidade, authz, typecheck, lint, build web, deploy Live no Render e smoke funcional do BFF em producao.
- Arquivos principais: `login-form.tsx`, `esqueci-senha-form.tsx`, rotas BFF de auth e configuracao de acesso do servidor.
- Pendencias: nenhuma nesta fase.
- Proxima fase: Fase 169 - Disponibilidade e feed completo da agenda.

### Fase 167 - Agenda interna visual

- Responsavel: Codex.
- Conclusao: 2026-07-30.
- Commit: registrado no historico Git desta fase.
- Push: sim.
- Validacoes: Playwright agenda desktop/mobile, backend spec de agenda, typecheck e lint web.
- Arquivos principais: `agenda-semanal.tsx`, `painel-agenda.tsx` e teste de regressao do console.
- Pendencias: feed por periodo, bloqueios externos opacos e bloqueios internos manuais.
- Proxima fase: Fase 168 - Acesso comercial e onboarding.

### Fase 162 - Portal do paciente orientado a prioridades

- Responsavel: Codex.
- Conclusao: 2026-07-30.
- Commit: registrado no historico Git desta fase.
- Push: sim.
- Validacoes: Playwright portal desktop/mobile, typecheck, lint e contrato da base visual.
- Proxima fase: navegacao mobile propria e aprofundamento das demais telas do portal.

### Fase 160 - Redesenho UX/UI e especificacao Penpot

- Responsavel: Codex.
- Conclusao: 2026-07-30.
- Commit: `b46d4da`.
- Push: sim.
- Validacoes: estrutura e pranchas principais verificadas no Penpot, somente dados sinteticos.
- Proxima fase: Fase 161 - Base visual e navegacao compartilhada.

### Fase 161 - Base visual e navegacao compartilhada

- Responsavel: Codex.
- Conclusao: 2026-07-30.
- Commit: registrado no historico Git desta fase.
- Push: sim.
- Validacoes: teste de contrato, typecheck, lint, autorizacao, acessibilidade, build e regressao visual clinica desktop/mobile.
- Proxima fase: redesenho aprofundado do portal do paciente.

### Fase 105 - Evolucoes/anotacoes clinicas

- Responsavel: Codex.
- Conclusao: 2026-07-22.
- Commit: `335cf79`.
- Push: sim.
- Validacoes: backend spec, backend/web typecheck, authz, Playwright prontuario desktop/mobile, backend/web build, preflight docs e varredura de secrets.
- Proxima fase: Fase 106 - Planos de acompanhamento e tarefas do paciente.

### Fase 106 - Planos de acompanhamento e tarefas do paciente

- Responsavel: Codex.
- Conclusao: 2026-07-22.
- Commit: registrado no historico Git desta fase.
- Push: sim.
- Validacoes: backend spec, backend/web typecheck, authz, Playwright prontuario desktop/mobile e backend/web build.
- Proxima fase: Fase 107 - Biblioteca de materiais e envio ao paciente.

### Fase 107 - Biblioteca de materiais e envio ao paciente

- Responsavel: Codex.
- Conclusao: 2026-07-22.
- Commit: registrado no historico Git desta fase.
- Push: sim.
- Validacoes: backend spec de materiais/pacientes/permissoes, backend/web typecheck, authz, Playwright prontuario desktop/mobile, backend/web build, preflight docs e varredura de secrets.
- Proxima fase: Fase 108 - Agenda de producao.

### Fase 108 - Agenda de producao

- Responsavel: Codex.
- Conclusao: 2026-07-22.
- Commit: registrado no historico Git desta fase.
- Push: sim.
- Validacoes: backend specs de agenda/Google Calendar, backend/web typecheck, authz, Playwright agenda/dashboard desktop/mobile, backend/web build, preflight docs e varredura de secrets.
- Proxima fase: Fase 109 - Templates aprovados e mapeamento Meta WhatsApp.

### Fase 217 - PWA do portal do paciente

- Responsavel: Codex.
- Conclusao: 2026-08-08.
- Commit: `7f6631b`.
- Push: sim.
- Validacoes: 107 suites/773 testes backend, typecheck backend/web, build web,
  contrato de seguranca PWA e 6 cenarios Playwright desktop/mobile.
- Proxima fase: Fase 218 - API publica, chaves por tenant e webhooks.

### Fase 218 - API publica, chaves por tenant e webhooks

- Responsavel: Codex.
- Inicio: 2026-08-08.
- Conclusao: 2026-08-08.
- Commit: `9572704`.
- Push: sim; backend e web confirmados nas rotas novas.
- Validacoes: 113 suites/801 testes backend, typecheck/build backend,
  authz/Next 15/typecheck/lint/build web, preflight e secrets aprovados.
- Arquivos principais: `octaclin-backend/src/modulos/integracoes`, migration
  `1022`, gestao em `octaclin-web/components/cliente/integracoes-api-cliente.tsx`
  e `API_PUBLICA_V1.md`.
- Pendencias: entrega a receptor externo real no onboarding da primeira
  integracao aprovada; nao e pendencia de codigo da fase.
- Proxima fase: Fase 219 - backup automatizado, retencao e restore recorrente.

### Fase 219 - Backup automatizado, retencao e restore recorrente

- Responsavel: Codex.
- Inicio: 2026-08-08.
- Conclusao: 2026-08-09.
- Commits principais: `892b9d4`, `3bc1467`, `403bd0f`.
- Push: sim; workflow ativo no `main`.
- Validacoes: contrato local, secrets/preflight, bucket privado, lifecycle,
  SHA-256, AES256, restore e gate estrutural nas execucoes `31346127174` e
  `31346290507`.
- Arquivos principais: `.github/workflows/backup-producao.yml`,
  `.github/backblaze-backup-lifecycle.json`, `scripts/backup-producao.mjs` e
  `RUNBOOK_BACKUP_RESTORE.md`.
- Pendencias: acompanhar a primeira ocorrencia automatica; falha reabre
  incidente operacional.
- Proxima fase: Fase 220 - observabilidade e alertas externos de producao.

### Fase 220 - Observabilidade e alertas externos de producao

- Responsavel: Codex.
- Inicio e conclusao: 2026-08-09.
- Commit de implementacao: `19ff4b5`.
- Push: sim; workflow ativo no `main`.
- Validacoes: contrato local, permissoes minimas, secrets/preflight e execucao
  real `31346835747` com readiness, dependencias e web aprovadas.
- Arquivos principais: `.github/workflows/monitor-producao.yml`,
  `scripts/monitor-producao.mjs` e
  `fase-220-observabilidade-alertas-externos.md`.
- Pendencias: acompanhar a primeira ocorrencia automatica; falhas passam a ser
  incidentes operacionais, nao pendencias de implementacao.
- Proxima fase: Fase 221 - regressao ponta a ponta pos-fases 200-220.

### Fase 221 - Regressao E2E em producao isolada

- Responsavel: Codex.
- Inicio: 2026-08-10.
- Conclusao: 2026-08-10.
- Status: concluida.
- Entrega: gate Playwright autenticado, explicito e somente leitura
  para `Professional`, `SuperAdmin`, `Client` e `Patient`.
- Evidencia: os quatro papeis foram aprovados em suas superficies e bloqueados
  fora delas; zero HTTP 5xx, falha de rede real, erro de pagina ou console nas
  execucoes finais.
- Defeito encontrado: o status Google do `SuperAdmin` tentava resolver perfil
  profissional e retornava HTTP 500. A correcao foi implementada e validada
  e publicada, mantendo conectar/desconectar exclusivo do profissional.
- Segundo defeito encontrado: a ativacao do paciente emitia a sessao antes do
  commit do usuario. O commit `b5293a9` separou as operacoes; teste unitario,
  ativacao em producao e smoke do portal passaram.
- Seguranca operacional: o acesso `SuperAdmin` legado foi desativado e suas
  sessoes revogadas somente depois da aprovacao do substituto.
- Pendencia externa a fase: renovar as credenciais Gmail API ou validar o
  provedor SMTP; os envios de recuperacao registraram falha de refresh OAuth.
- Documento: `fase-221-regressao-e2e-producao-isolada.md`.

### Fase 222 - Confiabilidade Google Agenda e Gmail

- Responsavel: Codex.
- Inicio: 2026-08-10.
- Status: concluida em producao.
- Diagnostico: OAuth individual e canal watch do Google estavam ativos, mas a
  conexao permanecia sem `syncToken` e sem bloqueios externos; webhooks
  chegavam sem conclusao da reconciliacao.
- Entrega local: carga inicial no callback, reconciliacao manual, janela
  inicial limitada, comando na agenda e helper Gmail sem exposicao do token.
- Primeiro smoke: `syncToken` persistido sem falhas; uma recorrencia ate 2040
  gerou 8.530 bloqueios, levando ao hardening de janela movel 30/400 dias e
  limpeza fora do horizonte antes do aceite final.
- Validacoes locais: 27 testes focados, builds/typechecks, lint web e sintaxe do
  helper aprovados.
- Producao: `syncToken` e bloqueios externos validados com janela 30/400 dias;
  OAuth Gmail publicado e renovado; Gmail aceitou envio real; health detalhado
  integralmente `ok`; `OCTACLIN_PROCESSO=all` restaurado enquanto nao houver
  worker dedicado.
- Seguranca operacional: nenhum segredo entrou em logs ou documentacao e todos
  os temporarios da rotacao foram apagados.
- Documento: `fase-222-confiabilidade-google-agenda-gmail.md`.

### Fase 223 - Verdade operacional do go-live

- Responsavel: Codex.
- Inicio e conclusao: 2026-08-10.
- Status: concluida.
- Entrega: auditoria documental das evidencias das Fases 200 a 222, com
  reconciliacao de checklist, preflight, resumo, status e handoffs de agentes.
- Decisao: o primeiro piloto assistido pode usar o controle manual ja entregue
  para assinatura e limites; gateway de pagamento fica nao bloqueador ate haver
  decisao comercial/fiscal de provedor.
- Gates mantidos: dominio/identidade, juridico, jornadas mutaveis em staging,
  onboarding/suporte, operacao de lancamento e WhatsApp caso seja vendido.
- Documento: `fase-223-verdade-operacional-go-live.md`.

### Fase 224 - Oferta comercial, planos e ativacao assistida

- Responsavel: Codex.
- Inicio: 2026-08-10.
- Conclusao: 2026-08-11.
- Status: concluida com aceite comercial.
- Entrega: contrato operacional reutilizavel, pacotes propostos sem preco,
  estados de ativacao, fronteiras de seguranca e checklist de onboarding
  ampliado. Profissional R$ 99 trimestral/R$ 119 mensal; Clinica R$ 199
  trimestral/R$ 249 mensal; PIX antecipado, demonstracao sintetica,
  cancelamento em 30 dias, migracao por escopo e WhatsApp fora da oferta.
- Documento: `CAPACIDADE_OFERTA_COMERCIAL_ATIVACAO_ASSISTIDA.md`.

### Fase 232 - Operacao de lancamento

- Responsavel: Codex, com Octavio como responsavel primario da operacao.
- Inicio e conclusao: 2026-08-13.
- Status: concluida; cliente real permanece em NO-GO por gates externos.
- Entrega: janela, papeis, GO/NO-GO, matriz P0-P3, rollback, comunicacao,
  controle vivo e gate dedicado no CI.
- Exercicio: `EX-SINTETICO-F232-001` aprovado sem rede ou dados reais.
- Evidencias: PR #38, CIs `31741178651`/`31741805806` e monitor
  `31741818055` verdes.
- Documento: `fase-232-operacao-lancamento.md`.

### Fase 234 - Incremento 2: contratos e permissoes

- Responsavel: Codex, com auditoria paralela de backend e frontend/BFF.
- Inicio e conclusao: 2026-08-14.
- Status: concluido localmente, sem migration.
- Entrega: listagem resumida, detalhe sob demanda com historico leve, defesa de
  permissao no servico, BFF dedicado e workspace de leitura sem mutacoes.
- Validacao: 135 suites/894 testes backend, builds e typechecks, lint, gate de
  autorizacao e Playwright desktop/mobile para leitura e gestao.
- Documento: `fase-234-editor-planos-alimentares-avancado-multifonte.md`.
