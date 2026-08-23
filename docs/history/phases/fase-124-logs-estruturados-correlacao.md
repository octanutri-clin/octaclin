# Fase 124 - Logs estruturados e correlacao

Data: 2026-07-23

## Objetivo

Melhorar diagnostico operacional do backend com request ID, logs estruturados e correlacao com auditoria, sem expor PII ou secrets.

## Entregas

- Criado helper de contexto de requisicao para gerar/preservar `requestId`.
- Criado middleware global que adiciona `requestId` na requisicao e responde header `x-request-id`.
- Criado interceptor global para logs HTTP estruturados de sucesso e erro.
- Logs HTTP incluem `requestId`, `tenantId`, `usuarioId`, metodo, rota sem query string, status e duracao.
- Erros HTTP registram apenas o nome tecnico do erro, sem mensagem de negocio potencialmente sensivel.
- Auditoria passa a aceitar `requestId` e gravar esse valor em `metadados` para correlacao.
- Falhas de auditoria passam a usar log estruturado `auditoria.falha` sem mensagem bruta de erro.
- Runbook e guia de testes foram atualizados com o uso operacional de correlacao.

## Decisoes

- `tenantId` e `usuarioId` entram nos logs somente quando disponiveis pelo usuario autenticado, nunca por header externo.
- Query string nao entra em logs estruturados para evitar vazamento de email, token ou filtros sensiveis.
- Corpo de requisicao/resposta nao e logado nesta fase.
- Mensagem de erro de negocio nao e logada no interceptor global; fica restrita ao fluxo normal de tratamento de erro da aplicacao.
- O `requestId` aceito por header e sanitizado e limitado a 128 caracteres.

## Arquivos principais

- `octaclin-backend/src/infraestrutura/observabilidade/contexto-requisicao.ts`
- `octaclin-backend/src/infraestrutura/observabilidade/middleware-correlacao.ts`
- `octaclin-backend/src/infraestrutura/observabilidade/interceptor-log-requisicao.ts`
- `octaclin-backend/src/infraestrutura/auditoria/servico-auditoria.ts`
- `octaclin-backend/src/main.ts`
- `RUNBOOK_PRODUCAO.md`
- `TESTES_E_VALIDACOES.md`
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- `RESUMO_FASES_CONCLUIDAS.md`

## Validacoes

```powershell
cd octaclin-backend
.\node_modules\.bin\jest.cmd --runInBand src/infraestrutura/observabilidade/contexto-requisicao.spec.ts src/infraestrutura/observabilidade/middleware-correlacao.spec.ts src/infraestrutura/observabilidade/interceptor-log-requisicao.spec.ts src/infraestrutura/auditoria/servico-auditoria.spec.ts
.\node_modules\.bin\tsc.cmd --noEmit
.\node_modules\.bin\nest.cmd build
```

Na raiz do projeto:

```powershell
node scripts\scan-secrets.mjs
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

## Pendencias para fases futuras

- Criar alertas operacionais consumindo logs e healthchecks.
- Avaliar sink externo de logs para producao, com retencao e busca por `requestId`.
- Adicionar mascaramento centralizado caso logs de dominio passem a aceitar metadados livres no futuro.
