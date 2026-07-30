# Fase 169 - Disponibilidade e feed completo da agenda

Status: validada em producao em 2026-07-30.

## Entregue

- `GET /agenda/feed` filtra por periodo e profissional, sempre respeitando o
  escopo do usuario Professional.
- Eventos externos do Google ocupam o horario como `Indisponivel`; titulo,
  identificador e demais detalhes privados nao saem no feed.
- Bloqueios internos persistentes para `intervalo`, `reuniao` e `ferias`, com
  criacao, remocao, auditoria, RLS e validacao de sobreposicao.
- Agenda visual com visoes de dia, semana e mes, sem arrastar eventos.
- A agenda interna permanece funcional sem uma conta Google conectada.

## Producao

- As migrations `1720000001002` a `1720000001004` e
  `CriarBloqueiosManuaisAgenda1720000001006` foram aplicadas e registradas no
  Neon de producao.
- A web esta em live com o commit `5bfec09`, que mantem a acao de liberar
  horario sempre visivel nos bloqueios internos, inclusive nos mais curtos.
- Nenhuma variavel nova foi necessaria.

## Validacoes

```powershell
pnpm --dir octaclin-backend test --runInBand servico-agenda.spec.ts opcoes-typeorm.spec.ts
pnpm --dir octaclin-backend run typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "agenda de producao" --project=desktop-chromium --reporter=list
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "agenda de producao" --project=mobile-chromium --reporter=list
```

Validacao manual de producao: bloqueio interno criado sem erro, migrations
confirmadas no historico do Neon e deploy web `5bfec09` concluido com servico
em live. Dashboard e questionarios voltaram a responder apos o alinhamento do
schema.

## Proxima fase

Fase 170 - Integridade historica de formularios.
