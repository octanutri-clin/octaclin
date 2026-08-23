# Fase 37 - Historico de Comunicacoes e Automacoes

## Objetivo

Fechar a persistencia operacional de Comunicacoes e Automacoes exibindo historicos reais no backend, BFF, demo local, clientes web e paineis administrativos.

## Entregas

- Backend real com `GET /comunicacoes/mensagens` para listar as 50 mensagens mais recentes do tenant.
- Backend real com `GET /automacoes/avaliacoes` para listar as 50 execucoes de regras mais recentes do tenant.
- Rotas BFF `GET /api/comunicacoes/mensagens` e `GET /api/automacoes/avaliacoes`.
- API demo local com os mesmos GETs, usando o estado em memoria ja alimentado pelos POSTs.
- Cliente web de Comunicacoes carregando canais, templates, mensagens persistidas e pacientes no bootstrap.
- Cliente web de Automacoes carregando regras, avaliacoes persistidas, profissionais e pacientes no bootstrap.
- Painel de Comunicacoes exibindo mensagens recentes persistidas e atualizando a lista apos novo disparo.
- Painel de Automacoes exibindo avaliacoes persistidas no carregamento inicial.
- Smoke E2E do BFF validando que mensagem e avaliacao criadas aparecem nas respectivas listagens.
- README atualizado com as rotas e capacidades novas.

## Validacao

Comandos usados/esperados:

```powershell
& 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check outputs/octaclin-backend/scripts/api-demo-local.mjs
& 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check outputs/octaclin-web/scripts/smoke-e2e-bff.mjs
& 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules/typescript/bin/tsc --noEmit
& 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules/next/dist/bin/next build
powershell -ExecutionPolicy Bypass -File outputs/verificar-demo-local.ps1
```

## Proximo passo recomendado

Fase 38 - Hardening operacional do BFF e auditoria: padronizar envelopes de erro, revisar cobertura de auditoria para mutacoes, reforcar guardrails contra vazamento de dados sensiveis e consolidar limites de listagem/filtros nas rotas administrativas.
