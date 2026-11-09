# Revisao do inventario Security & Quality — 2026-11-09

Risco: R4 (inventario de seguranca e imagens de producao). Continua a revisao de
[2026-11-08](REVISAO_SECURITY_QUALITY_2026-11-08.md) depois do merge das PRs #471,
#474, #475 e #476.

## Captura

- Run 42539482821 (`workflow_dispatch`, `main` `55553a91`), `capturadoEm`
  `2026-11-09T00:18:46.890Z`. JSON remontado do eco do log do job e conferido
  contra o hash e a contagem de partes declarados no proprio log
  (`sha256=619a4165...555d`, 52686 bytes, 24 partes). Bytes em
  [inventario-capturado.json](evidencias/2026-11-09/inventario-capturado.json),
  com o hash fixado por teste.
- Resultado: 192 Code Scanning e 3 Dependabot, zero Secret Scanning. Eram 205 e 29
  (234) na captura de 2026-11-08: **39 alertas a menos**.

## O que fechou

As causas `SQ-2026-248` (certifi), `249` (musl-utils), `250` (next), `251`
(body-parser, multer, qs, fast-uri) e `252` (filelock) nao tem mais nenhuma
referencia aberta. Foram aposentadas por condicao de saida atendida; o historico
fica no Git e na revisao de 2026-11-08.

## O que continua aberto

| Causa | Alertas | Situacao |
| --- | --- | --- |
| `SQ-2026-004` imagem Debian do servico IA | 189 | 185 anteriores, mais 4 novos (#578 `zlib1g` high com versao corrigida; #579 a #581 `gcc`, low, sem versao corrigida). A base fixada em #471 aparentemente nao traz o `zlib1g` corrigido (inferencia; imagem nao inspecionada). A maioria nao tem versao corrigida no scanner. |
| `SQ-2026-253` CodeQL #533 | 1 | **A correcao de #471 nao fechou o alerta.** Disposicao volta para `investigar`; a linha exata continua nao lida porque a API de Code Scanning nao e legivel nesta sessao. |
| `SQ-2026-254` deepmerge | 1 | Sem versao corrigida; so dependencia de desenvolvimento. |
| `SQ-2026-255` minimatch (novo) | 2 | GHSA-g3hv-75wg-m249 (>=7 <11.0.1). Dependencia de desenvolvimento no backend; web nao inspecionado. Aguarda atualizacao compativel de `glob`; sobrescrever para a linha 11 nao foi validado. |
| `SQ-2026-256` zlib das imagens Node (novo) | 2 | CVE-2026-4738, versao corrigida `1.4-r0`. Correcao nesta PR. |

## Correcao nesta PR

- Pin `zlib=1.4-r0` nos Dockerfiles do backend e do web, com o teste
  `validar-dockerfiles-runtime.spec.mjs` atualizado primeiro (RED: 1 falha; GREEN:
  13 de 13). A disponibilidade de `1.4-r0` no indice Alpine 3.24 foi registrada na
  PR #455 (`tasks/food06-ci-zlib.md`) e **nao foi reverificada aqui**: o proxy
  bloqueou o indice. O build das imagens no CI e a prova; sem Docker daemon nesta
  sessao.

## Validacao

| Gate | Resultado |
| --- | --- |
| `pnpm test:inventario-security-quality` | PASS (195 alertas cobertos) |
| `validar-dockerfiles-runtime.spec.mjs` | PASS 13/13 |
| Build e Trivy das imagens | SKIPPED local; CI da PR e da main |
| Efeito de #582/#583 | NAO VERIFICADO ate merge e nova varredura |

## Proximos passos

- `SQ-2026-253`: ler a linha do alerta #533 na aba Security e corrigir.
- `SQ-2026-004`: decisao do proprietario sobre aceitar com prazo ou trocar a base.
- Depois do merge: recapturar e aposentar `SQ-2026-256` se #582 e #583 fecharem.
