# Fase 216 - Plano alimentar e calculo nutricional (MVP)

Status: implementacao concluida em 2026-08-08. Rollout de banco registrado
separadamente ao final deste documento.

## Objetivo

Permitir que o profissional monte, revise, publique e versione um plano
alimentar, com calculo energetico rastreavel e composicao de alimentos
versionada, sem transformar uma estimativa populacional em decisao clinica
automatica.

## Escopo entregue

- nova aba `Plano alimentar` no prontuario; a aba anterior passou a se chamar
  `Acompanhamento`;
- criacao, rascunho, revisao explicita, publicacao, nova versao, historico
  imutavel e arquivamento;
- refeicoes, horarios, orientacoes, alimentos, porcoes e substituicoes;
- busca no catalogo TACO e entrada manual quando necessario;
- Mifflin-St Jeor (1990), Harris-Benedict revisada por Roza-Shizgal (1984) e
  FAO/OMS/UNU (1985), sempre executadas no backend;
- fator de atividade entre 1,40 e 2,40, ajuste energetico e distribuicao de
  macronutrientes em basis points, cuja soma precisa ser exatamente 10.000;
- portal do paciente mostra somente a versao publicada atual e permite
  imprimir ou salvar PDF pelo navegador;
- novas permissoes `planos_alimentares.ler` e
  `planos_alimentares.gerenciar`, exclusivas de Professional e SuperAdmin.

Collaborator, Client e Patient nao recebem acesso ao editor. Patient acessa
somente a projecao segura da propria publicacao pelo portal.

## Guardrails clinicos

- o profissional precisa selecionar uma avaliacao antropometrica do mesmo
  paciente e confirmar explicitamente a aplicabilidade da formula;
- Mifflin-St Jeor e recusada fora da faixa estudada de 19 a 78 anos;
- o fluxo automatico aceita apenas adultos, valida peso, altura, IMC plausivel,
  atividade e meta energetica;
- `possuiCondicaoEspecial=true` bloqueia calculo, revisao e publicacao neste
  MVP. A interface explica que a conduta deve ser individualizada fora do
  fluxo automatico;
- alteracao do rascunho invalida revisao e hash anteriores;
- publicacao exige revisao humana, objetivo, calculo, totais, ao menos uma
  refeicao e ao menos um item em cada refeicao;
- fibra e sodio ausentes permanecem ausentes. O sistema nao converte dado
  desconhecido em zero;
- o portal nao recebe formula, fator de atividade, metabolismo, antropometria,
  autoria, hash, codigos/fontes de composicao ou alertas internos.

## Formulas e fontes

- Mifflin-St Jeor: equacoes e populacao do artigo original, DOI
  `10.1093/ajcn/51.2.241`.
- Harris-Benedict revisada: Roza e Shizgal, PMID `6741850`.
- FAO/OMS/UNU: equacoes por sexo e faixa etaria da Technical Report Series 724
  (1985). A propria FAO registra limites de aplicabilidade universal; por isso
  a selecao e a confirmacao permanecem decisao do profissional.
- TACO: 4a edicao revisada e ampliada, NEPA/UNICAMP, 2011. O artefato guarda
  URL, atribuicao, SHA-256 da planilha e SHA-256 do conjunto normalizado.

O importador reproduz a planilha oficial de forma deterministica: `NA` e
celula ausente viram `null`, `Tr` vira zero conforme a legenda, e linhas com
marcador `*` em nutriente essencial ficam excluidas e registradas nos
metadados. Resultado atual: 583 alimentos validos, 14 excluidos e 15
categorias.

## Persistencia e isolamento

Migration `1720000001021-CriarPlanosAlimentares`:

- `planos_alimentares`;
- `plano_alimentar_versoes`;
- `plano_alimentar_refeicoes`;
- `plano_alimentar_itens`;
- `plano_alimentar_substituicoes`;
- `fontes_composicao_alimentos`;
- `alimentos_composicao`.

As cinco tabelas clinicas possuem RLS habilitada e forcada. Chaves estrangeiras
compostas impedem vinculo cruzado entre tenants. A publicacao cria snapshot
criptografado de calculo e composicao, hash SHA-256 estavel e auditoria na mesma
transacao. Triggers bloqueiam mutacao de versao publicada e de seus filhos.

O catalogo e global, sem dado de paciente e sem RLS. A aplicacao so expoe busca
autenticada e nao oferece escrita HTTP no catalogo.

## Interface

O editor profissional usa busca TACO com debounce, permite alimento manual,
substituicoes e ordenacao por controles acessiveis. Ha feedback de alteracao nao
salva, protecao ao sair, estados vazio/erro/sucesso e acoes separadas de salvar,
revisar e publicar.

A revisao independente adicionou chaves estaveis na reordenacao, alvos moveis
de 44 px, confirmacao antes de descartar alteracoes e justificativa obrigatoria
quando metas e totais das refeicoes divergirem de forma relevante. A
reatribuicao do paciente e as mutacoes do plano usam a mesma trava no paciente;
o responsavel atual acessa o historico, enquanto a autoria original permanece
registrada no plano.

No portal, a apresentacao e orientada ao paciente: objetivo, orientacoes, metas
publicadas, refeicoes e substituicoes. Nao ha score, formula ou detalhe tecnico.
O PDF usa a impressao nativa para nao criar uma segunda representacao clinica.

## Validacao

- backend: 107 suites e 770 testes aprovados;
- testes focados de dominio, catalogo, migration, servico, controller,
  permissoes e portal aprovados;
- backend typecheck e build aprovados;
- web typecheck e lint sem avisos;
- BFF do plano alimentar: 5/5 testes aprovados;
- `test:authz` aprovado;
- Next 15: 76 arquivos validados;
- build web: 116 paginas geradas;
- `git diff --check` aprovado.

## Rollout

1. Aplicar a migration `1021` primeiro no banco de integracao com role owner.
2. Confirmar que somente ela estava pendente.
3. Verificar RLS forcada, policies, triggers, indices e sete tabelas.
4. Carregar o TACO com confirmacao do nome exato do banco.
5. Fazer smoke com dados sinteticos: criar, salvar, revisar, publicar e ler no
   portal.
6. Repetir em producao somente apos backup e confirmacao explicita do banco.

O backend de producao deve continuar com `BANCO_EXECUTAR_MIGRACOES=false` e
role runtime sem `BYPASSRLS`.

## Fora do MVP

- pediatria, gestacao, lactacao, terapia nutricional e outras condicoes
  especiais;
- prescricao automatica ou recomendacao clinica por IA;
- equivalencia automatica de substituicoes;
- micronutrientes completos, metas por kg e periodizacao;
- assinatura digital, PDF server-side e modelos reutilizaveis de plano.
