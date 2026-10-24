import type { IntencaoGrupoSubstituicoesEdicao } from './grupos-substituicoes-tipos';
import type { IntencaoEquivalenciaEdicao } from './equivalencias-plano-api';
import type { FormulaEnergeticaApi, MetodoMacrosManualApi } from './plano-alimentar-api';
import type { PreferenciasApresentacaoPlanoApi } from './preferencias-apresentacao-plano';
import type { PrecondicaoEdicaoPlano } from './coordenador-edicao-plano';
import type { CodigoMicronutrienteApi, MicronutrientesPor100gApi } from './plano-alimentar-api';
import type { MedidaCaseiraAplicadaApi } from './medidas-caseiras-plano';
/** Contrato editorial versionado. Não representa validação clínica. Sem persistência no navegador. */
export type NumeroEdicao = number | string | null;
export interface AlimentoPersonalizadoEdicao { id: string; revisao: number; aplicacaoId: string }

/** A ausência preserva clientes legados; null desvincula de forma explícita. */
export function serializarAlimentoPersonalizadoEdicao(
  valor: AlimentoPersonalizadoEdicao | null | undefined
): AlimentoPersonalizadoEdicao | null | undefined {
  if (valor === undefined || valor === null) return valor;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(valor.id) || !uuid.test(valor.aplicacaoId) || !Number.isSafeInteger(valor.revisao) || valor.revisao < 1) {
    throw new Error('Referência de alimento personalizado inválida.');
  }
  return { id: valor.id, revisao: valor.revisao, aplicacaoId: valor.aplicacaoId };
}
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
export type MicronutrientesEdicao = Partial<Record<CodigoMicronutrienteApi, NumeroEdicao>>;
export function micronutrientesNumericosEdicao(valores: MicronutrientesEdicao | undefined): MicronutrientesPor100gApi {
  if (!valores) return {};
  return Object.fromEntries(Object.entries(valores).flatMap(([campo, valor]) => {
    if (typeof valor === 'string' && valor.trim() && !/^\d+(?:[.,]\d+)?(?:e[+-]?\d+)?$/i.test(valor.trim())) return [];
    const numero = interpretarNumeroEdicao(valor);
    return numero === undefined || numero < 0 ? [] : [[campo, numero]];
  })) as MicronutrientesPor100gApi;
}
export function validarMicronutrientesEdicao(valores: MicronutrientesEdicao | undefined): MicronutrientesPor100gApi {
  const normalizados = micronutrientesNumericosEdicao(valores);
  const possuiValorIncompleto = Object.entries(valores ?? {}).some(([codigo, valor]) => {
    if (valor == null || (typeof valor === 'string' && !valor.trim())) return false;
    return !Object.hasOwn(normalizados, codigo);
  });
  if (possuiValorIncompleto) throw new Error('Complete ou limpe os campos de micronutrientes antes de salvar em um modelo ou receita.');
  return normalizados;
}
export interface AlimentoEdicao {
  chaveCliente: string;
  alimentoComposicaoId?: string | null;
  alimentoPersonalizado?: AlimentoPersonalizadoEdicao | null;
  descricao?: string;
  quantidade?: NumeroEdicao;
  unidade?: string;
  porcaoGramas?: NumeroEdicao;
  nutrientesPor100g?: NutrientesEdicao;
  micronutrientesPor100g?: MicronutrientesEdicao;
  fonteRotulo?: string;
  /** Identidade do vínculo do rascunho; não é transportada a cópias. */
  medidaCaseira?: MedidaCaseiraAplicadaApi | null;
}
export interface AlternativaEdicao extends AlimentoEdicao { origemGrupo?: IntencaoGrupoSubstituicoesEdicao | null; equivalencia?: IntencaoEquivalenciaEdicao; liberadaParaPaciente?: boolean; preferida?: boolean }
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

export interface ReferenciaCopiaEquivalenciaEdicao {
  pacienteOrigemId: string;
  planoOrigemId: string;
  numeroVersaoOrigem: number;
  itemChaveOrigem: string;
  alternativaChaveOrigem: string;
  itemChaveDestino: string;
  alternativaChaveDestino: string;
}

export interface SalvarEdicaoPlanoEntrada extends PrecondicaoEdicaoPlano {
  documento: DocumentoEdicaoPlano;
  copiasEquivalencia?: ReferenciaCopiaEquivalenciaEdicao[];
}

/** Limite do documento; o envelope HTTP inteiro continua limitado a 100KiB. */
export const LIMITE_BYTES_DOCUMENTO_EDICAO = 96 * 1024;
