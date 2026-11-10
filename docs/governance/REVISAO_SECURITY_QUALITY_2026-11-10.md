# Revisao do inventario Security & Quality — 2026-11-10 (captura de 2026-11-09T23:56Z)

Risco: R4 (inventario de seguranca e imagem de producao do servico de IA).
Continua a revisao de [2026-11-09](REVISAO_SECURITY_QUALITY_2026-11-09.md), depois do
merge das PRs #491 a #499. Tarefa T9 do plano FOOD06; prazo duro anterior: o
`revisarEm` mais proximo era 2026-11-16 (SQ-2026-256), com reprovacao de todas as
PRs a partir de 2026-11-17.

## Captura

- Run 42724463312 (`workflow_dispatch`, `main` `903f4fec`), `capturadoEm`
  `2026-11-09T23:56:51.831Z`. JSON remontado do eco do log do job e conferido contra
  o hash e a contagem de partes declarados no proprio log
  (`sha256=75d42f15...aa19`, 54960 bytes, 25 partes). Bytes em
  [inventario-capturado.json](evidencias/2026-11-10/inventario-capturado.json), com o
  hash fixado por teste.
- Resultado: 201 Code Scanning, 3 Dependabot, zero Secret Scanning (eram 192 e 3).
  Delta: 12 alertas novos, 3 fechados (#533, #582, #583), 189 mantidos.

## O que fechou

- **#533 (CodeQL, SQ-2026-253):** fechou depois da #492. O fix foi provado antes
  com CodeQL local e agora com a varredura da main. Causa aposentada.
- **#582 e #583 (zlib das imagens Node, SQ-2026-256):** fecharam com o pin
  `zlib=1.4-r0` da #477. Causa aposentada.

## O que entrou

| Causa | Alertas | Situacao |
| --- | --- | --- |
| `SQ-2026-257` pip vendorizado na imagem IA | 9 (#353, #354, #355, #584 a #589) | **Regressao da #481.** Um critical (certifi 2026.6.17, corrigida 2026.10.18), cinco high, dois medium, um low. O lock da aplicacao ja tem certifi 2026.10.23; os alertas sao as copias vendorizadas do pip da base. Correcao nesta PR. |
| `SQ-2026-258` Semgrep em arquivo de teste | 1 (#555) | `falso_positivo`, severidade none, `Object.assign` em fixtures de `servico-planos-alimentares.spec.ts`. Linha exata nao lida. Revisar em 2027-02-08. |
| `SQ-2026-004` (existente) | 189 -> 191 | Entram #576 e #577 (`apt`/`libapt-pkg7.0` 3.0.3, corrigida 3.0.4, CVE-2026-109518, high). A correcao e atualizar o digest da base. |

`SQ-2026-254` (deepmerge) e `SQ-2026-255` (minimatch) seguem como estavam.

## Correcao nesta PR (SQ-2026-257)

As rotas de remocao do pip em `octaclin-ai-service/Dockerfile` e o
`caminhos_ausentes` do harness em `trivy.yml` estavam em `python3.14` depois da
base ir para 3.15; o `test ! -e` do harness passava por o caminho nao existir. O
teste `validar-dockerfiles-runtime.spec.mjs` agora deriva a versao menor da tag do
`FROM` (RED: 2 falhas; GREEN: 14 de 14) e Dockerfile e `trivy.yml` foram para
`python3.15`. Licao registrada em `docs/agents/LESSONS_LEARNED.md`.

## Validacao

| Gate | Resultado |
| --- | --- |
| `pnpm test:inventario-security-quality` | PASS (204 alertas cobertos; 42 testes do spec) |
| `validar-dockerfiles-runtime.spec.mjs` | PASS 14/14 (RED antes: 2 falhas) |
| `test:actions-imutaveis`, `test:lock-python`, `security:secrets`, `git diff --check` | PASS |
| `test:workflows-seguros` | FAIL **pre-existente e de ambiente**: o `preflight` exige PowerShell, ausente neste sandbox Linux (mesma falha sem as mudancas); o CI executa |
| Build da imagem IA e harness (`python3.15` ausente) | SKIPPED local (sem Docker daemon); CI desta PR e a prova |
| Fechamento dos 9 alertas de SQ-2026-257 | NAO VERIFICADO ate o merge e nova varredura da main |

## Proximos passos

- Depois do merge: recapturar a main e aposentar `SQ-2026-257` se os 9 alertas
  fecharem (condicao de saida na causa).
- `SQ-2026-004` (`revisarEm` 2026-11-20): decisao do proprietario sobre aceitar com
  prazo ou trocar a base; os dois `apt` 3.0.4 podem sair com um digest novo.
- A fronteira que trava as PRs passou de 2026-11-17 para **2026-11-21**
  (`SQ-2026-004` e `SQ-2026-257`, `revisarEm` 2026-11-20).
