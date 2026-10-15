# PA04 — resumo de macros na lista de planos

> Fechamento em 2026-10-14: PR #418 mergeada em `64f54b88`, árvore idêntica
> ao HEAD `37d7979` aprovado. Checks aplicáveis PASS, incluindo CI
> `38625821164`, Backend/PostgreSQL/RLS descartável, Web, Demo e PR Gate.
> SBOM provenance SKIPPED. Os itens pendentes abaixo preservam o checkpoint
> anterior; gates de integração/CI encerrados pela evidência remota, sem alegar
> execução local dos 64 casos bloqueados por ENOSPC. Sem migration/deploy externo.


Planejamento iniciado em 2026-10-14 após autorização do proprietário para
seguir à próxima etapa. Base main `6f0be7d`, merge #417; worktree isolada
`/workspace/octaclin/.worktrees/pos320-pa04-planejamento`, branch
`docs/pos320-pa04-planejamento`. Runtime não alterado. D01–D03 respondidas pelo
proprietário; handoff consolidado. Início do código aguarda a troca manual de
modelo, conforme preferência registrada na sessão.

## Base e referência específica

- PA03 integrada pela #417 em `6f0be7df241e5eeea6685cad4c16792964577be9`.
  Conteúdo da main idêntico ao HEAD aprovado `a013555` (git diff --quiet).
  Cinco workflows SUCCESS: CI 38608333870, Semgrep 38608334092,
  CodeQL 38608333825, Trivy 38608333892 e Dependency Review 38608333817.
  Todos os dez jobs do CI SUCCESS, inclusive Backend, Web, Demo e PR Gate.
  Isso comprova integração/CI, não deploy ou estado de produção.
- Consultadas somente entradas PA04 do roadmap pós-320, mapa do catálogo,
  matriz (sugestão 48) e JSON entries[].prs. Não há candidato externo PA04;
  catálogo/matriz recomendam primitives e código atual. Sem clone ou biblioteca.
- Reutilizar domínio de planos, snapshots cifrados, ExecutorTenant, paginação,
  guardas, BFF/no-store, formatação pt-BR e proteção FND02/PA02.

## Decisões de produto confirmadas

| ID | Aceite do proprietário nesta sessão |
| --- | --- |
| D01 | Ambas as versões: resumos separados do rascunho e da publicada atual, quando existirem, com estado e número da versão. |
| D02 | Totais dos alimentos previstos na versão salva, sem metas extras, substituições ou inferência de consumo. |
| D03 | Somente a lista do console profissional; portal e impressão seguem seus fluxos existentes. |

D01–D03 foram confirmadas pelo proprietário. D03 “console profissional” não altera
os papéis legados: serviço admite Professional/SuperAdmin com permissão de ler;
Professional exige carteira atual. Client e usuário do portal não ganham acesso.

## Gaps constatados e solução técnica

| Gap | Evidência | Correção planejada |
| --- | --- | --- |
| G01: listagem sem macros | montarResumoVersao() expõe só metadados; API Web usa Pick sem totais | Acrescentar projeção mínima somente às versões escolhidas da lista. Não ampliar histórico/portal automaticamente. |
| G02: consulta “leve” carregava metadados de todas as versões e colunas cifradas desnecessárias | Revisão R4 independente identificou materialização sem limite por quantidade de histórico | A seleção ORM agora inclui somente ponteiros publicados atuais e drafts ativos da página; histórico é preservado por `COUNT(*) GROUP BY plano_id` com filtro de tenant e IDs da página. Snapshot cifrado carregado em lote somente para os IDs relevantes. |
| G03: fonte computacional já existe | PlanoAlimentarVersaoOrm.totaisSnapshotCriptografado; save/publicação conservam snapshots | Ler totais salvos, nunca recomputar árvore, catálogo ou conteúdo histórico. |
| G04: Web corta em 100 | carregar() fixa página1/limite100 e descarta total/página/limite | Paginação visível, limite25, total real; não carregar páginas silenciosamente nem duplicar fetch por plano. |
| G05: sidebar prioriza texto de rascunho | botão lista Rascunho vN, senão Publicado vN | Identificar a versão de cada resumo segundo D01; rascunho salvo não representa alterações não salvas. |
| G06: dados opcionais/corrompidos | reader existente devolve unknown; snapshot ausente em rascunho novo | Validar em runtime e emitir allowlist de quatro números; ausências/invalidade não viram zero. |
| G07: paginação pode perder edição/cópia | selecionarPlano() e FND02 protegem dirty; PA02 usa ref síncrona de cópia | Paginação também respeita dirty/operação/cópia e sequências de carregamento; não persistir nem limpar silenciosamente. |
| G08: dois lotes sob READ COMMITTED | ExecutorTenant usa transaction padrão; leituras de metadados/totais separadas podem coincidir com save/publicação/transferência | Trava compartilhada do paciente na autorização; mutações existentes usam a mesma linha com FOR UPDATE/UPDATE. Provar concorrência real, sem mudar o isolamento global. |

Arquivos auditados: servico-planos-alimentares.ts e spec; controlador e DTO de
listagem; plano-alimentar-versao.orm.ts; plano-alimentar-api.ts; editor;
BFF /api/pacientes/[id]/planos-alimentares e proxy; specs BFF e PA02/PA03.

## Contrato proposto de dados e cálculo

1. A lista mostra snapshots da versão salva. Não são consumo real, metas,
   soma de alternativas ou prévia de alterações ainda não salvas.
2. Publicada atual é a referência versaoPublicadaAtualId; não deduzir pela
   maior versão/data e não substituir por publicação histórica diferente.
   Rascunho é a versão ativa sem publicadaEm/descartadaEm, segundo o contrato.
3. Reutilizar os totais persistidos, que já têm arredondamento do domínio.
   Não somar novamente nem aplicar fórmula 4/4/9. Formatar apenas na UI.
4. Campo aditivo em current/draft: resumoNutricional com estado
   completo/incompleto/sem_snapshot/indisponivel e valores opcionais
   energiaKcal/proteinasG/carboidratosG/gordurasG. Estados e nomes acima são o
   contrato de implementação; consumidores antigos continuam aceitando o resumo.
5. JSON deve ser objeto, nunca array/null. Cada valor exige number, finito,
   >=0; zero válido. Campo ausente, string, NaN, Infinity ou negativo fica
   indisponível, conservando indicadores válidos; não criar total fictício.
6. Sem buffer: sem_snapshot, “Sem resumo salvo”. Falha de decriptação/JSON:
   indisponivel, “Resumo indisponível”, sem detalhe interno ou dado cifrado.
   Objeto com campo inválido: incompleto, “Dados incompletos” e “—” no afetado.
   A falha do resumo não deve ser confundida com falha de autorização: esta
   continua interrompendo a operação antes de ler/decriptar snapshots.
7. Projetar explicitamente somente as quatro métricas e estado. Não retornar
   objeto JSON cru, entidades ORM, buffer, objetivos, observações, cálculo,
   medidas, itens, fibras/sódio ou novas fingerprints. Preservar metadados
   legados do resumo sem refator oportunista de API/histórico.
8. Antes de qualquer lote: ExecutorTenant e garantirPacienteNoEscopo com
   tenant, paciente não arquivado, profissional atual e permissão ler.
   Todos os lotes restringem tenant e planos/versões da página autorizada.
9. Metadados sem colunas cifradas; totais carregados em um lote <=2*limite.
   Decriptar somente versões selecionadas, sem N+1, catálogo ou árvores.
   Manter ordenação criadoEm DESC/id DESC e contrato pagina/limite/total.
   Agrupar versões por plano numa passagem; não redesenhar todo o repositório.
10. Sem migration, índice novo, backfill, recalculo retroativo, nova dependência
    ou chamadas externas previstos. Uma necessidade comprovada muda o plano
    antes da implementação afetada, sem editar migrations integradas.
11. Na listagem, garantirPacienteNoEscopo deve obter pessimistic_read/FOR SHARE
    antes dos lotes e da decriptação, dentro de ExecutorTenant. Estender somente
    o argumento privado de bloqueio para aceitar esse modo; bool true mantém
    pessimistic_write nas mutações, false mantém comportamento anterior nos
    demais caminhos. Não alterar ExecutorTenant nem isolamento global.
12. Locks permanecem até encerrar a transação. Leituras concorrentes podem
    compartilhar a linha; save/revisão/publicação/criar versão/archive existentes
    travam o paciente para escrita (verificados em obterPlanoNoEscopo(...,true),
    criar() e publicar()). UPDATE/transferência da linha também conflita com
    FOR SHARE. Isso serializa os lotes em relação a essas operações, mantendo
    número/estado/data e totais da mesma versão salva. Ordem: paciente antes
    de plano/versão. Não prometer snapshot global de outras tabelas nem cancelamento
    de resposta já autorizada; uma leitura nova após transferência deve ser negada.
13. PG T03 inclui lista pausada depois do lock, save/publicação/transferência
    concorrentes e nova leitura após transferência. Provar espera e resultado
    coerente com barreiras no harness, sem sleeps arbitrários ou mocks de SQL.
    Se surgir mutação legítima que não use a linha do paciente, interromper
    somente este checkpoint e revisar o contrato antes de declarar coerência.

## Interface e paginação

- Estado e vN junto de cada resumo; pt-BR: kcal sem casas, P/C/G em gramas
  com uma casa, nomes acessíveis completos. Não depender apenas de cor.
- Valores da lista são salvos; ao editar o plano, manter esse significado,
  com aviso já existente de rascunho não salvo. Não misturar a prévia PA03.
- Sidebar usa total real e controles anterior/próxima, página atual/total.
  Após troca explícita de página, abrir o primeiro plano da página, pelo fluxo
  existente de carga; não fazer requisição por cada card. Não alterar página
  enquanto dirty/cópia/operação bloquear saída. Carga inicial/paciente reseta1.
  Save recarrega a mesma página/seleção; create vai à página1 e seleciona o novo;
  archive remove seleção antiga, ajusta página vazia e abre o primeiro disponível.
- Reutilizar sequenciaCarregamento/AbortSignal para impedir resposta antiga
  após mudança de paciente/página. Trava síncrona PA02 também protege ações
  programáticas, não somente disabled no botão.
- Após save/reload, atualizar resumos a partir do servidor; não computar no
  browser para “corrigir” valores salvos. Após archive/create, ajustar página
  inválida/seleção de modo determinístico e preservar o contrato existente.
- Mobile, quebra de títulos/valores longos, alvo44px, foco visível e keyboard.
  UI de leitura e impressão existentes não adquirem formulário ou toggle novo.

## Execução e checkpoints

| Tarefa | Dependência | Entrega e aceite |
| --- | --- | --- |
| T00 | merge PA03 | Planejamento, referências PA04 e D01–D03 ratificadas; runtime intacto. |
| T01 | T00 + autorização/modelo | RED/GREEN do projetor de snapshot: zero, parcial, inválido, objeto extra/cipher ausente; allowlist exata e versões corretas. |
| T02 | T01 | Listagem em lotes, select mínimo, nenhuma árvore/catálogo e nenhum N+1; API aditiva e leitura autorizada antes da decriptação. |
| T03 | T02 | PostgreSQL descartável/role sem BYPASSRLS: tenants, carteiras, transferência/arquivamento, paginação, versões e concorrência FOR SHARE/UPDATE; explicar ambiente e assertar resultados reais. |
| T04 | T03 | BFF/cliente preservam permissões, no-store e página/limite; payload profissional não chega à API portal. |
| T05 | T04 | Cards com resumos D01–D03, paginação acessível e guardas dirty/cópia; respostas atrasadas descartadas; save reidrata snapshots. |
| T06 | T05 | Playwright desktop/mobile/axe; regressões PA01–03, FND02, readonly, históricos e portal/PDF proporcional ao diff. |
| T07 | T06 | lint/typecheck/build, R4 cruzada independente, secrets/diff; evidências por gate. |
| T08 | T07 local | Uma PR com plano/código. CI do HEAD, scanners e Demo; Draft até gates. Sem merge/deploy/migrations externas. |

Testes futuros: service/controller listagem e domínio de planos; BFF planos;
unitários do projetor; PostgreSQL via harness existente; visual PA02/PA03 e
spec PA04. Novo teste de PG pode reutilizar a configuração de RLS/containers;
não confundir mocks de Repository com prova de select/SQL ou isolamento.
Preferir casos de serviço no harness existente de
src/infraestrutura/banco-dados/rls-isolamento-tenant.integracao.spec.ts, que já
provê DataSource runtime/ExecutorTenant/crypto e migrations reais. O runner
test:rls:testcontainers limpa variáveis de banco externo e habilita
RLS_TESTCONTAINERS=true. Confirmar que os casos novos foram executados, não
apenas exit0 de um describe pulado. Nenhum ambiente externo para essa prova.
Helper puro novo pode ficar em dominio/resumo-nutricional-plano.ts; extrair
somente o card/lista para components/pacientes/lista-planos-alimentares.tsx se
isso evitar ampliar o editor central. Tipos em plano-alimentar-api.ts são
aditivos; backend não amplia montarResumoVersao global para históricos.
Compiladores rodam sem Next dev regenerando .next; visual preferencialmente
no build com next start, Node22/pnpm11.25 conforme manifests.

## Segurança, evidências e continuidade

R4: nova projeção de PHI e leitura cifrada no backend. Revisão cruzada quando
viável; rollback reverte campo/cards/paginação e preserva snapshots históricos.
Não adicionar logs, auditoria com métricas, URLs de PHI, analytics, Cache Storage
ou preferência persistente. Não copiar dados reais nem .env de outra worktree.

## Revisão R4 independente e correções adicionais

A revisão read-only independente encontrou dois P2: (1) a listagem materializava
todas as versões históricas da página; (2) a navegação podia confirmar a lista
de uma nova página antes de obter seu detalhe, deixando editor e lista de páginas
diferentes após erro. Correções: seleção limitada ao pointer atual e draft ativo;
contagem histórica em agregação tenant-scoped; lista/página/editor agora só são
confirmados após detalhe e avaliações resolverem. Testes backend foram ampliados
com muitas versões sintéticas e contagem agregada.

A revisão também observou risco transitório ao trocar paciente no mesmo componente.
O render do prontuário falha fechado se `dados.paciente.id` diverge da rota; o
editor PA04 também verifica a identidade do paciente no próprio render e usa key
por paciente. O link interno de duplicidade usa navegação SPA; o teste Playwright
fornece prontuário sintético B, pausa a lista de B e verifica que o modal e os
macros de A somem antes de B carregar. Esse novo cenário ainda aguarda execução. A revisão estática
R4 confirmou a lógica do guard e das duas correções; não executou testes. Relatório:
`docs/governance/REVISAO_R4_PA04_2026-10-14.md`.

Estado final de verificação registrado nesta worktree: testes focados de
domínio/serviço **44/44 PASS**; typecheck backend e Web **PASS**; BFF
**26/26 PASS**; lint Web **0 erros e 10 avisos** de hooks na superfície
auditada; `node --check`, `git diff --check` e scanner local de secrets
**PASS**. O lint foi executado após os ajustes finais da UI.

O Playwright com os novos cenários R4 e PostgreSQL/Testcontainers estão
**BLOCKED** por `ENOSPC`: tentativas não conseguiram iniciar Next/Docker nem
executar os casos novos. A execução Playwright anterior (2/2 desktop/mobile)
antecede esses cenários. Build completo, CI remoto e PR ainda não executados.
Não houve migration, acesso a staging/produção, deploy ou ativação.

Reversão: reverter projeção/API e UI; snapshots cifrados preexistentes não são
alterados. Não há migration nem backfill. D01–D03 seguem fechadas.
