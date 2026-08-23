# Fase 123 - Monitoramento e healthchecks de producao

Data: 2026-07-23

## Objetivo

Preparar healthchecks operacionais para staging/producao, permitindo diferenciar processo vivo de prontidao real das dependencias criticas.

## Entregas

- Mantido `/health` como liveness simples e rapido.
- Criado `/health/detalhado` para readiness/diagnostico operacional.
- Criado `ServicoSaude` com checks de backend, banco, Redis, email, WhatsApp Meta e Google Calendar.
- Banco passa por `SELECT 1` e falha critica deixa o health geral como `falha`.
- Redis, email, WhatsApp e Google Calendar sao verificados por completude segura de configuracao e deixam o health como `degradado` quando ausentes.
- Resposta do health detalhado nao expoe tokens, senhas, refresh tokens nem URLs com credenciais.
- Runbook de producao documenta uso de `/health` e `/health/detalhado`.

## Decisoes

- `/health` continua enxuto para uso por Render/load balancer.
- `/health/detalhado` retorna HTTP 200 com `status` no corpo, evitando falso negativo de infraestrutura enquanto ainda permite monitoramento por parsing.
- Checks externos de Gmail/Meta/Calendar nao fazem chamadas reais nesta fase para evitar custo, latencia e efeitos colaterais no endpoint de health.
- Redis e demais integracoes ausentes geram `degradado`, nao `falha`, porque o backend pode continuar vivo com funcionalidades parciais.
- Banco indisponivel gera `falha`, pois autenticacao, dados clinicos e operacao dependem dele.

## Arquivos principais

- `octaclin-backend/src/modulos/saude/servico-saude.ts`
- `octaclin-backend/src/modulos/saude/servico-saude.spec.ts`
- `octaclin-backend/src/modulos/saude/controlador-saude.ts`
- `octaclin-backend/src/modulos/saude/modulo-saude.ts`
- `RUNBOOK_PRODUCAO.md`
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- `RESUMO_FASES_CONCLUIDAS.md`

## Validacoes

```powershell
cd octaclin-backend
.\node_modules\.bin\jest.cmd --runInBand src/modulos/saude/servico-saude.spec.ts
.\node_modules\.bin\tsc.cmd --noEmit
.\node_modules\.bin\nest.cmd build
```

## Pendencias para fases futuras

- Criar alertas externos que consultem `/health/detalhado` e disparem notificacao quando `status` for `falha` ou `degradado` persistente.
- Adicionar checagens reais de ping Redis/API externas com timeout curto se o custo operacional for aceitavel.
- Proteger o health detalhado por rede/secret de monitoramento se ele ficar acessivel publicamente em producao.
