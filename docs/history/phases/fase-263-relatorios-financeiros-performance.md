# Fase 263 - Relatorios financeiros e de performance por cliente

Status: concluida. Incrementos 1, 2, 3 e 4 implementados e integrados em
2026-09-16 pelos PRs GitHub `#249`, `#250`, `#251` e `#252`.

## Objetivo

Transformar os dados financeiros e de agenda ja autorizados em indicadores
gerenciais claros para cliente e profissional, sem duplicar faturamento de
pacotes, sem expor dados entre tenants e sem criar uma segunda fonte de verdade.

## Decisoes do primeiro incremento

- Reutilizar `GET /agenda/financeiro/recebimentos`, a permissao
  `agenda.financeiro.ler`, a RLS e o escopo por profissional existentes.
- Nao criar migration: todos os indicadores sao derivados das consultas do
  periodo depois da aplicacao dos mesmos filtros de tenant, profissional e
  paciente usados no fechamento financeiro.
- Calcular comparecimento somente sobre consultas encerradas (`concluida` ou
  `falta`), para que agendamentos futuros nao reduzam artificialmente a taxa.
- Calcular cancelamento sobre todas as consultas do periodo.
- Calcular ticket medio apenas com consultas pagas e nao canceladas. Pacotes
  permanecem na linha financeira propria e nao entram no ticket da consulta.
- Arredondar taxas para uma casa decimal e dinheiro para centavos inteiros.

## Entrega

O resumo financeiro passou a devolver `performance` com:

- total de consultas no periodo;
- concluidas, faltas e canceladas;
- taxas de comparecimento, falta e cancelamento;
- ticket medio recebido em consultas.

A tela de recebimentos apresenta os indicadores em um cartao separado, com
rotulo ajustado para gestor, profissional ou paciente filtrado e uma explicacao
curta das bases de calculo. O fluxo existente por profissional foi preservado.

## Incremento 2 - comparacao com o periodo anterior

O mesmo endpoint passou a consultar a janela imediatamente anterior com a
mesma duracao e sem sobrepor o limite inicial do periodo atual. A resposta
inclui os totais financeiros e os indicadores de performance anteriores depois
dos mesmos filtros de tenant, profissional e paciente.

A interface compara receita recebida (consultas mais pacotes), consultas
concluidas, taxa de comparecimento e ticket medio. Dinheiro e contagens usam
diferenca absoluta; taxas usam pontos percentuais. Essa decisao evita variacao
percentual indefinida quando a base anterior e zero. O fim do dia selecionado
tambem foi corrigido para `23:59:59.999`, o ultimo milissegundo do dia.

O cartao e tolerante a uma janela curta de rollout na qual a web nova ainda
receba a resposta do backend anterior: sem `comparacaoPeriodoAnterior`, a tela
mantem o resumo atual e apenas omite a comparacao.

## Evidencia TDD e validacoes

- RED: o teste de dominio falhou porque
  `calcularIndicadoresPerformance` ainda nao existia.
- GREEN: testes de dominio cobrem taxas, denominador zero, exclusao de
  canceladas e ticket medio sem pacotes.
- GREEN: o teste do servico confirma que o contrato HTTP recebe os indicadores
  depois do mesmo filtro seguro do resumo financeiro.
- A regressao visual da agenda usa o novo contrato e verifica o cartao de
  desempenho.
- RED do Incremento 2: o teste do servico falhou porque o contrato ainda nao
  expunha `comparacaoPeriodoAnterior`.
- GREEN do Incremento 2: o servico confirmou a janela anterior sem sobreposicao,
  e a regressao visual confirmou valores atuais, anteriores e diferenca em
  pontos percentuais.

## Incremento 3 - performance por profissional

`quebrarPorProfissional` ja existia (recebido/pendente/isentas por
profissional); passou a incluir tambem `performance`, calculado com a mesma
`calcularIndicadoresPerformance` do consolidado, aplicada as consultas de cada
profissional isoladamente. Nao ha migration nem novo endpoint: o campo entra
no mesmo contrato de `porProfissional` ja usado pela tela de recebimentos.

O gestor agora ve, por profissional, taxa de comparecimento e ticket medio
recebido na mesma tabela onde ja via atendimentos/recebido/a receber. O
consolidado (`resumo.performance`) continua vindo do calculo sobre todas as
consultas do periodo — nao e a soma das linhas por profissional.

Nenhuma migration; RLS, permissao `agenda.financeiro.ler` e escopo por
profissional/paciente reaproveitados sem alteracao.

### Evidencia TDD e validacoes

- RED: teste novo esperando `performance` em cada linha de
  `resumo.porProfissional` falhou (campo ainda nao existia no calculo).
- GREEN: teste com dois profissionais e desfechos diferentes (faltas,
  cancelamento, ticket medio) confirma que a formula e aplicada por
  profissional, isolada do consolidado.
- `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-web typecheck`,
  suite do servico e do dominio financeiro (25/25), `git diff --check` e
  `pnpm security:secrets`.
- Playwright: nenhum cenario existente navega ate a aba financeira do cliente
  (`RecebimentosCliente`, contexto `gestor`) nem afirma o conteudo da tabela
  "Por profissional" — o unico mock desse endpoint (`console-regression.spec.mjs`)
  cobre a agenda em contexto `profissional`, onde essa tabela nunca renderiza.
  O mock foi atualizado para incluir `performance` por consistencia de tipo,
  mas a cobertura visual dedicada a essa tabela continua pendente.

## Incremento 4 - exportacao auditada dos indicadores

Novo endpoint `GET /agenda/financeiro/recebimentos/exportar.csv`, no mesmo
padrao ja usado por `agenda/consultas/exportar.csv` (Fase 211): mesmos papeis
e mesma permissao `agenda.financeiro.ler` da rota JSON, `montarCsv`/`campoCsv`
compartilhados (protegem contra injecao de formula de planilha) e auditoria
em toda leitura, nao so em escrita.

`exportarRecebimentosCsv` reaproveita `resumoRecebimentos` por inteiro —
mesmo filtro de periodo, mesmo escopo por profissional/paciente, mesma RLS —
e so muda a saida para CSV: uma linha por profissional (mesmas colunas da
tabela "Por profissional" mais os quatro indicadores de performance que a
tela nao tem espaco para mostrar: concluidas, faltas, canceladas e as tres
taxas) e uma linha final "Consolidado" com os totais do periodo. Nenhuma
migration, nenhum novo dado calculado: e a mesma formula do Incremento 1,
so em outro formato de saida.

A auditoria (`agenda.financeiro.exportar_csv`) segue a mesma regra do resto
do produto para exportacao: registra o volume exportado
(`contarLinhasCsv`), nunca o conteudo das linhas — copiar os valores para
`user_action_logs.metadados` faria a trilha de auditoria conter uma segunda
copia do proprio dado que ela deveria vigiar.

A tela de recebimentos ganhou um link "Exportar CSV" no cabecalho do card
principal, ao lado do indicador de carregamento, apontando para o periodo e
paciente atualmente exibidos (nao para o que esta digitado e ainda nao
aplicado no formulario).

### Evidencia TDD e validacoes

- GREEN: teste novo do servico compara o CSV inteiro (cabecalho + linha por
  profissional + linha consolidada) byte a byte contra a mesma fixture do
  primeiro teste de `resumoRecebimentos`, provando que a exportacao e so uma
  reprojecao do mesmo calculo.
- GREEN: teste novo confirma que a exportacao aplica o mesmo escopo de
  usuario `Professional` que a rota JSON (ignora `profissionalId` pedido e
  usa o vinculo do usuario).
- `pnpm --dir octaclin-backend typecheck`, `pnpm --dir octaclin-web typecheck`,
  suite do servico e do dominio financeiro (18/18 no arquivo do servico),
  `pnpm audit:redacao-auditoria` (confirma `linhas` classificado como
  metadado seguro, mesma classificacao da exportacao de agenda existente),
  `pnpm test:guardas-controladores`, `pnpm test:actions-imutaveis`,
  `pnpm test:confiabilidade`, `git diff --check` e `pnpm security:secrets`.
- Playwright: nao adicionado. Nenhum cenario existente navega ate a aba
  financeira do cliente (mesma lacuna ja registrada no Incremento 3);
  cobertura visual dedicada a essa tela continua pendente.

## Encerramento

Nenhum candidato pendente no momento. Os dois candidatos documentados apos o
Incremento 2 (exportacao auditada e quebra por profissional) foram entregues
nos Incrementos 3 e 4.
