import { GATILHO_INATIVIDADE } from './recall-inatividade';

export const TIPOS_GATILHO_AUTOMACAO = [
  GATILHO_INATIVIDADE,
  'checkin.atrasado',
  'questionario.respondido',
  'paciente.risco_alto'
] as const;

export type TipoGatilhoAutomacao = (typeof TIPOS_GATILHO_AUTOMACAO)[number];

/** Contrato especializado do recall: as opcoes preservam o comportamento de `recall-inatividade.ts`. */
export interface GatilhoInatividadeAutomacao {
  tipo: typeof GATILHO_INATIVIDADE;
  diasSemConsulta?: number;
  statusAdesao?: string[];
  intervaloMinimoDias?: number;
  limitePorExecucao?: number;
}

export interface GatilhoCheckinAtrasadoAutomacao {
  tipo: 'checkin.atrasado';
}

export interface GatilhoQuestionarioRespondidoAutomacao {
  tipo: 'questionario.respondido';
}

export interface GatilhoPacienteRiscoAltoAutomacao {
  tipo: 'paciente.risco_alto';
}

export type GatilhoAutomacao =
  | GatilhoInatividadeAutomacao
  | GatilhoCheckinAtrasadoAutomacao
  | GatilhoQuestionarioRespondidoAutomacao
  | GatilhoPacienteRiscoAltoAutomacao;

export class ContratoGatilhoAutomacaoInvalido extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ContratoGatilhoAutomacaoInvalido';
  }
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function possuiApenasAsChavesPermitidas(item: Record<string, unknown>, permitidas: string[]): boolean {
  return Object.keys(item).every((chave) => permitidas.includes(chave));
}

function ehListaDeStrings(valor: unknown): valor is string[] {
  return Array.isArray(valor) && valor.every((item) => typeof item === 'string');
}

function ehNumeroFinito(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor);
}

/**
 * Fecha o vocabulario de gatilhos: rejeita tipo desconhecido e campo fora do
 * contrato antes de a regra ser persistida. Cada tipo exceto o recall
 * especializado aceita somente `{ tipo }` hoje; parametros novos entram junto
 * do incremento que passa a interpreta-los (ver `docs/history/phases/PLANO_FASE_267.md`).
 */
export function validarGatilhoAutomacao(valor: unknown): GatilhoAutomacao {
  if (!ehObjeto(valor)) {
    throw new ContratoGatilhoAutomacaoInvalido('O gatilho precisa ser um objeto.');
  }
  if (!TIPOS_GATILHO_AUTOMACAO.includes(valor.tipo as TipoGatilhoAutomacao)) {
    throw new ContratoGatilhoAutomacaoInvalido('O gatilho possui tipo nao suportado.');
  }

  if (valor.tipo === GATILHO_INATIVIDADE) {
    const permitidas = ['tipo', 'diasSemConsulta', 'statusAdesao', 'intervaloMinimoDias', 'limitePorExecucao'];
    if (!possuiApenasAsChavesPermitidas(valor, permitidas)) {
      throw new ContratoGatilhoAutomacaoInvalido('O gatilho de inatividade contem campos fora do contrato atual.');
    }
    const resultado: GatilhoInatividadeAutomacao = { tipo: GATILHO_INATIVIDADE };
    if ('diasSemConsulta' in valor) {
      if (!ehNumeroFinito(valor.diasSemConsulta)) {
        throw new ContratoGatilhoAutomacaoInvalido('diasSemConsulta precisa ser um numero.');
      }
      resultado.diasSemConsulta = valor.diasSemConsulta;
    }
    if ('statusAdesao' in valor) {
      if (!ehListaDeStrings(valor.statusAdesao)) {
        throw new ContratoGatilhoAutomacaoInvalido('statusAdesao precisa ser uma lista de textos.');
      }
      resultado.statusAdesao = valor.statusAdesao;
    }
    if ('intervaloMinimoDias' in valor) {
      if (!ehNumeroFinito(valor.intervaloMinimoDias)) {
        throw new ContratoGatilhoAutomacaoInvalido('intervaloMinimoDias precisa ser um numero.');
      }
      resultado.intervaloMinimoDias = valor.intervaloMinimoDias;
    }
    if ('limitePorExecucao' in valor) {
      if (!ehNumeroFinito(valor.limitePorExecucao)) {
        throw new ContratoGatilhoAutomacaoInvalido('limitePorExecucao precisa ser um numero.');
      }
      resultado.limitePorExecucao = valor.limitePorExecucao;
    }
    return resultado;
  }

  if (!possuiApenasAsChavesPermitidas(valor, ['tipo']) || Object.keys(valor).length !== 1) {
    throw new ContratoGatilhoAutomacaoInvalido('O gatilho contem campos fora do contrato atual.');
  }
  return { tipo: valor.tipo as Exclude<TipoGatilhoAutomacao, typeof GATILHO_INATIVIDADE> };
}
