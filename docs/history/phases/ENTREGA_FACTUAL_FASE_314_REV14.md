# Evidência da entrega factual Fase314 — REV14

Rodada2026-10-11, worktree `docs-fase-314-planejamento`, branch
`feat/fase-314-validacao-rev11`. Base main consultada2e06bcde e HEAD inicialdb4f317a;
nenhuma alteração preexistente nessa worktree. Outras worktrees preservadas.
PR394 única em Draft, sem merge/ativação/deploy.

## Comparação e alterações

- Main conserva seis métodos18–19 pendentes e snapshotv1; branch REV11 já tem
  seis métodos desde18, v2/ratificação e autorização antes de replay. Não duplicar
  sua implementação nem presumir integração da PR394 aindaOPEN.
- Aviso residual de idade fora do domínio não informa mais ratificação pendente.
  Tradução do antigo aviso adulto identifica histórico, sem recalcular resultados.
- UI pediátrica informa protocolo ratificado/referências não habilitadas, inclusive
  histórico v1; contexto, motivos e dados originais não são modificados.
- Regressões adicionais por sexo/17–20, idade ausente, sexo/medidas ausentes,
  gestação, domínio/população; teste de dependências transitivas a partir de main
  proíbe consumidores assistenciais dos classificadores isolados.
- Contrato/gates separados em `../../product/LIBERACAO_FACTUAL_FASE_314_REV14.md`.
  Atualizados status, roadmap, checklist/T01–T18, ADR e matriz. REV11/G02/oráculos
  originais preservados; REV14 arquivada byte a byte comhash próprio.

## Segurança e limites da revisão

Auto-revisão técnica do diff, contratos e testes, não revisão R4 independente.
Nenhuma nova entidade/migration/dependência/alteração de RLS/criptografia/portal.
A prova existente PostgreSQL real descartável voltou a passar, incluindo runtime
restrito, FORCE RLS, carteira/tenant, replay e concorrência, retenção/rollback.
As migrations1068/1069 estão registradas na configuração. Nenhum banco externo
foi consultado; registros em main/CI não comprovam a aplicação operacional.
Checklist do revisor humano e condições dos alvos estão no contrato REV14.

## Verificações desta rodada

| Verificação | Resultado real |
| --- | --- |
| AnexoREV14 | PASS byte a byte e SHA256 no disco/blob Git; primeiro diff cached encontrou linha vazia final do original, exceção whitespace limitada a esse anexo imutável, sem relaxar runtime |
| TDD domínio | RED1 FAIL/14 PASS aviso residual; GREEN77 PASS em6 suítes focadas |
| Isolamento transitivo | 2 PASS; fixture cobre import dinâmico/ciclo, grafo real sem consumidores experimentais; correção do path do teste após primeira execução falhar |
| Playwright313/314 | RED2 FAIL mensagem ausente desktop/mobile; GREEN10 PASS; ampliação v1/v2 depois12 PASS desktop/mobile, axe, autorização/leitura/revogação/paginação |
| PostgreSQL Testcontainers | 31 PASS/1 suíte; instância descartável, nenhuma migration externa |
| Typecheckbackend/web | PASS |
| Buildbackend/guard | PASS, sem coeficientes de pesquisa no artefato |
| Lintweb | PASS,0 erros/65 warnings existentes |
| Governança focal | 25 PASS: matriz, guardas e contratos de migrations fora de banda |
| Preflight DocsOnly | PrimeiroFAIL pelo cabeçalho “Fase314” sem espaço; corrigido documento, repetiçãoPASS sem enfraquecer validador |
| Buildweb | PASS |
| Backend completo | 2.650 PASS/54 SKIPPED;295 suítes PASS/3 SKIPPED. Sem variáveis de oráculos integrais nesta rodada factual;4 verificações extras de pesquisa não executadas, não considerar G01 aprovado |
| Test:authz | Execução completa local iniciada, em andamento na redação deste registro; não declarar PASS antes do exit0. Resultado final/CI vinculados por HEAD na PR394 |
| CI | db4f317a/run38161961023PASS é anterior; CI do novo HEAD deve ser consultado na PR394 |
| R4 independente | BLOCKED: revisor independente/evidência ainda não disponíveis |
| Migrations/roles por alvo | SKIPPED/BLOCKED: sem consulta/execução externas nesta autorização |
| G01/direitos/55s | BLOCKED somente classificadores, não gate factual |
| G02CL01–10 | RATIFICADO_PELO_USUARIO REV9, nenhuma reabertura |
| Merge/deploy/ativação | BLOCKED: autorização expressa necessária |

## Comandos realmente executados

Usada ferramenta Node22/pnpm11.25 existente, sem alterar lockfiles:

- `git fetch origin main`, `git rev-parse HEAD origin/main`, `git status`,
  `git diff --stat`, `gh pr view394`: somente leitura/fetch.
- Node22 `jest --runInBand protecoes-etarias.spec.ts elegibilidade-adulta.spec.ts
  antropometria.spec.ts antropometria-pediatrica.spec.ts servico-pediatrico.spec.ts
  projecao-antropometria.spec.ts`; `jest --runInBand isolamento-factual-rev14.spec.ts`.
- Backend `pnpm test:rls:testcontainers`, `pnpm typecheck`, `pnpm build`.
- Web `pnpm typecheck`, `pnpm lint`, `pnpm exec playwright test
  console-regression.spec.mjs --grep 'Fase 31[34]'`, `pnpm test:authz`, `pnpm build`.
- Node22 `--test scripts/test-matriz-confiabilidade.mjs
  scripts/validar-migracoes-fora-de-banda.spec.mjs
  scripts/validar-guardas-controladores.spec.mjs`.
- `pwsh -NoProfile -File validar-preflight.ps1 -DocsOnly`, `git diff --check`.

São testes/artefatos locais ou checks GitHub, não prova de produção nem aprovação
humana independente. Sem uso de pacientes reais ou mensagem enviada a terceiros.
