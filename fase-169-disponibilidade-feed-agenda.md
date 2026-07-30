# Fase 169 - Disponibilidade e feed completo da agenda

Status: concluida localmente em 2026-07-30. Requer deploy coordenado de backend
e web para executar a migration antes da validacao em producao.

## Entregue

- `GET /agenda/feed` filtra por periodo e profissional, sempre respeitando o
  escopo do usuario Professional.
- Eventos externos do Google ocupam o horario como `Indisponivel`; titulo,
  identificador e demais detalhes privados nao saem no feed.
- Bloqueios internos persistentes para `intervalo`, `reuniao` e `ferias`, com
  criacao, remocao, auditoria, RLS e validacao de sobreposicao.
- Agenda visual com visoes de dia, semana e mes, sem arrastar eventos.
- A agenda interna permanece funcional sem uma conta Google conectada.

## Deploy

O backend deve executar a migration
`CriarBloqueiosManuaisAgenda1720000001006` antes ou durante a publicacao da
web. Nenhuma variavel nova e necessaria.

## Validacoes

```powershell
pnpm --dir octaclin-backend test --runInBand servico-agenda.spec.ts opcoes-typeorm.spec.ts
pnpm --dir octaclin-backend run typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "agenda de producao" --project=desktop-chromium --reporter=list
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "agenda de producao" --project=mobile-chromium --reporter=list
```

## Proxima fase

Fase 170 - Integridade historica de formularios.
