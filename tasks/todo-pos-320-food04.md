# FOOD04 — tarefas, checkpoints e aceite

Base/contratos: [plan-pos-320-food04.md](plan-pos-320-food04.md).
Estado: planejamento, sem implementação. T00 concluída; T01 aguarda D01–D03.
Cada tarefa exige RED antes do código quando muda comportamento/segurança.
Não declarar gate aprovado com mocks se a propriedade depende de PostgreSQL.

| ID | Atividade / arquivos principais | Depende de | Aceite e verificação |
| --- | --- | --- | --- |
| T00 | Base, AGENTS, referências FOOD04 e contratos reais | — | [x] Main9e1984a2; alteração preexistente preservada; gaps G01–G08 mapeados |
| T01 | Ratificar D01–D03 e congelar DTO/intenções/limites | T00 | [ ] Respostas registradas; exemplos sintéticos e critérios de erro fechados |
| T02 | Domínio/DTO da biblioteca (`dominio/grupos-substituicoes.ts`, spec, DTO/spec) | T01 | [ ] RED/GREEN para identidade XOR, porções, ordem, ausências,20 entradas, escopo; unknown fields rejeitados |
| T03 | ORM/migration nova e registro TypeORM + specs | T02 | [ ] Migration aditiva registrada; FORCE RLS/tenant FK/unique/checks;1077 intacta; unit de registro PASS |
| T04 | Serviço CRUD/controle/identidade (`servico-grupos-substituicoes`, controller e respectivos specs) | T03 | [ ] Criação idempotente, CAS, só criador altera, pesquisa HMAC/cifra/projeção; cross-profissional/tenant e custom pessoal em grupo clínica negados |
| C1 | Checkpoint biblioteca | T02–T04 | [ ] Focados backend/typecheck PASS; sem novo acesso clínico ou dependência |
| T05 | Resolver puro da intenção editorial (`dominio/aplicacao-grupos-substituicoes.ts`, spec, `edicao-plano.ts` e spec) | C1 | [ ] RED/GREEN primeira aplicação vs cópia salva, chaves/nonce, revisão, teto/bytes; metadados falsos não conferem autoridade |
| T06 | Integrar save/clone/projeções (`servico-planos-alimentares.ts`, spec, DTO editorial) | T05 | [ ] Grupo/fonte e destino revalidados na mesma transação; revisão/locks existentes; histórico inalterado após edição/desativação; não vazar proveniência |
| T07 | Postgres real descartável: RLS/autorização/concorrência (`*.integracao.spec.ts`, runner/script) | T06 | [ ] Role não-owner/NOBYPASSRLS; contextos ausente/incorreto negados; races criação/CAS/save/desativar/transferência; executado de fato |
| C2 | Checkpoint persistência | T05–T07 | [ ] RED/GREEN e SQL real registrados; registro da migration; revisão de locks e snapshots, sem escalar acesso runtime |
| T08 | BFF/API/types (`app/api`, `lib/plano-alimentar-api.ts`, scripts BFF/permissões) | C2 | [ ] Allowlist/guardas/no-store; body validado; erro sanitizado; negar sessão/papel/permissão e campos extras |
| T09 | UI de biblioteca independente (`components/pacientes/grupos-substituicoes.tsx`, helper/spec) | T08 | [ ] Criar/editar/desativar/selecionar, paginação, loading/vazio/erro, pessoal padrão se ratificado; sem nomes clínicos no cache/URL |
| T10 | UI aplicação no editor e helper/spec | T09 | [ ] Prévia, múltiplos destinos, acréscimo e estados D03; posse/abort/coordenador; nenhuma resposta tardia altera outro plano |
| T11 | Playwright desktop/mobile e acessibilidade | T10 | [ ] Teclado/foco/nome/erro; 20→21, perda de posse, autosave/retry, troca de paciente e grupo indisponível; relatório PASS |
| C3 | Checkpoint funcional | T08–T11 | [ ] Fluxo inteiro funciona; cópias/planos publicados/portal/print e cálculos preservados |
| T12 | Regressões/gates e documentação/segurança | C3 | [ ] Focados e integral backend, Web authz, typecheck/build/lint, RLS integral, regressões PA02–PA07/FOOD01–03; revisão R4 identificada; resultados/limites explícitos |
| T13 | PR única e checks do HEAD final | T12 | [ ] Diff/secrets/governança PASS; CI Backend/Web/Demo/PRGate e scanners conferidos; sem alegar deploy pelo CI |

Tarefas com mais de cinco arquivos devem ser feitas em subpassos sequenciais,
mantendo a mesma PR: T03a migration/ORM e T03b registro/provas; T04a serviço e
T04b controller; T08a DTO/BFF e T08b catálogo de permissões; T12a regressões e
T12b revisão/documentos. Não abrir PRs paralelas nem duplicar writers do editor.

## Comandos previstos para implementação

- Backend: `pnpm --dir octaclin-backend exec jest --runInBand <specs-food04>`;
  depois `pnpm --dir octaclin-backend test --runInBand`, `typecheck` e `build`.
  Substituir `<specs-food04>` por paths reais; não é comando executado.
- Postgres: criar suite FOOD04 sintética e conectá-la ao runner/CI existente;
  executar também `pnpm --dir octaclin-backend test:rls:testcontainers`.
  O runner atual tem lista explícita de duas suites e não descobre automaticamente
  um novo spec: adicionar FOOD04 e a flag apropriada, ou invocá-la em step
  dedicado no CI, com falha se a prova real não executar.
  Não aceitar skip condicional do Jest como evidência de banco real.
- Web: `pnpm --dir octaclin-web test:authz`, `test:copia-refeicoes`,
  `test:nutricao-plano`, `test:calculo-combinado-planos`, `typecheck`, `build`
  e lint dos arquivos alterados; specs novas devem entrar nos runners reais.
- UI: `pnpm --dir octaclin-web exec playwright test <spec-food04> --project=desktop-chromium --project=mobile-chromium --reporter=list`;
  adicionar provas de a11y proporcionais no runner atual. Placeholders serão
  substituídos pelo caminho existente na implementação.
- Governança: `git diff --check`, `pnpm security:secrets`,
  `pnpm test:confiabilidade`, `pnpm validate:docs`. PowerShell ausente deve ser
  reportado como bloqueio, sem converter conferência local de links em PASS do preflight.

## Gates

| Gate | Estado inicial | Condição de saída |
| --- | --- | --- |
| Planejamento técnico | EM ANDAMENTO | D01–D03 incorporadas e handoff conferido |
| Segurança / R4 | SKIPPED | Revisão com autoria e achados resolvidos; própria não é independente |
| PostgreSQL / RLS / concorrência | SKIPPED | Execução real descartável, role e isolamento demonstrados |
| Regressões / UI / a11y | SKIPPED | Comandos específicos e integrais aplicáveis passam no código final |
| CI / scanners | SKIPPED | Runs da PR e HEAD final identificados; nenhum falso verde |
| Migration externa / operação | SKIPPED | Preflight alvo/role, autorização aplicável, ensaio e verificação separados |
