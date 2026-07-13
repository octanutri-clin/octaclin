# Fase 40 - Filtros e exportacao operacional

## Objetivo

Melhorar a operacao diaria do console OctaClin com consultas paginadas e exportacao CSV segura para auditoria e outbox com falha.

## Entregas

- Backend real com `GET /operacoes/auditoria/paginada`.
- Backend real com `GET /operacoes/auditoria/exportar.csv`.
- Backend real com `GET /operacoes/outbox/falhas/paginada`.
- Backend real com `GET /operacoes/outbox/falhas/exportar.csv`.
- Exportacoes CSV limitadas, com metadados sanitizados e sem payload bruto.
- API demo local com os mesmos endpoints paginados e CSV.
- BFF Next.js com rotas equivalentes em `/api/operacoes/*`.
- Cliente web de Operacoes com tipos paginados, filtros de outbox e URLs de exportacao.
- Painel de Operacoes com paginacao, filtros e botoes CSV para auditoria/outbox.
- Smoke E2E validando endpoints paginados e CSV.
- README atualizado com as novas rotas e capacidade operacional.

## Guardrail de exportacao

As exportacoes nao devem incluir payload bruto de outbox nem metadados complexos de auditoria. O CSV de auditoria exporta apenas pares escalares simples em `metadados`; o CSV de outbox exporta apenas `mensagemId` quando existir.

## Validacao

Comandos esperados:

```powershell
& 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check outputs/octaclin-backend/scripts/api-demo-local.mjs
& 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check outputs/octaclin-web/scripts/smoke-e2e-bff.mjs
& 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules/typescript/bin/tsc --noEmit
& 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules/next/dist/bin/next build
powershell -ExecutionPolicy Bypass -File outputs/verificar-demo-local.ps1
```

## Proximo passo recomendado

Fase 41 - Testes automatizados de dominio e BFF: ampliar specs para os fluxos de comunicacoes, automacoes, mobile, IA e gamificacao com foco em isolamento tenant, dados sensiveis e contratos de API.
