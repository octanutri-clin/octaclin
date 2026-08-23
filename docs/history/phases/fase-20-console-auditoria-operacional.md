# Fase 20 - Console de auditoria operacional

## Objetivo

Transformar a trilha criada na Fase 19 em superficie consultavel para suporte, governanca e compliance dentro do console operacional do OctaClin.

## Entregas

- Endpoint backend `GET /operacoes/auditoria` protegido por JWT e papel `SuperAdmin`.
- Filtros opcionais por `acao`, `recursoTipo`, `recursoId`, `usuarioId`, `inicio`, `fim` e `limite`.
- Consulta usando `UserActionLogOrm` dentro do contexto RLS do tenant via `ExecutorTenant`.
- Rota BFF `GET /api/operacoes/auditoria`, mantendo tokens fora do JavaScript do navegador.
- Painel `/operacoes` com secao "Auditoria sensivel", filtros rapidos e lista de eventos com usuario, recurso, IP, user-agent, data e metadados.
- Teste unitario cobrindo listagem operacional de auditoria.

## Arquivos principais

- `outputs/octaclin-backend/src/modulos/operacoes/aplicacao/servico-operacoes.ts`
- `outputs/octaclin-backend/src/modulos/operacoes/apresentacao/controlador-operacoes.ts`
- `outputs/octaclin-backend/src/modulos/operacoes/aplicacao/servico-operacoes.spec.ts`
- `outputs/octaclin-web/app/api/operacoes/auditoria/route.ts`
- `outputs/octaclin-web/lib/operacoes-api.ts`
- `outputs/octaclin-web/components/operacoes/painel-operacoes.tsx`

## Validacao

- backend `tsc --noEmit`: aprovado.
- backend `jest --runInBand`: aprovado, 11 suites e 30 testes.
- backend `nest build`: aprovado.
- web `tsc --noEmit`: aprovado.
- web `next build`: aprovado.
- `node work/checar-imports-relativos.js`: aprovado, `relative-imports-ok 117`.
