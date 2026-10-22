# FOOD04 — tarefas, checkpoints e aceite

Contrato vigente: [plan-pos-320-food04.md](plan-pos-320-food04.md).
D01–D08 aprovadas pelo proprietário e incorporadas ao planejamento. T00/T01
concluídas documentalmente; implementação T02–T14 não iniciada.
TDD obrigatório para lógica/segurança: registrar RED, correção e GREEN, com
fixtures sintéticas. Dividir cada tarefa em subpassos de3–5 arquivos, uma PR.

| ID | Atividade / superfícies | Dependências | Aceite objetivo |
| --- | --- | --- | --- |
| T00 | Base/AGENTS/referências/contratos atuais | — | [x] Main9e1984a2 e worktree isolada; ausência de biblioteca externa específica confirmada |
| T01 | Consolidar decisões e seis entregáveis de planejamento | T00 + mensagem do proprietário | [x] D01–D08, modelos/fluxos/permissões/testes/essencial vs complementares registrados; sem código |
| T02 | Domínio e DTOs grupos/entradas/consulta/duplicação | T01 | [ ] RED/GREEN limites, estados, escopo, porções, identidade XOR, metadados, reordenação e campos extras |
| T03 | ORM grupos/favoritos + migration aditiva/registro | T02 | [ ] Nova migration disponível e registrada; FK tenant-aware/unique/checks/índices/ENABLE+FORCE RLS;1077 intacta; rollback conservador |
| T04 | CRUD pessoal/compartilhado/cifra/HMAC/CAS/arquivo/restauração | T03 | [ ] Só autorizados; composição custom autoritativa; estados/cópias independentes; pedido idempotente sem duplo create; audit na transação |
| T05 | Permissões e administração institucional | T04 | [ ] Client/SuperAdmin somente compartilhados do tenant com capacidade específica; criador desligado não orfana gestão; nenhum acesso pessoal/prontuário novo |
| T06 | Duplicar/favoritos/filtros/compartilhar | T04–T05 | [ ] Cópia pessoal padrão/IDnovo/origem interna; promoção autorizada sem custom pessoal; favorito isolado/idempotente; paginação/estado/categoria/pesquisa sem vazamento |
| C1 | Checkpoint biblioteca | T02–T06 | [ ] Focados/typecheck e matriz de autorização PASS; revisão do escopo administrativo |
| T07 | Resolver editorial seletivo/dedup/proveniência | C1 | [ ] RED/GREEN principal excluído, selecionadas somente, porção personalizada, duplicata exata, divergência explícita, snapshot anterior confiável vs replay forjado |
| T08 | Integrar save/materialização/cópias/projeções | T07 | [ ] Mesma transação/CAS/locks; snapshots preservados após arquivo/edição; nova versão/copy/modelos mantêm origem/composição; DTO não vaza campo interno |
| T09 | PostgreSQL real descartável/RLS/concorrência | T08 | [ ] Role não-owner/NOBYPASSRLS; tenant ausente/cruzado, pessoal/admin, duas criações/duplicações, races CAS/arquivo/restauração/aplicar/transferir; provar execução no runner/CI |
| C2 | Checkpoint R4 backend | T07–T09 | [ ] RED/GREEN e SQL real registrados; sem inferir isolamento de mocks; locks sem ordem inversa |
| T10 | BFF/API/types/rotas e testes de autorização | C2 | [ ] Helpers existentes, allowlists, no-store, sessão/papel/permissão/escopo/erros; catálogo de rotas atualizado sem abrir endpoints clínicos ao Client |
| T11 | UI biblioteca/administração/duplicação/organização | T10 | [ ] Fluxos CRUD/favorito/arquivo/restauração/compartilhamento, filtros/paginação e ordem por teclado; componente comum sem expor pessoal ao admin |
| T12 | UI prévia/aplicação/undo e Playwright | T11 | [ ] Seleção/porções/dedup/cancelamento; flags falsas; coordenador/posse/abort; undo local seguro; desktop/mobile/a11y e corridas de autosave/contexto |
| C3 | Checkpoint funcional | T10–T12 | [ ] Fluxo completo e regressões editoriais; 20/item e96KiB, sem perda silenciosa ou liberação paciente |
| T13 | Regressões, revisão R4, evidências e docs | C3 | [ ] Backend/Web/banco/a11y e regressões PA02–PA07/FOOD01–03; revisão com autoria/achados; gates reais e limites documentados |
| T14 | PR única/CI/scanners do HEAD final | T13 | [ ] Diff/secrets/governança e checks aplicáveis; separar CI de deploy/migration; complementar não implementado por antecipação |

## Subpassos para manter tarefas executáveis

- T03a: entidades e migration; T03b: registro/constraints/fixtures/provas de migração.
- T04a: criar/ler; T04b: editar/arquivar/restaurar com auditoria/CAS.
- T05a: capacidades/backend; T05b: rotas administrativas sem afrouxar helper profissional.
- T06a: duplicar/compartilhar; T06b: favoritos/filtros/consulta e testes.
- T07a: seleção/dedup/porções; T07b: confiança/idempotência/proveniência.
- T08a: save e materialização; T08b: clone/copy/modelos/projeção e regressões.
- T10a: BFF profissional/admin; T10b: catálogo de permissões e testes negativos.
- T11a: biblioteca profissional; T11b: administração reaproveitada; T11c: organização/duplicação.
- T12a: helper/preview; T12b: integração autosave/undo; T12c: navegador e acessibilidade.
- T13a: regressões locais; T13b: revisão/evidências e documentos.

Nenhum subpasso cria escritor concorrente nos arquivos críticos. Complementares
FOOD04-C01/C02/C03 estão no roadmap, sem tarefas de implementação nesta PR.

## Comandos previstos, não executados nesta etapa

1. Selecionar Node22.x/pnpm11.25.0 do projeto antes dos testes; instalar somente
   com lockfile congelado. Não alterar engines/lockfile para adaptar ao ambiente.
2. `pnpm --dir octaclin-backend exec jest --runInBand <paths-reais-food04>`;
   depois `pnpm --dir octaclin-backend test --runInBand`, `typecheck` e `build`.
   Placeholders devem virar paths reais na execução/handoff.
3. Suite PostgreSQL FOOD04 com flag e comando explícitos; incluir no runner/step
   CI. Também `pnpm --dir octaclin-backend test:rls:testcontainers` para regressão.
   O runner atual enumera suites; adicionar um arquivo isolado não o executa.
4. Web: `pnpm --dir octaclin-web test:authz`, `test:copia-refeicoes`,
   `test:nutricao-plano`, `test:calculo-combinado-planos`, `typecheck`, `build`,
   lint dos alterados; novos specs precisam integrar runners de fato executados.
5. Playwright FOOD04 desktop/mobile, acessibilidade e regressões proporcionais
   usando projetos `desktop-chromium` e `mobile-chromium`; incluir teste de
   espera após60s, falha de rede, perda de posse e conflito entre edições.
6. Governança: `git diff --check`, `pnpm security:secrets`,
   `pnpm test:confiabilidade`, `pnpm audit:redacao-auditoria`, `pnpm validate:docs`.
   PowerShell ausente significa BLOCKED, sem fingir PASS do preflight oficial.
7. CI Backend/Web/Demo/PRGate e scanners do HEAD final da PR; nenhuma aprovação
   implícita de migration/deploy externo.

## Gates e resultados reais

| Gate | Estado no planejamento | Condição de saída |
| --- | --- | --- |
| Decisões de produto | PASS | D01–D08 aprovadas; regras adicionais incorporadas |
| Especificação técnica | PREPARADA | Seis entregáveis apresentados; qualquer divergência nova deve ser evidenciada |
| Diff/secrets/links/matriz documental | PASS | Diff/secrets limpos; 4 links válidos; 40 referências da matriz; comandos no plano |
| Preflight documental oficial | BLOCKED anterior | PowerShell ausente; nova execução apenas com ferramenta adequada |
| Backend/BFF/UI/regressões | SKIPPED | Implementação e comandos apropriados passam no código final |
| PostgreSQL/RLS/concorrência | SKIPPED | Prova real sintética e role adequada, não skip condicional |
| Revisão técnica R4 | SKIPPED | Revisão com autoria/escopo/achados; autorrevisão não é independente |
| CI/scanners | SKIPPED | PR e HEAD final identificados e conferidos |
| Migration externa/deploy | SKIPPED | Exigem autorização operacional específica e preflight separado |
