import type { FormulaEnergeticaApi, MetodoMacrosManualApi } from './plano-alimentar-api';
import type { PreferenciasApresentacaoPlanoApi } from './preferencias-apresentacao-plano';
import type { PrecondicaoEdicaoPlano } from './coordenador-edicao-plano';
/** Contrato editorial versionado. Não representa validação clínica. Sem persistência no navegador. */
export type NumeroEdicao = number | string | null;
/** O editor conserva texto parcial; interpretar um número é uma operação separada. */
export function campoNumeroEdicao(valor: NumeroEdicao | undefined): number | string {
  return valor ?? '';
}

export function interpretarNumeroEdicao(valor: NumeroEdicao | undefined): number | undefined {
  if (valor == null || (typeof valor === 'string' && !valor.trim())) return undefined;
  const numero = typeof valor === 'number' ? valor : Number(valor.replace(',', '.'));
  return Number.isFinite(numero) ? numero : undefined;
}

/** Deslocamento decimal, sem arredondar texto com mais de duas casas para uma prescrição válida. */
export function percentualParaBasisPointsEdicao(valor: NumeroEdicao | undefined): number | undefined {
  const numero = interpretarNumeroEdicao(valor);
  if (numero === undefined) return undefined;
  const [mantissa, expoente = '0'] = String(numero).split('e');
  return Number(`${mantissa}e${Number(expoente) + 2}`);
}

export function nutrientesNumericosEdicao(valores: NutrientesEdicao): Partial<Record<keyof NutrientesEdicao, number>> {
  return Object.fromEntries(Object.entries(valores).flatMap(([campo, valor]) => {
    const numero = interpretarNumeroEdicao(valor);
    return numero === undefined ? [] : [[campo, numero]];
  }));
}
export type NutrientesEdicao = Partial<Record<'energiaKcal' | 'proteinasG' | 'carboidratosG' | 'gordurasG' | 'fibrasG' | 'sodioMg', NumeroEdicao>>;
export interface AlimentoEdicao {
  chaveCliente: string;
  alimentoComposicaoId?: string | null;
  descricao?: string;
  quantidade?: NumeroEdicao;
  unidade?: string;
  porcaoGramas?: NumeroEdicao;
  nutrientesPor100g?: NutrientesEdicao;
  fonteRotulo?: string;
}
export interface AlternativaEdicao extends AlimentoEdicao { liberadaParaPaciente?: boolean; preferida?: boolean }
export interface ItemEdicao extends AlimentoEdicao { substituicoes?: AlternativaEdicao[]; substituicoesVisiveisInicialmente?: NumeroEdicao }
export interface RefeicaoEdicao { chaveCliente: string; nome?: string; horarioLocal?: string; orientacoes?: string; itens: ItemEdicao[] }
export interface DocumentoEdicaoPlano {
  schemaVersao: 1;
  avaliacaoAntropometricaId?: string | null;
  formula?: FormulaEnergeticaApi | '';
  fatorAtividade?: NumeroEdicao;
  ajusteEnergeticoKcal?: NumeroEdicao;
  carboidratosBasisPoints?: NumeroEdicao;
  proteinasBasisPoints?: NumeroEdicao;
  gordurasBasisPoints?: NumeroEdicao;
  /** Texto percentual exato, opcional para compatibilidade com documentos v1 anteriores. */
  percentuaisMacrosEdicao?: Partial<Record<'carboidratosBasisPoints' | 'proteinasBasisPoints' | 'gordurasBasisPoints', NumeroEdicao>>;
  possuiCondicaoEspecial?: boolean;
  aplicabilidadeFormulaConfirmada?: boolean;
  justificativaCondicaoEspecial?: string;
  metodoMacrosManual?: MetodoMacrosManualApi | '';
  metaEnergeticaManualKcal?: NumeroEdicao;
  carboidratosGPorKg?: NumeroEdicao;
  proteinasGPorKg?: NumeroEdicao;
  gordurasGPorKg?: NumeroEdicao;
  justificativaDivergenciaClinica?: string;
  objetivos?: string;
  observacoes?: string;
  preferenciasApresentacao?: PreferenciasApresentacaoPlanoApi;
  refeicoes: RefeicaoEdicao[];
}

export interface SalvarEdicaoPlanoEntrada extends PrecondicaoEdicaoPlano { documento: DocumentoEdicaoPlano }

/** Limite do documento; o envelope HTTP inteiro continua limitado a 100KiB. */
export const LIMITE_BYTES_DOCUMENTO_EDICAO = 96 * 1024;
