# Relatorio de seguranca - PR 54: DAST e probes ativos em staging

Status em 2026-09-08: **automacao local PASS; execucao no staging descartavel,
checks do PR e review humano pendentes**. Nenhum resultado dinamico foi inferido
a partir dos testes unitarios.

## Escopo entregue

- preflight fail-closed para execucao manual e alvos loopback exatos;
- 26 probes ativos serializados sob teto imutavel de 30 requisicoes;
- auth, BFLA, BOLA, mass assignment, parser, limites, upload, webhook e rate limit;
- OWASP ZAP Baseline passivo, versao `2.17.0` e manifesto
  `sha256:781a2bdaea47324e7bab583e2263f21d257b0aee61ed51521a5be45f5f5081ef`;
- evidencia sanitizada e ledger fail-closed para falsos positivos.

Fora de escopo: producao, terceiros, carga/DoS, exploracao destrutiva, scanner
ativo irrestrito, pentest independente da PR 55 e mobile da PR 56.

## Evidencia local

| Prova | Resultado |
| --- | --- |
| `pnpm test:seguranca-dinamica` | PASS (19/19) |
| `pnpm test:workflows-seguros` | PASS (7/7) |
| `pnpm test:actions-imutaveis` | PASS (15/15) |
| `pnpm --dir octaclin-web lint` | PASS, 52 warnings historicos fora do diff |
| `pnpm --dir octaclin-web typecheck` | PASS |
| `pnpm security:secrets` | PASS |
| `pnpm validate:docs` | PASS |
| `node --check scripts/seguranca-dinamica-cli.mjs` | PASS |
| `node --check octaclin-web/scripts/e2e-seguranca-dinamica.mjs` | PASS |
| parse YAML de `ci.yml` e `staging-e2e-mutavel.yml` | PASS |
| `git diff --check` | PASS |

O host local usa Node 24, fora do contrato `>=22 <23`; o CI oficial em Node 22
precisa repetir os gates. Os testes com `fetch` controlado provam serializacao,
orcamento, cobertura e redacao, mas nao substituem a execucao real.

## Gate externo pendente

Executar `OctaClin staging E2E mutavel` no head deste PR com:

- `executar_seguranca_dinamica`: `true`;
- `confirmacao_seguranca_dinamica`: `DAST-FUZZ-STAGING-DESCARTAVEL`.

Registrar aqui o run, commit, totais sanitizados do ZAP, 26/30 probes e qualquer
falso positivo ou achado confirmado. O gate so vira `PASS` com cleanup verde,
zero `critical/high` confirmado aberto e revisao humana concluida.

## Falsos positivos

Nenhum registrado nesta versao. O ledger inicia vazio. Nao converter achado em
falso positivo sem evidencia reproduzivel, owner e prazo.

## Rollback

Reverter os arquivos da PR. Nenhuma alteracao de producao, conta externa ou
dado real foi executada pela elaboracao local.
