# Fase 41 - Testes automatizados de dominio e BFF

## Objetivo

Ampliar a cobertura automatizada do OctaClin nos modulos de Comunicacoes, Automacoes, IA, Mobile e Gamificacao, reforcando isolamento tenant, contratos de API e protecao de dados sensiveis.

## Entregas

- Comunicacoes: spec para listagem de mensagens restrita ao tenant.
- Automacoes: specs para criacao de regra, solicitacao de avaliacao com busca por tenant e job idempotente, e rejeicao de regra inexistente/inativa.
- IA: specs para persistencia de analise de sentimento sem texto bruto e cache de reconhecimento alimentar sem chamada externa.
- Mobile: specs para resumo seguro de acompanhante sem `pinHash`/campos criptografados e sincronizacao idempotente por `idLocal`.
- Gamificacao: specs para criacao de post com moderacao no mesmo tenant e atualizacao de progresso com participacao existente.
- Smoke BFF existente mantido como contrato de ponta a ponta para login, rotas BFF, dados sensiveis, auditoria, paginacao e CSV.

## Guardrails testados

- Servicos executam operacoes dentro do tenant recebido.
- Listagens e buscas usam `tenantId` no criterio de consulta.
- Retornos publicos nao expoem PIN, hash ou campos criptografados.
- IA nao persiste texto clinico bruto em analise de sentimento.
- Jobs assicronos usam IDs idempotentes.

## Validacao

Comandos esperados:

```powershell
& 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules/jest/bin/jest.js src/modulos/comunicacoes/aplicacao/servico-comunicacoes.spec.ts src/modulos/automacoes/aplicacao/servico-automacoes.spec.ts src/modulos/ia/aplicacao/servico-ia.spec.ts src/modulos/mobile/aplicacao/servico-mobile.spec.ts src/modulos/gamificacao/aplicacao/servico-gamificacao.spec.ts --runInBand
& 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules/typescript/bin/tsc --noEmit
powershell -ExecutionPolicy Bypass -File outputs/verificar-demo-local.ps1
```

## Proximo passo recomendado

Fase 42 - Qualidade visual e UX operacional: revisar estados vazios, loading, erro e responsividade das telas de Operacoes, Comunicacoes, Automacoes, IA, Mobile e Gamificacao com evidencias de screenshot.
