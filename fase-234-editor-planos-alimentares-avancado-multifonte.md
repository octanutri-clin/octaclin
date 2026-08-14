# Fase 234 - Editor de planos alimentares avancado e catalogo multifonte

Status: em execucao. Incremento 1 concluido em 2026-08-14. Fase importante de evolucao clinica e de produto, posterior
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

O Incremento 2 comeca pelos contratos e permissoes: separar listagem resumida
de detalhe sob demanda e propagar `podeGerenciar` ao workspace profissional.
Quem possui apenas `planos_alimentares.ler` deve receber uma interface realmente
somente leitura, sem acoes de criar, editar, revisar, publicar ou arquivar.

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
