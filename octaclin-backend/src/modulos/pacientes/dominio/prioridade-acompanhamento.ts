/**
 * `1.1.0`: a `1.0.0` incluia o fator `formulario_vencido`, removido nesta
 * versao porque o dominio de questionarios nao tem hoje o conceito de
 * "obrigatorio" que o fator exigia (ver `CodigoFatorPrioridadeAcompanhamento`
 * abaixo) -- modelar isso so para alimentar a formula seria inventar uma
 * decisao de produto que ainda nao foi tomada. `formulario_vencido` pode
 * voltar numa formula futura se e quando o produto adquirir o conceito de
 * formulario obrigatorio + prazo. Nunca reutilize `1.0.0` para esta
 * semantica: um registro historico com `versaoFormula: '1.0.0'` pode ter
 * pontuado `formulario_vencido`, e um com `1.1.0` nunca pontua.
 */
export const VERSAO_FORMULA_PRIORIDADE_ACOMPANHAMENTO = '1.1.0';

export type FaixaPrioridadeAcompanhamento = 'baixa' | 'media' | 'alta';

export type CodigoFatorPrioridadeAcompanhamento =
  | 'faltas_recentes'
  | 'sem_retorno_programado'
  | 'adesao_declarada_baixa';

export interface FaltaParaPrioridadeAcompanhamento {
  consultaId: string;
  ocorreuEm: Date;
}

export interface RegistroHabitosParaPrioridadeAcompanhamento {
  registradoEm: Date;
  adesaoPercentual: number;
}

export interface EntradaPrioridadeAcompanhamento {
  agora: Date;
  faltas?: readonly FaltaParaPrioridadeAcompanhamento[];
  ultimaConsultaConcluidaEm?: Date | null;
  proximaConsultaEm?: Date | null;
  ultimoRegistroHabitos?: RegistroHabitosParaPrioridadeAcompanhamento | null;
}

export interface FatorPrioridadeAcompanhamento {
  codigo: CodigoFatorPrioridadeAcompanhamento;
  pontos: number;
  quantidade?: number;
}

export interface ResultadoPrioridadeAcompanhamento {
  versaoFormula: typeof VERSAO_FORMULA_PRIORIDADE_ACOMPANHAMENTO;
  score: number;
  faixa: FaixaPrioridadeAcompanhamento;
  fatores: FatorPrioridadeAcompanhamento[];
}

const DIA_MS = 24 * 60 * 60 * 1000;
const JANELA_FALTAS_MS = 90 * DIA_MS;
const LIMITE_SEM_RETORNO_MS = 60 * DIA_MS;
const JANELA_REGISTRO_HABITOS_MS = 30 * DIA_MS;

export function calcularPrioridadeAcompanhamento(
  entrada: EntradaPrioridadeAcompanhamento
): ResultadoPrioridadeAcompanhamento {
  validarData(entrada.agora, 'Data agora invalida.');
  validarDataOpcional(entrada.ultimaConsultaConcluidaEm, 'Data da ultima consulta invalida.');
  validarDataOpcional(entrada.proximaConsultaEm, 'Data da proxima consulta invalida.');

  const agoraMs = entrada.agora.getTime();
  const fatores: FatorPrioridadeAcompanhamento[] = [];

  const faltasRecentes = contarFaltasRecentes(entrada.faltas ?? [], agoraMs);
  if (faltasRecentes > 0) {
    fatores.push({
      codigo: 'faltas_recentes',
      pontos: Math.min(faltasRecentes * 30, 60),
      quantidade: faltasRecentes
    });
  }

  if (estaSemRetornoProgramado(entrada, agoraMs)) {
    fatores.push({ codigo: 'sem_retorno_programado', pontos: 25 });
  }

  if (temAdesaoDeclaradaBaixa(entrada.ultimoRegistroHabitos, agoraMs)) {
    fatores.push({ codigo: 'adesao_declarada_baixa', pontos: 15 });
  }

  const score = Math.min(fatores.reduce((total, fator) => total + fator.pontos, 0), 100);
  return {
    versaoFormula: VERSAO_FORMULA_PRIORIDADE_ACOMPANHAMENTO,
    score,
    faixa: classificarFaixa(score),
    fatores
  };
}

function contarFaltasRecentes(
  faltas: readonly FaltaParaPrioridadeAcompanhamento[],
  agoraMs: number
): number {
  const consultas = new Set<string>();
  for (const falta of faltas) {
    if (!falta.consultaId.trim()) throw new Error('Falta invalida.');
    validarData(falta.ocorreuEm, 'Data da falta invalida.');
    if (estaNaJanelaInclusiva(falta.ocorreuEm.getTime(), agoraMs, JANELA_FALTAS_MS)) {
      consultas.add(falta.consultaId);
    }
  }
  return consultas.size;
}

function estaSemRetornoProgramado(
  entrada: EntradaPrioridadeAcompanhamento,
  agoraMs: number
): boolean {
  const ultimaConsultaMs = entrada.ultimaConsultaConcluidaEm?.getTime();
  if (ultimaConsultaMs === undefined || ultimaConsultaMs >= agoraMs - LIMITE_SEM_RETORNO_MS) {
    return false;
  }

  const proximaConsultaMs = entrada.proximaConsultaEm?.getTime();
  return proximaConsultaMs === undefined || proximaConsultaMs <= agoraMs;
}

function temAdesaoDeclaradaBaixa(
  registro: RegistroHabitosParaPrioridadeAcompanhamento | null | undefined,
  agoraMs: number
): boolean {
  if (!registro) return false;
  validarData(registro.registradoEm, 'Data do registro de habitos invalida.');
  if (
    !Number.isFinite(registro.adesaoPercentual) ||
    registro.adesaoPercentual < 0 ||
    registro.adesaoPercentual > 100
  ) {
    throw new Error('Adesao percentual invalida.');
  }
  return registro.adesaoPercentual < 50 &&
    estaNaJanelaInclusiva(registro.registradoEm.getTime(), agoraMs, JANELA_REGISTRO_HABITOS_MS);
}

function estaNaJanelaInclusiva(instanteMs: number, agoraMs: number, janelaMs: number): boolean {
  return instanteMs >= agoraMs - janelaMs && instanteMs <= agoraMs;
}

function classificarFaixa(score: number): FaixaPrioridadeAcompanhamento {
  if (score >= 70) return 'alta';
  if (score >= 40) return 'media';
  return 'baixa';
}

function validarData(data: Date, mensagem: string): void {
  if (!(data instanceof Date) || !Number.isFinite(data.getTime())) throw new Error(mensagem);
}

function validarDataOpcional(data: Date | null | undefined, mensagem: string): void {
  if (data !== null && data !== undefined) validarData(data, mensagem);
}

/**
 * Vocabulario fechado do motivo de override da prioridade de acompanhamento,
 * aprovado pelo dono do produto para a Fase 265. `outro` e uma categoria
 * fechada como as demais -- nunca um escape para texto livre no codigo; o
 * detalhe do motivo continua exclusivamente na justificativa cifrada, que
 * nunca entra na trilha generica de auditoria.
 */
export const CODIGOS_MOTIVO_OVERRIDE_PRIORIDADE_ACOMPANHAMENTO = [
  'evento_recente_nao_capturado',
  'informacao_externa_relevante',
  'acompanhamento_intensificado',
  'acompanhamento_reduzido',
  'correcao_de_dado',
  'outro'
] as const;

export type CodigoMotivoOverridePrioridadeAcompanhamento =
  (typeof CODIGOS_MOTIVO_OVERRIDE_PRIORIDADE_ACOMPANHAMENTO)[number];
