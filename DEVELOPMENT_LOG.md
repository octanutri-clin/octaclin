# OctaClin - Development Log

Use este arquivo como diario curto quando outro desenvolvedor ou agente de IA assumir fases.

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
