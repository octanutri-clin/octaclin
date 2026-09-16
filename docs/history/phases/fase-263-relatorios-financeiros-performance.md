# Fase 263 - Relatorios financeiros e de performance por cliente

Status: em andamento. Incremento 1 implementado em 2026-09-16.

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

## Evidencia TDD e validacoes

- RED: o teste de dominio falhou porque
  `calcularIndicadoresPerformance` ainda nao existia.
- GREEN: testes de dominio cobrem taxas, denominador zero, exclusao de
  canceladas e ticket medio sem pacotes.
- GREEN: o teste do servico confirma que o contrato HTTP recebe os indicadores
  depois do mesmo filtro seguro do resumo financeiro.
- A regressao visual da agenda usa o novo contrato e verifica o cartao de
  desempenho.

## Proximos incrementos candidatos

1. Evolucao temporal e comparacao com periodo anterior, sem inferir tendencia
   quando a base for insuficiente.
2. Exportacao auditada dos indicadores, respeitando filtros e autorizacao.
3. Quebra gerencial por profissional com as mesmas formulas do consolidado.

Esses candidatos ainda nao estao concluidos e devem passar por priorizacao
antes de ampliar o contrato.
