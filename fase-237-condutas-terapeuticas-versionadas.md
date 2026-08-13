# Fase 237 - Condutas terapeuticas versionadas

Status: Incremento 1 entregue localmente em 2026-08-13. A migration `1026`
ainda precisa ser aplicada e aprovada no banco de teste antes de qualquer
deploy de producao.

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

## Pendente de schema e aceite

1. Aplicar `CriarCondutasTerapeuticas1720000001026` somente no banco de
   integracao usando uma URL explicitamente confirmada como nao producao.
2. Verificar RLS forcada, duas policies, os tres indices e a unicidade parcial
   de versao publicada.
3. Repetir em producao somente com role `neondb_owner`, janela aprovada e
   backup/restore recente.
4. Em producao, testar somente paciente e conteudo sinteticos: criar rascunho,
   publicar, criar nova versao, arquivar e confirmar que o portal nao exibe
   condutas.

## Fora do escopo

- Catalogo de suplementos ou produtos, estoque, precificacao, interoperacao
  com farmacia, assinatura digital, receita regulamentada ou envio automatico.
- Motor clinico, IA de recomendacao, calculo de dose e alertas terapeuticos.
- Acesso do paciente antes de politica, revisao clinica e design do portal
  especificos para cada tipo de conduta.
