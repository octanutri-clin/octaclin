# Decisao de fontes do catalogo - Fase 234

Atualizado em 2026-08-14.

## Decisao

O OctaClin separa a familia institucional do catalogo de cada versao e base.
Uma fonte ativa e imutavel: nova publicacao, correcao de artefato ou mudanca de
esquema cria outra versao/base. Valores divergentes entre fontes nunca sao
mesclados silenciosamente.

## Estado das fontes

| Familia | Versao/base | Estado | Condicao para avancar |
| --- | --- | --- | --- |
| TACO | `taco-4a-cmvcol-taco3-v1` / `cmvcol_taco3` | Ativa no banco de integracao | Manter atribuicao, hashes e artefato conhecidos. |
| TBCA | 7.3 / `BD-AIN` e `BD-B` | Desabilitada | Artefato oficial, direito comercial escrito e importador testado. |
| IBGE/POF | A definir por edicao/base | Desabilitada | Edicao oficial, metodologia, licenca e redistribuicao aprovadas. |
| Tucunduva | A definir | Bloqueada | Contrato/licenca escrita e entrega estruturada. |

TBCA 7.3 nao e uma segunda familia. `BD-AIN` e `BD-B` sao bases da mesma
versao e podem coexistir pela chave `catalogo_id + versao + base_codigo`.

## Invariantes tecnicos

- Ativacao exige artefato, checksum SHA-256, hash de conteudo, esquema,
  captura, licenca/direito aprovado, responsavel, ator, motivo e importacao
  concluida com total e hashes correspondentes.
- Importacao ocorre em transacao e somente enquanto a fonte esta
  `em_validacao`.
- Fonte ativa/suspensa/revogada e seus alimentos nao podem ser alterados ou
  excluidos.
- A aplicacao runtime apenas le o catalogo global; carga e governanca exigem
  processo administrativo separado.
- Reexecucao com identidade e conteudo iguais e `no-op`; qualquer divergencia
  falha fechada.
- Plano publicado calcula e exibe o snapshot criptografado historico, nunca os
  valores atuais do catalogo.

## Evidencia do Incremento 1

No banco isolado `octaclin_test_fase150b`:

- migrations `1028`, `1029` e `1030`: 43/43;
- TACO: 583 alimentos, situacao `ativa`, direito `aprovado`;
- checksum do artefato:
  `a66b8ec528daeabc63bc2b015fc9bd8c6d76b941c2fc0ed93a4311d449302d14`;
- hash normalizado:
  `82c22bc4c72720f9786478b5ba0c6947316b23c4cddfd365781ee2ffb7f481e7`;
- os 583 alimentos possuem `importacao_id` da carga concluida e hash individual;
- mutacao de fonte ativa, mutacao/transferencia de alimento ativo, ativacao sem
  importacao e transicao sem ator/motivo foram recusadas pelas triggers;
- role `octaclin_runtime_integracao`: leitura permitida e escrita negada;
- segunda execucao do carregador confirmou os 583 registros, nao alterou o
  catalogo e registrou a tentativa como `ignorada`.

## Rollout

Rollout inicial concluido em 2026-08-14 no banco
`Octaclin-db-producao`: backup custom validado, identidade owner confirmada,
43/43 migrations, 583 registros com proveniencia, triggers e privilegios
runtime aprovados. A reexecucao do carregador nao alterou o catalogo e foi
auditada como `ignorada`.

As migrations sao forward-only em producao. Antes do rollout produtivo:

1. backup e restore canario aprovados;
2. URL owner confirmada explicitamente como producao;
3. `migration:show` com apenas `1028`, `1029` e `1030` pendentes;
4. aplicar migrations sem rodar seed ou carregador em paralelo;
5. repetir contagem, hashes, triggers, privilegios e busca TACO;
6. liberar o codigo somente depois das verificacoes.

Nenhuma fonte externa deve ser cadastrada como ativa para simular progresso de
produto. Ausencia de direito de uso mantem a fonte desabilitada.
