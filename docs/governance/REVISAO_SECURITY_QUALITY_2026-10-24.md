# Revisao do inventario e da auditoria Mobile — 2026-10-24

## Escopo e fontes

Revisao tecnica para os checks de Governanca/Mobile da PR #441. Nao representa
encerramento de SQ-4, liberacao Mobile, autorizacao de producao ou ratificacao
clinica. O inventario anterior continua recuperavel no Git em
`f2ff69e9:docs/governance/inventario-security-quality.json`; as evidencias antigas
das causas foram preservadas.

- Captura autenticada: [run 40073140896](https://github.com/octanutri-clin/octaclin/actions/runs/40073140896),
  job `Capturar snapshot`, concluido com sucesso usando o secret de captura
  previsto no workflow existente. O job separado de aviso reprovou pelo prazo
  vencido, como esperado; nao confundir as duas conclusoes.
- Main capturada: `9e1984a277e89469581b620d8c637324327a9342`,
  `capturadoEm: 2026-10-24T07:11:22.967Z`.
- JSON original preservado em [inventario-capturado.json](evidencias/2026-10-24/inventario-capturado.json).
  SHA-256: `3e8cb7400759f9a22b6ce8d7e1975f0dd4b78cead1788c69590ab207ed89985c`.
- O download direto do ZIP foi bloqueado pelo canal local. A remontagem dos 21
  blocos publicados pelo proprio capturador foi conferida por ordem, completude
  e hash antes da leitura. O teste do inventario exige igualdade do snapshot e
  do hash dessa evidencia; nenhum alerta foi removido por edicao manual.
- A credencial local recebeu HTTP 403 ao consultar Code Scanning. A captura foi
  executada pelo workflow de leitura ja existente, sem mudar permissoes,
  secrets, ambiente ou regras do repositorio.

## Reconciliacao do inventario

Foram observados 171 alertas Code Scanning, quatro Dependabot e zero Secret
Scanning, totalizando 175 referencias. Em relacao ao snapshot de 09/10, 53
referencias deixaram de aparecer na lista de abertos e cinco novas apareceram.
As 175 referencias atuais pertencem a exatamente uma causa; nao foram feitas
dispensas, exclusoes ou alteracoes de estado pela API de seguranca.

| Causa | Referencias atuais | Disposicao | Evidencia da revisao |
| --- | ---: | --- | --- |
| SQ-2026-004 | 167 | corrigir | Imagem IA: 44 high, 58 medium, 61 low e quatro none. Tres alertas none oferecem patch para liblzma5/ca-certificates. Mantida a severidade contextual critical conservadora; nova revisao em 07/11, dentro de 14 dias. |
| SQ-2026-139 | 0 | mitigado | Historico OpenSSL preservado; nenhuma referencia atual. |
| SQ-2026-239 | 0 | mitigado | Historico image-size preservado; nenhuma referencia atual. |
| SQ-2026-240 | 0 | mitigado | Todas as referencias proxy-addr antigas ausentes na captura de abertos; condicao e evidencia anteriores preservadas. |
| SQ-2026-241 | 0 | mitigado | Referencias source-map-js antigas ausentes. |
| SQ-2026-242 | 0 | mitigado | Referencias sharp antigas ausentes. |
| SQ-2026-243 | 2 | aguardando_upstream | braces continua no snapshot da API, com backport exato ja previsto e testes negativos existentes. |
| SQ-2026-244 | 2 | aguardando_upstream | node-forge continua no snapshot, sem primeira versao corrigida; backport existente verificado. |
| SQ-2026-245 | 0 | mitigado | GHSA-hp3w-g68c-fv3c retirado pelo publicador em 22/10; confirmado na API publica. sprintf-js 1.0.3 permanece no lock; nao foi declarado upgrade corretivo. |
| SQ-2026-246 | 0 | mitigado | Referencia postcss-selector-parser antiga ausente. |
| SQ-2026-247 | 0 | mitigado | Referencias zlib antigas ausentes. |
| SQ-2026-248 | 2 | corrigir | Novo GHSA-6q48-6c7w-9gw2, certifi critical. Lock IA ja fixa 2026.10.19, mas #113 continua aberto; lock de pesquisa 319 ainda fixa 2026.7.22 (#114). Exige correcao do lock de pesquisa e fechamento comprovado pela API. |
| SQ-2026-249 | 2 | corrigir | Novos #514/#515: musl-utils 1.2.6-r2, patch 1.2.6-r3, severidade none, nas imagens backend/web. |

Os locks atuais tambem foram conferidos: proxy-addr 2.0.8, source-map-js 1.2.2,
sharp 0.35.5 e postcss-selector-parser 7.1.6; os Dockerfiles instalam zlib
1.3.2-r1. Ausencia na lista de abertos nao prova isoladamente a razao do fechamento.
`mitigado` registra o atendimento da condicao anterior de nova captura sem as
referencias vinculadas; o historico e a possibilidade de reabertura permanecem.
Os alertas atuais com patch continuam como trabalho pendente. Nenhum gate de
ausencia de critical/high corrigivel foi habilitado ou declarado aprovado.

## Causa e correcao do check Mobile

O advisory novo [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
afeta Zod anterior a 4.6.6. Uma colecao excedente ainda processava cada elemento,
mesmo com tamanho maximo declarado. A CLI Expo 57.0.27 consumia Zod 3.25.76;
na consulta de 24/10, essa continua sendo a ultima versao 3 publicada. Mesmo a
CLI Expo atual publicada ainda declarava a faixa 3. A correcao upstream esta
em [a0ebf970](https://github.com/colinhacks/zod/commit/a0ebf970f2d752e5f58527cd2942ff48be4f46bd).

Foi escolhido um override exato e restrito a `@expo/cli@57.0.27>zod: 4.6.7`.
Nao houve bump de SDK, React Native, dependencias de aplicacao ou expansao das
excecoes da auditoria. A faixa exata do pai exige reavaliacao quando a CLI mudar.
O pacote e MIT, publicado em 12/10, com integridade SHA-512 conferida contra o
registro e fixada no lock; a quarentena de 24 horas e os controles de scripts,
trust policy e store permanecem ativos.

Foram inspecionados os dois consumidores diretos de Zod na CLI:
`DevToolsPlugin.schema.js` e `createMCPDevToolsExtensionSchema.js`. Ambos usam
o entrypoint principal; nenhum depende de `zod/v3`. Os testes usam esses
modulos reais para validar plugins, saidas, tipos de parametros, enum de
comandos, objetos readonly e rejeicao de propriedades extras. Nao foi
adicionado um pacote MCP nem habilitada integracao MCP.

O advisory [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv)
continua sem versao upstream corrigida. O backport RSA existente e seu teste
negativo permanecem intactos. O audit passara com aviso desse residual somente
quando seus testes exatos passarem; nao significa auditoria bruta sem alertas.

## Evidencias executadas

| Verificacao | Resultado observado |
| --- | --- |
| Baseline `audit:security`, Node 22 | FAIL com node-forge e Zod, reproduzindo o CI. |
| Testes Zod antes do override | RED: os dois testes de curto-circuito sync/async processavam tres elementos em vez de zero; os dois testes de contrato passavam. Entradas exclusivamente sinteticas e pequenas. |
| `test:security` apos instalacao estavel | PASS, 14/14, incluindo regressao dos dois backports e quatro testes Zod/CLI. |
| `audit:security` apos correcao | PASS com aviso do backport node-forge; nenhuma excecao nova nem supressao. |
| Typecheck Mobile | PASS. |
| Testes a11y Mobile | PASS, 15/15. |
| Licencas Mobile | PASS, 586 pacotes. |
| Instalacao congelada | PASS, pnpm 11.25.0/Node 22.23.4, policies do lock verificadas. |
| Testes do inventario antes da reconciliacao | RED: cobertura antiga e revisao vencida. |
| Agregado de inventario apos reconciliacao | PASS, 73/73 e CLI com 175 referencias cobertas. Inclui hash do original e bordas 06/11, 07/11 e 08/11. |
| `expo install --check` online adicional | FAIL: catalogo remoto recomenda patches gerais do SDK e outra versao TypeScript; nao foi usado como justificativa para alterar o SDK nesta PR. |
| Gate canonico `EXPO_OFFLINE=1 pnpm run doctor` local | BLOCKED: 19/21 passaram; dois checks de metadados externos falharam por conexao recusada (Expo API/React Native Directory). Preservar o gate no CI. |
| Exportacao Mobile | PASS, `expo export --platform all`, bundles Android/iOS/Web produzidos no diretorio descartavel. |

O primeiro ensaio paralelo local coincidiu com reinstalacao automatica do pnpm
e falhou ao resolver braces durante o audit. Foi descartado como prova da
correcao; a instalacao e os comandos foram repetidos em sequencia no mesmo
diretorio descartavel. Os resultados PASS acima sao da repeticao estavel.
Node, pnpm e dependencias ficaram no ambiente local; nenhuma dependencia de
tooling foi adicionada ao produto. O cache regeneravel local do Trivy foi
limpo para liberar espaco; os arquivos versionados e pesquisas foram preservados.

## Rollback e limites

Reverter somente o override e seu lock restaura Zod vulneravel e deve deixar o
check vermelho. Nao adicionar o advisory a allowlists nem retirar testes para
viabilizar rollback. A captura original e o historico anterior do inventario
devem continuar preservados em qualquer reconciliacao futura.

CI do novo HEAD e revisao cruzada de seguranca continuam necessarios. Nao foram
feitos merge, deploy, migrations externas, distribuicao Mobile, novos testes
da PoC 319 ou alteracoes de configuracao de producao.
