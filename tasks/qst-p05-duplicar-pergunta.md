# QST-P05 — duplicar pergunta salva no mesmo rascunho

## Estado vigente

T01 (domínio) e T02 (serviço transacional) implementadas e validadas localmente.
A ação de produto ainda NÃO está disponível: API/BFF, interface, UX B/C, aceite
transversal e CI do novo HEAD permanecem pendentes. Prova PostgreSQL dirigida
concluída no escopo T02; não comprova concorrência de toda a aplicação. PR própria Draft,
base main `5873ff1c`; não inclui a integração P01/P02 da #570 nem FOOD06.

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

## Sequência — mesma PR; T01/T02 locais, T03–T05 pendentes

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
| P05-C1 | Origem salva no mesmo rascunho autorizado | PARCIAL: serviço/PG PASS; API e bloqueio de pendências na UI pendentes |
| P05-C2 | Cópia independente com novos IDs de pergunta/opções | PARCIAL: geração servidor/persistência PG PASS; integração UI pendente |
| P05-C3 | Sem herdar chave clínica/biblioteca | PARCIAL: domínio e persistência PG PASS; contrato HTTP pendente |
| P05-C4 | Inserção adjacente e atômica | PARCIAL: transação/locks/revisão/rollback PG PASS; confirmação na UI pendente |
| P05-C5 | Repetição, rollback e alteração concorrente seguros | PARCIAL: comando/biblioteca/leitor legado dirigidos PASS; HTTP e erros tardios na UI pendentes |
| P05-C6 | Pendências bloqueiam; foco/seleção e erros claros | PENDENTE UI/UX B/C |
| P05-C7 | Snapshots/envios antigos intactos | PARCIAL: histórico congelado intacto e legado incompleto bloqueado em PG; regressões HTTP/UI pendentes |

Não declarar P05 pronta para merge com essa matriz parcial. Nenhuma alteração
na FOOD06, branches alheias, main local, banco externo ou infraestrutura.


## T02 — resultado local, 21/11/2026

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

## Próxima ação exata

T03: controlador/DTOs e BFF com validação/limites, guardas existentes,
auditoria mínima e projeções allowlist, sem habilitar UI parcialmente.
Continuar na mesma PR Draft, com TDD e testes HTTP/negativas. Depois T04/T05,
incluindo UX B/C, teclado/mobile, erros tardios e revisão independente final.
Sem merge, deploy, migrations externas, alterações na FOOD06 ou infraestrutura.
