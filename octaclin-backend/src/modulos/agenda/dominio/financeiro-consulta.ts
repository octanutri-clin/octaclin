/**
 * Financeiro da consulta e pacote de sessoes.
 *
 * **Dinheiro e inteiro em centavos, em todo lugar.** Nao existe `number` com
 * casa decimal atravessando servico, banco ou HTTP: `0.1 + 0.2` continua sendo
 * `0.30000000000000004` e o total do mes de uma clinica fecha errado por
 * centavos que ninguem consegue explicar. A conversao para "R$ 180,00" acontece
 * so na borda de exibicao.
 */

export type StatusPagamentoConsulta = 'pendente' | 'pago' | 'isento';

export const STATUS_PAGAMENTO_CONSULTA: readonly StatusPagamentoConsulta[] = ['pendente', 'pago', 'isento'];

export type FormaPagamentoConsulta =
  | 'dinheiro'
  | 'pix'
  | 'cartao_credito'
  | 'cartao_debito'
  | 'transferencia'
  | 'convenio'
  | 'pacote';

export const FORMAS_PAGAMENTO_CONSULTA: readonly FormaPagamentoConsulta[] = [
  'dinheiro',
  'pix',
  'cartao_credito',
  'cartao_debito',
  'transferencia',
  'convenio',
  'pacote'
];

/** Teto por consulta. Existe para transformar erro de digitacao em recusa. */
export const VALOR_MAXIMO_CENTAVOS = 100_000_000;

export const ROTULOS_FORMA_PAGAMENTO: Record<FormaPagamentoConsulta, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao_credito: 'Cartao de credito',
  cartao_debito: 'Cartao de debito',
  transferencia: 'Transferencia',
  convenio: 'Convenio',
  pacote: 'Pacote de sessoes'
};

/**
 * Consulta cancelada **nunca** entra no faturamento — criterio de aceite da
 * fase. Vale para o total recebido e para o total pendente: cobrar consulta que
 * a clinica cancelou e o tipo de erro que vira reclamacao no Procon.
 */
export function entraNoFaturamento(statusConsulta: string): boolean {
  return statusConsulta !== 'cancelada';
}

/** Formato de exibicao. Entrada em centavos, saida em pt-BR. */
export function formatarValorBRL(centavos: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);
}

/**
 * Aceita centavos inteiros e nao negativos. Fracao de centavo nao existe em
 * recibo, entao `18050.5` e recusado em vez de arredondado em silencio: dinheiro
 * arredondado sem o usuario ver e a origem de divergencia de fechamento.
 */
export function normalizarValorCentavos(valor: unknown): number | undefined {
  if (valor === undefined || valor === null || valor === '') return undefined;
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isInteger(numero)) throw new Error('valor_invalido');
  if (numero < 0) throw new Error('valor_negativo');
  if (numero > VALOR_MAXIMO_CENTAVOS) throw new Error('valor_acima_do_teto');
  return numero;
}

/**
 * Status de uma consulta que ocupa vaga do pacote.
 *
 * `falta` **consome** sessao: e a politica dominante em clinica (o horario foi
 * reservado e perdido). `cancelada` devolve a vaga.
 * ponytail: politica fixa em codigo; vira campo do pacote se algum tenant pedir
 * o contrario.
 */
const STATUS_CONSOME_SESSAO = ['concluida', 'falta'];
const STATUS_RESERVA_SESSAO = ['agendada', 'reagendada'];

export interface ConsumoPacote {
  contratadas: number;
  consumidas: number;
  reservadas: number;
  disponiveis: number;
  esgotado: boolean;
}

export function calcularConsumoPacote(
  sessoesContratadas: number,
  statusDasConsultas: readonly string[]
): ConsumoPacote {
  const consumidas = statusDasConsultas.filter((status) => STATUS_CONSOME_SESSAO.includes(status)).length;
  const reservadas = statusDasConsultas.filter((status) => STATUS_RESERVA_SESSAO.includes(status)).length;
  const disponiveis = Math.max(0, sessoesContratadas - consumidas - reservadas);
  return {
    contratadas: sessoesContratadas,
    consumidas,
    reservadas,
    disponiveis,
    esgotado: disponiveis === 0
  };
}

/**
 * Pacote vencido nao recebe consulta nova. Compara **data**, nao instante: um
 * pacote com validade "31/12" vale o dia 31 inteiro.
 */
export function pacoteVencido(validadeEm: Date | null | undefined, referencia: Date): boolean {
  if (!validadeEm) return false;
  return diaLocal(validadeEm) < diaLocal(referencia);
}

function diaLocal(instante: Date): string {
  return instante.toISOString().slice(0, 10);
}

export interface TotaisRecebimento {
  recebidoCentavos: number;
  pendenteCentavos: number;
  isentas: number;
  consultas: number;
}

export interface LinhaFaturamento {
  status: string;
  statusPagamento: StatusPagamentoConsulta;
  valorCentavos: number;
}

export interface IndicadoresPerformance {
  totalConsultas: number;
  concluidas: number;
  faltas: number;
  canceladas: number;
  taxaComparecimentoPercentual: number;
  taxaFaltaPercentual: number;
  taxaCancelamentoPercentual: number;
  ticketMedioRecebidoCentavos: number;
}

function percentual(parte: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((parte / total) * 1000) / 10;
}

/**
 * Indicadores gerenciais do periodo. Comparecimento e falta usam apenas
 * consultas encerradas como base; agendamentos futuros nao derrubam a taxa.
 * O ticket medio considera somente consultas pagas e nao canceladas. Pacotes
 * nao entram aqui porque sao contabilizados em linha financeira separada.
 */
export function calcularIndicadoresPerformance(
  linhas: readonly LinhaFaturamento[]
): IndicadoresPerformance {
  const concluidas = linhas.filter((linha) => linha.status === 'concluida').length;
  const faltas = linhas.filter((linha) => linha.status === 'falta').length;
  const canceladas = linhas.filter((linha) => linha.status === 'cancelada').length;
  const baseComparecimento = concluidas + faltas;
  const pagas = linhas.filter(
    (linha) => entraNoFaturamento(linha.status) && linha.statusPagamento === 'pago'
  );
  const recebidoCentavos = pagas.reduce((total, linha) => total + linha.valorCentavos, 0);

  return {
    totalConsultas: linhas.length,
    concluidas,
    faltas,
    canceladas,
    taxaComparecimentoPercentual: percentual(concluidas, baseComparecimento),
    taxaFaltaPercentual: percentual(faltas, baseComparecimento),
    taxaCancelamentoPercentual: percentual(canceladas, linhas.length),
    ticketMedioRecebidoCentavos: pagas.length === 0 ? 0 : Math.round(recebidoCentavos / pagas.length)
  };
}

/**
 * Soma o periodo. Consulta cancelada fica de fora inteira; isenta conta como
 * atendimento realizado mas nao entra em recebido nem em pendente — senao o
 * dono da clinica ve "a receber" que ninguem vai cobrar.
 */
export function somarRecebimentos(linhas: readonly LinhaFaturamento[]): TotaisRecebimento {
  const totais: TotaisRecebimento = { recebidoCentavos: 0, pendenteCentavos: 0, isentas: 0, consultas: 0 };

  for (const linha of linhas) {
    if (!entraNoFaturamento(linha.status)) continue;
    totais.consultas += 1;
    if (linha.statusPagamento === 'pago') totais.recebidoCentavos += linha.valorCentavos;
    else if (linha.statusPagamento === 'pendente') totais.pendenteCentavos += linha.valorCentavos;
    else totais.isentas += 1;
  }

  return totais;
}
