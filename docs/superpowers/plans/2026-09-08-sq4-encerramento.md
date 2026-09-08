# SQ-4 — reconciliacao final e retomada controlada

## Objetivo

Reconciliar o Security tab da `main` depois do SQ-3, tornar o inventario
versionado uma fotografia ativa dos residuos e autorizar a proxima etapa sem
fechar, dispensar ou esconder alertas que ainda dependem de upstream.

## Base e estado observado

- `main`: merge `98b6e5f17e7f4eae07b3fb537a91aea1d9e37394`, PR `#214`.
- Code Scanning: 213 alertas, todos Trivy.
- Dependabot: 2 alertas.
- Secret Scanning: 0 alertas.
- Total ativo: 215 alertas.
- Distribuicao: 173 IA, 20 backend, 20 web e 2 Mobile.
- Semgrep `#76`, `#82` e `#83` nao aparecem mais entre os alertas abertos.

## Tres causas raiz residuais

1. IA: 173 alertas sem versao corrigida publicada, mantidos abertos e com
   revisao em 2026-09-20.
2. Node/Alpine: 40 alertas de OpenSSL. O scanner conhece `3.5.8-r0`, mas a tag
   oficial `node:22-alpine` ainda resolve para o digest fixado que contem
   `3.5.7-r0`. Revisao em 2026-09-14; nao usar `apk upgrade` mutavel.
3. Mobile: Dependabot `#35` e `#36` de `image-size`, sem patch, cobertos por
   `SC-2026-005`, Mobile NO-GO e revisao em 2026-12-01.

## TDD do gate

### RED

- Alterar a expectativa do inventario canonico de 240 para 215 alertas.
- Exigir que `aguardando_upstream` com versao corrigida declare o bloqueio do
  artefato suportado.
- Exigir que o gate SQ-4 recuse investigacao pendente e causa critical/high
  ainda marcada como `corrigir`.

### GREEN

- Estender o validador com `bloqueioUpstream` para o caso de patch existente
  fora do artefato suportado.
- Ativar `gateEncerramentoSq4` no inventario canonico.
- Substituir as 215 causas unitarias por tres causas raiz, preservando cobertura
  exata de todas as referencias abertas.

## Evidencia exigida

- captura sanitizada ligada ao SHA integral da `main`;
- cobertura exata do inventario sem segredo bruto;
- owner, data de revisao, condicao de saida e controles para cada causa;
- CodeQL, Semgrep, Trivy, CI, imagens, SBOM, provenance e secrets verdes;
- `git diff --check`, testes do inventario e validacao documental verdes;
- revisao humana e merge humano.

## Decisao de retomada

SQ-4 nao transforma alerta aberto em alerta resolvido. Depois do merge, os 215
residuos continuam visiveis e revisaveis. Como nao ha investigacao pendente nem
critical/high classificado como corrigivel dentro de um artefato suportado, o
programa pode avancar para PR 53 e PR 54. A retomada funcional das Fases 256 a
261 ocorre depois desses dois gates, com capacidade reservada para seguranca.

Novo critical/high corrigivel volta a bloquear. Mudanca de upstream abre um PR
pequeno e independente para a causa correspondente.

## Risco e rollback

Risco R2: uma classificacao de upstream ficar obsoleta. O prazo de revisao e o
gate diario de alertas tornam a mudanca detectavel. Rollback: reverter a
atualizacao documental e do validador; nenhum schema, dado, deploy ou ambiente
de producao e alterado.

