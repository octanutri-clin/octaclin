# Plano SQ-1B - Runtime Node minimo da imagem web

Data: 2026-09-07. Risco: R3. Branch:
`feat/sq1b-runtime-node-minimo`. Base: `origin/main` no merge `316165d` do PR
`#210`.

## Objetivo

Remover do estagio final da imagem web o npm global e as interfaces de
gerenciamento de pacotes que nao participam do boot do Next, preservando
`node`, o servidor Next, o healthcheck e todas as restricoes do harness de
runtime.

O snapshot sanitizado recapturado em 2026-09-07 sobre `316165d` ainda possui
238 alertas de Code Scanning, dos quais 19 pertencem a `SQ-1B`. Todos os 19 sao
da categoria `trivy-imagem-web` e apontam para dependencias sob
`/usr/local/lib/node_modules/npm`.

## Limites

- Nao alterar a major do Node nem o digest da base. A SQ-1A permanece separada
  e aguarda uma imagem oficial Node 22 Alpine reconstruida com OpenSSL
  corrigido.
- Nao alterar dependencias da aplicacao, lockfiles, configuracao Next, backend,
  servico de IA ou provider de producao.
- Nao executar gerenciador de pacotes no estagio final.
- Nao editar o inventario ativo antes de o scan da `main` comprovar o
  fechamento dos alertas.
- Docker ausente localmente e `SKIPPED`, nunca `PASS`; a prova de container e
  obrigatoria no CI.

## Contrato de saida

1. `node` e `node_modules/next/dist/bin/next` continuam presentes e o comando
   final permanece `node .../next start`.
2. `npm`, `npx`, `pnpm` e `corepack` nao sao resolvidos no `PATH` do container
   final.
3. `/usr/local/lib/node_modules/npm` e
   `/usr/local/lib/node_modules/corepack` nao existem no filesystem final.
4. O web chega a `healthy` sob root filesystem read-only, UID 1000,
   `cap-drop=ALL`, `no-new-privileges` e os limites atuais.
5. O scan Trivy da imagem do PR nao encontra os 19 caminhos associados ao npm.
6. A captura posterior na `main` confirma o fechamento antes de atualizar o
   inventario canonico.

## Task 1 - Contrato estatico RED

**Arquivo:** `scripts/validar-dockerfiles-runtime.spec.mjs`

- Adicionar um teste que exige no estagio final web a remocao explicita dos
  quatro comandos e dos dois diretorios globais.
- Preservar as assercoes existentes sobre `CMD` direto por Node e ausencia de
  instalacao no runtime.
- Executar `pnpm test:dockerfiles-runtime` e registrar FAIL porque o Dockerfile
  atual herda o npm/Corepack da imagem oficial.

## Task 2 - Minimizacao do estagio final GREEN

**Arquivo:** `octaclin-web/Dockerfile`

- Adicionar um unico passo de remocao no estagio `runtime`, antes de copiar os
  artefatos da aplicacao.
- Remover os diretorios globais de npm/Corepack e os shims
  `npm`, `npx`, `pnpm`, `pnpx` e `corepack`.
- Nao remover `node`, os modulos de producao em `/app/node_modules`, o binario
  Next, arquivos `.next`, `public` ou o healthcheck.
- Reexecutar `pnpm test:dockerfiles-runtime` e exigir PASS.

## Task 3 - Prova negativa no container real

**Arquivos:**

- `scripts/harness-runtime-containers.sh`
- `.github/workflows/trivy.yml`

- Estender o harness com listas opcionais de comandos e caminhos que devem
  estar ausentes.
- Passar argumentos como parametros posicionais de `sh -c`, sem interpolar
  conteudo em codigo de shell.
- Configurar somente a matriz web com os quatro comandos e os dois diretorios;
  backend e IA recebem listas vazias.
- Manter todas as provas atuais de UID, filesystem read-only, capabilities,
  limites, health e ausencia do canario.

## Task 4 - Estado e rastreabilidade

**Arquivos:**

- `STATUS_ATUAL_PROJETO.md`
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- `MATRIZ_CONFIABILIDADE_TESTES.md`

- Marcar SQ-0 como integrada pelo PR `#210`.
- Registrar SQ-1A como aguardando novo digest oficial, sem declarar os 40
  alertas resolvidos.
- Marcar SQ-1B como em execucao e documentar a nova prova negativa do harness.
- Nao reduzir a contagem canonica de alertas enquanto a `main` nao for
  reescaneada.

## Task 5 - Validacao e PR

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

Executar `scripts/harness-runtime-containers.sh` localmente apenas para registrar
o resultado esperado `SKIPPED: docker indisponivel`. O CI deve executar com
`REQUIRE_DOCKER=1` e aprovar o job `Imagem web (build e identidade)`.

Antes do merge, revisar o SARIF/scan da imagem do PR e confirmar que nenhum dos
19 caminhos de SQ-1B permanece. Depois do merge, recapturar o inventario sobre
a nova `main`; somente essa evidencia autoriza remover ou reclassificar os 19
alertas canonicos.

## Rollback

Reverter o commit da SQ-1B restaura o estagio final anterior sobre o mesmo
digest Node 22 Alpine. Nao ha migration, mudanca de dados, secret, provider ou
acao de producao neste PR.
