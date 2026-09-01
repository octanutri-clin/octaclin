# Relatorio de seguranca - PR 49 (Supply chain e dependencias)

**Data:** 2026-09-01
**Risco:** R3 - bloqueador
**Branch:** `security/governanca-pr49-supply-chain-dependencias`
**Norma duravel produzida:** `docs/governance/POLITICA_SUPPLY_CHAIN_DEPENDENCIAS.md`

---

## 1. Baseline

| Item | Valor |
| --- | --- |
| PR 48 da governanca | Pull Request GitHub **#175**, `feat(security): isolar tooling de agentes (PR 48)` |
| Merge commit do PR 48 | `7b42d411b76ce8f4bfb268d495a0330d842fa3b8` |
| Relatorio do PR 48 no `main` | `docs/governance/RELATORIO_SEGURANCA_PR48_2026-08-31.md` |
| HEAD inicial do PR 49 | `7b42d411b76ce8f4bfb268d495a0330d842fa3b8` (identico a `origin/main`) |

Verificacao do gate de sequencia: `git merge-base --is-ancestor` confirmou que o
merge do PR 48 e ancestral de `origin/main` antes de qualquer alteracao. O
trabalho comecou com working tree limpa e sem nada staged.

---

## 2. Achados comprovados

### A1 - Controles de supply chain declarados, mas inertes sob o pnpm fixado

**Severidade:** alta. **Fonte:** `octaclin-backend/pnpm-workspace.yaml`,
`octaclin-web/pnpm-workspace.yaml`, campo `packageManager`.

O repositorio declarava `allowBuilds` (e, na web, `minimumReleaseAgeExclude`)
enquanto fixava `pnpm@9.15.9`. O pnpm 9 nao conhece nenhuma dessas chaves.

Prova, obtida com os binarios reais de cada versao baixados do registry:

| Chave | pnpm 9.15.9 | pnpm 10.34.5 | pnpm 11.25.0 |
| --- | --- | --- | --- |
| `strictDepBuilds` | ausente | presente | presente |
| `allowBuilds` | ausente | **ausente** | presente |
| `onlyBuiltDependencies` | presente | presente | substituida por `allowBuilds` |
| `minimumReleaseAge` / `Exclude` | ausente | presente | presente |
| `minimumReleaseAgeStrict` | ausente | ausente | presente |
| `trustPolicy` / `Exclude` / `IgnoreAfter` | ausente | presente | presente |
| `blockExoticSubdeps` | ausente | presente | presente |
| `trustLockfile` | ausente | ausente | presente |
| `verifyStoreIntegrity` | presente | presente | presente |
| `strictStorePkgContentCheck` | presente | presente | presente |

Prova de comportamento (fixture sintetica local com `postinstall` que escreve um
marcador, sem pacote remoto):

- pnpm 9.15.9, com `strictDepBuilds: true` e `allowBuilds: {}` declarados:
  instalacao **exit 0** e o `postinstall` **executou**. Configuracao presente,
  controle inativo.
- pnpm 11.25.0, mesma configuracao: `ERR_PNPM_IGNORED_BUILDS`, **exit 1**, script
  nao executado.
- pnpm 11.25.0 com o pacote em `allowBuilds`: **exit 0** e script executado.

**Correcao:** pnpm fixado em `11.25.0` e configuracao migrada para as chaves que
essa versao efetivamente le.
**RED:** o cenario acima com pnpm 9.
**GREEN:** `pnpm test:instalacao-congelada`, que reexecuta as tres provas.

### A2 - Instalacao nao congelada em CI e em imagem

**Severidade:** alta. **Fonte:** `.github/workflows/ci.yml`,
`octaclin-backend/Dockerfile`, `octaclin-web/Dockerfile`.

Quatro pontos do CI usavam `pnpm install --frozen-lockfile=false` (jobs
`backend`, `web` e as duas instalacoes do `demo-smoke`), e os Dockerfiles do
backend e da web usavam a mesma flag. Manifest alterado sem lockfile
correspondente seria resolvido em silencio, e o lockfile versionado deixaria de
ser a fonte de verdade do build.

Os Dockerfiles ainda copiavam `pnpm-lock.yaml*` com glob, o que fazia o build
prosseguir mesmo **sem lockfile nenhum**. O Dockerfile da web nao copiava
`pnpm-workspace.yaml`, entao a imagem instalava sob politica diferente da do CI
(sem overrides de seguranca e sem `allowBuilds`).

**Correcao:** `--frozen-lockfile` em todos os pontos, lockfile obrigatorio sem
glob, `pnpm-workspace.yaml` copiado nas duas imagens.
**GREEN:** prova negativa em `pnpm test:instalacao-congelada` - manifest
divergente do lockfile reprova o modo congelado.

### A3 - Overrides de seguranca seriam descartados em silencio pelo pnpm 11

**Severidade:** alta. **Fonte:** bloco `pnpm.overrides` dos `package.json`.

O pnpm 11 nao le mais `pnpm.overrides` do `package.json`. Os tres apps
mantinham ali as remediacoes de `brace-expansion`, `fast-uri`, `js-yaml`,
`nanoid`, `postcss`, `sharp` e `uuid`. Uma atualizacao ingenua do package
manager teria removido essas protecoes sem erro.

A primeira tentativa de `--frozen-lockfile` com pnpm 11 falhou fechada, com
`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`, o que confirmou tanto o problema quanto a
protecao.

Havia ainda divergencia interna na web: `pnpm-workspace.yaml` listava apenas
`postcss` e `sharp`, enquanto o lockfile era governado pelo conjunto completo de
oito overrides do `package.json`.

**Correcao:** todos os overrides migrados para `pnpm-workspace.yaml`, conjunto
completo em cada componente, bloco `pnpm` removido dos `package.json`.
**GREEN:** frozen install limpo nos tres apps, com lockfile de backend e web
inalterado.

### A4 - Versao do package manager divergente entre fontes

**Severidade:** media. **Fonte:** CI, manifests, Dockerfiles.

`PNPM_VERSION: "9"` no CI (apenas major, resolvido para a ultima 9.x do dia),
`pnpm@9.15.9` em backend e web, **nada** na raiz e no mobile, e `corepack enable`
sem versao nos Dockerfiles. Quatro respostas diferentes para "qual pnpm?".

Fato adicional observado: ao rodar o pnpm 11 sobre o backend, ele trocou
sozinho para a versao de `packageManager` e concluiu com
`Done in 25.1s using pnpm v9.15.9`. O `packageManager` e a fonte de verdade
efetiva, e o `corepack enable` isolado baixava uma versao implicita.

**Correcao:** `pnpm@11.25.0` com hash de integridade nos quatro `package.json`,
`PNPM_VERSION: "11.25.0"` no CI, `corepack prepare pnpm@11.25.0 --activate` nos
Dockerfiles.
**GREEN:** `pnpm test:versao-pnpm` reprova major solto, divergencia entre fontes
e `corepack enable` sem versao fixada. Sao 11 declaracoes verificadas.

### A5 - Trust downgrade em quatro pacotes transitivos

**Severidade:** media. **Fonte:** `trustPolicy: no-downgrade` do pnpm 11.

Sinal que o pnpm 9 nao era capaz de produzir. Triagem factual pela metadata do
registry:

| Pacote | Publicado | Atestado | Versao atestada existente | Componente | Cadeia | Decisao |
| --- | --- | --- | --- | --- | --- | --- |
| `chokidar@4.0.3` | 2024-12-18 | nao | `5.0.0` (2025-11-25) | backend (dev) | `@nestjs/cli` > `@angular-devkit/*` | excecao datada |
| `semver@6.3.1` | 2023-07-10 | nao | `7.8.5` (2026-06-19) | backend, web, mobile | `@babel/core`, `eslint-plugin-import` | excecao datada |
| `eslint-import-resolver-typescript@3.10.1` | 2025-04-21 | nao | `4.4.5` (2026-06-01) | web (lint) | `eslint-config-next` | excecao datada |
| `ua-parser-js@1.0.41` | 2025-08-19 | nao | `2.0.10` (2026-05-21) | mobile | `react-native-web` > `fbjs` | excecao datada |

Causa comum: sao versoes anteriores a adocao de provenance pelo mantenedor, com
publicacao pelo mesmo publisher de sempre. Nao ha indicio de takeover. Todas sao
transitivas fixadas por upstream, nenhuma executa lifecycle script (negado por
`strictDepBuilds`) e nenhuma alcanca runtime de producao a nao ser pelo bundle do
mobile, que permanece NO-GO.

**Correcao:** `trustPolicyExclude` por versao exata, com excecao correspondente
no ledger (owner, prazo de 90 dias, controles compensatorios e condicao de
remocao). `trustPolicyIgnoreAfter` foi rejeitado por desligar a verificacao para
toda versao antiga.

### A6 - Advisory nova no mobile com correcao segura disponivel

**Severidade:** moderada. **Fonte:** `pnpm audit` do mobile.

`GHSA-vcc3-ghjq-m6fr` em `decode-uri-component@0.2.2`, pela cadeia
`expo-router` > `query-string`. Medido tambem no baseline nao modificado
(`main`, pnpm 9.15.9), onde ja reprovava `pnpm audit:security` - portanto e
divida preexistente, nao efeito da atualizacao do package manager.

Como havia correcao publicada (`0.5.0`), a decisao foi **corrigir, nao excetuar**:
override `decode-uri-component@<0.5.0: 0.5.0`. Validado com
`pnpm build:validate` (export Expo para android, ios e web) e `pnpm typecheck`,
ambos verdes. O unico pacote alterado no lockfile do mobile foi esse; o restante
do diff e o sufixo de peers que o pnpm 11 passa a anotar.

### A7 - Gate de auditoria do mobile acoplado ao formato de relatorio do pnpm 9

**Severidade:** media. **Fonte:** `octaclin-mobile/scripts/audit-seguranca-lib.mjs`.

O validador das duas excecoes upstream de `image-size` exigia
`patched_versions === '<0.0.0'`, `recommendation === 'None'` e caminho contendo
`image-size@1.2.1`. O pnpm 11 usa `patched_versions: null`, omite
`recommendation` e nao anota versao no caminho do grafo. O gate reprovaria
excecoes legitimas.

**Correcao:** aceitar as duas formas de "sem correcao publicada" e provar a
origem pelo caminho (`metro` > `image-size`) sem depender da anotacao de versao -
a versao continua verificada em `findings[].version`.
**RED:** tres testes novos no formato pnpm 11 (um falhando).
**GREEN:** 11 testes passando, incluindo dois negativos novos que reprovam
caminho fora do metro e modulo diferente do esperado.

### A8 - Grafo Python transitivo nao congelado

**Severidade:** media. **Fonte:** `octaclin-ai-service/requirements.txt`.

As quatro dependencias diretas estavam fixadas com `==`, mas nada congelava o
grafo transitivo: `starlette`, `anyio`, `h11`, `pydantic-core`, `uvloop`,
`websockets`, `httptools`, `watchfiles` e o restante flutuavam a cada build de CI
e de imagem. Nao havia verificacao de hash.

**Correcao:** `requirements.lock.txt` universal, gerado por
`uv pip compile --generate-hashes --universal --python-version 3.12`, com 644
linhas cobrindo 22 pacotes resolvidos. CI e Dockerfile instalam com
`--require-hashes`.
**RED/GREEN:** com todos os hashes de um pacote adulterados,
`pip install --require-hashes` recusa com
`THESE PACKAGES DO NOT MATCH THE HASHES FROM THE REQUIREMENTS FILE` (exit 1); com
o lock integro, instala (exit 0). A prova roda no job `AI FastAPI` do CI.
Observacao registrada: o pip aceita a instalacao se **qualquer** hash listado
casar, entao a prova precisa adulterar todos os hashes do pacote - adulterar
apenas um produz falso verde.

### A9 - Licencas sem politica e sem inventario

**Severidade:** media.

Nao havia politica nem inventario. Levantamento sobre os tres `node_modules`
reais (1699 pacotes unicos): nenhuma licenca bloqueada, e cinco casos que
exigiam decisao explicita - `MPL-2.0` (axe-core, @axe-core/playwright,
@vercel/og, lightningcss), `LGPL-3.0-or-later` (@img/sharp-libvips-*),
`(BSD-3-Clause OR GPL-2.0)` (node-forge, resolvido pelo lado BSD),
`MIT AND Apache-2.0` e um aparente `NOASSERTION`.

O `NOASSERTION` era **falso positivo do proprio inventario**: o arquivo estava em
`expo-modules-autolinking/node_modules_mock/`, uma arvore de teste empacotada
pela dependencia, e o pacote real e MIT no registry. O coletor passou a exigir
posicao real de dependencia instalada.

**Correcao:** `docs/governance/politica-licencas.json` com quatro classes,
revisoes concluidas documentadas para MPL-2.0 e LGPL, e gate com semantica SPDX
real. **GREEN:** os tres apps aprovam (751, 395 e 553 pacotes).

### A10 - SBOM do Trivy nao e reproduzivel campo a campo (achado do proprio gate)

**Severidade:** baixa (qualidade de gate). **Fonte:** primeira execucao do gate
de reproducao no CI do PR 49.

O gate reprovou a si mesmo com `SBOM nao reproduzivel. as relacoes de dependencia
divergem.` A investigacao local, com duas execucoes do Trivy 0.74.0 sobre o mesmo
checkout, mostrou a causa: alem de `serialNumber` e `metadata.timestamp`, o Trivy
**sorteia um `bom-ref` UUID novo para cada componente a cada execucao**, e
`dependencies` referencia esses UUIDs. Medicao: 940 componentes e 941 relacoes
nas duas execucoes, com 2962 referencias, todas resolviveis, e nenhum componente
em comum entre os `bom-ref` das duas.

Havia ainda um segundo efeito: refs distintos podem resolver para a mesma
identidade quando o mesmo pacote aparece por mais de um caminho, e ordenar as
relacoes apenas por `ref` deixava a ordem dessas entradas dependente da ordem de
emissao do scanner.

**Correcao:** resolver cada ref para a identidade estavel do componente (PURL, ou
`nome@versao`) antes de comparar, e ordenar pela entrada inteira. Um ref que nao
resolva e preservado marcado, para falhar e exigir analise em vez de sumir.

**RED:** duas execucoes reais do Trivy sobre o mesmo commit reprovavam.
**GREEN:** as mesmas duas execucoes passam com
`SBOM reproduzivel: 859 componentes com inventario semantico identico`, e as
provas negativas continuam reprovando sobre os mesmos dados reais: relacao
removida reprova, versao de pacote alterada reprova, ecossistema inteiro ausente
reprova. Tres testes unitarios novos cobrem o caso.

Este achado e a razao de o gate existir: o SBOM anterior era publicado sem
nenhuma verificacao de que duas execucoes descreviam o mesmo inventario.

### A11 - Alertas Trivy de container sao preexistentes, nao introduzidos

**Severidade:** informativa. **Fonte:** check `Trivy` do PR 49, que reportou
"8 new alerts including 5 high severity".

O PR altera os tres Dockerfiles (pnpm fixado, instalacao congelada, lockfile
obrigatorio), e por isso o Trivy reatribuiu ao PR misconfiguracoes que ja
existiam nesses arquivos. Comparacao reproduzivel entre `origin/main` e o HEAD do
PR, ambos exportados limpos com `git archive` e escaneados com
`trivy fs --scanners vuln,misconfig,license`:

| | Baseline `origin/main` | HEAD do PR 49 |
| --- | --- | --- |
| Total de findings | 9 | 8 |
| `DS-0002` (sem USER non-root) | 3 (HIGH) | 3 (HIGH) |
| `DS-0026` (sem HEALTHCHECK) | 3 (LOW) | 3 (LOW) |
| `CVE-2025-71329` / `CVE-2025-71330` (`image-size@1.2.1`) | 2 (HIGH) | 2 (HIGH) |
| `CVE-2026-45822` (`decode-uri-component@0.2.2`) | 1 (MEDIUM) | **0 - removido** |

**Findings novos introduzidos pelo PR: nenhum. Findings removidos: um.** Os cinco
HIGH sao os tres `DS-0002` mais os dois CVEs de `image-size`, ja triados como
`SC-2026-005` no ledger.

`DS-0002` e `DS-0026` sao exatamente non-root e healthcheck, itens que o programa
de hardening atribui explicitamente ao **PR 50 - Containers e runtime**. Corrigi-los
aqui ampliaria o escopo do PR 49 e, no ambiente desta execucao, seria uma mudanca
nao testada: o daemon do Docker nao esta disponivel, entao nao ha como provar que
as imagens continuam subindo com `USER` non-root (o `next start` da web escreve em
`.next/cache`) nem que ha binario para o `HEALTHCHECK` nas imagens `alpine` e
`slim`. Fica registrado como divida conhecida, com dono definido no PR 50.

---

## 3. Package manager

| Item | Valor |
| --- | --- |
| Versao anterior | `pnpm@9.15.9` em backend e web; nada na raiz e no mobile; `9` (major) no CI; implicita nos Dockerfiles |
| Versao final | `pnpm@11.25.0`, exata, com `+sha512-...` de integridade |
| Onde esta fixada | `packageManager` dos quatro `package.json`, `PNPM_VERSION` do CI, `corepack prepare` dos dois Dockerfiles Node |

**Por que 11 e nao 10.** A menor atualizacao seria o pnpm 10, mas ele **nao le**
`allowBuilds` - a chave que o repositorio ja usava. No pnpm 10 seria preciso
reescrever para `onlyBuiltDependencies`, que o pnpm 11 por sua vez ignora
silenciosamente (confirmado no CHANGELOG do pnpm 11: "Those settings were
replaced by `allowBuilds` in pnpm 11 and silently ignored since"). Adotar o 10
recriaria em seis meses exatamente a armadilha que este PR corrige. O 11.25.0 e
a `latest` do registry, ativa a sintaxe ja presente e adiciona
`minimumReleaseAgeStrict` e a verificacao do lockfile contra as politicas.

**Compatibilidade verificada:** `engines.node >= 22.13`, satisfeito pelo Node 22
do CI, pelo `node:22-alpine` das imagens e pelo ambiente local (22.22.2). Os
lockfiles de backend e web, em `lockfileVersion: '9.0'`, foram aceitos **sem
alteracao**.

**Incompatibilidade encontrada e corrigida:** o pnpm 11 passou a repassar `--`
literalmente para o script, entao `pnpm test -- --runInBand` chegava ao jest como
padrao de arquivo e resultava em `No tests found`. O CI passou a usar
`pnpm test --runInBand`.

---

## 4. Controles pnpm

| Controle | Estado | Evidencia |
| --- | --- | --- |
| frozen lockfile | PASS | `--frozen-lockfile` em 4 pontos do CI e nas 4 instalacoes de imagem; prova negativa automatizada |
| lifecycle scripts | PASS | `strictDepBuilds: true` nos quatro componentes |
| `allowBuilds` | PASS | 5 negacoes auditadas no backend, 2 aprovacoes na web, vazio no mobile |
| `dangerouslyAllowAllBuilds` | NA | ausente; o gate reprova se aparecer |
| `minimumReleaseAge` | PASS | 1440 minutos, com `minimumReleaseAgeStrict: true` |
| `trustPolicy` | PASS | `no-downgrade` nos quatro componentes, com 4 excecoes por versao exata |
| `blockExoticSubdeps` | PASS | `true` nos quatro componentes |
| `trustLockfile` | NA | deliberadamente nao habilitado; o gate reprova se aparecer |
| `verifyStoreIntegrity` | PASS | `true` nos quatro componentes |
| `strictStorePkgContentCheck` | PASS | `true` nos quatro componentes |

---

## 5. Lockfiles

Quatro lockfiles, todos canonicos, um por manifest: raiz (sem dependencias),
backend, web e mobile. Nenhum e redundante e nenhum projeto tem dois. Nada foi
removido.

Instalacao congelada verificada com store novo em `/tmp`, sem `node_modules`
anterior: backend, web e mobile completaram com `Lockfile passes supply-chain
policies` e exit 0.

Diff de lockfile neste PR: apenas `octaclin-mobile/pnpm-lock.yaml`. A unica
mudanca de resolucao e `decode-uri-component 0.2.2 -> 0.5.0`; o total de pacotes
permanece 599. O restante do diff e o sufixo de peers anotado pelo pnpm 11.
Backend e web ficaram byte a byte identicos.

Politica de conflito documentada: lockfile nao se resolve por `ours`/`theirs`
nem por concatenacao; regenera-se com a versao exata do pnpm.

---

## 6. Python

| Item | Estado |
| --- | --- |
| Modelo de lock | `requirements.txt` (diretas) + `requirements.lock.txt` (grafo resolvido, universal) |
| Transitivas | congeladas: 22 pacotes em versao exata |
| Hashes | presentes em todos os requisitos; instalacao com `--require-hashes` |
| Instalacao | validada em venv limpo, exit 0 |
| Prova negativa | hash adulterado reprova (exit 1), executada no CI |
| `pip-audit` | passa a rodar sobre o ambiente instalado, com `--strict` |

Um unico sistema de lock; nenhum provider externo introduzido.

---

## 7. Dependabot

Cobertura preservada integralmente: GitHub Actions, backend, web, mobile e
Python/AI service, semanal as segundas, com `cooldown` por tipo de semver, limite
de 5 PRs e agrupamento minor/patch. Auto-merge continua desabilitado. Nenhuma
alteracao em `.github/dependabot.yml`.

Consequencia registrada na politica: um PR de `pip` do Dependabot altera
`requirements.txt` sem regenerar o lock, e `pnpm test:lock-python` falha de
proposito. O procedimento e regenerar o lock no proprio PR antes de aprovar.

### Snapshot de alertas no momento do PR 49

| Advisory | Pacote | Versao | Tipo | Componente | Caminho | Alcance | Fix | Decisao |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GHSA-w3rx-r6r6-pgpr | `image-size` | 1.2.1 | transitiva, build | mobile | `react-native` > `metro` | bundler em build; mobile NO-GO | nenhum publicado | `EXCECAO_TEMPORARIA` (SC-2026-005) |
| GHSA-5p2g-fcmc-qvqq | `image-size` | 1.2.1 | transitiva, build | mobile | `react-native` > `metro` | bundler em build; mobile NO-GO | nenhum publicado | `EXCECAO_TEMPORARIA` (SC-2026-005) |
| GHSA-vcc3-ghjq-m6fr | `decode-uri-component` | 0.2.2 | transitiva, runtime mobile | mobile | `expo-router` > `query-string` | app mobile, NO-GO | `>=0.5.0` | `MITIGADO` por override |

`pnpm audit` de backend e web nao reportou advisory. Nenhum alerta
`critical`. Nenhum alerta foi tratado como vulnerabilidade comprovada sem
analise de caminho e alcance.

---

## 8. Licencas

Politica em `docs/governance/politica-licencas.json`: 14 permitidas, 7 de revisao
obrigatoria, 9 bloqueadas, mais os marcadores de desconhecida. A classificacao e
por token SPDX com semantica de `OR` e `AND`, nunca por substring.

Revisoes concluidas registradas (com owner, data e condicao de reabertura):
`MPL-2.0` para axe-core, @axe-core/playwright, @vercel/og e lightningcss;
`LGPL-3.0-or-later` para os binarios do libvips usados pelo sharp. Ambas
condicionadas a consumo sem modificacao.

Nenhuma licenca bloqueada presente. Nenhuma excecao de licenca foi necessaria no
ledger.

---

## 9. SBOM

Formato CycloneDX, gerado pelo Trivy - sem segunda cadeia de SBOM. O workflow
passou a gerar o SBOM duas vezes sobre o mesmo checkout e a comparar o inventario
**semantico** normalizado: `serialNumber` e `metadata.timestamp` sao removidos,
componentes sao deduplicados e ordenados por PURL, e a comparacao cobre pacote,
versao, PURL, relacoes de dependencia e licencas conhecidas.

O mesmo gate verifica cobertura por ecossistema (backend, web, mobile e AI
service), para detectar o desaparecimento acidental de um app inteiro do SBOM.

O artefato continua publicado com retencao de 90 dias.

---

## 10. Provenance

Implementada para o **SBOM**: `actions/attest-build-provenance` em job separado,
com `id-token: write` e `attestations: write` restritos a esse job e
`contents: read` no restante. Nao roda em `pull_request`. Verificacao:
`gh attestation verify sbom.cyclonedx.json --repo octanutri-clin/octaclin`.

Provenance de pacote publicado (npm, PyPI ou imagem Docker): **NA**. O
repositorio nao publica pacote nem imagem, entao nao existe artefato de release a
atestar. Nao se declara provenance por um arquivo ter saido do GitHub Actions.

---

## 11. Actions

Todas as referencias externas continuam por SHA completo de 40 caracteres com
comentario de versao. Tres referencias novas:

| Action | SHA | Versao |
| --- | --- | --- |
| `actions/dependency-review-action` | `a1d282b36b6f3519aa1f3fc636f609c47dddb294` | v5.0.0 |
| `actions/attest-build-provenance` | `4d101475d8b20a2381f78447822ac1eab6504dd8` | v4.2.2 |
| `actions/download-artifact` | `37930b1c2abaa49bbe596cd826c3c89aef350131` | v7 |

O gate `test:actions-imutaveis` ganhou seis casos novos que provam que ele
reconhece cada uma por SHA e as recusa por tag mutavel. O gate nao foi afrouxado.

---

## 12. Excecoes

Ledger canonico: `docs/governance/excecoes-supply-chain.json`, com cinco
excecoes (quatro `trustPolicy` e uma `vulnerability`), todas com owner, alcance,
controles compensatorios, `createdAt` 2026-09-01, `expiresAt` 2026-12-01 e
condicao de remocao.

O gate reprova excecao sem owner, sem justificativa util, sem alcance, sem
controle compensatorio, sem prazo, vencida, com prazo maior que 180 dias, com
curinga amplo em `version`, com tipo fora da taxonomia ou com id duplicado. Ele
tambem amarra ledger e configuracao nos dois sentidos: `trustPolicyExclude` sem
excecao reprova, e excecao sem configuracao correspondente e apontada como
ociosa.

---

## 13. Validacoes

| Gate | Resultado | Evidencia |
| --- | --- | --- |
| `pnpm test:versao-pnpm` | PASS | 9 testes; 11 declaracoes consistentes em 11.25.0 |
| `pnpm test:instalacao-congelada` | PASS | 2 testes; pnpm real contra registry local efemero |
| `pnpm test:excecoes-supply-chain` | PASS | 13 testes; 5 excecoes, 8 amarracoes com `trustPolicyExclude` |
| `pnpm test:licencas` | PASS | 11 testes de semantica SPDX e coerencia da politica |
| `pnpm test:lock-python` | PASS | 7 testes sobre o lock real |
| `pnpm test:sbom` | PASS | 12 testes de normalizacao, reproducao e cobertura |
| Reproducao do SBOM com Trivy real | PASS | duas execucoes do Trivy 0.74.0 sobre o mesmo checkout, 940 componentes, inventario identico |
| `pnpm test:actions-imutaveis` | PASS | 15 testes, incluindo as tres Actions novas |
| `pnpm test:workflows-seguros` | PASS | 6 testes |
| `pnpm test:triagem-seguranca` | PASS | snapshot do PR 37 intacto |
| `pnpm test:tooling-agentes` | PASS | governanca do PR 48 preservada |
| `pnpm test:confiabilidade` | PASS | 21 referencias criticas |
| `pnpm test:a11y:matriz` | PASS | matriz de acessibilidade intacta |
| `pnpm security:secrets` | PASS | nenhum secret no diff |
| `pnpm test:security` | PASS | scanner de secrets validado |
| Instalacao limpa (backend, web, mobile) | PASS | store novo, sem `node_modules`, `--frozen-lockfile` |
| Licencas do instalado (backend / web / mobile) | PASS | 751 / 395 / 553 pacotes aprovados |
| `pnpm --dir octaclin-backend typecheck` | PASS | - |
| `pnpm --dir octaclin-backend build` | PASS | artefato de producao validado |
| `pnpm --dir octaclin-backend test --runInBand` | PASS | 168 suites, 1348 testes, 3 suites e 26 testes skipped por exigirem infra real |
| `pnpm --dir octaclin-web lint` | PASS | 0 erros, 52 avisos preexistentes |
| `pnpm --dir octaclin-web typecheck` | PASS | - |
| `pnpm --dir octaclin-web test:seguranca-operacional` | PASS | - |
| `pnpm --dir octaclin-mobile typecheck` | PASS | - |
| `pnpm --dir octaclin-mobile test:security` | PASS | - |
| `pnpm --dir octaclin-mobile test:a11y` | PASS | - |
| `pnpm --dir octaclin-mobile audit:security` | PASS | aprovado com as duas excecoes upstream de image-size |
| `pnpm --dir octaclin-mobile doctor` | PASS | - |
| `pnpm --dir octaclin-mobile build:validate` | PASS | export Expo android/ios/web |
| `pip install --require-hashes -r requirements.lock.txt` | PASS | venv limpo |
| Prova negativa de hash Python | PASS | hash adulterado reprova (exit 1) |
| `git diff --check` | PASS | - |

### Scanners

| Scanner | Resultado | Observacao |
| --- | --- | --- |
| `pnpm audit` (backend, web) | PASS | nenhum advisory |
| `pnpm audit` (mobile) | PASS | duas excecoes upstream de `image-size`, sem correcao publicada |
| `pip-audit` | SKIPPED localmente | passa a rodar no job `AI FastAPI` do CI, com `--strict`, sobre o ambiente instalado |
| CodeQL | SKIPPED localmente | executa no CI do PR |
| Semgrep | SKIPPED localmente | executa no CI do PR |
| Trivy | SKIPPED localmente | executa no CI do PR |
| Dependency Review | SKIPPED localmente | introduzido neste PR; executa em `pull_request` |
| Scanner de secrets | PASS | `pnpm security:secrets` e `pnpm test:security` |

`SKIPPED` significa nao executado neste ambiente, nunca aprovado.

---

## 14. Operacoes externas

```text
Nenhum deploy executado.
Nenhuma alteracao realizada em Render.
Nenhuma alteracao realizada em Neon.
Nenhuma alteracao realizada em Redis.
Nenhuma alteracao realizada em Backblaze.
Nenhum pacote publicado.
Nenhuma credencial ou secret alterado.
Nenhum registry externo configurado.
Nenhuma migration executada.
```

---

## 15. Riscos residuais

1. **Verificacao de trust depende do registry.** O pnpm 11 consulta a metadata
   do npm para aplicar `trustPolicy` e `minimumReleaseAge`. Um sinal novo de
   downgrade pode surgir a qualquer momento e reprovar o CI mesmo sem mudanca no
   repositorio. E fail-closed por design; o procedimento de resposta esta na
   politica (triagem por metadata, correcao quando existir versao atestada,
   excecao datada quando nao existir).
2. **Quatro excecoes de trust vencem em 2026-12-01.** Se os upstreams nao
   publicarem versoes atestadas alcancaveis ate la, o gate reprovara e exigira
   nova analise. Esse e o comportamento desejado.
3. **`image-size` continua sem correcao publicada.** Mitigado por mobile
   permanecer NO-GO para distribuicao.
4. **Dependency Review depende do grafo de dependencias do GitHub.** Se o
   recurso estiver indisponivel para o repositorio, o job falha e precisa ser
   investigado, nao silenciado.
5. **Lock Python e regenerado manualmente.** PRs `pip` do Dependabot vao reprovar
   ate que o lock seja regenerado no proprio PR.
6. **O SBOM do Trivy e do filesystem.** Ele inventaria os lockfiles do
   repositorio, nao a imagem final publicada. SBOM de imagem pertence ao PR 50.
7. **Hardening de container permanece aberto.** Non-root, capabilities, digest da
   imagem base, filesystem somente leitura e healthcheck sao escopo do PR 50.

---

## 16. Rollback

Todo o PR e reversivel por `git revert` do merge commit: nao ha migration, dado
persistente, publicacao nem alteracao de ambiente externo. Reverter restaura
`pnpm@9.15.9`, os `pnpm.overrides` nos `package.json`, as instalacoes nao
congeladas e o `requirements.txt` como unica fonte Python.

Rollback parcial, se apenas a atualizacao do package manager precisar ser
desfeita: reverter `packageManager`, `PNPM_VERSION`, `corepack prepare` e
`VERSAO_PNPM_ESPERADA` juntos, mover os overrides de volta para os
`package.json`, e rodar `pnpm install --frozen-lockfile` em cada componente para
confirmar coerencia. Reverter manifest sem lockfile deixaria a instalacao
congelada falhando - corretamente.

---

## 17. Skills utilizadas

`security-review` e `test-driven-development` foram aplicadas como metodo
(revisao por superficie de ataque e ciclo RED -> GREEN em cada gate novo), sem
carregamento de skill empacotada. Nenhuma skill nova foi introduzida no
repositorio, e a governanca de tooling do PR 48 permanece intacta
(`pnpm test:tooling-agentes` PASS).
