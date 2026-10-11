# Fase 314 — execução técnica controlada

## Autorização e fronteira

O proprietário autorizou desenvolvimento, testes sintéticos, PostgreSQL local descartável, commits e uma PR Draft. Essa autorização substitui os limites operacionais documentais anteriores e a sugestão P0 da REV5. Não autoriza ratificação clínica, direitos comerciais, ativação assistencial, merge, staging/produção ou deploy.

Risco R4: snapshots clínicos, tenancy, autorização e imutabilidade. Um escritor ativo; revisões prévias preservadas no commit `cee05f20`. Base remota conferida: `f8c5ab66f2708d4a73fc31d460f929a665bd6f08`. Sem acesso a dados reais.

## Implementação técnica e limites

- Datas civis estritas, dias e meses estatísticos separados; convenção civil explícita para mês curto/29 de fevereiro. A ratificação da política clínica de aniversário continua pendente.
- Snapshot pediátrico v1 cifrado na estrutura de avaliações existente. Confirmação explícita, chave idempotente, lock por paciente e por chave; escopo revalidado antes de replay. Divergência cadastral impede novos registros, sem alterar anteriores.
- Registro de medidas parciais e contexto ausente/desconhecido. Quatro indicadores ficam bloqueados por ratificação; não há flag de cliente ou ambiente que os habilite.
- Endpoint paginado na transação tenant existente: ordenação por data, instante e UUID, cursor SQL preservando precisão. O cursor avança pelo último registro examinado antes de filtrar snapshots pediátricos. Nenhuma observação ou fingerprint na projeção.
- Console com registro, resultado de bloqueio, contexto preservado, tabela e gráficos de medidas originais; séries separadas quando contexto/técnica mudam. Sem novos fluxos de portal.
- Proteções de menores e dos seis métodos 18–19 pendentes individualmente. Resultados legados são lidos sem recálculo. Gestação mantém precedência.
- Candidatos matemáticos isolados: LMS direto/inverso/interpolação de parâmetros, caudas por configuração, quatro indicadores, normalização OMS proposta, flags/edema e política de prematuridade versionada. Não são consumidos pelo serviço assistencial, não incluem datasets comerciais não comprovados.
- Coeficientes INTERGROWTH somente no teste de investigação, excluído do build; sem código R copiado. Oráculos arquivados exclusivamente sintéticos. Concordância amostral não comprova fonte primária nem direitos.

## Evidências nesta execução

| Comando / verificação | Estado e escopo |
| --- | --- |
| `pnpm --dir octaclin-backend test --runInBand` | PASS após refinamento final: 290 suites, 2614 testes; 3 suites/50 testes SKIPPED, 149,418s |
| `pnpm --dir octaclin-backend test:rls:testcontainers` | PASS: 31 testes após refinamento e prova adicional de paginação por microssegundo, 98,763s; banco local descartável, role runtime não owner, RLS/transferência/replay/concorrência/UPDATE/DELETE/rollback |
| INTERGROWTH investigação | PASS: 17 testes; 14 casos/28 resultados oficiais arquivados sintéticos; divergência semanal 55s permanece, G01 BLOCKED |
| Candidatos quatro indicadores / CL07 | PASS: 8 e 4 testes sintéticos. Não prova direitos ou validade clínica das referências ausentes |
| `pnpm --dir octaclin-web test:authz` | BFF314 final PASS: 1 teste composto, 30,224s; suíte ampla local em execução após build. CI Web valida suíte ampla no HEAD da PR |
| `pnpm --dir octaclin-backend typecheck` / `build` | PASS após refinamento final; guarda de produção exclui testes/coeficientes de investigação |
| `pnpm --dir octaclin-web typecheck` / `build` | PASS no ambiente retomado; 177 páginas e novo BFF |
| `pnpm --dir octaclin-web lint` | PASS: zero erros, 65 warnings existentes; componente novo sem warnings |
| `node scripts/smoke-ui-regression.mjs` | PASS: smoke-ui-regression-ok; 9 rotas, servidor local de produção e API demo sintética |
| `node scripts/smoke-e2e-bff.mjs` | PASS: smoke-e2e-bff-ok, API demo sintética |
| `pnpm --dir octaclin-web exec playwright test console-regression.spec.mjs --grep 'Fase 31[34]'` | PASS: 6 testes desktop/mobile/axe, registros/paginação/acesso revogado/gestação, 30s; servidor local de produção |
| Governança | PASS: 22 scripts do workflow, mais workflows seguros (8 testes) e testes PR Gate/impacto; matriz, auditoria, guardas, migrations, a11y, supply chain/secrets |
| `pwsh -NoProfile -File validar-preflight.ps1 -DocsOnly` | PASS após corrigir cabeçalho/status da fase ativa; não altera fases históricas |
| `git diff --check` / `pnpm security:secrets` | PASS antes do push; repetir na entrega final |
| CI PR #392 | IN_PROGRESS; backend/governança PASS no HEAD c3744333; evidência final deve ser lida no HEAD vigente da PR |

### Falhas realmente observadas e resolução

- PostgreSQL frio sob carga: 31 FAIL derivados do timeout de preparação de180s, sem executar casos; repetição com imagem disponível:31 PASS. Não elevou tolerâncias nem alterou critérios clínicos.
- BFF/build concorrentes: TS6053 nos arquivos `.next/types` substituídos pelo build. Repetição sequencial após build, sem alterar contratos ou mascarar erros.
- Preflight documental: cabeçalho histórico apontava307; corrigido cabeçalho vigente314/status313 concluído no código, histórico preservado. PASS.
- TDD portal: dois FAIL demonstraram exposição por fluxo legado; correção49 PASS.
- TDD projeção/extremos: dois FAIL demonstraram objeto num campo escalar conhecido e overflow no arredondamento de IMC factual. Correção valida tipos do contexto e finitude depois de arredondar, preservando medidas originais; 12 testes focados e suite completa2614 PASS.

Testes são locais e sintéticos. Oráculos independentes arquivados não constituem revisão independente do patch. Ainda não houve revisão cruzada humana.

## Rollback e ambientes

Desabilitar a entrada da interface/rota em rollback de aplicação preserva snapshots cifrados e o histórico. Nunca recalcular ou apagar registros para voltar código. Nova migration 1069 acrescenta proteção BEFORE DELETE para avaliações confirmadas. `down()` recusa com dados; legado e exclusão lógica preservados. Procedimento em `RUNBOOK_PRODUCAO.md`; 1068 não foi editada. A aplicação de 1068 fora deste PostgreSQL descartável permanece não verificada. Migrations de staging/produção exigem evidência externa do operador e autorização operacional separada.

## Gates

| Gate | Estado atual |
| --- | --- |
| G00 | Parcial: base/contratos locais PASS; fontes/direitos BLOCKED; operação externa 1068 BLOCKED/consulta SKIPPED |
| G01 | BLOCKED: origem/precisão primária IG, direitos concretos e fechamento integral OMS/55s |
| G02 | BLOCKED: CL01–10 sem ratificação humana específica |
| G03 | PASS para desenvolvimento; BLOCKED para ativação assistencial |
| G04 | BLOCKED para validação integral dos classificadores por G01/G02; provas técnicas locais PASS conforme tabela; CI obrigatório consultável na PR |
| G05 | BLOCKED: revisão R4/CI/ratificações/ambientes e autorização de merge/produção |


## Revisão de segurança e regressões

Superfícies revisadas: DTO, serviço, controlador, paginação SQL, projeções
executáveis, portal legado, candidatos sem consumidores assistenciais, build
e migration aditiva. Testes negativos cobrem autorização antes de replay,
transferência de paciente, tenant externo, cursor, conteúdo extra, acesso
revogado e bloqueio de compartilhamento pediátrico. Os resultados e contexto
estão cifrados; auditoria contém somente contagem, BFF usa private/no-store,
nenhum dataset/equação de direitos pendentes entra no runtime assistencial.

Defeito identificado e corrigido: o fluxo legado de peso e métricas poderia
publicar avaliações pediátricas. Leitura do portal agora exclui tais avaliações
e PATCH de compartilhamento as rejeita. TDD apresentou dois testes FAIL e,
após correção, 49 PASS nos serviços pediátrico/portal.

Limites: revisão realizada pelo mesmo autor, não independente. O fluxo formal
da skill security-diff-scan está SKIPPED porque seu recurso obrigatório
config-preflight não ficou disponível; leitura da skill não equivale a scan
formal aprovado. Não houve alteração externa de permissões, banco ou ambiente.
Snapshot ilegível não é parcialmente exposto. Dataset, cobertura/âncoras OMS,
coeficientes primários INTERGROWTH/55 semanas e direitos concretos permanecem
pendentes. Sem ratificação, a entrega permite medidas e histórico, sem
escore/classificação assistencial.

## Retomada de ambiente

A worktree e os arquivos foram preservados; logs/processos temporários do
ambiente anterior não foram transferidos. As suites foram reiniciadas;
resultados anteriores são intermediários, não prova do HEAD final. Node
22.23.3 e PowerShell 7.6.6 temporários tiveram SHA256 oficial conferido.
O launcher pnpm inicial do ambiente é 11.19; processos de teste usam Node 22.
A ferramenta temporária pnpm 11.25 foi instalada para os comandos seguintes,
sem modificar dependências ou lockfiles do projeto.


## Prontidão e tarefas T01–T18

O checklist preserva cada tarefa original e separa a subfatia técnica realizada
do critério clínico integral. T01/T02 produziram investigação e dossiê;
T03–T05 e T07–T10 possuem contratos/matemática candidatos com fixtures
sintéticas, sem referências licenciadas assistenciais. T06/T11–T15 entregam
registro, proteção, histórico/paginação e interface factuais. T16/T17 registram
provas locais e governança; T18 tem a única PR Draft #392.

A fase completa não está concluída: tabelas/edições/âncoras OMS oficiais
normalizadas, direitos concretos, modelo IG primário/55s e ratificação CL01–10
são bloqueadores de classificadores, curvas e ativação. Não chamar candidatos
sintéticos de classificador oficial pronto. O software factual pode ser
revisado tecnicamente; uso assistencial dos protocolos e produção BLOCKED.

PR: https://github.com/octanutri-clin/octaclin/pull/392. Sem merge ou deploy.


Evidência sanitizada de comandos/estados: `reviews/fase-314-implementacao/evidencias.json`.
Ela contém somente metadados de execução e hashes de arquivos, sem logs ou
payloads clínicos. CI, scanners e provas de ambiente externo são categorias
distintas; os badges da PR informam o HEAD realmente validado.
