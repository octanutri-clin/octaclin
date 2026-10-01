const DIA_MS = 24 * 60 * 60 * 1000;
const HORA_MS = 60 * 60 * 1000;

/** Retorna apenas o ciclo corrente, sem recuperar ciclos perdidos. */
export function cicloLembretePlano(publicadoEm: Date, ativadoEm: Date, intervaloDias: number, agora: Date): number | null {
  if (publicadoEm <= ativadoEm || !Number.isInteger(intervaloDias) || intervaloDias < 1 || intervaloDias > 30) return null;
  const intervaloMs = intervaloDias * DIA_MS;
  const ciclo = Math.floor((agora.getTime() - publicadoEm.getTime()) / intervaloMs);
  if (ciclo < 1) return null;
  const vencimento = publicadoEm.getTime() + ciclo * intervaloMs;
  return agora.getTime() - vencimento < DIA_MS ? ciclo : null;
}

/** Lembrete da tarefa é pontual: não envia atrasos antigos. */
export function tarefaElegivelParaLembrete(
  criadoEm: Date, vencimentoEm: Date, status: string, ativadoEm: Date,
  antecedenciaHoras: number, agora: Date
): boolean {
  if (criadoEm <= ativadoEm || !['pendente', 'em_andamento'].includes(status) ||
      !Number.isInteger(antecedenciaHoras) || antecedenciaHoras < 0 || antecedenciaHoras > 168) return false;
  const inicio = vencimentoEm.getTime() - antecedenciaHoras * HORA_MS;
  const fim = vencimentoEm.getTime() + (antecedenciaHoras === 0 ? HORA_MS : 0);
  return agora.getTime() >= inicio && agora.getTime() <= fim;
}

export function chaveLembretePlano(versaoId: string, ciclo: number): string {
  return `plano-acompanhamento:${versaoId}:${ciclo}`;
}

export function chaveLembreteTarefa(tarefaId: string, vencimentoEm: Date): string {
  return `tarefa-acompanhamento:${tarefaId}:${vencimentoEm.getTime()}`;
}
