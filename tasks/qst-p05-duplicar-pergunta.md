# QST-P05 — duplicar pergunta salva no mesmo rascunho

## Estado vigente

T01–T04 implementadas e verificadas localmente nos escopos abaixo. A interface
existe nesta branch; não foi disponibilizada em produção. Código testado:
`d832c029a7d228602ee09df51426a3dc7f5fa0d8`. T05 local:66 browser PASS, UX B/C e revisão R4
estática integral favoráveis. CI/scanners do novo HEAD pendentes ao envio.
PR permanece Draft, sem merge/deploy; prontidão final depende do CI correspondente
e revisão formal. Base main `5873ff1c`; não inclui #570 nem alterações na FOOD06.
Prova PostgreSQL dirigida T02 preservada; não comprova concorrência de toda a aplicação.

## Decisão do proprietário — 21/11/2026

Resposta explícita: “Sim, seguir essa recomendação” à regra de copiar somente
a versão salva dentro de um rascunho, inserir imediatamente após a original em
operação atômica, exigir salvar alterações pendentes, criar nova identidade e
não herdar chave clínica de comparação nem publicação na biblioteca.

Não amplia autorização a merge, deploy, migrations ou produção. Fonte de
inspiração já pesquisada: SurveyJS, somente padrão de interação, sem código
externo, instalação ou dependência nova.

## Compatibilidade e menor caminho

| Camada | Observado | Decisão |
| --- | --- | --- |
| Domínio | Normalização de configuração existente, sete tipos suportados | Não criar outro normalizador; preparar cópia independente dos valores salvos |
| Serviço | adicionarPergunta e reordenarPerguntas são operações separadas | Não encadear POST+PATCH no navegador; atomicidade precisa de comando backend |
| Versão | Pergunta não tem revisão própria; Questionario tem versao; reordenação atual não incrementa essa versão | Não tratar somente número como prova completa de identidade/revisão da origem |
| Concorrência | Escritores atuais não compartilham trava editorial explícita | Mapear todos os escritores relevantes e ordem de locks antes de integrar |
| UI | criar/salvar pergunta persistem diretamente; existe proteção de alterações pendentes | Copiar apenas origem salva, bloquear enquanto salva ou tem pendências; explicar bloqueio |
| Histórico | Envios/versões usam infraestrutura existente | Nenhuma alteração retroativa; comprovar em testes de integração |

## T01 — histórico do domínio puro (substituído pelo estado vigente T02)

Código testado: `fbb04005abeb4597d8472927f74e5a9872dfd95a` (última mudança
após os gates foi somente terminologia de comentário, sem comportamento).

- `copiarDefinicaoPergunta` projeta somente campos reutilizáveis, exclui IDs,
  tenant, vínculo do questionário, chave clínica e ordem da pergunta; fixa
  visivelBiblioteca=false. Configuração congelada é clonada sem renormalização;
  rótulos, valores, imagens e ordem das opções são preservados sem seus IDs.
- `planejarInsercaoCopiaPergunta` recebe lista autoritativamente ordenada,
  rejeita origem inexistente, IDs repetidos/conflitantes e identidade vazia,
  planeja inserção adjacente e numeração sem mutar a lista recebida.
- Estas funções NÃO autorizam acesso, geram UUIDs, leem snapshots, persistem
  cópias ou comprovam atomicidade. Configuração é dado salvo recebido do serviço,
  não DTO arbitrário nem nova projeção HTTP; validação e limites do comando
  serão obrigatórios na integração. Não transportar payload cru para respostas.
- Reutiliza tipos ORM apenas via import type; configuração por tipo permanece
  no contrato existente. Sem migration nem mudança de motor clínico.

### TDD e verificações

| Gate | Estado/evidência |
| --- | --- |
| RED | Jest compilou e executou: 15 falhas pela ausência dos contratos de cópia/inserção, sem erro de setup. Seis negativas inicialmente capturavam qualquer exceção e NÃO contam como prova; foram corrigidas para exigir BadRequestException |
| GREEN final | 68/68: 21 novos domínio, 3 configuração existente, 44 serviço questionários |
| Oráculos | Sequências literais nas três posições; sete configurações válidas pelo normalizador existente; independência de referências; zero/falso e legado; nenhuma identidade/chave clínica no resultado |
| Typecheck | PASS — Node22.21.1, tsc --noEmit backend |
| Build | PASS — Nest build + verificar-artefato-producao.mjs, dist/main.js |
| Segurança local | Scanner de segredos e diff-check PASS antes do commit |
| Revisão independente | Favorável estática, /root/auth2_r4; leu arquivos reais, não executou testes próprios. Observações sobre oráculos/configurações incorporadas |
| UX A | [Parecer profissional](../docs/agents/ux/reports/QST-P05-A-2026-11-21/avaliacao.md); paciente N/A |
| PostgreSQL/RLS e rollback | NOT RUN: nenhum caminho persistente integrado neste incremento; obrigatório antes do aceite da operação |
| Playwright/UX B/C | NOT RUN: interface ainda não implementada |
| CI/scanners remotos | Pendente no HEAD enviado; instalação local reutilizada, CI canônico necessário |

Uma tentativa de execução com caminho relativo errado não criou arquivos e
não é evidência RED. A primeira tentativa GREEN encontrou erro de tipagem no
adaptador de testes; não conta como GREEN. O resultado acima é da suíte final
corrigida, sem casts para ignorar erro no código de produção.

## Sequência — T01–T04 e T05 local executados; CI final pendente

1. **T02 — serviço e contrato transacional (PASS local; registro abaixo).** Resolver tenant/ator no servidor,
   autorizar mesmo rascunho, fixar origem salva/revisão exata e lista ordenada;
   gerar novas identidades no servidor. Persistir cópia, opções, ordem e versão
   num único ExecutorTenant. Definir CAS/locks com os escritores atuais e
   comportamento de repetição sem cópia duplicada. Não inventar ledger ou nova
   migration por conveniência. Testar falhas intermediárias e rollback real.
2. **T03 — controlador/BFF.** DTO limitado, UUIDs validados, permissão existente
   questionarios.gerenciar; reautorização no serviço, auditoria mínima e resposta
   por allowlist. Testar tenant/profissional errados, revogação, origem alterada,
   rascunho publicado entre leitura/confirmação e payload manipulado.
3. **T04 — editor.** Ação nas propriedades, motivo dos bloqueios visível mesmo
   com botão desabilitado. Em sucesso selecionar cópia e focar enunciado; em
   falha preservar origem/seleção/edições. Sem copiar da memória não salva ou
   publicar automaticamente; sem ativação parcial antes de T02/T03.
4. **T05 — aceite.** PostgreSQL descartável/role runtime/RLS, concorrência e
   retries; regressões das versões/envios; desktop/mobile, teclado e fonte200,
   UX B/C, revisão independente da operação completa e CI do SHA final.

## Critérios de produto — estado vigente

| ID | Critério | Estado atual |
| --- | --- | --- |
| P05-C1 | Origem salva no mesmo rascunho autorizado | PASS local: domínio/PG/HTTP e32 cenáriosP05; CI final pendente |
| P05-C2 | Cópia independente com novos IDs de pergunta/opções | PASS local: geração/persistência PG e seleção/edição independente na UI; CI final pendente |
| P05-C3 | Sem herdar chave clínica/biblioteca | PASS local: domínio/PG/HTTP/BFF/UI; CI final pendente |
| P05-C4 | Inserção adjacente e atômica | PASS local: transação/rollback PG e32 cenáriosP05; CI final pendente |
| P05-C5 | Repetição, rollback e alteração concorrente seguros | PASS local nos cenários dirigidos PG e leitores/escritores/UI descritos; não é prova de toda concorrência da aplicação; CI final pendente |
| P05-C6 | Pendências bloqueiam; foco/seleção e erros claros | PASS local:32P05+16a11y, UX B/C; Axe/teclado não equivalem a leitor de tela manual; CI final pendente |
| P05-C7 | Snapshots/envios antigos intactos | PASS T02 histórico no código backend inalterado +18 regressões editor/P04 e HTTP; CI final pendente |

Não declarar P05 pronta para merge antes de concluir o CI e a revisão formal aplicáveis. Nenhuma alteração
na FOOD06, branches alheias, main local, banco externo ou infraestrutura.


## T02 — checkpoint histórico local, 21/11/2026

Código validado: `99967e14e6e484374e319880e2845d108d04e216`.
Risco R4: autorização, sessão, histórico e persistência. Revisão independente
estática final favorável por `/root/auth2_r4`, sem execução própria de testes/SQL.
Parecer limitado ao serviço/protocolo T02; não é aceite global da QST-P05.

### Contrato implementado

- `prepararCopiaPergunta`: lê o mesmo rascunho autorizado e produz definição
  permitida + revisão opaca, sem gravações. HMAC-SHA256 com domínio
  `octaclin:qst-p05:revisao:v1`, vinculado ao tenant, ator, papel, sessão, origem
  canônica e agregado editorial completo. Reutiliza segredo já requerido pelo
  módulo, sem configuração nova. Não é capability nem substitui autorização.
- `duplicarPergunta`: reautoriza após eventual espera pelo pai e compara revisão
  sob lock exclusivo; cópia/opções/ordem/versão usam um só `ExecutorTenant`.
  Novas UUIDs são geradas no servidor. Chave clínica é omitida (NULL no banco),
  biblioteca=false. Somente ACK mínimo: perguntaId e versaoQuestionario.
- Identidade ativa/papel atual, sessão não revogada e vínculo profissional são
  conferidos no banco com projeções mínimas e locks compartilhados. Expiração
  temporal é conferida após espera e antes do retorno; lock não congela relógio.
  Não altera política geral de auth, permissões, MFA ou delegação.
- Reenvio de uma revisão já consumida devolve409, sem duplicata. **Não** promete
  ACK de sucesso reaproveitado nem retry transparente. O futuro cliente deve
  atualizar/conferir o estado antes de nova tentativa; nunca repetir cegamente.
- Reordenação incrementa versão monotônica, inclusive para impedir ABA
  (reordenar e restaurar não torna válida uma preparação antiga). Objetos JSON
  têm serialização determinística; perguntas/opções são ordenadas por ordem/id.
- SQLSTATE40P01/40001/55P03 no comando é conflito recuperável409, sem retry;
  erros de persistência provocam rollback. Não há ledger, migration ou nova tabela.

### Escritores e leitores

| Caminho | Protocolo |
| --- | --- |
| Atualizar questionário/publicar, adicionar/editar/reordenar pergunta | Pai FOR UPDATE antes dos filhos |
| Incluir da biblioteca | Identificar dois pais, canonicalizar UUIDs, travá-los em ordem global, revalidar origem e destino |
| Duplicar questionário, listar perguntas, envios manual/lote e versões | Pai FOR SHARE antes da composição; não fazer upgrade de lock |
| Biblioteca | Identificar pais, uma consulta de lock por lote em ordem global, reler somente pais efetivamente bloqueados, depois opções |
| Worker de agendamentos | Pais processados em ordem global com lock compartilhado antes do snapshot |
| Fallbacks legados | Leitor comum bloqueia pai antes de perguntas/opções; metadados de obterFormulario também são lidos sob lock |

A prova concorrente PG cobre comando, pares da biblioteca e fallback de salvar
rascunho. Worker e demais snapshots possuem regressões unitárias neste ciclo;
não alegar prova concorrente integral desses caminhos ou de toda a aplicação.

### Histórico legado: falha fechada

Copiar exige que cada envio existente tenha objeto snapshot com perguntas em
array. SQLNULL, JSONnull, array, objeto vazio e perguntasnull não comprovam
congelamento e impedem preparação/confirmar. Isso evita acrescentar perguntas
que apareceriam retroativamente em envios dinâmicos antigos. Não há backfill,
reconstrução presumida nem regravação de histórico. Tratar eventual saneamento
como entrega/autorização separada, preservando o conteúdo original verificável.

### RED/GREEN e qualidade

| Evidência | Resultado |
| --- | --- |
| RED inicial PG | 14 falhas em runtime por ausência do comando, com schema/role/RLS já carregados |
| Expiração durante lock da sessão | RED: operação indevidamente confirmada; GREEN:401, sem cópia |
| Expiração durante lock do perfil | RED: preparação devolvida expirada; GREEN:401 |
| Leitores biblioteca/fallback de rascunho | Dois REDs: não esperavam writer pausado por trigger SQL; GREEN com bloqueio observado e definição coerente |
| Legados | RED SQLNULL e quatro JSONs incompletos; GREEN:409 sem regravação |
| Pares com UUIDs em caixa mista | RED PostgreSQL40P01 observado; GREEN após canonicalização antes de Set/sort, com dois waiters reais |
| PostgreSQL final | **31/31 PASS**, container postgres:15-alpine, role qst_runtime NOSUPERUSER/NOBYPASSRLS, FORCE RLS; dois concorrentes observados em pg_stat_activity; zero acesso externo |
| Regressões questionários | **89/89 PASS** em8suítes;31PG SKIPPED nesse comando sem flag e executados separadamente como acima |
| Typecheck/backend build | PASS Node22.21.1: tsc --noEmit, Nest build e verificador dist/main.js |
| Segurança/editorial | Scanner local de segredos, diff-check e sintaxe do runner PASS |
| CI | Novo HEAD pendente. Suíte adicionada ao runner PostgreSQL oficial existente e habilitada por RLS_TESTCONTAINERS; nenhum workflow modificado |
| UX B/C, Playwright e HTTP | NOT RUN, pois API/BFF/interface ainda não implementados |

Cenários adicionais PG: revisão obsoleta por texto/configuração/ordem/opções,
repetição, reordenação/restauração, publicado/arquivado, isolamento de tenant e
role runtime, profissional alheio, usuário/papel/sessão/vínculo revogados durante
espera, formatos inválidos, binding a sessão/origem, JSON com chaves reordenadas,
identidades/flags persistidas e duas falhas de rollback (opções e versão final).

Ajustes dos doubles antigos: incorporar a query de lock da biblioteca e incluir
pais que faltavam nas fixtures, sem remover ou reduzir asserts. Esses doubles
não comprovam locks; as provas de banco acima são reais.

### Ambiente e limitações

Primeiro container falhou no setup por falta de espaço em pg_wal; não é RED.
Banco descartável passou a usar TMPFS256MiB; nenhuma configuração de serviço
externo foi alterada. O schema sintético explícito reproduz colunas/constraints
usadas pela prova e FORCE RLS; não é ensaio do histórico integral de migrations.

Uma chamada de gravação com caminho relativo incorreto não alterou arquivos e
uma tentativa GREEN teve erro de tipagem/import; nenhuma conta como prova.
Um run de inspeção de versões encontrou package exports do TypeORM, resolvido
somente na inspeção por leitura de package.json; não era teste do produto.

Artefatos próprios ignorados de build preservados em `/tmp/qst-p05-t02-dist`,
com symlink local dist, para reduzir pressão de disco; nenhum arquivo alheio foi
removido. Dependências reutilizadas: Nest11.2.5, TypeORM1.1.1, Jest30.5.2,
TS6.0.3, Testcontainers12.1.0. CI canônico com lockfile ainda necessário.

Para reproduzir em Node22, no backend: `QST_P05_POSTGRES=true pnpm test --runInBand
--runTestsByPath src/modulos/questionarios/aplicacao/copia-pergunta.integracao.spec.ts`.
O runner `pnpm test:rls:testcontainers` também inclui a prova no CI.

## T03 — API/BFF, checkpoint histórico local de 21/11/2026

Escopo R4: expor o comando já autorizado por rotas autenticadas e projeções mínimas.
Não altera o domínio, o protocolo de locks T02, snapshots, schema ou permissões gerais.
Rollback de código do incremento não implica desfazer cópias já confirmadas.

- `GET /questionarios/:id/perguntas/:perguntaId/copia`: preparação autorizada,
  revisão opaca e definição da cópia salva, sem gravação.
- `POST /questionarios/:id/perguntas/:perguntaId/duplicar`: DTO fechado contendo
  somente `revisaoEsperada` hex64 minúscula. UUIDs nos dois parâmetros;
  papel/permissão existentes e tenant do principal. Serviço mantém reautorização.
- Controlador retorna somente revisão/definição ou ACK perguntaId/versão.
  Auditoria de confirmação inclui somente questionarioId/origemId e recurso novo;
  não inclui definição, revisão, sessão ou conteúdo clínico.
- BFF usa `exigirPermissaoBff`, `requisitarBackendAutenticado` e verificação de
  Origin compartilhados. Entrada limitada a1KiB; resposta a512KiB com o leitor
  limitado já existente (`lerTextoLimitado`); nenhuma alteração no módulo de restrições.
  Projeta definição/opções e ACK por allowlist, sem IDs de opções, chave clínica,
  tenant ou entidade ORM. Configuração salva por tipo permanece preservada.
- `peso` continua **string decimal**, conforme o numeric da entidade/driver.
  Fixture inicial number passou, mas a prova corrigida com string real produziu
  RED502; GREEN após preservar o contrato, sem conversão ou arredondamento.
- HTTP/BFF usam private,no-store; BFF aplica também Vary:Cookie, inclusive erros.
  Corpos de erro do backend não são retransmitidos. Conflito409 exige nova
  conferência; não existe retry próprio. Renovação401 permanece no wrapper comum.
  Uma falha de transporte/ACK ou da auditoria após commit exige conferir o estado;
  não significa rollback nem autoriza repetir o comando cegamente.

### Evidências T03

Código testado/commit local: `91333ea2a90afc69b0e5a9a6db005e429a4048cf`.

| Gate | Resultado e limite |
| --- | --- |
| RED HTTP |17 falhas404 com app/guardas/pipe iniciados: rotas inexistentes; não é erro de setup |
| HTTP final | PASS19/19; UUIDs, sessão/papéis/permissão, DTO adulterado/nulo/array/JSON, revisão, respostas/cache e auditoria mínima |
| BFF focado | PASS11/11 (5 regressões +6 P05); definição fiel com categoria, tipo suportado e peso string também confirmada no test:authz |
| RED/GREEN peso BFF | RED10PASS/1FAIL com numeric string; GREEN11/11 após ajuste de projeção |
| Regressões backend | PASS89 regressões +19HTTP; comando do módulo confirmou107 testes antes da inclusão do19ºHTTP, depois confirmado19/19;31PG SKIPPED sem flag |
| Typecheck | PASS backend/Web, Node22.21.1 |
| Build | PASS Nest/artefato e Next webpack, repetido após ajuste das rotas; Node22.21.1, dependências locais preexistentes |
| test:authz | PASS consolidado dos28 comandos canônicos em Node22; detalhes de execução/setup abaixo |
| PostgreSQL/RLS | Não repetido no delta de apresentação;31/31 T02 no código99967e14, serviço/locks não modificados; não prova HTTP ligado ao banco |
| Revisão cruzada | Favorável estática /root/auth2_r4, delta T03; sem execução própria de testes, sem aceite global P05 |
| CI anterior | aa3a1c70: OctaClinCI44930521345, CodeQL44930521380, Semgrep44930521344, Trivy44930521378 e DependencyReview44930521367 concluídos success; não valida T03 |
| Segredos/diff | Scanner local PASS; repetir diff final antes de enviar |
| Next real local | PASS GET/POST401 sem cookies nas rotas geradas pelo build, com private,no-store,max-age=0,must-revalidate do middleware; não é jornada autenticada |
| Navegador/UX B/C | NOT RUN: interface T04 ainda ausente; permanece obrigatório em T05 |

O `test:authz` foi executado pelos mesmos28 comandos definidos no package.json,
sem alterar asserts, severidades, dependências ou configurações das suítes. Os8
primeiros terminaram em série; a orquestração serial foi interrompida para executar
os restantes em lotes paralelos de3. O bloco dashboard em voo foi reexecutado e
confirmado5/5; não se atribui PASS à execução interrompida. Os19 comandos finais
foram registrados individualmente:18 PASS na primeira tentativa; restrições falhou
antes dos testes (ENOENT do registro clínico, não falha funcional). O registro
`docs/clinico/validacao-textos-restricoes.json` já existia no mesmo HEAD, mas estava
fora do sparse-checkout. `git sparse-checkout add docs/clinico` ampliou somente a
leitura desta worktree, sem modificar o registro ou outras worktrees. Reexecutado
somente esse bloco: PASS69/69. Portanto o comando serial original não foi uma
execução global completa; o PASS consolidado cobre todos os mesmos28 subcomandos.

Build Next registrou avisos de convenção middleware e API de Node no Edge oriundos
da dependência local preexistente; terminou com sucesso. Nenhum codemod ou ajuste
de segurança foi aplicado. CI canônico do novo HEAD permanece pendente ao envio.

As provas HTTP substituem apenas autenticação e serviço por identidades/dados
sintéticos: guardas/pipe/controlador são reais, mas não há JWT criptográfico ou
banco nesse teste. BFF usa cookies/fetch/NextResponse simulados; não comprova
Next real nem a jornada. Os testes novos integram os runners existentes do módulo
e de questionários no `test:authz`, sem workflow/dependência nova. O guardrail de APIs dinâmicas
rejeitou o alias de params importado: corrigidas as rotas com interface Promise
e await explícitos, sem mudar o guardrail; PASS194arquivos. Lint dirigido PASS.

Dependências locais preexistentes/reutilizadas: CI com lockfile continua necessário.
O primeiro smoke local esperava cabeçalho exato menor; a observação mostrou o
middleware acrescentando max-age=0,must-revalidate. A prova corrigida exige o
cabeçalho completo efetivo; não houve defeito funcional ou mudança do middleware.
Saída própria `.next` em tmp via symlink ignorado para não pressionar disco;
nenhum arquivo de outra worktree removido.

## Handoff histórico anterior — T04 (substituído pelo fechamento abaixo)

T04: conectar a ação nas propriedades do editor ao preparo/confirmação existente,
com TDD. Bloquear enquanto houver alterações de pergunta **ou questionário** ainda
não salvas ou salvamento em curso; explicar o motivo fora do botão desabilitado.
Conferir definição salva/revisão, sem copiar memória não salva. Em409/falha preservar
edições e seleção; não repetir cegamente. Em sucesso recarregar lista autorizada,
selecionar cópia e focar enunciado. Depois T05: UX B/C, Playwright desktop/mobile,
teclado/fonte200, respostas tardias e revisão independente da jornada completa.
Sem merge, deploy, migrations externas, alterações na FOOD06 ou infraestrutura.


### Mapa delimitado para T04 (somente leitura nesta rodada)

- `components/questionarios/usar-workspace-questionarios.ts`: possui os dois
  indicadores de pendências, `salvando`, seleção, `salvarPergunta` e carregamento.
  Integrar preparo/confirmação guardando contexto/origem/revisão; resposta tardia
  não pode selecionar uma cópia em outro formulário nem sobrescrever edições novas.
- `components/questionarios/area-editor.tsx`: ação junto a Propriedades e
  explicação acessível; `enunciado` já tem identificador para foco após sucesso.
- `lib/questionarios-api.ts`: cliente do BFF, manter erro de conflito explícito e
  peso decimal compatível; não persistir revisão em localStorage/query string.
- `tests/visual/questionarios-editor.spec.mjs`: reutilizar a jornada/mocks
  sintéticos existentes para RED/GREEN, depois executar UX B/C na interface real.

Este mapa não constitui implementação T04 nem nova aprovação de produto.

## T04 e fechamento local — 22/11/2026

Risco R4 de integração: nenhuma mudança nova de domínio, serviço, API, BFF,
permissões ou banco. O código T01/T02/T03 permanece o mesmo dos commits registrados.
A interface nova existe apenas nesta branch; não está disponível em produção.

### Interface e consistência

- `usar-copia-pergunta.ts`: preparo/confirmação com contexto editorial memoizado,
  barreira síncrona de operação em voo e verificação de contexto antes de aplicar
  respostas. Confirma somente a revisão emitida pelo servidor, nunca a definição
  do navegador. Sem localStorage, query string ou retry próprio.
- `fluxo-copia-pergunta.tsx`: ação em Propriedades, motivo de bloqueio visível,
  prévia salva reutilizada e confirmação explícita. Cancelar antes do comando
  não escreve; após início do POST aguarda resultado, sem simular cancelamento.
- ACK precisa ser seguido por leitura autorizada contendo a nova identidade.
  Só então aplica lista/versão, seleciona cópia e foca Enunciado. Não fabrica uma
  cópia otimista. Erro/conflito/readback falho preserva dados e bloqueia nova
  cópia até conferência explícita, também bloqueada se surgirem novas edições.
- Conferência atualiza somente a lista, preserva seleção quando existente e
  orienta conferir se a cópia já aparece. Não promete identificar uma aplicação
  após ACK perdido nem provar que o comando não ocorreu. Sem POST na conferência.
- Editor fica bloqueado enquanto grava/copia/carrega ou mantém a prévia aberta.
  Foco de cancelamento é devolvido ao gatilho após reabilitar o campo; sucesso
  foca o enunciado da cópia. Campo de texto/número/slider da prévia reutilizada
  recebe nome acessível do enunciado, sem alterar sua composição/configuração.

### Achados da revisão e TDD

| ID | Evidência RED | Correção/prova |
| --- | --- | --- |
| T04-R01, P1 | EditarA → selecionarB → salvarB deixava Duplicar habilitado, embora A não salva | Pendências por ID; salvar só limpa a pergunta salva. Badge Não salva e mensagem plural. RED/GREEN dirigido desktop/mobile4/4 comR02 |
| T04-R02, P2 | PATCH de ordem iniciado e aguardando ACK deixava Duplicar habilitado | Reordenação integra salvando, recusa pendências e ignora resposta de contexto antigo (incluindo ABA). Editor bloqueado durante salvamento |
| T04-R03, P2 | SelecionarB(GET atrasado) → voltarA → copiarA → liberarB removia cópia: esperado3 perguntas, recebido0 | Geração de leitura incrementada sincronamente; sucesso/erro/finally antigos não escrevem. Seleção nula invalida, nova seleção limpa lista anterior. ACK/conferência invalida leitores anteriores; carregamento bloqueia a cópia |
| A11Y-01 | Axe encontrou textarea de prévia sem nome acessível | Nome explícito associado ao enunciado em textarea/range/number; não se desabilitou regra |
| FOCUS-01 | Cancelar devolvia foco ao body porque o gatilho estava desabilitado ao abrir | Ref/rAF local após cancelamento; sucesso mantém foco na cópia |
| NUX-P05-B-01 | Conferir lista não emitia a orientação esperada | Mensagem factual, sem inferir resultado da tentativa; teste de conflito e nova conferência |

O primeiro ensaio do teste de arraste não atingia o PATCH: não era RED funcional.
A sincronização foi corrigida aguardando aria-pressed e anúncio de droppable
medido antes de mover/soltar. Não houve ampliação de timeout ou retry. O RED
aceito R02 é o botão habilitado após PATCH efetivamente iniciado. Uma execução
intermediária durante edição de nomes de testes foi inválida (test not found);
não é evidência de produto. Uma regressão intermediária teve45PASS/1FAIL de
sincronização de DnD, corrigida pelo mesmo critério observável. Resultados finais
estão discriminados abaixo, sem atribuir PASS às tentativas interrompidas.

### Gates do delta final

| Gate | Estado |
| --- | --- |
| Navegador inicial | PASS64/64:30P05 +18editor/P04 +16a11y, antes de R03 |
| Navegador após R03 | PASS66/66:32P05+18editor/P04+16a11y, desktop/mobile, sem ampliar timeout/retries |
| Prévia domínio Web | PASS3/3, motor reutilizado inalterado |
| Lint dirigido | PASS nos arquivos alterados; repetir se houver código novo |
| Typecheck/build Web | PASS tsc --noEmit e Next webpack apósR03, Node22.21.1; dependências locais preexistentes |
| Ferramentas UX | PASS validador de papéis e5 testes Python, sem alteração de papéis/permissões |
| R4 independente integral | Favorável estática `/root/auth2_r4`, base5873ff1c→de822372+deltaT04; os3 achados foram rastreados e corrigidos. Sem execução própria de testes/SQL; não autoriza merge/produção |
| UX B | [Relatório](../docs/agents/ux/reports/QST-P05-B-2026-11-21/avaliacao.md), persona profissional independente com descrição factual da interface; pacienteN/A. Sem interação própria ou imagem recebida pela persona |
| UX C | [Parecer favorável limitado](../docs/agents/ux/reports/QST-P05-C-2026-11-22/avaliacao.md), resolução deB sem novos achados concretos; sem testes próprios |
| PostgreSQL/RLS | Reutilizada prova31/31 T02, código99967e14 inalterado. Não repetida neste delta exclusivamente Web |
| HTTP/BFF/authz | Reutilizados19HTTP/11BFF/28subcomandos T03; código dessas fronteiras inalterado. Não atribuir esse PASS ao CI de outro HEAD |
| CI anterior | de822372: workflows CI44942387911, CodeQL44942387994, Semgrep44942387967, Trivy44942387937 e DependencyReview44942387905 concluídos success; não comprovam T04 |
| CI HEAD final | PENDENTE de envio; dependências canônicas precisam da execução correspondente |

A matriz de navegador usa Next real, Chromium desktop e emulação Pixel5, mas
intercepta BFF/cookies com fixtures sintéticas. Prova interface/contratos; não
prova isolamento no banco nem navegador ligado ao PostgreSQL. R03 teve RED em
build local de produção; o GREEN usa desenvolvimento webpack suportado, sem
alterar arquitetura, dependências, segurança ou configurações de teste.
O teste de ACK tardio força ativação DOM de uma aba para simular mudança externa
de contexto; não é interação normal de ponteiro através do modal. Axe, teclado,
fonte200 e responsividade não equivalem a teste manual com leitor de tela ou
aparelho físico, que não foram executados. Não existe ensaio de produção.


## Próxima ação exata — estado vigente

Código T04 testado: `d832c029a7d228602ee09df51426a3dc7f5fa0d8`. Os testes e revisões locais acima
foram concluídos antes do commit, sem mudanças funcionais posteriores. Aguardar
e conferir CI/scanners do HEAD documental enviado; investigar falhas/threads novas
sem usar o PASS de de822372 para aprovar o delta. Não repetir suítes locais sem
novo código, falha ou lacuna relevante. Se todos os checks aplicáveis passarem e
não houver achado novo, consolidar recomendação de prontidão para revisão formal,
sem retirar Draft, fazer merge ou deploy automaticamente.

Backend/banco, autorização HTTP/BFF e suas provas foram reaproveitados porque
seus arquivos não mudaram. Não foi executado novamente o backend inteiro, PG,
HTTP/BFF ou authz28 neste delta Web. CI canônico permanece necessário. Não houve
ensaio de banco externo, migration, instalação de dependência ou alteração de
workflows, infraestrutura, main ou worktree de outro agente.
