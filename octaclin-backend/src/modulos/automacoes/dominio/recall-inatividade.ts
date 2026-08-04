export const GATILHO_INATIVIDADE = 'paciente.inativo';

export const DIAS_SEM_CONSULTA_PADRAO = 60;
export const INTERVALO_MINIMO_DIAS_PADRAO = 30;
export const LIMITE_POR_EXECUCAO_PADRAO = 25;

const DIAS_SEM_CONSULTA_MINIMO = 7;
const LIMITE_POR_EXECUCAO_MAXIMO = 200;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Teto comercial: recall e conversa de recuperacao, nao campanha. Intervalo minimo
 * entre dois recalls do mesmo paciente e limite por rodada existem para nao queimar
 * o numero na Meta nem transformar a automacao em disparo em massa.
 */
export interface ConfiguracaoRecallInatividade {
  diasSemConsulta: number;
  statusAdesao: string[];
  intervaloMinimoDias: number;
  limitePorExecucao: number;
}

export interface PacienteParaRecall {
  pacienteId: string;
  statusAdesao: string;
  /** Fim da ultima consulta concluida. `null` quando o paciente nunca concluiu uma. */
  ultimaConsultaConcluidaEm: Date | null;
  /** Ultimo recall efetivamente enviado a este paciente por esta regra. */
  ultimoRecallEm: Date | null;
  aceitaComunicacao: boolean;
  possuiContato: boolean;
  /** Contato existe no banco mas nao pode ser descriptografado. */
  contatoIlegivel?: boolean;
}

export type MotivoExclusaoRecall =
  | 'opt_out'
  | 'contato_ilegivel'
  | 'sem_contato'
  | 'status_adesao_fora_do_filtro'
  | 'consulta_recente'
  | 'recall_recente'
  | 'limite_por_execucao';

export interface CandidatoRecall {
  pacienteId: string;
  /** `null` quando o paciente nunca concluiu consulta — entra pelo cadastro, nao pela ausencia. */
  diasSemConsulta: number | null;
  ultimaConsultaConcluidaEm: Date | null;
}

export interface ExclusaoRecall {
  pacienteId: string;
  motivo: MotivoExclusaoRecall;
}

export interface ResultadoSelecaoRecall {
  candidatos: CandidatoRecall[];
  excluidos: ExclusaoRecall[];
}

export function normalizarConfiguracaoRecall(gatilho: Record<string, unknown>): ConfiguracaoRecallInatividade {
  return {
    diasSemConsulta: inteiroEmFaixa(gatilho.diasSemConsulta, DIAS_SEM_CONSULTA_PADRAO, DIAS_SEM_CONSULTA_MINIMO, 3650),
    statusAdesao: listaDeTextos(gatilho.statusAdesao),
    intervaloMinimoDias: inteiroEmFaixa(gatilho.intervaloMinimoDias, INTERVALO_MINIMO_DIAS_PADRAO, 1, 3650),
    limitePorExecucao: inteiroEmFaixa(gatilho.limitePorExecucao, LIMITE_POR_EXECUCAO_PADRAO, 1, LIMITE_POR_EXECUCAO_MAXIMO)
  };
}

export function ehGatilhoInatividade(gatilho: Record<string, unknown> | undefined): boolean {
  return String(gatilho?.tipo ?? '') === GATILHO_INATIVIDADE;
}

/**
 * Decide quem recebe recall. Ordena do mais inativo para o menos inativo antes de
 * aplicar o limite: se a rodada nao cabe todo mundo, quem sumiu ha mais tempo passa
 * primeiro. Paciente sem nenhuma consulta concluida vai para o fim da fila (ainda
 * pode ser um cadastro recem-criado que nunca chegou a ser atendido).
 */
export function selecionarCandidatosRecall(
  pacientes: PacienteParaRecall[],
  configuracao: ConfiguracaoRecallInatividade,
  agora: Date
): ResultadoSelecaoRecall {
  const excluidos: ExclusaoRecall[] = [];
  const elegiveis: CandidatoRecall[] = [];

  for (const paciente of pacientes) {
    const motivo = motivoExclusao(paciente, configuracao, agora);
    if (motivo) {
      excluidos.push({ pacienteId: paciente.pacienteId, motivo });
      continue;
    }

    elegiveis.push({
      pacienteId: paciente.pacienteId,
      diasSemConsulta: paciente.ultimaConsultaConcluidaEm ? diasEntre(paciente.ultimaConsultaConcluidaEm, agora) : null,
      ultimaConsultaConcluidaEm: paciente.ultimaConsultaConcluidaEm
    });
  }

  elegiveis.sort(compararPorInatividade);

  const candidatos = elegiveis.slice(0, configuracao.limitePorExecucao);
  for (const excedente of elegiveis.slice(configuracao.limitePorExecucao)) {
    excluidos.push({ pacienteId: excedente.pacienteId, motivo: 'limite_por_execucao' });
  }

  return { candidatos, excluidos };
}

function motivoExclusao(
  paciente: PacienteParaRecall,
  configuracao: ConfiguracaoRecallInatividade,
  agora: Date
): MotivoExclusaoRecall | null {
  if (!paciente.aceitaComunicacao) return 'opt_out';
  // Antes de 'sem_contato': contato ilegivel e falha de chave/criptografia, nao cadastro
  // incompleto. Confundir os dois esconde um problema de infraestrutura atras de um
  // relatorio que parece so ter pacientes mal cadastrados.
  if (paciente.contatoIlegivel) return 'contato_ilegivel';
  if (!paciente.possuiContato) return 'sem_contato';
  if (configuracao.statusAdesao.length && !configuracao.statusAdesao.includes(paciente.statusAdesao)) {
    return 'status_adesao_fora_do_filtro';
  }
  if (paciente.ultimaConsultaConcluidaEm && diasEntre(paciente.ultimaConsultaConcluidaEm, agora) < configuracao.diasSemConsulta) {
    return 'consulta_recente';
  }
  if (paciente.ultimoRecallEm && diasEntre(paciente.ultimoRecallEm, agora) < configuracao.intervaloMinimoDias) {
    return 'recall_recente';
  }
  return null;
}

function compararPorInatividade(primeiro: CandidatoRecall, segundo: CandidatoRecall): number {
  if (primeiro.diasSemConsulta === null && segundo.diasSemConsulta === null) return 0;
  if (primeiro.diasSemConsulta === null) return 1;
  if (segundo.diasSemConsulta === null) return -1;
  return segundo.diasSemConsulta - primeiro.diasSemConsulta;
}

function diasEntre(inicio: Date, fim: Date): number {
  return Math.floor((fim.getTime() - inicio.getTime()) / MS_POR_DIA);
}

function inteiroEmFaixa(valor: unknown, padrao: number, minimo: number, maximo: number): number {
  const numero = Math.trunc(Number(valor));
  if (!Number.isFinite(numero)) return padrao;
  return Math.min(Math.max(numero, minimo), maximo);
}

function listaDeTextos(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim());
}
