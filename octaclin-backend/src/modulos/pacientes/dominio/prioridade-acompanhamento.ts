export const VERSAO_FORMULA_PRIORIDADE_ACOMPANHAMENTO = '1.0.0';

export type FaixaPrioridadeAcompanhamento = 'baixa' | 'media' | 'alta';

export type CodigoFatorPrioridadeAcompanhamento =
  | 'faltas_recentes'
  | 'sem_retorno_programado'
  | 'formulario_vencido'
  | 'adesao_declarada_baixa';

export interface FaltaParaPrioridadeAcompanhamento {
  consultaId: string;
  ocorreuEm: Date;
}

export interface FormularioParaPrioridadeAcompanhamento {
  envioId: string;
  obrigatorio: boolean;
  vencimentoEm: Date;
  respondidoEm?: Date | null;
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
  formularios?: readonly FormularioParaPrioridadeAcompanhamento[];
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
const LIMITE_FORMULARIO_VENCIDO_MS = 7 * DIA_MS;
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

  const formulariosVencidos = contarFormulariosVencidos(entrada.formularios ?? [], agoraMs);
  if (formulariosVencidos > 0) {
    fatores.push({ codigo: 'formulario_vencido', pontos: 10, quantidade: formulariosVencidos });
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

function contarFormulariosVencidos(
  formularios: readonly FormularioParaPrioridadeAcompanhamento[],
  agoraMs: number
): number {
  const vencidos = new Set<string>();
  for (const formulario of formularios) {
    if (!formulario.envioId.trim()) throw new Error('Formulario invalido.');
    validarData(formulario.vencimentoEm, 'Data de vencimento do formulario invalida.');
    validarDataOpcional(formulario.respondidoEm, 'Data de resposta do formulario invalida.');
    if (
      formulario.obrigatorio &&
      !formulario.respondidoEm &&
      formulario.vencimentoEm.getTime() < agoraMs - LIMITE_FORMULARIO_VENCIDO_MS
    ) {
      vencidos.add(formulario.envioId);
    }
  }
  return vencidos.size;
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
