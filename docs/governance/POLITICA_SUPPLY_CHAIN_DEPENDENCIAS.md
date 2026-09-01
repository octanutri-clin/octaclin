# Politica de supply chain e dependencias do OctaClin

> Norma duravel. Estado observado fica em `STATUS_ATUAL_PROJETO.md` e a
> evidencia do ciclo em `docs/governance/RELATORIO_SEGURANCA_PR49_2026-09-01.md`.

Esta politica cobre como o OctaClin instala, atualiza, audita e reverte
dependencias. Ela vale para os quatro componentes versionados no repositorio:
`octaclin-backend`, `octaclin-web`, `octaclin-mobile` e `octaclin-ai-service`.

Principio: **configuracao presente nao e controle ativo**. Toda protecao
declarada precisa de prova de que o package manager em uso realmente a aplica.

---

## 1. Package manager

| Pergunta | Resposta |
| --- | --- |
| Qual pnpm usar | `pnpm@11.25.0`, versao exata |
| Quem define a versao | O campo `packageManager` de cada `package.json` |
| Onde mais ela aparece | `PNPM_VERSION` em `.github/workflows/ci.yml` e `corepack prepare` nos Dockerfiles |
| O que garante que nao divergem | `pnpm test:versao-pnpm` |

O `packageManager` traz o hash de integridade (`+sha512.<hex>`), no formato
canônico gerado por `corepack use pnpm@<versao>`. O pnpm e o
Corepack trocam automaticamente para a versao declarada e verificam o hash, o
que impede que um binario adulterado ou uma versao arbitraria do package manager
entre num build sensivel. `corepack enable` sozinho nao e suficiente: os
Dockerfiles usam `corepack prepare pnpm@<versao> --activate`.

### Como atualizar o pnpm

1. Escolher a versao exata e justificar (menor atualizacao segura que cumpra o objetivo).
2. Atualizar `VERSAO_PNPM_ESPERADA` em `scripts/validar-versao-pnpm.mjs`.
3. Atualizar `packageManager` nos quatro `package.json`, usando a referência com hash gerada pelo Corepack.
4. Atualizar `PNPM_VERSION` no CI e `corepack prepare` nos Dockerfiles.
5. Rodar `pnpm test:versao-pnpm` e `pnpm test:instalacao-congelada`.
6. Conferir, com o pnpm novo, se cada chave de `pnpm-workspace.yaml` continua reconhecida:
   o pnpm avisa em `[WARN] ... not recognized by this version of pnpm and were ignored`.
   Chave ignorada e controle desligado.

---

## 2. Lockfiles

| Lockfile | Manifest que governa | Usado por |
| --- | --- | --- |
| `pnpm-lock.yaml` | `package.json` da raiz (sem dependencias) | gates de governanca |
| `octaclin-backend/pnpm-lock.yaml` | `octaclin-backend/package.json` | CI job `backend`, `demo-smoke`, Dockerfile do backend |
| `octaclin-web/pnpm-lock.yaml` | `octaclin-web/package.json` | CI job `web`, `demo-smoke`, Dockerfile da web |
| `octaclin-mobile/pnpm-lock.yaml` | `octaclin-mobile/package.json` | CI job `mobile` |

Os quatro sao canonicos. Nao ha lockfile redundante: cada um governa um manifest
distinto, e nenhum projeto tem dois lockfiles.

### Regeneracao

```bash
pnpm install --no-frozen-lockfile   # dentro do diretorio do componente
```

### Conflito de lockfile

Lockfile nao se resolve escolhendo `ours`/`theirs` nem concatenando marcadores de
conflito: o resultado seria um grafo que nenhum resolvedor produziu. O
procedimento e:

```text
rebase ou merge da base
-> descartar o lockfile em conflito
-> pnpm install --no-frozen-lockfile com a versao exata do pnpm
-> revisar o diff do lockfile
-> pnpm install --frozen-lockfile
-> rodar os testes do componente
```

### Instalacao congelada

Toda instalacao de CI e de imagem usa `pnpm install --frozen-lockfile`. Nao ha
fallback para regenerar lockfile no CI. Os Dockerfiles copiam
`pnpm-lock.yaml` sem glob: lockfile ausente falha o build.

---

## 3. Lifecycle scripts

Politica: **negado por padrao, permitido explicitamente**. Nunca
`dangerouslyAllowAllBuilds`.

`strictDepBuilds: true` transforma "build ignorado" em erro, forcando decisao
explicita. Em `allowBuilds`, `true` autoriza e `false` e negacao auditada -- a
diferenca entre "analisado e recusado" e "ninguem olhou".

| Componente | Pacote | Decisao | Motivo |
| --- | --- | --- | --- |
| backend | `cpu-features` | `false` | acelerador nativo opcional do ssh2; cadeia dev testcontainers |
| backend | `ssh2` | `false` | o install script so compila cpu-features |
| backend | `protobufjs` | `false` | postinstall regenera artefato ja empacotado |
| backend | `unrs-resolver` | `false` | binarios pre-compilados chegam como optionalDependencies |
| backend | `msgpackr-extract` | `false` | acelerador opcional do msgpackr; degrada para JS puro |
| web | `sharp` | `true` | binario nativo de imagem exigido pelo build do Next |
| web | `unrs-resolver` | `true` | resolucao nativa usada pelo eslint-config-next |
| mobile | -- | `{}` | nenhuma dependencia precisa executar build |

### Como autorizar um build script novo

1. Identificar o pacote, a cadeia que o traz e o que o script faz.
2. Verificar se o produto funciona sem o build. Se funcionar, registrar `false`.
3. Se precisar do build, registrar `true` com comentario dizendo por que.
4. Rodar `pnpm install --frozen-lockfile` e a suite do componente.

---

## 4. Maturacao de versao (release age)

`minimumReleaseAge: 1440` (24 horas) e `minimumReleaseAgeStrict: true` em todos
os componentes. Uma versao publicada ha poucos minutos nao entra
automaticamente, o que reduz a janela de um pacote comprometido recem-publicado.

**O valor nao e livre.** Com `minimumReleaseAgeStrict`, o pnpm reaplica a janela
ao lockfile a cada instalacao, e nao apenas na resolucao -- desligar o strict nao
muda isso. O teto pratico e, portanto, a idade do pacote mais novo ja travado.
Medicao de 2026-09-01: `minimumReleaseAge: 10080` (7 dias) reprovava a instalacao
congelada em 8 entradas do backend e 43 da web, todas vindas de bumps recentes do
Dependabot. Uma recomendacao generica de 7 dias, como a da regra
`pnpm-minimum-release-age` do Semgrep, ignora esse acoplamento.

Como o Dependabot ja aplica `cooldown` de 3 a 30 dias por tipo de semver, o
caminho rotineiro de atualizacao ja espera mais que 24 horas. A janela que
`minimumReleaseAge` fecha e a outra: alguem instalando manualmente um pacote
publicado ha minutos. Antes de elevar o valor, verifique a idade do pacote mais
novo dos quatro lockfiles.

Excecao para patch de seguranca urgente: usar `minimumReleaseAgeExclude` com
`pacote@versao` exatos -- nunca curinga global -- e registrar excecao do tipo
`minimumReleaseAge` no ledger, com owner e prazo. Remover a entrada assim que a
janela de 24h passar.

---

## 5. Trust policy e provenance de pacote

`trustPolicy: no-downgrade`. O pnpm recusa uma versao publicada com
autenticacao mais fraca do que versoes anteriores do mesmo pacote (sinal de
possivel takeover). A confianca vem do mecanismo verificavel do registry
(atestado de proveniencia), nunca da popularidade ou do nome do publisher.

Quando o sinal aparecer em versao legada anterior a adocao de provenance pelo
mantenedor, a excecao e por versao exata em `trustPolicyExclude`, sempre com
entrada correspondente no ledger. `trustPolicyIgnoreAfter` **nao** e usado: ele
desliga a verificacao para toda versao mais velha que um prazo, criando ponto
cego amplo.

`trustLockfile` permanece desligado: o lockfile versionado continua sendo
verificado contra as politicas a cada instalacao, porque alteracao de lockfile e
justamente uma das superficies que precisam ser checadas.

---

## 6. Dependencias exoticas e registry

`blockExoticSubdeps: true` impede que dependencia transitiva puxe codigo de Git,
URL de tarball, branch ou tag arbitraria.

Nao ha dependencia direta vinda de Git, tarball URL, `file:` ou `link:` em
nenhum dos quatro componentes. Nao existe `.npmrc` versionado, registry
customizado, `strict-ssl=false` nem token no repositorio. O registry usado e o
publico padrao, por TLS.

**Dependency confusion:** `NA`. Nao existe pacote interno publicado nem escopo
privado; os quatro `package.json` sao `private: true` e nenhum e publicado.
Nenhum registry privado sera introduzido sem autorizacao humana explicita.

---

## 7. Integridade do store

`verifyStoreIntegrity: true` e `strictStorePkgContentCheck: true` permanecem
ligados nos quatro componentes. Desliga-los exigiria justificativa registrada;
hoje nao ha nenhuma.

---

## 8. Python (AI service)

`requirements.txt` continua sendo a lista de dependencias **diretas**.
`requirements.lock.txt` traz o grafo transitivo resolvido, em versoes exatas e
com hashes, gerado por:

```bash
uv pip compile requirements.txt --generate-hashes --universal \
  --python-version 3.12 --output-file requirements.lock.txt
```

CI e Dockerfile instalam com `pip install --require-hashes -r requirements.lock.txt`.
O lock e universal, entao serve tanto o Python 3.12 do CI quanto o
`python:3.12-slim` da imagem, incluindo os extras de `uvicorn[standard]`.

`pnpm test:lock-python` garante que o lock permanece exato, com hash em todo
requisito e coerente com as diretas. O CI ainda executa a prova negativa: com um
hash adulterado, a instalacao precisa ser recusada.

`pip-audit` roda sobre o ambiente instalado -- o grafo resolvido -- e nao sobre a
lista de entrada.

**Dependabot e o lock:** um PR de `pip` atualiza `requirements.txt` mas nao
regenera o lock, e o gate falha de proposito. O procedimento e regenerar o lock
com o comando acima no proprio PR antes de aprovar.

---

## 9. Dependabot

Cobertura preservada: GitHub Actions, backend, web, mobile e AI service, semanal,
com `cooldown` por tipo de semver e limite de 5 PRs por ecossistema. Auto-merge
permanece desabilitado. Atualizacao de seguranca nao e reclassificada como
rotina.

---

## 10. Politica de vulnerabilidades

| Camada | Ferramenta | Papel |
| --- | --- | --- |
| Risco novo do PR | `actions/dependency-review-action` | bloqueia `critical/high` novo e licenca proibida |
| Grafo instalado (JS) | `pnpm audit` | triagem por runtime/build/install/CI |
| Grafo instalado (Python) | `pip-audit` | auditoria do ambiente resolvido |
| Repositorio inteiro | Trivy | scanner amplo, com SARIF no Security tab e excecoes materializadas do ledger |

A separacao e deliberada: o Dependency Review bloqueia o que o PR **introduz**;
o Trivy amplo continua nao bloqueante para nao transformar divida historica ja
triada em bloqueio cego.

O SARIF nao usa uma lista paralela de supressoes. Antes do scan, o workflow
materializa `.trivyignore.yaml` a partir das entradas `vulnerability` do ledger
que declaram `scannerIds` e `scannerPaths`. Cada regra herda owner, motivo e
`expiresAt`; caminho vazio ou id invalido reprova o gate. Assim, uma excecao
aprovada e realmente consumida pelo scanner e vence junto com a fonte canonica.

`devDependency` nao e sinonimo de risco zero. Cada finding e avaliado em tres
eixos: alcance em runtime, execucao em build/CI e privilegio disponivel no job.

Nunca usar `npm audit fix --force` nem `pnpm audit --fix --force`.

---

## 11. Politica de licencas

Fonte: `docs/governance/politica-licencas.json`. Classes: `permitida`,
`revisao obrigatoria`, `bloqueada`, `desconhecida`.

A avaliacao respeita a semantica SPDX: em `A OR B` basta um operando aceitavel;
em `A AND B` todos precisam ser. Nao ha comparacao por substring -- `LGPL` e
`AGPL` contem `GPL` e sao licencas distintas. Licenca ausente, `NOASSERTION` ou
desconhecida exige revisao; nunca e aprovada em silencio.

Licenca de revisao obrigatoria so passa com revisao concluida registrada na
politica, nomeando os pacotes cobertos, a decisao, o owner e a condicao de
reabertura. Licenca desconhecida so passa com excecao datada no ledger.

Gates: `pnpm test:licencas` (politica e semantica) e
`node scripts/validar-licencas.mjs node_modules` em cada app do CI (inventario
real instalado).

---

## 12. Ledger de excecoes

Fonte canonica: `docs/governance/excecoes-supply-chain.json`.

Tipos: `vulnerability`, `license`, `minimumReleaseAge`, `trustPolicy`,
`buildScript`, `exoticDependency`.

Toda excecao exige `id`, `tipo`, `componente`, `package`, `version`, `motivo`,
`severidade`, `reachability`, `controlesCompensatorios`, `owner`, `createdAt`,
`expiresAt`, `approvedBy`, `source` e `condicaoDeRemocao`.

`pnpm test:excecoes-supply-chain` reprova excecao sem owner, sem justificativa
util, sem prazo, vencida, com prazo maior que 180 dias, com curinga amplo em
`version` ou com id duplicado. O gate tambem amarra ledger e configuracao: toda
entrada de `trustPolicyExclude` precisa de excecao correspondente, e uma excecao
que nao corresponde a nenhuma configuracao e apontada como ociosa.

Excecoes `vulnerability` consumidas pelo Trivy tambem precisam declarar
`scannerIds` e `scannerPaths`. O workflow gera o ignore file efemero a partir
desses campos; nao existe `.trivyignore` versionado e independente do ledger.

Excecao vencida quebra o gate. Esse e o comportamento desejado: a excecao volta
para a mesa em vez de virar divida permanente.

---

## 13. SBOM

Formato CycloneDX, gerado pelo Trivy no workflow `Trivy`. Nao existe segunda
cadeia de SBOM.

"Reproduzivel" nao significa byte identico. Tres campos mudam a cada execucao do
Trivy sem que nada da supply chain tenha mudado:

- `serialNumber` e `metadata.timestamp`, que identificam a execucao;
- o `bom-ref` de cada componente, que e um UUID sorteado por execucao;
- a ordem de emissao dos componentes e das relacoes.

O `bom-ref` e o caso que menos se espera: `dependencies` referencia esses UUIDs,
entao comparar o ref cru acusaria irreprodutibilidade em todo SBOM. Cada ref e
resolvido para a identidade estavel do componente que ele aponta (PURL, ou
`nome@versao` na falta dela) antes da comparacao. Isso normaliza o identificador
de execucao sem esconder a relacao, que continua sendo comparada.

O criterio e **inventario semantico identico** entre duas execucoes limpas sobre
o mesmo commit: mesmos pacotes, versoes, PURLs, relacoes de dependencia e
licencas conhecidas. `scripts/validar-sbom.mjs` normaliza os campos nao
deterministicos e compara; diferenca semantica reprova. Um ref que nao resolva a
componente algum e preservado marcado como nao resolvido, para que a comparacao
falhe e exija analise em vez de descartar a relacao em silencio.

O mesmo gate verifica cobertura: um componente conhecido de cada ecossistema
(backend, web, mobile e AI service) precisa aparecer, para detectar o
desaparecimento acidental de um ecossistema inteiro.

---

## 14. Provenance

O SBOM publicado recebe atestado de proveniencia via
`actions/attest-build-provenance`, em job separado, apenas fora de
`pull_request`. As permissoes `id-token: write` e `attestations: write` existem
somente nesse job; o workflow segue com `contents: read` por padrao.

Verificacao:

```bash
gh attestation verify sbom.cyclonedx.json --repo octanutri-clin/octaclin
```

Provenance de pacote publicado (npm/PyPI/imagem Docker): `NA`. O repositorio nao
publica pacote nem imagem, entao nao ha artefato de release a atestar. Nao se
declara provenance por um arquivo ter saido do GitHub Actions.

---

## 15. GitHub Actions

Toda referencia externa continua fixada por SHA completo de 40 caracteres, com
comentario de versao. Tag, branch, `@main` e SHA curto sao recusados por
`pnpm test:actions-imutaveis`. Action nova passa pelo mesmo gate.

Permissao segue o menor privilegio: `contents: read` por padrao;
`security-events: write` apenas nos jobs que publicam SARIF; `id-token: write` e
`attestations: write` apenas no job de atestado.

---

## 16. Politica de atualizacao

### Patch

Dependabot, CI completo, scanners, revisao do diff do lockfile.

### Minor

Testes completos do componente, leitura de changelog/release notes quando
relevante e revisao de mudanca de comportamento.

### Major

PR dedicado quando o impacto for relevante, guia de migracao, testes
direcionados e rollback explicito. Majors de framework, ORM, auth, build tool,
package manager ou runtime nao sao agrupadas por conveniencia.

Nunca aceitar alteracao de lockfile sem entender a origem. Nunca rodar
ferramenta de atualizacao automatica sem revisar o diff.

---

## 17. Rollback

Um rollback precisa preservar coerencia entre manifest, lockfile, package
manager e CI. Reverter apenas `package.json` deixa o lockfile incompativel e a
instalacao congelada falha -- corretamente.

```bash
git revert <commit>            # manifest + lockfile juntos
pnpm install --frozen-lockfile # confirma coerencia
```

### Incidente de pacote comprometido

1. Bloquear a versao (override em `pnpm-workspace.yaml` ou pin no manifest).
2. Reverter manifest e lockfile juntos.
3. `pnpm install --frozen-lockfile`.
4. Rebuild do componente afetado.
5. Rodar scanners (`pnpm audit`, `pip-audit`, Trivy, Dependency Review).
6. Revogar credencial **somente** se houver evidencia de exposicao.
7. Preservar evidencia sanitizada.
8. Abrir incidente pelo processo aplicavel.

Nenhuma dessas etapas executa deploy.

---

## 18. Gates desta politica

| Gate | O que prova |
| --- | --- |
| `pnpm test:versao-pnpm` | versao unica e exata do package manager em todas as fontes |
| `pnpm test:instalacao-congelada` | com o pnpm real: lifecycle nao aprovado falha, aprovado passa, manifest divergente reprova o modo congelado |
| `pnpm test:excecoes-supply-chain` | ledger com owner, justificativa e prazo; excecao vencida reprova |
| `pnpm test:licencas` | semantica SPDX e coerencia da politica de licencas |
| `pnpm test:lock-python` | lock Python exato, com hashes e coerente com as diretas |
| `pnpm test:sbom` | normalizacao, reproducao semantica e cobertura por ecossistema |
| `pnpm test:actions-imutaveis` | Actions por SHA completo, inclusive as novas |
| `node scripts/validar-licencas.mjs node_modules` | inventario real instalado por componente |
| `node scripts/validar-sbom.mjs a.json b.json` | duas execucoes do Trivy com inventario identico |
