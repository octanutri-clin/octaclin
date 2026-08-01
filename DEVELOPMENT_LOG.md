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
