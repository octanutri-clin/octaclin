# Relatorio de seguranca - PR 50 da governanca: Containers e runtime

Data: 2026-09-01. Risco: R3 - bloqueador. Escopo: exclusivamente o PR 50 do
`docs/governance/PROGRAMA_HARDENING_SEGURANCA_PRS_36_56.md`. Nao avanca ao PR 51.

## 1. Baseline (hard gate)

O PR 50 vem depois do PR 49 (Supply chain e dependencias).

- GitHub PR do PR 49: `#176` - estado `MERGED`.
- Merge commit do PR 49: `74c47a3aaa07dc31ad480ac79fca5256c4233d2b` (2026-09-01T11:34:35Z), base `main`.
- `git merge-base --is-ancestor 74c47a3 origin/main` -> exit 0 (ancestral de `main`).
- HEAD inicial do PR 50 (= `origin/main`): `74c47a3aaa07dc31ad480ac79fca5256c4233d2b`.
- Required checks do `#176`: todos `pass` (CI, CodeQL, Semgrep, Trivy, Dependency Review, imagens).

Nenhum controle do PR 49 foi enfraquecido: instalacao congelada, lockfiles,
lock Python com hashes, ledger de excecoes, SBOM de filesystem, Actions por SHA
e demais gates permanecem intactos.

## 2. Inventario de containers

| Artefato | Classificacao | Contexto de build |
| --- | --- | --- |
| `octaclin-backend/Dockerfile` | Producao | `octaclin-backend` |
| `octaclin-web/Dockerfile` | Producao | `octaclin-web` |
| `octaclin-ai-service/Dockerfile` | Producao | `octaclin-ai-service` |
| `docker-compose.yml` | Desenvolvimento local | raiz |
| `docker-compose.prod.yml` | Referencia de producao | raiz |

Os composes referenciam as imagens acima; o hardening deste PR vive nos
Dockerfiles e no harness de runtime, sem alterar o provider real.

## 3. Digests resolvidos

Resolvidos em 2026-09-01 no Docker Hub oficial (registry-1.docker.io). Para o
`FROM` usamos o digest do indice OCI multi-arch: o Docker seleciona a plataforma
correta, mantendo `linux/amd64` (CI/producao) e `linux/arm64` disponiveis.

| Imagem | Tag | Digest (indice OCI) | Plataformas verificadas |
| --- | --- | --- | --- |
| `library/node` | `22-alpine` | `sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32` | linux/amd64, linux/arm64 |
| `library/python` | `3.12-slim` | `sha256:e5c9fa26ffb76e11e0f054f30dc2523a2f9693f0c36c0cf1e39b27e152d899fc` | linux/amd64, linux/arm64 |

Digests de plataforma (evidencia, nao usados no `FROM`):
- node 22-alpine amd64 `sha256:76789712cd1ae89a1225eac9077010d68987a423588042dac30446f502f1858c`; arm64 `sha256:1ef15d33d74602021f35ec64a4e72f4a21e2cfa68ebecd125fbe0c44af8f604a`.
- python 3.12-slim amd64 `sha256:2fe5997d249a808b8eeea52c58a1dbffbba28754dc11699ef5c029f2d818ce79`; arm64 `sha256:3949e4271b0a3ff82afac7306764c313dcc8edeeb89c0376a3c2ac6007c66b1d`.

Atualizacao do digest (nao introduz auto-merge): Dependabot ecossistema `docker`
(adicionado aos tres contextos) ou processo humano -> novo digest -> scan ->
build -> harness de runtime -> SBOM -> review -> merge.

## 4. Achados e correcoes (RED -> GREEN)

| ID | Severidade | Controle ausente | Correcao | RED | GREEN |
| --- | --- | --- | --- | --- | --- |
| A1 | Alta | Base por tag mutavel (`node:22-alpine`, `python:3.12-slim`) | `FROM ...@sha256:<digest>` nas tres imagens | gate de digest falhava | `pnpm test:dockerfiles-runtime` PASS |
| A2 | Media | Gerenciador de pacotes/instalacao no estagio final Node | Estagio `deps-prod` resolve deps de producao; runtime so copia artefatos | gate "sem package manager no runtime" falhava | PASS |
| A3 | Media | AI service single-stage com `pip install` no runtime | Multi-stage: `pip install --prefix=/install` no build, runtime recebe pronto | gate falhava para AI | PASS |
| A4 | Media | `.dockerignore` so na raiz nao cobre os contextos dos subdiretorios | `.dockerignore` por contexto (backend/web/ai) | secret/artefato podiam entrar no contexto | canario ausente da imagem (harness) |
| A5 | Media | Runtime sem prova real de non-root/limites/read-only | Harness `--read-only --cap-drop=ALL --security-opt=no-new-privileges` + limites | so havia `Config.User` (config, nao processo) | uid efetivo/escrita negada provados no CI |
| A6 | Media | SBOM e scan cobriam so o filesystem do repo, nao a imagem | Trivy image + SBOM CycloneDX por imagem final | SBOM/scan de imagem ausentes | artefatos por imagem no CI |

Nenhuma vulnerabilidade foi fabricada; os RED sao ausencias de controle
comprovadas pelos gates.

## 5. Runtime por servico

| Item | backend | web | ai-service |
| --- | --- | --- | --- |
| Base | node:22-alpine@sha256:c610... | node:22-alpine@sha256:c610... | python:3.12-slim@sha256:e5c9... |
| UID/GID | node (1000) | node (1000) | octaclin (10001) |
| Porta | 3000 | 3000 | 8001 |
| Healthcheck | node fetch `/health` | node fetch `/health` | python urllib `/health` |
| capabilities | `--cap-drop=ALL` | `--cap-drop=ALL` | `--cap-drop=ALL` |
| no-new-privileges | sim | sim | sim |
| read-only rootfs | sim | sim | sim |
| tmpfs | `/tmp` | `/tmp`, `/app/.next/cache` | `/tmp` |
| pids-limit | 256 | 256 | 128 |
| memory | 512m | 768m | 256m |
| cpus | 1.0 | 1.0 | 0.5 |
| ferramentas de runtime | node (sem pnpm/corepack) | node + next (sem pnpm/corepack) | python (sem pip install no runtime) |
| health no CI | FACTUAL (ver 8) | healthy | healthy |

## 6. Build context e higiene de secrets

- `.dockerignore` por contexto bloqueia `.env`/`.env.*`, chaves (`*.pem/*.key/*.p12/*.pfx/*.crt`), `secrets/credentials`, `node_modules`, `.next`, `dist`, `coverage`, `__pycache__`, `.git`, logs, tmp e os canarios sinteticos. Preserva `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `requirements*.txt` e config de build.
- Prova negativa de contexto (harness, Docker no CI): um `secret-canary.txt` sintetico e criado no contexto, a imagem e construida e `docker export | tar -t` confirma que o canario **nao** entrou na imagem final. Nenhum secret real e usado.
- `docker history --no-trunc` e verificado contra padroes sensiveis (canario, PRIVATE KEY, password=, BEGIN RSA).
- Scanner de secrets do repositorio (`pnpm security:secrets`) preservado; o scan de imagem Trivy inclui `secret`.
- Nenhum `ARG/ENV` de token/senha, `COPY .env` ou `curl | sh` nos Dockerfiles (gate estatico).

## 7. SBOM e scan da imagem final

- SBOM CycloneDX por imagem (`sbom-imagem-<servico>.cyclonedx.json`), gerado por Trivy sobre a imagem construida e publicado como artefato com a identidade (image ID/RepoDigests) do artefato escaneado. Complementa - nao substitui - o SBOM de filesystem do PR 49.
- Trivy `image` (vuln, secret, misconfig) por imagem, SARIF publicado no Security tab (categoria `trivy-imagem-<servico>`). Nao bloqueante (warning), coerente com a cadeia Trivy existente; findings critical/high sao triados pelo ledger canonico do PR 49 (`docs/governance/excecoes-supply-chain.json`), sem criar segundo ledger nem `.trivyignore` manual desvinculado.

| Imagem | Vuln | Secrets | Misconfig | Resultado |
| --- | --- | --- | --- | --- |
| backend | Trivy image (CI) | Trivy secret (CI) | Trivy misconfig (CI) | evidencia no CI |
| web | Trivy image (CI) | Trivy secret (CI) | Trivy misconfig (CI) | evidencia no CI |
| ai-service | Trivy image (CI) | Trivy secret (CI) | Trivy misconfig (CI) | evidencia no CI |

Provenance de imagem: `NA` - o repositorio nao publica imagens neste fluxo. O
atestado de proveniencia do SBOM de filesystem do PR 49 permanece intacto.

## 8. CI hardened != producao

O harness prova compatibilidade tecnica em Docker local/CI. Ele **nao** prova que
Render aplica os mesmos controles.

```
CI/local hardened runtime: PASS (web, ai-service) / hardening PASS + health FACTUAL (backend)
provider real (Render/Neon/Redis/Backblaze): NAO VALIDADO NESTE PR
```

O boot completo do backend em producao exige segredos JWT/criptografia e
Postgres/Redis (config/provider). Isso pertence ao PR 51 (Providers e menor
privilegio). Por isso o harness prova o hardening da imagem do backend
(uid non-root efetivo, read-only, cap-drop, no-new-privileges, limites) em modo
sustentado e marca a saude do app como FACTUAL, com este motivo documentado.
`SKIPPED`/`FACTUAL` nunca e `PASS`.

## 9. Validacoes

Gate estatico e supply chain (executados localmente neste ciclo):

| Comando | Resultado |
| --- | --- |
| `pnpm test:dockerfiles-runtime` | PASS (8/8) |
| `pnpm test:actions-imutaveis` | PASS |
| `pnpm test:workflows-seguros` | PASS |
| `pnpm test:confiabilidade` | PASS |
| `node scripts/scan-secrets.mjs` (diff do PR) | PASS (achados apenas em diretorio nao versionado local) |
| `git diff --check` | PASS |

Runtime real, scan e SBOM de imagem (exigem Docker; `REQUIRE_DOCKER=1` no CI):

| Prova | Local | CI (GitHub Actions) |
| --- | --- | --- |
| harness de runtime hardened | SKIPPED (sem Docker) | executa |
| Trivy image (vuln/secret/misconfig) | SKIPPED | executa |
| SBOM CycloneDX de imagem | SKIPPED | executa |

`SKIPPED` local por ausencia de Docker nunca vale como `PASS`; o gate real roda
no CI, onde Docker esta disponivel.

## 10. Ferramentas removidas do runtime

- backend/web: `corepack`/`pnpm` e a etapa `pnpm install` deixam de existir no estagio final; o runtime recebe apenas `dist`/`.next`/`public` e `node_modules` de producao.
- ai-service: `pip install` sai do estagio final (roda so no build); o runtime recebe o prefixo `/install` pronto.
- Nenhum `curl`/`wget` e adicionado para healthcheck (usa o runtime ja presente).

Risco residual: as bases mantem `sh` e o gerenciador nativo (`apk`/`pip`) no
sistema base; removeu-se a **execucao** de instalacao no runtime, nao o binario
da base. Distroless foi avaliado e nao adotado para nao introduzir complexidade
operacional sem ganho comprovado neste PR.

## 11. Tamanho

Delta de tamanho medido no CI (build antes/depois). A remocao do `pnpm install`
do runtime Node tende a reduzir a imagem final; a mudanca para multi-stage no AI
mantem so o prefixo instalado. Tamanho nao e gate de seguranca isolado.

## 12. Riscos residuais

- Health do backend sob hardening ainda nao provado ponta a ponta (config/provider - PR 51).
- `sh` e gerenciador nativo presentes nas bases (superficie residual documentada).
- Scan de imagem e nao bloqueante (warning), com triagem pelo ledger do PR 49.
- Limites de memoria/cpu/pids sao recomendacao provada em CI, nao alteracao de plano Render.

## 13. Rollback

Rollback puramente versionado: `git revert` do merge do PR 50 restaura os
Dockerfiles e digests anteriores; em seguida rebuild, scan e smoke de runtime.
Nao ha "voltar para tag sem digest" como rollback. Nenhum deploy e executado
neste PR.

## 14. Operacoes externas

Nenhum deploy executado. Nenhuma alteracao em Render, Neon, Redis ou Backblaze.
Nenhuma credencial real utilizada. Nenhuma imagem publicada em registry.

## 15. Skills utilizadas

`security-review` e `test-driven-development` (RED -> GREEN dos gates estaticos)
orientaram a implementacao; `requesting-code-review` fica para a etapa de review
humano do PR.
