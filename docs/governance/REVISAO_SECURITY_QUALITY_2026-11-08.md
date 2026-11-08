# Revisao do inventario Security & Quality — 2026-11-08

Risco: R4 (inventario de seguranca, dependencias e imagens de producao). Escopo
minimo: recapturar o snapshot, corrigir o que tem correcao, reconciliar as
causas. Esta PR e separada da PR do FOOD06 M01.

## Por que existe

O check `Governanca de repositorio` reprovava a `main` e toda PR aberta porque
`SQ-2026-004`, `SQ-2026-240` e `SQ-2026-248` (critical) venceram em 2026-11-07 e
seis causas high venciam em 2026-11-08. Renovar a data nao resolve: o SLA conta a
partir de `capturadoEm`, entao a saida e recapturar e triar.

## Captura

- Run 42476505880 (`workflow_dispatch`, `inventario-security-quality.yml`), main
  `3b35e104f5ceeebda10b7bf98355ebfb7272b496`, `capturadoEm`
  `2026-11-08T11:36:46.227Z`.
- Resultado: 205 Code Scanning (4 critical, 58 high), 29 Dependabot (3 critical,
  4 high) e zero Secret Scanning; 234 alertas no total.
- O download do artefato foi bloqueado pelo egresso restrito. O JSON foi
  remontado do eco em base64 do log do job e conferido contra o hash declarado
  no proprio log (`sha256=aa5dee64...1867`, 61656 bytes). Os bytes ficam em
  [inventario-capturado.json](evidencias/2026-11-08/inventario-capturado.json) e
  um teste fixa o hash.
- A captura anterior falhava por falta do segredo `INVENTARIO_GITHUB_TOKEN`
  (`401`, depois `403` em `dependabot/alerts`). Com o segredo no repositorio a
  captura passou. O segredo nao foi impresso nem copiado para o Git.

## Causas

| Causa | Situacao | Alertas |
| --- | --- | --- |
| `SQ-2026-004` imagem Debian do servico IA | Mantida; base atualizada por digest | 190 |
| `SQ-2026-248` certifi | Mantida; alerta novo #140; lock atualizado | 1 |
| `SQ-2026-249` musl-utils | Mantida; base Node atualizada por digest | 2 |
| `SQ-2026-250` next 16.3.8 (critical) | Nova; corrigida em 16.4.5 | 9 |
| `SQ-2026-251` body-parser, multer, qs, fast-uri | Nova; overrides atualizados | 13 |
| `SQ-2026-252` filelock no lock de pesquisa | Nova; lock atualizado | 17 |
| `SQ-2026-253` CodeQL prototype pollution | Nova; correcao de codigo | 1 |
| `SQ-2026-254` deepmerge sem patch | Nova; so dev dependency | 1 |

Aposentadas por condicao de saida atendida e sem nenhuma referencia aberta:
`SQ-2026-139`, `239`, `240`, `241`, `242`, `243`, `244`, `245`, `246`, `247`. O
historico permanece no Git (`git log -p` neste arquivo). Elas deixavam de ser
informacao util e passaram a exigir renovacao periodica sem alerta a rastrear.

## Correcoes preparadas nesta PR

- `octaclin-web`: `next` e `eslint-config-next` 16.3.8 -> 16.4.5.
- `octaclin-backend/pnpm-workspace.yaml`: overrides `body-parser@2` 2.4.0,
  `multer@2` 2.5.0, `qs@6` 6.17.1, `fast-uri@3` 3.1.9.
- `octaclin-ai-service/requirements.lock.txt`: certifi 2026.10.19 -> 2026.10.23,
  regenerado com `uv pip compile --generate-hashes --universal --python-version 3.12
  --upgrade-package certifi`; so a linha do certifi mudou.
- `research/fase319/requirements-lab-lock.txt`: filelock 4.1.1 -> 4.2.9.
- Dockerfiles: `node:22.23.4-alpine3.24@sha256:0e1754758c2d...` (backend e web) e
  `python:3.14.10-slim@sha256:9aaa474097d0...` (servico IA), resolvidos no Docker
  Hub em 2026-11-08.
- `servico-planos-alimentares.ts`: `contextosCustomAnteriores` passa a ser
  `Object.create(null)`, como os outros dicionarios indexados por `chaveCliente`.

## Validacao

| Gate | Resultado |
| --- | --- |
| `pnpm test:inventario-security-quality` | PASS (73 testes e validador: 234 alertas cobertos) |
| `pnpm --dir octaclin-web typecheck`, `lint`, `build` | PASS (lint: 70 avisos, 0 erros; nao comparado com a main) |
| `pnpm --dir octaclin-backend build` com verificacao do artefato | PASS |
| `pnpm --dir octaclin-backend test` | PASS: 383 suites; 9 suites puladas |
| spec `servico-planos-alimentares` | PASS (141 testes) |
| Testcontainers do backend | SKIPPED: sem Docker daemon; roda no CI |
| Build e Trivy das imagens | SKIPPED: sem Docker daemon; so a varredura da main confirma |
| Efeito sobre os alertas | NAO VERIFICADO: depende de merge e nova varredura |
| `pnpm --dir octaclin-ai-service` testes e lab de pesquisa | NA: so lock de dependencia; nenhum codigo executado |

## Limites e proximos passos

- Nenhum alerta foi fechado ainda. Eles so fecham depois do merge, do Trivy e do
  Dependabot da `main`.
- `SQ-2026-253`: a linha exata do alerta CodeQL nao foi lida (a API de alertas
  nao e acessivel a esta sessao). A correcao segue o padrao dos outros
  dicionarios indexados por `chaveCliente` que li no servico
  (`Object.create(null)`); nao auditei todos os pontos do arquivo, e so a nova
  varredura confirma.
- A maioria dos 190 alertas Debian do servico IA nao tem versao corrigida no
  scanner. Eles nao somem com bump de digest; a decisao de aceitar o risco com
  prazo ou trocar a imagem base e do proprietario. `SQ-2026-004` fica com
  `revisarEm` 2026-11-15, antes do teto de 14 dias.
- Apos o merge e a nova varredura: rodar o workflow de captura, aposentar as
  causas fechadas e reconfirmar o que restar.
