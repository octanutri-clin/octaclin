# Relatorio de seguranca - PR 54: DAST e probes ativos em staging

Status em 2026-09-09: **automacao local PASS; setima execucao no staging
descartavel e review humano pendentes**. Nenhum resultado dinamico foi inferido
a partir dos testes unitarios nem das execucoes interrompidas antes dos probes.

## Escopo entregue

- preflight fail-closed para execucao manual e alvos loopback exatos;
- 29 probes ativos serializados sob teto imutavel de 30 requisicoes, incluindo
  a conclusao MFA real das tres identidades privilegiadas sinteticas;
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
| `node --test octaclin-web/scripts/e2e-mfa.spec.mjs` | PASS (3/3) |
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

## Tentativa externa sem resultado dinamico

O run autorizado `34358063540`, no commit `28dae9c`, falhou em
`pnpm/action-setup` antes do preflight e antes de provisionar a branch Neon. O
workflow mutavel ainda declarava `PNPM_VERSION: "9"`, divergente do
`packageManager` `11.25.0` da raiz. Probes e ZAP ficaram `SKIPPED`; portanto o
run nao constitui evidencia de seguranca dinamica.

A correcao alinha o workflow em `11.25.0` e inclui
`.github/workflows/staging-e2e-mutavel.yml` nas fontes obrigatorias de
`pnpm test:versao-pnpm`. O contrato legado do staging tambem passou a validar
as actions Neon atuais por SHA completo e a entrada `role: neondb_owner`.

O segundo run autorizado `34359110425`, no commit `4463a2a`, passou por setup,
preflight, branch Neon, migrations, fixtures e validacao de role/RLS para os
dois tenants. O backend encerrou no bootstrap antes dos probes porque o
workflow mantinha `NODE_ENV=production` sem declarar `APP_AMBIENTE`; com isso,
os Redis e MinIO efemeros em loopback foram corretamente tratados como uma
violacao de TLS de producao. O cleanup da branch Neon passou.

A correcao preserva `NODE_ENV=production` para o build e declara
`APP_AMBIENTE=test` para os processos descartaveis do runner. O contrato do
workflow reprova a remocao dessa classificacao. Staging e producao continuam
exigindo TLS e falha fechada.

O terceiro run autorizado `34376987488`, no commit `e631e22`, comprovou a
correcao de classificacao: backend e web iniciaram, e o readiness passou. A
jornada mutavel existente parou antes dos probes em `GET /api/auth/session`,
com `401`. A causa foi a defasagem do fixture: `SuperAdmin` e `Professional`
passaram a exigir MFA no PR 41, mas o runner ainda interpretava o `200` com
desafio MFA como se tokens e cookies de sessao tivessem sido emitidos. Probes
e ZAP ficaram `SKIPPED`; o cleanup da branch Neon passou e o run nao constitui
evidencia DAST.

A correcao nao cria bypass. Cada run passa a gerar um segredo TOTP Base32
aleatorio, mascara-lo antes de exportar e persisti-lo cifrado apenas nos
fatores das identidades privilegiadas do banco descartavel. Os runners BFF e
API concluem o MFA real; usuarios privilegiados criados durante o onboarding
percorrem tambem a configuracao inicial. As suites que reutilizam contas
aguardam a proxima janela TOTP para preservar a protecao contra replay. Uma
quarta execucao exige nova autorizacao especifica para o run.

O quarto run autorizado `34382517812`, no commit `80f2e8f`, confirmou o segredo
MFA efemero, as migrations, os fixtures, a role runtime, o RLS, os dois tenants,
os builds e o readiness. A jornada chegou a `POST /api/auth/mfa/concluir-login`,
mas recebeu `401`; probes, ZAP e onboarding ficaram `SKIPPED`. O cleanup da
branch Neon passou, portanto nao houve ambiente descartavel residual.

O codigo TOTP estava correto. O fator sintetico era persistido como habilitado,
mas com `ultimo_contador_totp = NULL`. A protecao antirreplay valida o token e
depois atualiza somente quando `ultimo_contador_totp < contador_atual`; em SQL,
`NULL < valor` nao e verdadeiro, a atualizacao afeta zero linhas e o servico
retorna o erro generico de MFA. A correcao inicializa o piso sintetico em `0`,
sem alterar a validacao ou a protecao antirreplay de producao. Uma quinta
execucao exige nova autorizacao especifica para o run.

O quinto run autorizado `34386998848`, no commit `8a955d4`, confirmou a
correcao do MFA ao avancar pela jornada autenticada ate a confirmacao do anexo
do formulario publico. O endpoint recusou o objeto com `400` e a mensagem
`Estrutura da imagem invalida ou nao reconhecida.`; probes, ZAP e onboarding
ficaram `SKIPPED`. As evidencias sanitizadas foram publicadas e o cleanup da
branch Neon passou, sem ambiente descartavel residual.

O hardening de imagem funcionou como projetado. O runner enviava somente 12
bytes do cabecalho JFIF, suficientes para deteccao superficial de MIME, mas sem
marcador estrutural de dimensoes. A correcao troca esse fragmento pelo PNG real
e versionado `octaclin-192.png`, lido em runtime pelo fixture, e adiciona um
contrato para assinatura PNG, `IHDR` e dimensoes positivas. Nenhum parser,
limite ou validacao de producao foi relaxado. Uma sexta execucao exige nova
autorizacao especifica para o run.

O sexto run autorizado `34390129868`, no commit `12db8f5`, aprovou migrations,
fixtures, role/RLS, dois tenants, MFA, upload do PNG, jornadas mutaveis e os 29
probes ativos dentro do teto de 30 requisicoes. O ZAP percorreu 31 URLs e
reportou `0 FAIL`, `6 WARN` e `61 PASS`, mas o processo nao conseguiu gravar o
JSON bruto em `/zap/wrk` por diferenca de permissao entre o runner e o usuario
do container. Sem JSON avaliavel, o gate falhou fechado; onboarding ficou
`SKIPPED`. As evidencias disponiveis foram publicadas e o cleanup Neon passou,
sem ambiente descartavel residual. O run nao constitui o PASS externo final.

A correcao cria um diretorio exclusivo sob `$RUNNER_TEMP`, gravavel pelo usuario
nao privilegiado do ZAP, e monta somente esse diretorio em `/zap/wrk`, em vez de
expor todo o checkout ao container. O avaliador continua exigindo o JSON e
publicando apenas o resumo sanitizado. Uma setima execucao exige nova
autorizacao especifica para o run.

## Gate externo pendente

Executar `OctaClin staging E2E mutavel` no head deste PR com:

- `executar_seguranca_dinamica`: `true`;
- `confirmacao_seguranca_dinamica`: `DAST-FUZZ-STAGING-DESCARTAVEL`.

Registrar aqui o run, commit, totais sanitizados do ZAP, 29/30 probes e qualquer
falso positivo ou achado confirmado. O gate so vira `PASS` com cleanup verde,
zero `critical/high` confirmado aberto e revisao humana concluida.

## Falsos positivos

Nenhum registrado nesta versao. O ledger inicia vazio. Nao converter achado em
falso positivo sem evidencia reproduzivel, owner e prazo.

## Rollback

Reverter os arquivos da PR. Nenhuma alteracao de producao, conta externa ou
dado real foi executada pela elaboracao local.
