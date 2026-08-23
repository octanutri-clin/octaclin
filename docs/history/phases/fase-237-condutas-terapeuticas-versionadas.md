# Fase 237 - Condutas terapeuticas versionadas

Status: Incremento 1 entregue e aceito em producao em 2026-08-13.

## Objetivo

Dar ao profissional uma area propria para documentar metas, orientacoes,
suplementos, produtos e formulas manipuladas sem confundir esses registros com
tarefas de acompanhamento ou criar uma ferramenta de recomendacao automatica.

## Entrega do Incremento 1

- Tabelas `condutas_terapeuticas` e `condutas_terapeuticas_versoes` com RLS
  habilitada e forcada, policy por tenant, dados textuais cifrados e indices
  de leitura por paciente.
- Uma conduta possui versoes numeradas. O profissional cria rascunho, edita o
  rascunho, publica explicitamente, cria uma nova versao a partir da publicada
  ou arquiva a conduta sem apagar o historico.
- Ha no maximo uma versao publicada por conduta. A publicacao substitui a
  anterior apenas como estado atual e preserva a versao anterior como
  descartada no historico.
- A subarea **Condutas terapeuticas** fica em **Prontuario > Plano** para
  SuperAdmin e Professional com permissao `pacientes.gerenciar`. Ela nao e
  exposta ao portal do paciente neste incremento.
- Auditoria registra somente IDs, tipo e acao. Titulo, conteudo e instrucoes
  nao entram em metadados de auditoria.

## Limites clinicos e regulatorios

- O OctaClin nao calcula dose, nao recomenda produto, nao valida formula e nao
  emite prescricao automatica. O campo registra apenas conteudo decidido pelo
  profissional autorizado.
- A aplicacao nao confirma habilitacao profissional, CRN, regra local ou
  compatibilidade de produto. Essa verificacao continua sob responsabilidade
  do profissional e devera ganhar modelagem especifica antes de qualquer
  assinatura digital, prescricao oficial ou integracao com farmacia.
- Publicar nesta fase significa disponibilizar no console profissional como
  versao atual, nao enviar ao paciente, e-mail, WhatsApp, farmacia ou terceiro.

## Validacoes locais

```powershell
pnpm --dir octaclin-backend test -- --runInBand src/infraestrutura/banco-dados/migracoes/1720000001026-CriarCondutasTerapeuticas.spec.ts src/modulos/pacientes/aplicacao/servico-condutas-terapeuticas.spec.ts
pnpm --dir octaclin-web test:condutas-terapeuticas:bff
pnpm --dir octaclin-backend build
pnpm --dir octaclin-web build
git diff --check
```

## Aceites de schema e operacao

1. Aceite de integracao concluido em `octaclin_test_fase150b` com
   `neondb_owner`: migrations `1025` e `1026` aplicadas em ordem, historico
   `39/39`, RLS habilitada e forcada nas tabelas novas, policies de tenant e
   indices de serie/versao publicada verificados sem inserir dados clinicos.
2. Aceite de schema em producao concluido em `Octaclin-db-producao` com
   `neondb_owner`: somente a `1026` estava pendente; apos a aplicacao, o
   historico ficou em `39/39`, RLS forcada, duas policies e os indices de
   paciente, versao e publicacao foram verificados sem inserir dados clinicos.
3. Aceite operacional concluido em producao com o `Paciente teste 1` e conteudo
   explicitamente sintetico: rascunho, publicacao, criacao da versao 2 e
   arquivamento foram confirmados. O historico preservou as duas versoes e a
   interface confirmou o estado `Arquivada`.
4. A revisao da superficie publicada confirmou que condutas existem somente no
   prontuario profissional (`Prontuario > Plano`): nao ha rota ou componente
   correspondente no portal do paciente neste incremento.

## Fora do escopo

- Catalogo de suplementos ou produtos, estoque, precificacao, interoperacao
  com farmacia, assinatura digital, receita regulamentada ou envio automatico.
- Motor clinico, IA de recomendacao, calculo de dose e alertas terapeuticos.
- Acesso do paciente antes de politica, revisao clinica e design do portal
  especificos para cada tipo de conduta.
