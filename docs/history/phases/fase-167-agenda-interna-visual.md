# Fase 167 - Agenda interna visual

Status: concluida em 2026-07-30.

## Objetivo

Dar ao profissional uma agenda semanal visual que continue funcional quando
ele optar por nao conectar o Google Agenda.

## Entregue

- Grade semanal interna com navegacao entre semanas e retorno para hoje.
- Selecao da agenda do profissional quando mais de um profissional estiver
  disponivel no escopo autenticado.
- Consultas `agendada` e `reagendada` desenhadas como horarios ocupados.
- Acesso do bloco visual aos detalhes e acoes da consulta ja existentes.
- Estado do Google apresentado como integracao opcional, sem confundir
  desconexao com indisponibilidade da agenda interna.
- Mensagens de criacao, remarcacao e cancelamento agora confirmam,
  respectivamente, bloqueio, atualizacao e liberacao do horario interno.
- Teste Playwright especifico para agenda visual com Google desconectado.

## Decisoes preservadas

- A consulta armazenada no OctaClin continua sendo a fonte de verdade.
- Google Calendar permanece uma integracao externa opcional.
- O backend ja impede sobreposicao por profissional em aplicacao e no
  PostgreSQL; esta fase nao duplicou a regra no frontend.
- Estados terminais (`concluida`, `falta` e `cancelada`) nao ocupam horario.
- Nenhum dado, estilo, texto ou ativo de LiveClin/WebDiet foi copiado. As
  referencias foram usadas apenas para comparar fluxos de produto.

## Validacoes

```powershell
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "agenda de producao" --project=desktop-chromium --reporter=list
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "agenda de producao" --project=mobile-chromium --reporter=list
pnpm --dir octaclin-backend test --runInBand servico-agenda.spec.ts
```

## Proximas lacunas da agenda

- Feed de calendario filtrado por periodo e profissional.
- Exibir bloqueios externos como `Indisponivel`, sem dados privados do evento.
- Bloqueios internos manuais para reuniao, intervalo, ferias e outros periodos.
- Visualizacoes de dia e mes.
- Drag-and-drop permanece adiado; remarcacao continua usando o fluxo validado.
