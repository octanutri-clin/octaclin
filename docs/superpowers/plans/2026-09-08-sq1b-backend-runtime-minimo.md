# Plano SQ-1B - Runtime Node minimo da imagem backend

Data: 2026-09-08. Risco: R3. Branch:
`feat/sq1b-backend-runtime-minimo`. Base: `origin/main` no merge `05e81c4` do
PR `#211`.

## Fato novo e objetivo

O PR `#211` removeu corretamente o npm/Corepack da imagem web: a analise
Trivy `1740151860` da `main` passou de 39 para 20 resultados nessa categoria.
A recaptura sanitizada posterior, porem, mostrou 39 resultados na imagem
backend, dos quais 19 sao o mesmo conjunto de dependencias herdadas do npm
global: `brace-expansion`, `picomatch`, `ip-address`, `@sigstore/core`,
`sigstore`, `tar`, `postcss-selector-parser` e `pacote`.

O backend inicia diretamente por `node dist/main.js` e nao usa gerenciador de
pacotes no runtime. O objetivo deste complemento e remover do estagio final do
backend o npm global e as interfaces de gerenciamento de pacotes, preservando
Node, os modulos de producao, o artefato compilado e todas as restricoes do
harness.

## Limites

- Nao alterar a versao nem o digest da base Node; SQ-1A continua aguardando
  upstream.
- Nao alterar dependencias da aplicacao, lockfiles, codigo NestJS, migrations,
  providers ou producao.
- Nao executar instalacao no estagio final.
- Nao declarar o health completo do backend como aprovado: o modo do harness
  permanece `factual`, pois o boot depende de configuracao e sidecars fora do
  escopo desta SQ.
- Nao reescrever o inventario canonico antes do scan da `main` posterior ao
  merge confirmar o fechamento.
- Docker ausente localmente continua `SKIPPED`, nunca `PASS`.

## Contrato de saida

1. `node` e `dist/main.js` continuam presentes e o `CMD` permanece
   `node dist/main.js`.
2. `npm`, `npx`, `pnpm` e `corepack` nao sao resolvidos no `PATH` do container
   final.
3. `/usr/local/lib/node_modules/npm` e
   `/usr/local/lib/node_modules/corepack` nao existem no filesystem final.
4. O backend continua executando como UID 1000 sob rootfs read-only,
   `cap-drop=ALL`, `no-new-privileges` e os limites atuais; o health do app
   permanece factual.
5. O scan Trivy do PR deixa de encontrar os 19 resultados associados ao npm na
   imagem backend.
6. A captura posterior na `main` confirma o fechamento antes de atualizar o
   inventario canonico.

## Task 1 - Contrato estatico RED

**Arquivo:** `scripts/validar-dockerfiles-runtime.spec.mjs`

- Adicionar teste que exige no runtime backend a mesma remocao explicita de
  comandos e diretorios globais ja exigida do web.
- Exigir que a matriz Trivy passe as listas negativas tambem ao backend.
- Executar `pnpm test:dockerfiles-runtime` e registrar FAIL antes da mudanca do
  Dockerfile/workflow.

## Task 2 - Minimizacao GREEN

**Arquivos:**

- `octaclin-backend/Dockerfile`
- `.github/workflows/trivy.yml`

- Remover os diretorios globais de npm/Corepack e os shims `npm`, `npx`,
  `pnpm`, `pnpx` e `corepack` antes de copiar os artefatos.
- Configurar a matriz backend com os quatro comandos e os dois diretorios que
  devem estar ausentes.
- Preservar `CMD`, usuario, healthcheck, limites e modo `factual`.
- Reexecutar `pnpm test:dockerfiles-runtime` e exigir PASS.

## Task 3 - Estado e rastreabilidade

**Arquivos:**

- `STATUS_ATUAL_PROJETO.md`
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- `MATRIZ_CONFIABILIDADE_TESTES.md`

- Registrar o merge do PR `#211` e a evidencia de 20 resultados na imagem web.
- Documentar que a recaptura sobre `05e81c4` manteve 238 alertas de Code
  Scanning porque a imagem backend passou a concentrar os 19 resultados do npm.
- Manter SQ-1B ativa ate o complemento passar no CI e ser integrado.
- Manter SQ-1C como proxima unidade, ainda nao iniciada.

## Task 4 - Validacao e PR

Executar localmente:

```powershell
pnpm test:dockerfiles-runtime
pnpm test:versao-node
pnpm test:versao-pnpm
pnpm test:inventario-security-quality
pnpm test:confiabilidade
pnpm test:workflows-seguros
pnpm validate:docs
pnpm security:secrets
git diff --check
```

No CI, exigir o job `Imagem backend (build e identidade)` verde e inspecionar
o log do harness para confirmar cada comando/caminho ausente. Comparar a
analise `trivy-imagem-backend` do PR com a analise `1740148024` da `main`, que
possui 39 resultados. Depois do merge, recapturar a `main`; somente essa
evidencia autoriza atualizar o inventario e iniciar SQ-1C.

## Rollback

Reverter o commit deste complemento restaura o estagio final anterior sobre o
mesmo digest Node 22 Alpine. Nao ha migration, mudanca de dado, secret,
provider ou acao de producao.
