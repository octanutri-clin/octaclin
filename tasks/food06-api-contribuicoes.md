# FOOD06 — API de contribuições paginadas (M02)

## Escopo e base

Implementação autorizada pelo proprietário após estabilização, na mesma PR #455
Draft e branch `docs/food06-contratos-fontes`. Baseec3690b1 conferida no GitHub:
nenhuma falha ou check em andamento na retomada. Sem migration, merge, deploy,
Neon/Render, ativação clínica ou FOOD05-MDL. Direitos e G06 continuam BLOCKED.

Risco R4: leitura de dados clínicos autorizados e projeções. Rollback somente de
código, sem nova gravação/schema ou alteração de snapshots publicados.

## Contrato

`POST /pacientes/:pacienteId/planos-alimentares/analise-micronutrientes/contribuicoes`
e BFF correspondente. Console profissional, mesmo guarda JWT/papéis/permissão
`planos_alimentares.ler` da PA06; sem portal novo. Resposta `private, no-store`.

Corpo: seleção PA06 existente com IDs/revisões esperados, `codigo` (um dos22
micronutrientes), `pagina` inteira1–10000 e `limite` inteiro1–100. Campos são
obrigatórios, sem coerção. Whitelist, UUID canônico, duplicatas e limites PA06
preservados; validação adicional no serviço recusa campo extra, código manipulado,
64KiB excedidos, tenant/snapshot/coeficientes arbitrários. BFF limita streaming64KiB.

Resposta versionada `food06-contribuicoes-v1`: página, limite, total de componentes,
cobertura da **seleção inteira**, refeições presentes na página com cobertura
integral daquela refeição, itens da página e publicações/revisões utilizadas.
Retorna ID persistente do item, nome/descrição autorizados, quantidade/unidade e
gramas congelados. Não retorna índice interno, ORM/cifra, snapshot completo,
contextos/proveniência clínica ou texto livre de outras seções.

Ordem: planos por UUID canônico; refeições por ordem+ID; itens por ordem+ID.
A ordem é de origem, não ranking por teor. Repetições legítimas permanecem.
Página depois do fim retorna lista vazia e total integral. Cliente pode determinar
fim por página/limite/total; trocar limite ou seleção constitui nova consulta.
Não há cursor opaco que conceda acesso nem cache persistente.

Cada página repete a autorização integral do paciente/carteira e de todos os
planos dentro do mesmo ExecutorTenant. Read locks do paciente/plano/publicação
seguem a fronteira existente PA06; writers de ativação/publicação/transferência
concorrem com esses locks. Publicação/revisão de ativação mudada retorna409 antes
da decifragem; acesso perdido retorna erro sem projeção parcial. Dados publicados
são imutáveis. Não há precondição de rascunho porque a rota só lê publicações.
Repetir leitura não grava nem reaplica alimentos; falha não persiste efeitos.

## Cálculo e paginação

Mesmo seletor, classificador e somador PA06. Janela calcula contribuição individual
só dos itens retornados; total e denominador continuam globais. Só descrições dos
itens/refeições da página são decifradas; snapshots nutricionais da seleção são
lidos integralmente até10.000 componentes para assegurar cobertura verdadeira.
Não há soma nova de nutrientes no BFF, recálculo por catálogo ou referências DRI.
Zero conhecido não é ausência; percentual exige denominador completo positivo.

Benchmark independente apenas de domínio:10.000 itens/retorno100,~222ms locais.
Não comprova latência HTTP, consultas/cifra, concorrência de carga ou produção.

## Evidências e revisão

- RED inicial:15 falhas/122 PASS nos novos contratos e no serviço contra stubs.
- GREEN inicial:153/153 focados; janela e limites ampliados levaram a156/156.
- BFF RED:75 PASS/1 FAIL por destino incorreto; GREEN76/76.
- Revisor `/root/food06_api_r4`, sem edição/coautoria, executou154 testes e120
  janelas sintéticas, reconciliando ordem/índices/total. Encontrou P2: teto200 de
  páginas truncava acesso com limites pequenos. Reproduziu o caso201 itens/limite1.
- Novo RED1 FAIL/14 PASS para alcançar página10000 com limite1. Correção nos dois
  validadores; regressão aceita10000 e rejeita10001. Revisor confirmou fechamento.
- Revisão estática do BFF e cenários PG sem novo achado de produção. Pediu prova
  específica de imutabilidade no detalhe; teste PG agora compara versão e itens
  antes/depois, além da prova histórica do endpoint factual.

Quatro cenários novos no PostgreSQL descartável/RLS oficial: duas páginas com IDs
reais distintos/cobertura integral/snapshots intactos e negativos tenant/papéis;
OFF concorrente409; publicação concorrente409 com histórico intacto; leitura sob
lock e perda de acesso após transferência concorrente. **PENDENTES no CI**;
nenhuma execução local real ou mock é rotulado como prova de banco/concorrência.

Typecheck backend/Web e build backend executados com Node22.23.4; ferramentas
locais reutilizadas conforme limitações da consolidação. Resultados finais da
suíte completa e CI devem ser ligados ao HEAD enviado, sem herdar verde da base.

## Pendências e handoff

- Conferir CI do novo HEAD, especialmente quatro testes PG/RLS/concorrência.
- Nova interface de contribuição, expansão/ordenação/navegação e UX B/C ainda não
  implementadas neste incremento. Fonte/preparo detalhados não são inferidos de
  descrições; projeção específica e integração de UI permanecem em M02-C1/C3.
- Sem teste HTTP real de autenticação backend nesta rodada: metadados/DTO,
  serviço, BFF e guardas reutilizados possuem provas delimitadas; prova PG ainda
  deve executar. Não declarar R4 integral FOOD06 ou latência produtiva validada.
- M01–M12 continuam obrigatórias; nada habilita comparação clínica ou produção.


## Comandos/verificações finais locais

Node22.23.4:3 suítes focadas156/156; BFF76/76; typecheck backend/Web PASS;
build Nest e verificador `dist/main.js` PASS; lint da rota BFF PASS;
`git diff --check` e `node scripts/scan-secrets.mjs` antes do push.
Uma execução completa iniciada pela raiz falhou1/3986 por ENOENT da ficha313,
pois o teste legado usa process.cwd(). A execução correta é pelo diretório
`octaclin-backend` com `node node_modules/jest/bin/jest.js --runInBand`.
Não se alterou a Fase313 nem se removeu a asserção; a repetição deve ser registrada
separadamente. Suítes condicionadas a banco continuam skipped localmente.
Não foi executado browser novo (sem UI adicionada), nem novo build Web local;
BFF foi compilado pelo harness/typecheck e o build completo será gate no CI.

Repetição final no diretório correto: **3816 PASS/170 SKIPPED**,376 suítes PASS e9
SKIPPED; nenhuma falha. Os quatro cenários PG novos fazem parte dos skipped
locais e não foram classificados como aprovados. BFF final76/76, typechecks e
build/verificação de artefato PASS após correções. Nenhum arquivo da Fase313
foi modificado. A worktree permanece com somente o delta intencional da API.
