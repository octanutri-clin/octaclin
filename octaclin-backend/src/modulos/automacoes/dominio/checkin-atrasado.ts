export const GATILHO_CHECKIN_ATRASADO = 'checkin.atrasado';

export const DIAS_SEM_CHECKIN_PADRAO = 7;
export const INTERVALO_MINIMO_DIAS_PADRAO = 7;
export const LIMITE_POR_EXECUCAO_PADRAO = 100;

/** Faixas do contrato fechado, reutilizadas pela validacao de escrita em `gatilhos-automacao.ts`. */
export const DIAS_SEM_CHECKIN_MINIMO = 1;
export const DIAS_SEM_CHECKIN_MAXIMO = 365;
export const INTERVALO_MINIMO_DIAS_MINIMO = 1;
export const INTERVALO_MINIMO_DIAS_MAXIMO = 365;
export const LIMITE_POR_EXECUCAO_MINIMO = 1;
export const LIMITE_POR_EXECUCAO_MAXIMO = 200;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Contrato fechado do gatilho `checkin.atrasado` (PB-03, Fase 267.3):
 * dias sem check-in, intervalo minimo entre dois disparos do mesmo paciente
 * pela mesma regra, e teto por rodada -- mesmo espirito do recall de
 * inatividade, para nao transformar o lembrete em disparo em massa.
 */
export interface ConfiguracaoCheckinAtrasado {
  diasSemCheckin: number;
  intervaloMinimoDias: number;
  limitePorExecucao: number;
}

export interface PacienteParaCheckinAtrasado {
  pacienteId: string;
  /** Ultimo check-in respondido. `null` quando o paciente nunca respondeu nenhum. */
  ultimoCheckinEm: Date | null;
  /** Usado como referencia quando nunca houve check-in. */
  criadoEm: Date;
  /** Ultimo disparo desta regra para este paciente (execucao ja criada, mesmo que ainda pendente). */
  ultimoDisparoEm: Date | null;
}

export type MotivoExclusaoCheckinAtrasado = 'dentro_do_prazo' | 'disparo_recente' | 'limite_por_execucao';

export interface CandidatoCheckinAtrasado {
  pacienteId: string;
  diasSemCheckin: number;
  /** `ultimoCheckinEm` do paciente, ou `criadoEm` quando ele nunca respondeu check-in. */
  referenciaEm: Date;
}

export interface ExclusaoCheckinAtrasado {
  pacienteId: string;
  motivo: MotivoExclusaoCheckinAtrasado;
}

export interface ResultadoSelecaoCheckinAtrasado {
  candidatos: CandidatoCheckinAtrasado[];
  excluidos: ExclusaoCheckinAtrasado[];
}

/**
 * Defensivo por proposito: le um `gatilho` ja validado no fechamento do
 * contrato (`dominio/gatilhos-automacao.ts`) na criacao da regra, mas nao
 * confia apenas nisso -- regra criada antes deste incremento ou lida por um
 * caminho que nao revalida sempre recebe um valor dentro da faixa e nunca
 * lanca.
 */
export function normalizarConfiguracaoCheckinAtrasado(valor: unknown): ConfiguracaoCheckinAtrasado {
  const gatilho = ehObjeto(valor) ? valor : {};
  return {
    diasSemCheckin: inteiroEmFaixa(
      gatilho.diasSemCheckin,
      DIAS_SEM_CHECKIN_PADRAO,
      DIAS_SEM_CHECKIN_MINIMO,
      DIAS_SEM_CHECKIN_MAXIMO
    ),
    intervaloMinimoDias: inteiroEmFaixa(
      gatilho.intervaloMinimoDias,
      INTERVALO_MINIMO_DIAS_PADRAO,
      INTERVALO_MINIMO_DIAS_MINIMO,
      INTERVALO_MINIMO_DIAS_MAXIMO
    ),
    limitePorExecucao: inteiroEmFaixa(
      gatilho.limitePorExecucao,
      LIMITE_POR_EXECUCAO_PADRAO,
      LIMITE_POR_EXECUCAO_MINIMO,
      LIMITE_POR_EXECUCAO_MAXIMO
    )
  };
}

export function ehGatilhoCheckinAtrasado(valor: unknown): boolean {
  const gatilho = ehObjeto(valor) ? valor : {};
  return String(gatilho.tipo ?? '') === GATILHO_CHECKIN_ATRASADO;
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

/**
 * Decide quem entra na rodada. Ordena do mais atrasado para o menos atrasado
 * antes de aplicar o limite -- mesmo criterio do recall de inatividade: se a
 * rodada nao cabe todo mundo, quem esta atrasado ha mais tempo passa
 * primeiro.
 */
export function selecionarCandidatosCheckinAtrasado(
  pacientes: PacienteParaCheckinAtrasado[],
  configuracao: ConfiguracaoCheckinAtrasado,
  agora: Date
): ResultadoSelecaoCheckinAtrasado {
  const excluidos: ExclusaoCheckinAtrasado[] = [];
  const elegiveis: CandidatoCheckinAtrasado[] = [];

  for (const paciente of pacientes) {
    const referenciaEm = paciente.ultimoCheckinEm ?? paciente.criadoEm;
    const diasSemCheckin = diasEntre(referenciaEm, agora);

    if (diasSemCheckin < configuracao.diasSemCheckin) {
      excluidos.push({ pacienteId: paciente.pacienteId, motivo: 'dentro_do_prazo' });
      continue;
    }
    if (paciente.ultimoDisparoEm && diasEntre(paciente.ultimoDisparoEm, agora) < configuracao.intervaloMinimoDias) {
      excluidos.push({ pacienteId: paciente.pacienteId, motivo: 'disparo_recente' });
      continue;
    }

    elegiveis.push({ pacienteId: paciente.pacienteId, diasSemCheckin, referenciaEm });
  }

  elegiveis.sort((primeiro, segundo) => segundo.diasSemCheckin - primeiro.diasSemCheckin);

  const candidatos = elegiveis.slice(0, configuracao.limitePorExecucao);
  for (const excedente of elegiveis.slice(configuracao.limitePorExecucao)) {
    excluidos.push({ pacienteId: excedente.pacienteId, motivo: 'limite_por_execucao' });
  }

  return { candidatos, excluidos };
}

function diasEntre(inicio: Date, fim: Date): number {
  return Math.floor((fim.getTime() - inicio.getTime()) / MS_POR_DIA);
}

function inteiroEmFaixa(valor: unknown, padrao: number, minimo: number, maximo: number): number {
  const numero = Math.trunc(Number(valor));
  if (!Number.isFinite(numero)) return padrao;
  return Math.min(Math.max(numero, minimo), maximo);
}
