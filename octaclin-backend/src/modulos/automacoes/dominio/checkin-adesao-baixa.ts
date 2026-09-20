export const GATILHO_CHECKIN_ADESAO_BAIXA = 'checkin.adesao_baixa';

export const LIMIAR_ADESAO_PADRAO = 50;

/** Faixa do contrato fechado, reutilizada pela validacao de escrita em `gatilhos-automacao.ts`. */
export const LIMIAR_ADESAO_MINIMO = 1;
export const LIMIAR_ADESAO_MAXIMO = 100;

/**
 * Contrato fechado do gatilho `checkin.adesao_baixa` (PB-05, Fase 268):
 * dispara por check-in individual, nao por rodada -- cada check-in do
 * portal ja e um evento distinto e raro o bastante (no maximo um por
 * paciente por chamada) para nao precisar de intervalo minimo nem teto por
 * execucao, ao contrario de `checkin.atrasado`. O limiar por padrao (50)
 * reusa o mesmo corte que a formula de prioridade de acompanhamento
 * (Fase 265) ja usa para o fator `adesao_declarada_baixa`, para manter os
 * dois sinais de "adesao baixa" do produto consistentes entre si.
 */
export interface ConfiguracaoCheckinAdesaoBaixa {
  limiarAdesao: number;
}

/**
 * Defensivo por proposito: le um `gatilho` ja validado no fechamento do
 * contrato (`dominio/gatilhos-automacao.ts`) na criacao da regra, mas nao
 * confia apenas nisso -- mesmo tratamento que `checkin-atrasado.ts` ja
 * aplica ao seu proprio contrato fechado.
 */
export function normalizarConfiguracaoCheckinAdesaoBaixa(valor: unknown): ConfiguracaoCheckinAdesaoBaixa {
  const gatilho = ehObjeto(valor) ? valor : {};
  return {
    limiarAdesao: inteiroEmFaixa(gatilho.limiarAdesao, LIMIAR_ADESAO_PADRAO, LIMIAR_ADESAO_MINIMO, LIMIAR_ADESAO_MAXIMO)
  };
}

export function ehGatilhoCheckinAdesaoBaixa(valor: unknown): boolean {
  const gatilho = ehObjeto(valor) ? valor : {};
  return String(gatilho.tipo ?? '') === GATILHO_CHECKIN_ADESAO_BAIXA;
}

/**
 * Unica regra de elegibilidade do gatilho: a adesao declarada NESTE check-in
 * ficou estritamente abaixo do limiar da regra. Nunca compara com check-ins
 * anteriores nem com a prioridade calculada -- e um sinal pontual do
 * check-in que acabou de ser respondido.
 */
export function checkinTemAdesaoBaixa(adesaoPlano: number, configuracao: ConfiguracaoCheckinAdesaoBaixa): boolean {
  return adesaoPlano < configuracao.limiarAdesao;
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

function inteiroEmFaixa(valor: unknown, padrao: number, minimo: number, maximo: number): number {
  const numero = Math.trunc(Number(valor));
  if (!Number.isFinite(numero)) return padrao;
  return Math.min(Math.max(numero, minimo), maximo);
}
