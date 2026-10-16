import { CodigoMicronutriente, CODIGOS_MICRONUTRIENTES } from './micronutrientes';
import { FormulaEnergetica, MetodoMacrosManual } from './calculo-nutricional';
import { PreferenciasApresentacaoPlano, validarPreferenciasApresentacao } from './apresentacao-plano';

export type NumeroEdicao = number | string | null;
export type NutrientesEdicao = Partial<Record<'energiaKcal' | 'proteinasG' | 'carboidratosG' | 'gordurasG' | 'fibrasG' | 'sodioMg', NumeroEdicao>>;
export interface AlimentoEdicao {
  chaveCliente: string;
  alimentoComposicaoId?: string | null;
  descricao?: string;
  quantidade?: NumeroEdicao;
  unidade?: string;
  porcaoGramas?: NumeroEdicao;
  nutrientesPor100g?: NutrientesEdicao;
  micronutrientesPor100g?: Partial<Record<CodigoMicronutriente, NumeroEdicao>>;
  fonteRotulo?: string;
}
export interface AlternativaEdicao extends AlimentoEdicao { liberadaParaPaciente?: boolean; preferida?: boolean }
export interface ItemEdicao extends AlimentoEdicao { substituicoes?: AlternativaEdicao[]; substituicoesVisiveisInicialmente?: NumeroEdicao }
export interface RefeicaoEdicao { chaveCliente: string; nome?: string; horarioLocal?: string; orientacoes?: string; itens: ItemEdicao[] }
export interface DocumentoEdicaoPlano {
  schemaVersao: 1;
  avaliacaoAntropometricaId?: string | null;
  formula?: FormulaEnergetica | '';
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
  metodoMacrosManual?: MetodoMacrosManual | '';
  metaEnergeticaManualKcal?: NumeroEdicao;
  carboidratosGPorKg?: NumeroEdicao;
  proteinasGPorKg?: NumeroEdicao;
  gordurasGPorKg?: NumeroEdicao;
  justificativaDivergenciaClinica?: string;
  objetivos?: string;
  observacoes?: string;
  preferenciasApresentacao?: PreferenciasApresentacaoPlano;
  refeicoes: RefeicaoEdicao[];
}

// Reserva espaço para a precondição no parser HTTP existente de 100KiB.
export const LIMITE_BYTES_EDICAO_PLANO = 96 * 1024;
const camposNumero = ['fatorAtividade', 'ajusteEnergeticoKcal', 'carboidratosBasisPoints', 'proteinasBasisPoints', 'gordurasBasisPoints', 'metaEnergeticaManualKcal', 'carboidratosGPorKg', 'proteinasGPorKg', 'gordurasGPorKg'];
const camposAlimento = ['chaveCliente', 'alimentoComposicaoId', 'descricao', 'quantidade', 'unidade', 'porcaoGramas', 'nutrientesPor100g', 'micronutrientesPor100g', 'fonteRotulo'];
const camposNutriente = ['energiaKcal', 'proteinasG', 'carboidratosG', 'gordurasG', 'fibrasG', 'sodioMg'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function falhar(): never { throw new Error('Documento de edição do plano inválido.'); }
function objeto(valor: unknown, permitidos: string[]): Record<string, unknown> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) falhar();
  const proto = Object.getPrototypeOf(valor);
  if (proto !== Object.prototype && proto !== null) falhar();
  if (Object.keys(valor).some(chave => !permitidos.includes(chave))) falhar();
  return valor as Record<string, unknown>;
}
function texto(valor: unknown, limite: number, obrigatorio = false): void {
  if (valor === undefined && !obrigatorio) return;
  if (typeof valor !== 'string' || valor.length > limite || (obrigatorio && !valor.trim())) falhar();
}
function numero(valor: unknown): void {
  if (valor === undefined || valor === null) return;
  if (typeof valor === 'number' && Number.isFinite(valor) && Math.abs(valor) <= 1_000_000_000) return;
  if (typeof valor === 'string' && valor.length <= 32 && /^-?\d*(?:[.,]\d*)?$/.test(valor.trim())) return;
  falhar();
}
function referencia(valor: unknown): void {
  if (valor === undefined || valor === null || valor === '') return;
  if (typeof valor !== 'string' || !uuid.test(valor)) falhar();
}
function booleano(valor: unknown): void {
  if (valor !== undefined && typeof valor !== 'boolean') falhar();
}
function lista(valor: unknown, maximo: number): unknown[] {
  if (!Array.isArray(valor) || valor.length > maximo) falhar();
  return valor;
}

/** Valida a estrutura editorial; não atribui validade clínica a campos incompletos. */
export function validarDocumentoEdicaoPlano(valor: unknown): DocumentoEdicaoPlano {
  const d = objeto(valor, ['schemaVersao', 'avaliacaoAntropometricaId', 'formula', 'percentuaisMacrosEdicao', ...camposNumero, 'possuiCondicaoEspecial', 'aplicabilidadeFormulaConfirmada', 'justificativaCondicaoEspecial', 'metodoMacrosManual', 'justificativaDivergenciaClinica', 'objetivos', 'observacoes', 'preferenciasApresentacao', 'refeicoes']);
  if (d.schemaVersao !== 1 || Buffer.byteLength(JSON.stringify(d), 'utf8') > LIMITE_BYTES_EDICAO_PLANO) falhar();
  referencia(d.avaliacaoAntropometricaId);
  if (d.formula !== undefined && !['', 'mifflin_st_jeor_1990', 'harris_benedict_revisada_1984', 'fao_oms_unu_1985'].includes(d.formula as string)) falhar();
  if (d.metodoMacrosManual !== undefined && !['', 'percentual', 'gramas_por_kg'].includes(d.metodoMacrosManual as string)) falhar();
  for (const campo of camposNumero) numero(d[campo]);
  if (d.percentuaisMacrosEdicao !== undefined) {
    const percentuais = objeto(d.percentuaisMacrosEdicao, ['carboidratosBasisPoints', 'proteinasBasisPoints', 'gordurasBasisPoints']);
    for (const v of Object.values(percentuais)) numero(v);
  }
  for (const campo of ['possuiCondicaoEspecial', 'aplicabilidadeFormulaConfirmada']) booleano(d[campo]);
  for (const campo of ['objetivos', 'justificativaCondicaoEspecial', 'justificativaDivergenciaClinica']) texto(d[campo], 4000);
  texto(d.observacoes, 8000);
  if (d.preferenciasApresentacao !== undefined) validarPreferenciasApresentacao(d.preferenciasApresentacao);
  const chaves = new Set<string>();
  function chave(v: unknown) {
    texto(v, 100, true);
    if (chaves.has(v as string)) falhar();
    chaves.add(v as string);
  }
  function alimento(v: unknown, extras: string[]) {
    const a = objeto(v, [...camposAlimento, ...extras]);
    chave(a.chaveCliente); referencia(a.alimentoComposicaoId);
    texto(a.descricao, 240); texto(a.unidade, 40); texto(a.fonteRotulo, 300);
    numero(a.quantidade); numero(a.porcaoGramas);
    if (a.nutrientesPor100g !== undefined) {
      const nutrientes = objeto(a.nutrientesPor100g, camposNutriente);
      for (const n of Object.values(nutrientes)) numero(n);
    }
    if (a.micronutrientesPor100g !== undefined) {
      const micros = objeto(a.micronutrientesPor100g, CODIGOS_MICRONUTRIENTES);
      for (const v of Object.values(micros)) numero(v);
    }
    return a;
  }
  for (const v of lista(d.refeicoes, 50)) {
    const r = objeto(v, ['chaveCliente', 'nome', 'horarioLocal', 'orientacoes', 'itens']);
    chave(r.chaveCliente); texto(r.nome, 180); texto(r.horarioLocal, 8); texto(r.orientacoes, 2000);
    for (const item of lista(r.itens, 100)) {
      const i = alimento(item, ['substituicoes', 'substituicoesVisiveisInicialmente']);
      numero(i.substituicoesVisiveisInicialmente);
      for (const alt of lista(i.substituicoes ?? [], 20)) {
        const a = alimento(alt, ['liberadaParaPaciente', 'preferida']);
        booleano(a.liberadaParaPaciente); booleano(a.preferida);
      }
    }
  }
  // Cópia impede alias mutável entre quem enviou, o retorno e a persistência.
  return JSON.parse(JSON.stringify(d)) as DocumentoEdicaoPlano;
}

export function numeroEdicao(valor: NumeroEdicao | undefined): number | undefined {
  if (valor === null || valor === undefined || (typeof valor === 'string' && !valor.trim())) return undefined;
  const n = typeof valor === 'string' ? Number(valor.trim().replace(',', '.')) : valor;
  return Number.isFinite(n) ? n : undefined;
}
