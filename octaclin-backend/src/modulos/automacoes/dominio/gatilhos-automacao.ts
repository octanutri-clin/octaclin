import {
  GATILHO_CHECKIN_ADESAO_BAIXA,
  LIMIAR_ADESAO_MAXIMO,
  LIMIAR_ADESAO_MINIMO,
  LIMIAR_ADESAO_PADRAO
} from './checkin-adesao-baixa';
import {
  DIAS_SEM_CHECKIN_MAXIMO,
  DIAS_SEM_CHECKIN_MINIMO,
  DIAS_SEM_CHECKIN_PADRAO,
  GATILHO_CHECKIN_ATRASADO,
  INTERVALO_MINIMO_DIAS_MAXIMO as CHECKIN_INTERVALO_MINIMO_DIAS_MAXIMO,
  INTERVALO_MINIMO_DIAS_MINIMO as CHECKIN_INTERVALO_MINIMO_DIAS_MINIMO,
  INTERVALO_MINIMO_DIAS_PADRAO as CHECKIN_INTERVALO_MINIMO_DIAS_PADRAO,
  LIMITE_POR_EXECUCAO_MAXIMO as CHECKIN_LIMITE_POR_EXECUCAO_MAXIMO,
  LIMITE_POR_EXECUCAO_MINIMO as CHECKIN_LIMITE_POR_EXECUCAO_MINIMO,
  LIMITE_POR_EXECUCAO_PADRAO as CHECKIN_LIMITE_POR_EXECUCAO_PADRAO
} from './checkin-atrasado';
import { GATILHO_INATIVIDADE } from './recall-inatividade';

export const TIPOS_GATILHO_AUTOMACAO = [
  GATILHO_INATIVIDADE,
  GATILHO_CHECKIN_ATRASADO,
  GATILHO_CHECKIN_ADESAO_BAIXA,
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

/** Contrato fechado do gatilho periodico: os tres parametros sempre existem apos a validacao (ver `checkin-atrasado.ts`). */
export interface GatilhoCheckinAtrasadoAutomacao {
  tipo: typeof GATILHO_CHECKIN_ATRASADO;
  diasSemCheckin: number;
  intervaloMinimoDias: number;
  limitePorExecucao: number;
}

/** Contrato fechado do gatilho por check-in: o limiar sempre existe apos a validacao (ver `checkin-adesao-baixa.ts`). */
export interface GatilhoCheckinAdesaoBaixaAutomacao {
  tipo: typeof GATILHO_CHECKIN_ADESAO_BAIXA;
  limiarAdesao: number;
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
  | GatilhoCheckinAdesaoBaixaAutomacao
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
 * Campo opcional com default de produto quando ausente, mas VALIDADO (nunca
 * clamado) quando presente -- ao contrario do recall, que so existia antes
 * deste contrato fechado e por isso normaliza de forma tolerante na leitura.
 * `checkin.atrasado` nasce com o contrato fechado, entao a escrita rejeita
 * de imediato um valor fora da faixa.
 */
function validarInteiroDoContrato(valor: unknown, campo: string, padrao: number, minimo: number, maximo: number): number {
  if (valor === undefined) return padrao;
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < minimo || valor > maximo) {
    throw new ContratoGatilhoAutomacaoInvalido(`${campo} precisa ser um inteiro entre ${minimo} e ${maximo}.`);
  }
  return valor;
}

/**
 * Fecha o vocabulario de gatilhos: rejeita tipo desconhecido e campo fora do
 * contrato antes de a regra ser persistida. `paciente.inativo` e
 * `checkin.atrasado` tem parametros proprios (o segundo com defaults de
 * produto aplicados quando ausentes); `questionario.respondido` e
 * `paciente.risco_alto` aceitam somente `{ tipo }` (ver
 * `docs/history/phases/PLANO_FASE_267.md`).
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

  if (valor.tipo === GATILHO_CHECKIN_ATRASADO) {
    const permitidas = ['tipo', 'diasSemCheckin', 'intervaloMinimoDias', 'limitePorExecucao'];
    if (!possuiApenasAsChavesPermitidas(valor, permitidas)) {
      throw new ContratoGatilhoAutomacaoInvalido('O gatilho de checkin atrasado contem campos fora do contrato atual.');
    }
    return {
      tipo: GATILHO_CHECKIN_ATRASADO,
      diasSemCheckin: validarInteiroDoContrato(
        valor.diasSemCheckin,
        'diasSemCheckin',
        DIAS_SEM_CHECKIN_PADRAO,
        DIAS_SEM_CHECKIN_MINIMO,
        DIAS_SEM_CHECKIN_MAXIMO
      ),
      intervaloMinimoDias: validarInteiroDoContrato(
        valor.intervaloMinimoDias,
        'intervaloMinimoDias',
        CHECKIN_INTERVALO_MINIMO_DIAS_PADRAO,
        CHECKIN_INTERVALO_MINIMO_DIAS_MINIMO,
        CHECKIN_INTERVALO_MINIMO_DIAS_MAXIMO
      ),
      limitePorExecucao: validarInteiroDoContrato(
        valor.limitePorExecucao,
        'limitePorExecucao',
        CHECKIN_LIMITE_POR_EXECUCAO_PADRAO,
        CHECKIN_LIMITE_POR_EXECUCAO_MINIMO,
        CHECKIN_LIMITE_POR_EXECUCAO_MAXIMO
      )
    };
  }

  if (valor.tipo === GATILHO_CHECKIN_ADESAO_BAIXA) {
    const permitidas = ['tipo', 'limiarAdesao'];
    if (!possuiApenasAsChavesPermitidas(valor, permitidas)) {
      throw new ContratoGatilhoAutomacaoInvalido('O gatilho de adesao baixa contem campos fora do contrato atual.');
    }
    return {
      tipo: GATILHO_CHECKIN_ADESAO_BAIXA,
      limiarAdesao: validarInteiroDoContrato(
        valor.limiarAdesao,
        'limiarAdesao',
        LIMIAR_ADESAO_PADRAO,
        LIMIAR_ADESAO_MINIMO,
        LIMIAR_ADESAO_MAXIMO
      )
    };
  }

  if (!possuiApenasAsChavesPermitidas(valor, ['tipo']) || Object.keys(valor).length !== 1) {
    throw new ContratoGatilhoAutomacaoInvalido('O gatilho contem campos fora do contrato atual.');
  }
  return {
    tipo: valor.tipo as Exclude<
      TipoGatilhoAutomacao,
      typeof GATILHO_INATIVIDADE | typeof GATILHO_CHECKIN_ATRASADO | typeof GATILHO_CHECKIN_ADESAO_BAIXA
    >
  };
}
