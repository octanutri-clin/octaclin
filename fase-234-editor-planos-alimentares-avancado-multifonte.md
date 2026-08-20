# Fase 234 - Editor de planos alimentares avancado e catalogo multifonte

Status: em execucao. Incrementos 1 e 2 concluidos em 2026-08-14; Incremento 3
concluido em 2026-08-16; Incrementos 4 e 5 concluidos em 2026-08-17;
Incrementos 6 e 7 concluidos em 2026-08-20. Fase importante de evolucao clinica e de produto, posterior
ao MVP da Fase 216. Nao substitui os bloqueadores de go-live das Fases 225,
226, 228, 229, 231, 232 e 233.

## Objetivo

Evoluir o editor de planos alimentares para uma experiencia clinica completa:
rapida para o profissional, compreensivel para o paciente, rastreavel em cada
publicacao e segura para dados de composicao nutricional de mais de uma fonte.

A Fase 216 permanece como a base: TACO versionado, calculo no backend,
rascunho, revisao humana, publicacao imutavel, RLS e projecao segura no portal.
Esta fase nao reabre essas garantias; ela as amplia.

## Incremento 1 - governanca e imutabilidade do catalogo

Concluido em 2026-08-14, sem importar novas fontes externas:

- familias de catalogo separadas de versao/base, permitindo representar TBCA
  7.3 com `BD-AIN` e `BD-B` sem colisao ou duplicacao conceitual;
- proveniencia por versao com artefato, checksum, hash normalizado, esquema,
  captura, direito de uso, aprovador e situacao fail-closed;
- historico de importacao e eventos de mudanca de situacao;
- fontes ativas/suspensas/revogadas e seus alimentos protegidos contra
  alteracao ou exclusao; transicoes exigem ator e motivo;
- role runtime limitada a leitura das tabelas globais do catalogo;
- carregador TACO transacional, sem `upsert` destrutivo, com verificacao
  integral e reexecucao idempotente;
- snapshots novos guardam checksum, esquema e datas, enquanto snapshots
  antigos continuam legiveis por campos opcionais;
- migrations `1028`, `1029` e `1030` aplicadas primeiro em
  `octaclin_test_fase150b`, com 43/43 migrations. A `1029` validou os 583
  alimentos antes de converter a identidade legada da TACO; a `1030`
  vinculou cada registro a uma importacao concluida, gravou hash por alimento,
  endureceu a ativacao e protegeu tambem transferencias saindo de fonte ativa.

Evidencia operacional: TACO ativa com 583 registros e 583 vinculos/hashes de
proveniencia, checksum do artefato
`a66b8ec5...2d14`, hash normalizado `82c22bc4...81e7`, evento auditado de
ativacao e bloqueios reais de mutacao e ativacao sem importacao aprovados. A
segunda execucao do carregador terminou sem alterar o catalogo e registrou a
tentativa como `ignorada`. A decisao de fontes esta em
`DECISAO_FONTES_CATALOGO_FASE_234.md`.

Validacao do incremento: 5 suites focadas com 27 testes, suite backend completa
com 135 suites e 890 testes, typecheck e build backend, typecheck/lint e gates
de autorizacao web, preflight documental, scanner de secrets e `diff --check`.
Build web e acessibilidade foram executados sequencialmente para evitar disputa
pelo diretorio `.next` e permaneceram aprovados.

Permanecem para os proximos incrementos: APIs e busca multifonte completas,
editor profissional, modelos, grupos de substituicao, portal, adesao, lista de
compras e validacao final.

Rollout de producao concluido em 2026-08-14: dump PostgreSQL custom gerado e
validado estruturalmente antes da mudanca; banco e role confirmados como
`Octaclin-db-producao`/`neondb_owner`; somente `1028`, `1029` e `1030` estavam
pendentes e foram aplicadas em uma transacao, elevando o historico a 43/43.
As provas posteriores repetiram os 583 vinculos/hashes, evento, triggers,
privilegios somente leitura de `octaclin_app_producao`, bloqueios com rollback
e recarga idempotente auditada como `ignorada`.

## Incremento 2 - contratos e permissoes do workspace

Concluido em 2026-08-14, sem migration de banco:

- a colecao de planos passou a retornar resumos de plano e versao em duas
  consultas constantes, sem materializar refeicoes, itens ou substituicoes;
- o novo detalhe `GET /pacientes/:pacienteId/planos-alimentares/:planoId`
  carrega somente publicacao atual e rascunho completos; versoes historicas
  permanecem resumidas;
- backend, BFF e cliente compartilham a separacao entre resumo e detalhe, com
  IDs codificados e escopo revalidado por tenant, paciente e responsavel;
- o servico passou a exigir `planos_alimentares.ler` ou
  `planos_alimentares.gerenciar` como defesa adicional aos guards HTTP;
- `podeGerenciar` agora chega ao workspace. Leitores nao recebem criacao,
  campos editaveis, revisao, publicacao, nova versao ou arquivamento, enquanto
  continuam podendo selecionar, atualizar, imprimir e consultar o plano;
- avaliacoes antropometricas deixaram de ser dependencia do modo de leitura e
  respostas obsoletas de trocas rapidas de plano sao ignoradas;
- o gate `test:authz` passou a incluir os contratos BFF de planos e prova que
  as seis mutacoes sao negadas antes de consultar o backend para quem possui
  somente leitura.

Validacao do incremento: 135 suites e 894 testes backend, typecheck e build
backend, typecheck/lint/build web, gate completo de autorizacao e quatro
cenarios Playwright em desktop/mobile para leitura e gestao. O proximo
incremento adicionara DTOs de consulta paginada, filtros multifonte e detalhe
historico sob demanda antes de ampliar o editor profissional.

## Incremento 3 - consultas paginadas, filtros multifonte e historico sob demanda

Concluido em 2026-08-16, sem migration de banco:

- a listagem de planos passou a ser paginada e validada (`pagina`, `limite`),
  devolvendo `{ itens, total, pagina, limite }` em vez de um array sem teto. O
  total sai do proprio `findAndCount`, entao a contagem nao depende do tamanho
  da pagina carregada;
- a busca de alimentos deixou de ser um `take(50)` fixo e ganhou a mesma
  paginacao, mais filtros opcionais por `fonteCodigo`, `versao` e `baseCodigo`.
  A resposta carrega `fontes`, a lista das fontes ativas, para a interface
  montar o filtro sem uma segunda rota;
- o filtro multifonte estreita o conjunto de fontes **antes** da consulta e
  continua partindo apenas de `situacao = 'ativa'`, entao filtrar por uma fonte
  suspensa devolve vazio em vez de revelar seus alimentos;
- `%` e `_` digitados pelo profissional passaram a ser escapados com
  `ESCAPE ''`. Antes, buscar `100%` casava com o catalogo inteiro: o curinga
  do LIKE anulava na pratica o minimo de dois caracteres;
- nova rota `GET /pacientes/:pacienteId/planos-alimentares/:planoId/versoes/:numero`
  entrega a versao historica completa sob demanda. O detalhe do plano continua
  trazendo apenas publicacao atual e rascunho completos, e o historico segue
  resumido ate alguem pedir uma versao especifica. O escopo do plano e
  revalidado antes da leitura, entao numero de versao nao vira caminho lateral
  para plano de outro paciente;
- o BFF ganhou `montarConsultaPermitida`, uma allowlist explicita: somente os
  parametros nomeados chegam ao backend e qualquer outro e descartado na
  fronteira. A codificacao usa `encodeURIComponent` para preservar o formato ja
  acordado nas rotas anteriores (`%20`, nao `+`).

Revisao independente do incremento (seguranca, tipos e banco), com dois
achados corrigidos ainda dentro dele:

- **paginacao instavel**: `listar` ordenava so por `criadoEm` e a busca so por
  `nome`. Nenhuma das duas colunas e unica — `criado_em` usa `default now()` e
  empata entre linhas gravadas na mesma transacao, e `nome` repete entre fontes
  e preparos. Com OFFSET, um empate na fronteira da pagina faz a mesma linha
  aparecer duas vezes ou sumir. Ambas ganharam desempate por `id`;
- **pagina sem teto**: `limite` ja era limitado a 100, mas `pagina` aceitava
  qualquer inteiro, entao `?pagina=999999999&limite=100` virava um OFFSET
  absurdo. Entrou `PAGINA_MAXIMA = 1000` no DTO e no clamp do servico, o mesmo
  padrao de defesa em profundidade ja usado para `limite`.

Sem achado critico ou alto. Confirmado na revisao: `obterVersao` revalida o
escopo do plano antes de ler a versao; os filtros multifonte so estreitam o
conjunto ja restrito a `situacao = 'ativa'`, entao filtrar por fonte suspensa
devolve vazio; o `ESCAPE` usa parametro vinculado, sem concatenacao; e o
allowlist do BFF descarta parametro desconhecido antes do backend. O
`ux_plano_alimentar_versoes_numero` ja cobre `(tenant_id, plano_id, numero)`,
entao `obterVersao` e index scan, e `montarVersao` faz tres consultas em lote,
sem N+1.

Debito registrado, nao bloqueante: a busca usa `LIKE '%termo%'`, cujo curinga a
esquerda nao aproveita indice B-tree. Hoje o `idx_alimentos_composicao_fonte_nome`
segura porque o catalogo ativo e so a TACO (583 itens). Quando uma fonte ativa
passar da ordem de 10-20 mil linhas, trocar por indice trigram
(`pg_trgm` + GIN sobre `lower(nome)`) antes de habilitar TBCA ou IBGE/POF.

Decisao registrada: a rota de versao historica devolve tambem versoes
`descartada`, e nao apenas `publicada`. Elas ja constavam do `historico`
resumido desde a Fase 216 e pertencem ao mesmo plano, sob a mesma permissao e o
mesmo escopo de paciente/profissional; abrir o detalhe do que ja era listado
mantem o historico clinico auditavel sem ampliar quem pode ler.

Validacao do incremento: 135 suites e 902 testes backend (o unico vermelho e o
`catalogo-taco.spec.ts`, que falha apenas em working tree Windows com
`core.autocrlf=true` por comparar o JSON com serializacao normalizada em LF;
falha identica reproduzida em `main` limpo antes da mudanca), typecheck backend
e web, lint web, `test:authz` completo (6 suites sem falha, 12 asserts do BFF de planos),
`test:next15` com 92 arquivos, build web, `git diff --check` e
`pnpm security:secrets`.

O proximo incremento amplia o editor profissional de refeicoes sobre esses
contratos. TBCA, IBGE/POF e Tucunduva continuam desabilitadas.

## Incremento 4 - previa nutricional, densidade da linha e fonte na busca

Concluido em 2026-08-17, sem migration de banco:

- entrou `octaclin-web/lib/nutricao-plano.ts`, um modulo puro que calcula a
  previa nutricional do rascunho enquanto o profissional digita. Antes os
  totais so apareciam depois de salvar, entao compor um plano era um ciclo de
  digitar, salvar e conferir;
- o modulo espelha deliberadamente o backend, nao aproxima: usa o mesmo
  `arredondar4` com epsilon `1e-10`, deriva a porcao apenas de `porcaoGramas`
  (a `quantidade` e a medida caseira exibida, nao um multiplicador) e repete a
  regra de `calcularTotaisPlano` de que um unico item sem fibras ou sodio torna
  o total **desconhecido** em vez de zero. O teste fixa o resultado contra o
  mesmo fixture de `calculo-nutricional.spec.ts` do backend, entao uma mudanca
  de arredondamento la quebra o teste aqui em vez de gerar divergencia silenciosa;
- `PainelNutricional` e um `<details>` unico: aside sticky a partir de `lg` e
  folha inferior fixa no mobile. Um so no DOM, uma so regiao viva, divulgacao
  nativa por teclado — em vez de duplicar o conteudo por breakpoint e duplicar
  tambem os anuncios de leitor de tela;
- o painel compara os totais com as metas do **ultimo rascunho salvo** e marca a
  comparacao como defasada enquanto houver alteracao pendente. O cliente nao
  reimplementa Mifflin-St Jeor, fator de atividade nem ajuste energetico: quem
  estima gasto continua sendo o servidor;
- a barra de desvio usa o mesmo limiar de 30% que bloqueia a publicacao no
  backend, entao o painel antecipa o resultado da publicacao em vez de ser um
  indicador decorativo. O numero, o sinal e o percentual aparecem em texto; a
  barra e leitura secundaria e nenhum estado depende so de cor;
- a linha de alimento ficou menos densa: dos seis campos de nutriente manual,
  os quatro obrigatorios seguem a vista e apenas fibras e sodio recolhem atras
  de `Mais nutrientes (opcional)`. Campo `required` escondido reprovaria o envio
  sem o profissional ver onde;
- item vindo do catalogo passou a mostrar energia e macros da porcao na propria
  linha. Antes o profissional escolhia um alimento da TACO e a linha nao dava
  retorno nutricional nenhum;
- a busca passou a consumir o que o Incremento 3 ja devolvia e a interface
  ignorava: seletor de fonte alimentado por `fontes`, contagem real vinda de
  `total` (`Mostrando 50 de 214`) e fonte com versao visivel em cada resultado.
  O seletor so aparece com mais de uma fonte ativa, entao com a TACO sozinha
  nao vira uma escolha sem alternativa.

Revisao independente do incremento (React e acessibilidade), com quatro achados
corrigidos ainda dentro dele:

- **fonte filtrada pelo campo errado**: o seletor usava `codigo` como valor,
  mas o indice unico do backend e `(catalogo_id, versao, base_codigo)` —
  `codigo` sozinho repete. A propria fase modela a TBCA 7.3 como duas fontes
  ativas (bases `BD-AIN` e `BD-B`) com o mesmo codigo e a mesma versao, entao
  filtrar por codigo devolveria as duas mescladas num resultado unico, que e
  exatamente a mescla silenciosa que o criterio de aceite proibe. A identidade
  passou a ser a tripla completa e a busca envia `fonteCodigo`, `versao` e
  `baseCodigo` juntos — parametros que o Incremento 3 ja aceitava e a interface
  ignorava;
- **foco escondido atras da folha (WCAG 2.2 SC 2.4.11, AA)**: com a previa
  expandida no mobile, tabular ate `Salvar rascunho` levava o foco para tras do
  painel opaco. A barra de acoes passou a ficar acima dele no empilhamento e o
  corpo da folha ganhou espaco inferior para nao terminar sob a barra. A folha
  tambem passou a abrir recolhida no celular, onde cobriria 60% da tela logo no
  carregamento;
- **regiao viva grande demais**: o corpo inteiro do painel estava sob
  `aria-live="polite"` e os totais mudam a cada tecla, entao o leitor de tela
  releria macros e todas as barras de desvio a cada digito. A regiao viva ficou
  restrita a frase de alerta, que so muda ao cruzar o limiar;
- **barra de desvio anunciada em duplicidade**: `role="img"` com `aria-label`
  repetia a informacao que a linha de texto acima ja da por completo. A barra
  virou decorativa (`aria-hidden`), sem perda de informacao para quem usa
  leitor de tela.

Tambem entraram dois ajustes menores: alvo de toque de 44 px no `summary` de
`Mais nutrientes` e no botao `Transformar em item manual`, que estavam fora do
padrao ja seguido pelos demais controles; e limpeza automatica do filtro quando
a fonte escolhida deixa de estar ativa, para nao valer um recorte que o seletor
nao consegue mais exibir nem limpar.

Confirmado na revisao, sem alteracao: o debounce da busca com `AbortController`
nao tem race entre requisicoes concorrentes; as chaves de lista sao estaveis e
nenhuma usa indice; o `<details>` controlado nao dessincroniza do DOM; os campos
obrigatorios ficam fora do collapse de proposito; e o rotulo `sr-only` do
seletor de fonte esta corretamente associado. A memoizacao de `totaisPrevistos`
foi avaliada e dispensada: no pior caso do DTO sao poucos milissegundos por
tecla, e otimizar sem medir jank real seria complexidade sem retorno.

Decisao registrada: a previa e calculada no cliente, e nao por uma rota de
calculo no servidor. A fase exige que o cliente nunca seja autoridade sobre
calorias e macros, e ele nao e — o backend recalcula tudo ao salvar e e ele
quem barra a publicacao. Uma rota por tecla digitada nao entregaria a
persistencia que o painel exige, e o risco de divergencia foi tratado onde ele
mora: o teste do modulo esta preso ao fixture do backend, e o painel diz na
propria tela que o valor oficial e recalculado ao salvar.

Fora do escopo deste incremento, por dependerem de tabelas novas: receitas,
biblioteca de refeicoes prontas, favoritos, recentes, alimentos da clinica e do
profissional, e modelos com origem explicita. Todos exigem migration e entraram no
Incremento 5.

Debito quitado em 2026-08-18 (PR #55): o job web do CI passou a rodar
`test:authz` e `test:next15` antes do `build`. Foi a ausencia desses gates que
deixou uma quebra de contrato chegar ao `main` sem sinal.

## Incremento 5 - modelos de plano alimentar

Concluido em 2026-08-17, mergeado e **em producao desde 2026-08-18** (PR #53).
A migration `1031` esta aplicada e verificada nos dois bancos: integracao
`octaclin_test_fase150b` e producao `Octaclin-db-producao`, ambos em 44/44.

O gate foi cumprido na ordem: backup de producao com teste de restore real
(workflow `backup-producao.yml`), integracao primeiro, producao depois.

Duas das tres coisas que o escopo parecia exigir nao precisaram de tabela:

- **grupos de substituicao nao viraram tabela**: `plano_alimentar_substituicoes`
  ja e a lista ordenada ancorada no item, com `unique (tenant_id, item_id,
  ordem)`. O grupo `escolha uma opcao` *e* o item. Uma tabela de grupos teria
  exatamente uma linha por item — indirecao sem informacao;
- **modelos de origem `catalogo` nao viraram tabela**: o precedente da casa sao
  os `MODELOS_QUESTIONARIO` da Fase 71, constantes em codigo. Mas a investigacao
  mostrou um impedimento concreto para faze-los agora: um modelo em codigo nao
  pode guardar `alimentoComposicaoId`, porque esse UUID e gerado por banco e
  difere entre a base de integracao e a de producao. Um modelo de catalogo
  portavel precisa referenciar alimento por `(fonte, versao, base,
  codigo_origem)` — o par unico que `ux_alimentos_composicao_fonte_codigo` ja
  garante — e resolver o UUID ao aplicar. Fica registrado para quando essa
  resolucao existir.

O que entrou:

- migration `1031`, aditiva, criando `modelos_plano_alimentar` com RLS
  habilitada e forcada, politica por `app.tenant_id`, FKs compostas por tenant
  para `profissionais` e `usuarios`, e `unique (tenant_id, id)`;
- constraint `modelos_plano_alimentar_origem_profissional_check`: modelo
  `pessoal` exige profissional, modelo `clinica` proibe. Preso a um profissional,
  o modelo da clinica deixaria de ser compartilhado no dia em que esse
  profissional fosse desligado;
- conteudo gravado como snapshot criptografado em JSON, e nao espelhado em
  tabelas de refeicao e item: um modelo existe para ser copiado para dentro de um
  rascunho, nunca para ser consultado item a item. `total_refeicoes` e
  `total_itens` ficam em claro para a listagem mostrar o tamanho do modelo sem
  descriptografar o conteudo de cada linha;
- `ServicoModelosPlanoAlimentar` em arquivo proprio — o servico de planos ja
  passava de 1.100 linhas;
- visibilidade aplicada **na consulta**, e nao depois de buscar: pos-filtrar
  deixaria o `total` da paginacao contando modelos que o profissional nao pode
  ver, vazando quantos modelos os colegas mantem. Modelo pessoal de outro
  profissional responde 404, e nao 403, para nao confirmar que existe;
- rotas `GET`/`POST /planos-alimentares/modelos` e
  `GET`/`DELETE /planos-alimentares/modelos/:modeloId`, com BFF por allowlist. O
  `profissionalId` vindo do cliente e descartado na fronteira: deixar o cliente
  escolher de quem sao os modelos pessoais listados contornaria o escopo.

Decisao registrada: **aplicar um modelo nao tem rota propria**. O cliente le o
modelo e envia as refeicoes pelo salvamento de rascunho que ja existe, que e
onde a composicao e resolvida contra o catalogo e a fonte inativa e recusada
(`Fonte do alimento nao esta ativa para uso clinico.`). Uma rota de aplicacao
duplicaria essa validacao, e validacao clinica duplicada e validacao que uma
hora diverge. O que faltava era avisar **antes** de aplicar: `obter` devolve
`alimentosIndisponiveis`, para o profissional ver o que saiu do catalogo em vez
de descobrir no salvamento, num erro que nao diz qual item quebrou.

Detalhe que so apareceu ao ligar a interface: `entradaAlimento` omite descricao
e nutrientes quando o item vem do catalogo, entao salvar o modelo por ela
produziria linhas sem rotulo ao aplicar. O modelo guarda o item completo — o
`ValidationPipe` global usa `whitelist` com `forbidNonWhitelisted`, e ambos os
campos sao propriedades declaradas do DTO, entao passam.

Validacao do incremento: 138 suites e 931 testes backend (o unico vermelho segue
sendo o `catalogo-taco.spec.ts` ambiental de CRLF em Windows, ja reproduzido em
`main` limpo), typecheck backend e web, lint web, `test:authz` (7 suites, 16
asserts do BFF de planos), `test:next15` com 93 arquivos, build web,
`git diff --check` e `pnpm security:secrets`.

A execucao em banco foi delegada em 2026-08-18, com passo a passo autocontido em
`HANDOFF_CODEX_MIGRATION_1031.md`: integracao primeiro, producao pelo deploy (o
backend tem `migrationsRun` ligado e aplica no boot), mais as verificacoes de RLS
forcada, policy, constraints e indices. Analise registrada: a tabela nao precisa
de `grant`, porque migrations rodam como `neondb_owner` — a mesma role da
aplicacao — e o isolamento por tenant vem do `force row level security`, que faz
a policy valer inclusive para o dono da tabela.

Fora deste incremento: familias de substituicao liberadas ao paciente e a trilha
de escolha (migration `1032`), e os filtros por alergenico, restricao, custo e
praticidade — estes ultimos sem previsao, porque a TACO nao carrega esses
atributos e a propria fase determina que dado desconhecido nao vira afirmacao
clinica.

## Licao operacional do rollout - 2026-08-18

Duas coisas quebraram no deploy que levou o Incremento 5 a producao, e nenhuma
delas era o codigo do incremento.

**1. Versao do pnpm nao fixada no Dockerfile do backend.** O CI fixa
`PNPM_VERSION: "9"`; o Dockerfile so fazia `corepack enable` e recebia pnpm 10,
que bloqueia lifecycle script de dependencia por padrao desde a v10.0. A
divergencia era antiga e so apareceu quando o bump do jest para 30 trouxe
`unrs-resolver`, a primeira dependencia do backend com build script. Corrigido
no PR #56 com `packageManager: pnpm@9.15.9`, igualando ao que a web ja fazia.

**2. `migrationsRun` no boot nao aplica DDL em producao.** Integracao conecta
como `neondb_owner`; producao conecta como `octaclin_app_producao`, que nao tem
`CREATE` no schema `public`. O boot tentou criar a tabela, recebeu
`42501 permission denied for schema public` e o container saiu com status 1.

Isso vale para **toda migration futura com DDL**, incluindo a `1032` do
Incremento 6. A ordem correta e:

1. merge do PR
2. `migration:run` contra producao com `neondb_owner`
3. deploy

Grants continuam nao precisando de acao: o `neondb_owner` tem default
privileges no schema, entao tabela nova ja nasce com
`select, insert, update, delete` para `octaclin_app_producao`. Verificado em
producao apos a `1031`. E o `force row level security` continua indispensavel,
porque `neondb_owner` tem `rolbypassrls = true` — a role da aplicacao nao tem.

## Incremento 6 - em producao desde 2026-08-18

Desenho validado em 2026-08-17 junto com o do Incremento 5 e implementado como
descrito, com uma correcao de premissa registrada abaixo.

Migration `1032`, aditiva, sem tabela de grupos:

```
alter plano_alimentar_substituicoes
  add liberada_para_paciente boolean not null default false
  add preferida              boolean not null default false

alter plano_alimentar_itens
  add substituicoes_visiveis_inicialmente integer

plano_alimentar_escolhas_paciente          -- append-only, trilha auditavel
  tenant_id, id, versao_id, item_id, substituicao_id (nullable = voltou ao principal)
  escolhido_por_usuario_id, criado_em
  FKs compostas por tenant; RLS habilitada e forcada
  SEM unique: e trilha de eventos, e a escolha vigente e a ultima
```

Razoes que sustentam o desenho:

- **grupos de substituicao nao viram tabela**: `plano_alimentar_substituicoes` ja
  e a lista ordenada ancorada no item, com `unique (tenant_id, item_id, ordem)`.
  O grupo `escolha uma opcao` *e* o item; uma tabela de grupos teria exatamente
  uma linha por item;
- **`liberada_para_paciente` nasce `false`**: planos ja publicados nao passam a
  expor trocas retroativamente;
- **a escolha do paciente grava em tabela separada**, nunca na versao. E assim
  que a imutabilidade da publicacao se mantem enquanto o paciente registra
  trocas;
- **sem `unique` na trilha**: a fase pede evento auditavel, e sobrescrever a
  escolha anterior apagaria o historico que torna o evento auditavel.

Fora do incremento, sem previsao: filtros por alergenico, restricao,
intolerancia, custo e praticidade. A TACO nao carrega esses atributos, e a fase
determina que atributo so vira filtro quando houver fonte, escopo e mecanismo de
revisao — dado desconhecido nao vira afirmacao clinica.

### Correcao de premissa: o portal ja expunha todas as substituicoes

O desenho justificava o default `false` de `liberada_para_paciente` dizendo que
"planos ja publicados nao passam a expor trocas retroativamente". A leitura
estava incompleta: `ServicoPortalPaciente.obterPlanoAlimentarPublicado` ja
devolvia **todas** as substituicoes ao paciente, sem filtro nenhum. Com o
default `false` e o filtro novo, todo plano publicado perderia em silencio as
trocas que o paciente enxerga hoje — dentro de uma versao que e imutavel por
contrato.

A migration por isso faz backfill: `update plano_alimentar_substituicoes set
liberada_para_paciente = true`. O default `false` continua valendo para tudo que
for escrito daqui em diante, entao liberar segue sendo decisao explicita do
profissional; o que nao acontece e a remocao retroativa de conteudo ja visivel.

### O que entrou

- migration `1032`, aditiva, como desenhada, mais o backfill acima e o check
  `plano_alimentar_itens_substituicoes_visiveis_check` (nulo ou 1 a 20);
- dominio: `AlternativaPlanoAlimentar` separa as duas decisoes do profissional
  de `SubstituicaoPlanoAlimentar`, porque o item principal herda essa interface
  e nao e alternativa de nada;
- gravacao, clone de versao e leitura da versao carregam as decisoes. O clone
  preserva a liberacao de proposito: perder a liberacao ao abrir a versao
  seguinte entregaria ao paciente um plano sem as trocas que ele ja usava, sem
  ninguem ter decidido isso;
- portal: filtra pelas liberadas **na consulta**, ordena preferidas primeiro,
  devolve o limite de exibicao e a escolha vigente;
- `POST /portal/paciente/plano-alimentar/itens/:itemId/escolha`, com auditoria
  e confirmacao explicita na interface do paciente;
- editor do profissional: duas caixas por alternativa e o campo de limite de
  exibicao por item.

### O que ficou de fora

Leitura da trilha pelo profissional. O evento e auditado e a escolha vigente
aparece no portal, mas ainda nao existe tela ou endpoint que mostre ao
profissional o historico de trocas do paciente. E o proximo passo natural, e nao
um esquecimento.

### Rollout executado em 2026-08-18

Na ordem definida pela fase, e ela se pagou logo no primeiro passo.

1. backup de producao com teste de restore real (`backup-producao.yml`, run
   `32202727143`), disparado de proposito **depois** da `1031`, para o ponto de
   retorno cobrir o estado atual e nao o de oito horas antes;
2. merge do PR #59 (`6c1205c`);
3. `1032` na integracao — **e aqui apareceu o defeito**, descrito abaixo;
4. correcao no PR #61 (`53112a4`), depois `1032` aplicada e verificada na
   integracao;
5. `1032` em producao com `neondb_owner`, com a identidade conferida antes
   (role, host `c-12`, banco `Octaclin-db-producao`);
6. deploy do backend e do web no Render;
7. monitor de producao (run `32204692558`): readiness, dependencias e web ok.

Os dois bancos ficaram em **45/45**, e a verificacao independente do catalogo do
Postgres passou 10/10 nos dois: RLS habilitada e forcada, politica de tenant, os
dois indices, ausencia de unique sobre `(tenant_id, item_id)` e prova real do
check de exibicao recusando `0` e `21` com `23514`.

### O defeito que o passo da integracao pegou

A `1032` foi mergeada **sem entrar no array `migrations` de
`opcoes-typeorm.ts`**, que e explicito e nao um glob. Arquivo criado, spec da
migration passando, 7 jobs verdes — e `migration:run` nao a aplicaria. Era
codigo morto.

Nada pegou por duas causas somadas: o CI nao executa migrations, por decisao; e
a asercao vizinha usava `expect.arrayContaining`, que por construcao so prova a
presenca das migrations listadas e nunca a ausencia de uma. O PR #61 troca isso
por uma comparacao de conjunto contra os arquivos da pasta, entao esquecer uma
linha volta a quebrar o build.

O sinal foi `migration:show` contra a integracao listando 44 aplicadas e nada
pendente, quando deveria listar a `1032` pendente. Sem o passo da integracao,
o mesmo comando teria rodado contra producao dizendo "No migrations are
pending", e a fase inteira teria sido dada por concluida com a tabela
inexistente.

### O backfill nao protegeu nada, na pratica

A justificativa do backfill continua correta como principio, mas convem
registrar o que os dados mostraram: no momento da aplicacao, producao tinha
**1 plano, 1 versao, 0 versoes publicadas e 0 substituicoes**. Nao havia
paciente enxergando troca nenhuma, entao o `update ... set
liberada_para_paciente = true` foi um no-op nos dois ambientes. A protecao
existe para quando houver dado; nao houve regressao evitada aqui.

## Incremento 7 - leitura profissional da trilha de escolhas

Concluido em 2026-08-20, sem migration. A tabela append-only criada no
Incremento 6 ja continha todas as informacoes necessarias; esta entrega apenas
criou a leitura clinica correta sobre ela.

- `GET /pacientes/:pacienteId/planos-alimentares/:planoId/escolhas-paciente`
  exige `planos_alimentares.ler`, papel `Professional` ou `SuperAdmin` e
  revalida o paciente no escopo antes de consultar eventos;
- o retorno e paginado, em `criadoEm/id` decrescente, para que eventos no
  mesmo instante nao sejam repetidos ou omitidos entre paginas;
- cada evento traz a versao, refeicao, alimento principal, substituicao
  escolhida ou o retorno ao principal. Textos clinicos so sao descriptografados
  depois da autorizacao no servico;
- o BFF aceita somente `pagina` e `limite`; a interface do prontuario mostra o
  historico em contexto, com carregamento, vazio e erro isolados do editor.

Validacao: suites focadas do backend e controlador (44 testes), contrato BFF
(17 testes), typecheck backend/web, build Next.js 16 e Playwright desktop/mobile
da leitura do prontuario aprovados. Nenhuma
escrita e feita por esta rota, nenhuma versao publicada e alterada e o portal
continua sem acesso a esta leitura profissional.

## Incremento 8 - biblioteca de receitas e refeicoes prontas

Concluido em 2026-08-20. Este incremento fecha o primeiro dos modos de
insercao previstos no editor sem mudar a estrutura de uma versao de plano ja
publicada. A migration aditiva `1033` foi aplicada e verificada em integracao e
producao com `neondb_owner`; RLS forcada, policy de tenant, indices e
constraints esperados foram conferidos antes do deploy.

- uma unica biblioteca cobre `receita` e `refeicao_pronta`; o tipo diferencia a
  intencao de uso, mas ambos sao compostos por itens alimentares;
- cada registro pertence a clinica ou ao profissional, seguindo exatamente a
  visibilidade de modelos: a clinica e compartilhada no tenant, a pessoal so
  aparece ao seu dono e o `SuperAdmin` pode administrar ambas;
- nome, instrucoes e itens sao snapshots criptografados. Os itens preservam a
  entrada aceita pelo rascunho, inclusive composicao manual e alternativas,
  para que a biblioteca nao dependa de IDs de catalogo portaveis entre bancos;
- aplicar uma receita nao salva nem publica o plano: copia seus itens para a
  refeicao escolhida no rascunho. O salvamento existente continua sendo a
  autoridade que resolve fontes ativas, recalcula nutrientes e barra uma
  publicacao invalida;
- a migration e somente aditiva, com RLS forcada, FKs compostas por tenant,
  indices de listagem e auditoria de criar, editar e arquivar. Nenhum dado de
  paciente, plano ou catalogo existente sera reescrito.

Ficam fora deste incremento receitas publicas de catalogo, sugestoes clinicas
automaticas, calculo de custo e qualquer alegacao sobre alergeno ou restricao:
nao ha fonte licenciada e validada para esses atributos.

## Escopo funcional

### 1. Estrutura e ciclo de vida do plano

- Preservar os estados `rascunho`, `em revisao`, `publicado` e `arquivado`.
- Tornar visiveis no editor a versao atual, autoria, data de publicacao e a
  diferenca entre rascunho e versao publicada.
- Permitir duplicar plano, refeicao e dia de plano a partir de modelos pessoais
  ou compartilhados pela clinica, sempre criando um novo rascunho.
- Permitir refeicoes com horario, nome, orientacoes, habitos e ordenacao
  acessivel por teclado e controles alternativos ao arrastar.
- Exigir confirmacao e justificativa quando a publicacao altera metas ou totais
  de modo relevante em relacao a versao anterior.

### 2. Editor de refeicao

- Tres modos de insercao: busca por alimento/receita, busca por equivalentes e
  biblioteca de refeicoes prontas.
- Linhas focadas em alimento, porcao e medida caseira; detalhes de nutrientes
  ficam progressivos para reduzir a densidade visual.
- Painel persistente no desktop com energia, macros, peso total, metas,
  desvios e alertas. No celular, esse painel vira uma folha inferior acessivel.
- Busca com favoritos, itens recentes, alimentos da clinica, alimentos do
  profissional, receitas e dados de fabricante quando licenciados.
- Modelos com origem explicita: pessoal, clinica ou catalogo. Nenhum modelo
  compartilhado altera a publicacao existente de outro plano.

### 3. Familias de substituicao

- Substituicoes deixam de ser linhas soltas e passam a formar grupos do tipo
  `escolha uma opcao`, ancorados no alimento principal.
- Cada alternativa mostra porcao equivalente, medida caseira, origem,
  categoria, energia e diferencas de macronutrientes em relacao ao item
  principal.
- Separar alternativas preferidas/aprovadas pelo profissional das demais
  opcoes de catalogo; permitir ordenar e limitar as exibidas inicialmente.
- Filtros por restricao, alergeno, intolerancia, preferencia alimentar,
  praticidade e custo, quando o atributo for conhecido e tiver fonte.
- Usar a acao explicita `Definir como alimento principal`, com confirmacao,
  no lugar de uma acao ambigua de inversao.
- Profissional define quais alternativas podem ser escolhidas pelo paciente.
  A escolha do paciente gera evento auditavel e nunca altera uma versao
  publicada.

### 4. Portal do paciente

- Mostrar somente plano publicado, instrucoes, porcoes caseiras, preparo e
  trocas liberadas; nunca expor formula, score, anotacao interna ou catalogo
  irrestrito.
- Permitir registrar refeicao realizada, substituida ou nao realizada, com
  feedback curto de dificuldade, saciedade ou observacao.
- Gerar lista de compras a partir da versao publicada, respeitando o periodo e
  as escolhas de substituicao confirmadas pelo paciente.
- Manter linguagem simples, responsividade mobile e confirmacao clara antes de
  registrar uma troca.

## Catalogo multifonte e governanca de dados

### Principio obrigatorio

Nenhuma tabela sera copiada da interface de outro produto, extraida por scrape
em tempo de execucao ou usada sem direito de incorporacao comercial. Todo
importador le um artefato oficial ou fornecido sob licenca, salvo localmente de
forma efemera, normaliza de maneira deterministica e registra a proveniencia.

### Fontes previstas

| Fonte | Estado na Fase 234 | Regra de produto |
| --- | --- | --- |
| TACO, 4a edicao | Ja importada na Fase 216 | Manter como fonte versionada; nao sobrescrever alimento ou snapshot existente. |
| TBCA | Candidata a importacao | Registrar base e versao separadamente. A versao atual identificada no portal oficial e `7.3` (2025). |
| TBCA 7.3 | Versao da TBCA, nao uma segunda tabela | Representar como `fonte=TBCA`, `versao=7.3` e `base=BD-AIN` ou `BD-B`, evitando duplicacao. |
| IBGE/POF | Candidata a importacao | Usar somente artefato oficial da edicao identificada, com ano, URL e metodologia preservados. |
| Tucunduva | Pendente de direito de uso | So importar apos contrato ou licenca escrita, artefato estruturado e escopo de redistribuicao confirmados. |

Antes de qualquer carga de TBCA, o responsavel deve obter autorizacao comercial
expressa por escrito ou a fonte deve ficar desabilitada. O site oficial informa
condicoes de uso nao comercial e restricoes de reproducao. IBGE/POF e
Tucunduva tambem exigem uma revisao de direito de uso, atribuicao e
redistribuicao antes de qualquer publicacao de dados no SaaS.

### Modelo de dados e importacao

- Estender `fontes_composicao_alimentos` com entidade de versao, base,
  licenca/direito de uso, URL de origem, data de captura, checksum, esquema de
  nutrientes, responsavel de aprovacao e situacao (`em_validacao`, `ativa`,
  `suspensa`, `revogada`).
- Preservar cada registro de alimento por fonte e versao. Uma normalizacao ou
  relacao de equivalencia nao pode apagar valores divergentes entre fontes.
- Criar mapeamento canonico opcional e revisavel; correspondencia automatica
  nunca substitui uma decisao clinica ou altera item ja publicado.
- Importadores idempotentes, offline e auditaveis; rejeitar arquivo sem
  checksum, licenca aprovada, esquema conhecido ou validacao de unidades.
- Armazenar valores por 100 g de porcao comestivel, ausencias como `null`,
  unidade, metodo/preparo quando fornecido e observacoes da fonte.
- Toda busca e todo snapshot exibem fonte, versao e data; o calculo de uma
  versao publicada continua usando somente o snapshot criptografado dela.

## Seguranca, permissoes e limites clinicos

- Catalogos globais permanecem sem escrita HTTP para perfis clinicos; somente
  processo administrativo explicitamente autorizado pode ativar uma fonte.
- Itens, planos, escolhas de troca e eventos do paciente mantem RLS forcada,
  FKs compostas por tenant, auditoria e autorizacao por papel.
- Calculos, equivalencias e validacoes rodam no backend. O cliente nunca e
  autoridade para calorias, macros, porcoes ou permissao de substituicao.
- Atributos de alergia, restricao, custo ou praticidade so aparecem como filtro
  quando houver fonte, escopo e mecanismo de revisao. Dado desconhecido nao
  vira afirmacao clinica.
- Permanecem fora desta fase pediatria, gestacao, lactacao, terapia
  nutricional, prescricao automatica e IA clinica sem revisao humana.

## UX e acessibilidade

- Desktop: contexto do paciente, editor de refeicao e resumo nutricional em
  areas estaveis, sem aninhar cartoes desnecessariamente.
- Mobile: composicao por etapas, resumo em folha inferior e alvos de toque de
  pelo menos 44 px.
- Estados de carregamento, vazio, erro, sem permissao e sucesso para busca,
  importacao, rascunho, revisao, publicacao e escolha de substituicao.
- Navegacao completa por teclado, foco visivel, texto de acoes explicito e
  nenhuma comunicacao de estado dependente apenas de cor.

## Entregas tecnicas

1. Documento de decisao de fontes, licencas, versoes e hierarquia de busca.
2. Migration aditiva para versoes/fontes e, se necessaria, grupos de
   substituicao, modelos e eventos de adesao; RLS e indices revisados.
3. Importadores deterministas e testes de contrato por fonte aprovada.
4. APIs/BFFs autorizados para busca, rascunho, modelos, grupos de troca,
   publicacao e projecao segura do portal.
5. Editor profissional e portal redesenhados segundo a especificacao Penpot,
   com desktop e mobile.
6. Testes de dominio, tenant/RLS, autorizacao, calculo, importacao,
   acessibilidade, Playwright e jornadas mutaveis em staging com dados
   sinteticos.

## Criterios de aceite

- Nenhuma fonte entra ativa sem artefato identificavel, checksum, versao,
  direito de uso aprovado e teste de importacao.
- TACO continua pesquisavel e todos os planos publicados existentes permanecem
  imutaveis e legiveis apos a migracao.
- TBCA 7.3 aparece uma unica vez como versao da TBCA, sem duplicar alimentos
  como se fosse uma fonte diferente.
- Cada alimento selecionado mostra sua fonte e versao; divergencias entre
  fontes nao sao silenciosamente mescladas.
- Uma substituicao mostra equivalencia e diferencas nutricionais antes da
  confirmacao; o paciente so acessa alternativas liberadas.
- Um profissional cria rascunho, monta refeicoes, usa modelo, publica e o
  paciente visualiza a projecao permitida sem obter dados internos.
- Staging cobre isolamento entre tenants, importacao idempotente, revisao,
  publicacao, portal, escolhas e rollback documental sem mutar producao.

## Validacao prevista

```powershell
pnpm --dir octaclin-backend test
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web test:a11y
pnpm --dir octaclin-web build
git diff --check
pnpm security:secrets
```

O rollout exige backup aprovado, banco explicitamente identificado, migration
aplicada primeiro na integracao e carga de catalogo somente depois do aceite de
licenca. Nunca rodar importador, seed ou migration contra producao sem essa
confirmacao.

## Referencias de produto

- Fluxos observados no WebDiet foram usados apenas como referencia de UX:
  busca por alimentos, grupos de equivalencia, refeicoes prontas, porcoes em
  medidas caseiras e substituicoes recalculadas. Nenhum dado ou interface deve
  ser copiado.
- TBCA: https://www.tbca.net.br/
- IBGE/POF: https://www.ibge.gov.br/estatisticas/todos-os-produtos-estatisticas/9050-pesquisa-de-orcamentos-familiares.html
