# Revisao do inventario Security & Quality — 2026-11-11 (captura de 2026-11-11T21:27Z)

Risco: R4 (inventario de seguranca e imagem de producao do servico de IA). Continua a
revisao de [2026-11-10](REVISAO_SECURITY_QUALITY_2026-11-10.md), depois do merge da #500
e das PRs FOOD06 #511 a #518. Tarefa T9 do plano FOOD06 (recorrente). Nenhuma mudanca de
codigo, imagem, workflow ou configuracao: so inventario, teste e evidencia.

## Captura

- Run 43103169438 (`workflow_dispatch`, `main` `5ced18e6`), `capturadoEm`
  `2026-11-11T21:27:26.287Z`. JSON remontado do eco do log do job e conferido contra o
  hash e a contagem de partes declarados no proprio log
  (`sha256=a16c1dab...4b38`, 56847 bytes, 26 partes). Bytes em
  [inventario-capturado.json](evidencias/2026-11-11/inventario-capturado.json), com o hash
  fixado por teste.
- Resultado: 207 Code Scanning, 3 Dependabot, zero Secret Scanning (eram 201 e 3).
  Delta: 15 alertas novos, 9 fechados, 192 mantidos. Os dois jobs do run
  (`Aviso de vencimento` e `Capturar snapshot`) terminaram em sucesso.

## O que fechou

**SQ-2026-257 (pip vendorizado na imagem IA):** os 9 alertas (#353, #354, #355 e #584 a
#589) fecharam depois do merge da #500. A condicao de saida da causa foi atendida
(recaptura da `main` sem esses 9 alertas), entao ela foi aposentada. O historico fica no Git
e na revisao de 2026-11-10.

## O que entrou

| Causa | Alertas | Situacao |
| --- | --- | --- |
| `SQ-2026-004` imagem Debian do servico IA | 191 -> 206 | Entram #591 a #605: CVE-2026-107496, 88822, 88823, 95691 e 95692 em `libssl3t64`, `openssl` e `openssl-provider-legacy` 3.5.7-1~deb13u3. Severidade `none` e sem versao corrigida no scanner. Nao ha correcao alem de uma base nova. |

Continuam como estavam: `SQ-2026-254` (deepmerge), `SQ-2026-255` (minimatch) e
`SQ-2026-258` (Semgrep em arquivo de teste, #555). O alerta do Semgrep da #518 era de
escopo de PR e nao entrou na captura da `main`.

## Decisao do proprietario (pendente)

`SQ-2026-004` agora e a unica causa com `revisarEm` proximo (**2026-11-20**). A partir de
**2026-11-21** o check `Governanca de repositorio` reprova todas as PRs se a causa nao for
reavaliada. `revisarEm` **nao foi renovado**: renovar sem decisao seria o falso verde que
o inventario existe para impedir. Opcoes:

- **Aceitar com prazo:** os 206 residuos nao tem correcao no scanner; o runtime roda como
  nao-root, sem instalacao de pacotes, e a integracao de IA e opcional. Exige decisao
  explicita e nova data.
- **Trocar a base / atualizar o digest:** resolve o `apt` 3.0.4 (#576, #577, high) e pode
  trazer o `openssl` corrigido, mas exige validar compatibilidade, runtime, SBOM e Trivy no
  CI, e nao foi feito nesta PR.

Recomendacao: atualizar o digest da base em PR propria (R4, com a prova do CI) e so depois
recapturar; renovar a data so se o proprietario decidir aceitar o risco.

## Validacao

| Gate | Resultado |
| --- | --- |
| `pnpm test:inventario-security-quality` | PASS (73 testes; 210 alertas cobertos) |
| RED antes da atualizacao (inventario antigo, spec novo) | 4 falhas, como esperado |
| `git diff --check`, `pnpm security:secrets` | PASS |
| Build da imagem IA e Trivy | NA nesta PR (sem mudanca de imagem); a captura e a evidencia da `main` |
| Fechamento dos alertas de `SQ-2026-004` | NAO VERIFICADO: nada foi corrigido nesta PR |

## Proximos passos

- Decisao do proprietario sobre `SQ-2026-004` ate 2026-11-20.
- Se a base for atualizada: recapturar depois do merge e reconciliar o que fechar.

## Atualizacao depois da #520 (recaptura de 2026-11-11T22:17Z)

- Run 43110480135 (`workflow_dispatch`, `main` `d84b0f11`), feito depois do merge da #520 e do
  Trivy da `main` concluido com sucesso (capturar antes mostraria o estado anterior). JSON
  remontado do eco e conferido contra hash e partes declarados
  (`sha256=6a5228d6...b6e5`, 56323 bytes, 26 partes). Bytes em
  [inventario-capturado-pos-520.json](evidencias/2026-11-11/inventario-capturado-pos-520.json).
- Resultado: 205 Code Scanning, 3 Dependabot, zero Secret Scanning. Delta: **2 fechados
  (#576 e #577, `apt` 3.0.4, high), 0 novos**. Os high caem de 51 para 49. Era o previsto pela
  leitura da camada base da imagem antes da #520.
- **Achado novo:** os alertas de `zlib1g` (#289, #400 e #578) continuam abertos e **tem versao
  corrigida** (`1:1.3.dfsg+really1.3.1-1+deb13u1`). A camada base da `3.15.2-slim` traz
  `1:1.3.dfsg+really1.3.1-1+b1`, anterior a essa versao. Sao corrigiveis na imagem (por
  exemplo, fixar a versao do `zlib1g` no estagio final, como ja e feito com `zlib` nas imagens
  Node); isso e uma PR propria, R4, e **nao** esta nesta.
- `SQ-2026-004`: 204 alertas, 3 corrigiveis (zlib1g) e 201 sem correcao informada. `revisarEm`
  segue em **2026-11-20**, sem renovar: a decisao de aceitar os 201 com prazo continua do
  proprietario.
- Gates: `pnpm test:inventario-security-quality` PASS (73 testes; 208 alertas cobertos) e RED antes
  da atualizacao (inventario antigo, spec novo).
