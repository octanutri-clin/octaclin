# Fase 144 - Agendamento publico por solicitacao

Status: concluida em 2026-07-27.

## Objetivo

Permitir que uma pessoa solicite um horario por link publico sem reservar a
agenda imediatamente, deixando a aprovacao final para o profissional dentro do
fluxo autenticado do OctaClin.

## Entregue

- Jornada critica `octaclin-web/tests/visual/jornadas-criticas.spec.mjs`
  expandida com o fluxo completo de solicitacao publica, aprovacao interna e
  reflexo no portal do paciente.
- A regressao cobre a regra de negocio central: a solicitacao publica fica
  pendente, o horario continua livre ate a aprovacao e a consulta/notificacoes
  so aparecem depois da criacao normal da agenda.
- O fluxo interno validado exige selecao explicita de paciente antes de liberar
  `Aprovar solicitacao`.
- O estado seguro do link publico ficou documentado na propria evidencia de
  teste: o token bruto nao e persistido, entao uma nova sessao exige rotacao
  confirmada para voltar a exibir uma URL copiavel.

## Regras preservadas

- Solicitacao publica nao reserva horario por si so.
- Aprovacao manual exige paciente existente do tenant e selecao explicita na UI.
- Email, WhatsApp, Google Calendar e lembrete continuam sendo disparados apenas
  pela criacao normal da consulta aprovada.
- Nenhum token bruto entra em persistencia ou documentacao.

## Validacoes

```powershell
pnpm --dir octaclin-web exec playwright test tests/visual/jornadas-criticas.spec.mjs -g "solicitacao publica segue para aprovacao manual" --project=desktop-chromium --reporter=list
pnpm --dir octaclin-web test:e2e:criticas
pnpm --dir octaclin-backend test --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web build
pnpm security:secrets
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

## Evidencia objetiva

- `pnpm --dir octaclin-web test:e2e:criticas`: 8 testes Playwright aprovados
  (desktop + mobile), incluindo a nova jornada publica -> aprovacao interna ->
  portal do paciente.
- `pnpm --dir octaclin-backend test --runInBand`: 52 suites e 273 testes
  aprovados.
- `pnpm --dir octaclin-web build`: build Next.js 15.5.22 concluido com as
  rotas publicas `/agendar/[token]`, `/api/agendamentos-publicos/*` e o BFF
  autenticado de agenda presentes no artefato.
- `pnpm security:secrets`: nenhum secret real identificado pelos padroes
  locais.
