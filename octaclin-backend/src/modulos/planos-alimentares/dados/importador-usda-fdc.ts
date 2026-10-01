import {
  calcularHashConteudoCatalogo,
  limitarPrecisaoNutriente,
  type CatalogoFonteNormalizado,
  type RegistroCatalogoFonte
} from './catalogo-composicao-fonte';

type NutrienteUsda = {
  nutrient?: { id?: number; name?: string; unitName?: string };
  amount?: number | null;
  loq?: number | null;
  [campo: string]: unknown;
};

type AlimentoUsda = {
  fdcId?: number;
  dataType?: string;
  description?: string;
  foodCategory?: { description?: string };
  foodNutrients?: NutrienteUsda[];
  foodAttributes?: unknown[];
  foodPortions?: unknown[];
  ndbNumber?: number;
  foodClass?: string;
  publicationDate?: string;
  [campo: string]: unknown;
};

export interface OpcoesImportacaoUsda {
  base: 'foundation-foods' | 'sr-legacy';
  versao: string;
  capturadaEm: string;
  checksumArquivo?: string;
  urlArtefato?: string;
}

const RAIZES_POR_BASE = {
  'foundation-foods': { raiz: 'FoundationFoods', tipo: 'Foundation', codigo: 'usda_fdc_foundation' },
  'sr-legacy': { raiz: 'SRLegacyFoods', tipo: 'SR Legacy', codigo: 'usda_fdc_sr_legacy' }
} as const;

function numeroValido(valor: unknown, campo: string): number | null {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new Error(`Valor USDA inválido em ${campo}.`);
  }
  if (valor < 0) return null;
  return limitarPrecisaoNutriente(valor);
}

function obterNutrientes(alimento: AlimentoUsda): Map<number, NutrienteUsda> {
  const nutrientes = new Map<number, NutrienteUsda>();
  for (const item of alimento.foodNutrients ?? []) {
    const id = item.nutrient?.id;
    if (!Number.isInteger(id) || id! <= 0) continue;
    if (nutrientes.has(id!)) {
      const existente = nutrientes.get(id!)!;
      if ([1003, 1004, 1005, 1008, 1079, 1093, 2047, 2048].includes(id!)) {
        throw new Error(`Nutriente essencial USDA duplicado (${id}) no FDC ${alimento.fdcId}.`);
      }
      // Nutrientes adicionais repetidos permanecem preservados na lista de origem.
      if (existente === item) throw new Error('Nutriente USDA inválido.');
      continue;
    }
    nutrientes.set(id!, item);
  }
  return nutrientes;
}

function valorNutriente(
  nutrientes: Map<number, NutrienteUsda>,
  ids: readonly number[],
  unidadeEsperada: string,
  fdcId: number
): number | null {
  const item = ids.map((id) => nutrientes.get(id)).find((valor) => valor !== undefined);
  if (!item) return null;
  const unidade = item.nutrient?.unitName?.trim().toLowerCase();
  if (unidade !== unidadeEsperada) {
    throw new Error(`Unidade USDA inesperada no FDC ${fdcId}: ${unidade ?? 'ausente'}.`);
  }
  if (item.amount === null || item.amount === undefined) return null;
  const valor = numeroValido(item.amount, `nutriente ${item.nutrient?.id}, FDC ${fdcId}`);
  if (valor === null) return null;
  const loq = item.loq;
  if (valor === 0 && typeof loq === 'number' && loq > 0) return null;
  return valor;
}

function converterAlimento(alimento: AlimentoUsda, opcoes: OpcoesImportacaoUsda): RegistroCatalogoFonte {
  const id = alimento.fdcId;
  const config = RAIZES_POR_BASE[opcoes.base];
  if (!Number.isSafeInteger(id) || id! <= 0) throw new Error('FDC ID USDA ausente ou inválido.');
  if (alimento.dataType !== config.tipo) {
    throw new Error(`Tipo de dado USDA inválido para ${opcoes.base}: ${alimento.dataType ?? 'ausente'}.`);
  }
  const nome = alimento.description?.trim();
  if (!nome) throw new Error(`Alimento USDA sem descrição (FDC ${id}).`);
  const nutrientes = obterNutrientes(alimento);
  const energiaIds = opcoes.base === 'foundation-foods' ? [2048, 2047] : [1008];
  const referenciaEnergia = nutrientes.get(energiaIds.find((nutrienteId) => nutrientes.has(nutrienteId))!);
  const registro: RegistroCatalogoFonte = {
    externalId: String(id),
    nome: nome.slice(0, 240),
    baseGramas: 100,
    nutrientes: {
      energiaKcal: valorNutriente(nutrientes, energiaIds, 'kcal', id!),
      proteinasG: valorNutriente(nutrientes, [1003], 'g', id!),
      lipidiosG: valorNutriente(nutrientes, [1004], 'g', id!),
      carboidratosG: valorNutriente(nutrientes, [1005], 'g', id!),
      fibrasG: valorNutriente(nutrientes, [1079], 'g', id!),
      sodioMg: valorNutriente(nutrientes, [1093], 'mg', id!)
    },
    metadadosOrigem: {
      fdcId: id,
      dataType: alimento.dataType,
      release: opcoes.versao,
      publicationDate: alimento.publicationDate ?? null,
      categoria: alimento.foodCategory?.description ?? null,
      foodCategory: alimento.foodCategory ?? null,
      foodClass: alimento.foodClass ?? null,
      ndbNumber: alimento.ndbNumber ?? null,
      energia: referenciaEnergia?.nutrient?.name ?? null,
      nutrientsOriginal: alimento.foodNutrients ?? [],
      nutrientesNegativos: (alimento.foodNutrients ?? [])
        .filter((nutriente) => typeof nutriente.amount === 'number' && nutriente.amount < 0)
        .map((nutriente) => ({
          nutrientId: nutriente.nutrient?.id ?? null,
          nome: nutriente.nutrient?.name ?? null,
          unidade: nutriente.nutrient?.unitName ?? null,
          amount: nutriente.amount
        })),
      foodAttributes: alimento.foodAttributes ?? [],
      foodPortions: alimento.foodPortions ?? []
    }
  };
  return registro;
}

export function montarCatalogoUsda(
  entrada: unknown,
  opcoes: OpcoesImportacaoUsda
): CatalogoFonteNormalizado {
  const config = RAIZES_POR_BASE[opcoes.base];
  if (!opcoes.versao.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(opcoes.capturadaEm)) {
    throw new Error('Release e data de captura USDA são obrigatórias.');
  }
  if (!opcoes.checksumArquivo || !/^[0-9a-f]{64}$/i.test(opcoes.checksumArquivo)) {
    throw new Error('Checksum SHA-256 do arquivo USDA é obrigatório.');
  }
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) {
    throw new Error('JSON USDA inválido.');
  }
  const dados = entrada as Record<string, unknown>;
  const alimentosBrutos = dados[config.raiz];
  if (!Array.isArray(alimentosBrutos) || !alimentosBrutos.length) {
    throw new Error(`JSON USDA sem a raiz ${config.raiz}.`);
  }
  const outros = Object.keys(RAIZES_POR_BASE).map((chave) => RAIZES_POR_BASE[chave as keyof typeof RAIZES_POR_BASE].raiz)
    .filter((raiz) => raiz !== config.raiz && raiz in dados);
  if (outros.length) throw new Error('O JSON USDA contém mais de uma base; importe cada release separadamente.');

  const registros: RegistroCatalogoFonte[] = [];
  let nulosIgnorados = 0;
  let umidadeZeroExcluida = 0;
  let registrosComNutrientesNegativos = 0;
  for (const bruto of alimentosBrutos) {
    if (bruto === null) {
      nulosIgnorados += 1;
      continue;
    }
    if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) throw new Error('Registro USDA inválido.');
    const alimento = bruto as AlimentoUsda;
    if (opcoes.base === 'foundation-foods' && /0\s*%\s*moisture/i.test(alimento.description ?? '')) {
      umidadeZeroExcluida += 1;
      continue;
    }
    if ((alimento.foodNutrients ?? []).some((nutriente) => typeof nutriente.amount === 'number' && nutriente.amount < 0)) {
      registrosComNutrientesNegativos += 1;
    }
    registros.push(converterAlimento(alimento, opcoes));
  }
  registros.sort((a, b) => Number(a.externalId) - Number(b.externalId));
  const ids = new Set<string>();
  for (const registro of registros) {
    if (ids.has(registro.externalId)) throw new Error(`FDC ID USDA duplicado: ${registro.externalId}.`);
    ids.add(registro.externalId);
  }

  const fonte = {
    codigo: config.codigo,
    nome: `FoodData Central (USDA) — ${opcoes.base === 'foundation-foods' ? 'Foundation Foods' : 'SR Legacy'}`,
    instituicao: 'United States Department of Agriculture',
    versao: opcoes.versao.trim(),
    baseCodigo: opcoes.base,
    urlFonte: 'https://fdc.nal.usda.gov/',
    urlArtefato:
      opcoes.urlArtefato ?? 'https://fdc.nal.usda.gov/download-datasets/',
    licenca: 'CC0 1.0; atribuição recomendada: USDA FoodData Central.',
    checksumArquivo: opcoes.checksumArquivo ?? '',
    hashConteudo: calcularHashConteudoCatalogo(registros),
    capturadaEm: opcoes.capturadaEm,
    esquemaVersao: 'octaclin-composicao-v1',
    contagem: {
      recebidos: alimentosBrutos.length,
      registros: registros.length,
      registrosNulosIgnorados: nulosIgnorados,
      foundationBaseUmidadeZeroExcluidos: umidadeZeroExcluida,
      registrosComNutrientesNegativos
    },
    metadadosOrigem: { conjunto: config.raiz, tipoEsperado: config.tipo }
  };
  return { fonte, registros };
}
