import {
  calcularHashConteudoCatalogo,
  limitarPrecisaoNutriente,
  type CatalogoFonteNormalizado,
  type RegistroCatalogoFonte
} from './catalogo-composicao-fonte';

export interface LinhaIbgePof {
  codigoAlimento: string;
  nomeAlimento: string;
  codigoPreparacao: string;
  nomePreparacao: string;
  referenciaCodigo: string;
  referenciaDescricao: string;
  nutrientes: Record<string, number | string | null>;
  numeroLinha?: number;
}

export interface EntradaIbgePof {
  versao: string;
  checksumArquivo: string;
  capturadaEm: string;
  urlArtefato?: string;
  referencias?: Record<string, string>;
  metadadosOrigem?: Record<string, unknown>;
  linhas: LinhaIbgePof[];
}

const COLUNAS = {
  energiaKcal: ['ENERGIA (kcal)'],
  proteinasG: ['PROTEÍNA (g)', 'PROTEINA (g)'],
  lipidiosG: ['LIPÍDEOS TOTAIS (g)', 'LIPIDEOS TOTAIS (g)'],
  carboidratosG: ['CARBOIDRATO (g)'],
  fibrasG: ['FIBRA ALIMENTAR TOTAL (g)'],
  sodioMg: ['SÓDIO (mg)', 'SODIO (mg)']
} as const;

function normalizarChave(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
}

export function normalizarNutrienteIbge(valor: number | string | null): number | null {
  if (valor === null || valor === undefined || valor === '' || valor === '-') return null;
  const texto = typeof valor === 'string' ? valor.trim() : String(valor);
  if (!texto || texto === '-') return null;
  if (!/^-?\d+(?:[.,]\d+)?$/.test(texto)) throw new Error('Valor nutricional IBGE inválido.');
  const numero = Number(texto.replace(',', '.'));
  if (!Number.isFinite(numero)) throw new Error('Valor nutricional IBGE inválido.');
  if (numero < 0) throw new Error('Valor nutricional IBGE negativo.');
  return limitarPrecisaoNutriente(numero);
}

function localizarNutriente(
  nutrientes: Record<string, number | string | null>,
  aliases: readonly string[]
): number | null {
  const porChave = new Map(Object.entries(nutrientes).map(([chave, valor]) => [normalizarChave(chave), valor]));
  const chave = aliases.map(normalizarChave).find((alias) => porChave.has(alias));
  return chave === undefined ? null : normalizarNutrienteIbge(porChave.get(chave)!);
}

function validarCodigo(codigo: string, campo: string): string {
  const normalizado = codigo.trim();
  if (!/^\d+$/.test(normalizado)) throw new Error(`Código IBGE inválido: ${campo}.`);
  return normalizado;
}

export function montarCatalogoIbgePof(entrada: EntradaIbgePof): CatalogoFonteNormalizado {
  if (!/^[0-9a-f]{64}$/i.test(entrada.checksumArquivo)) throw new Error('Checksum do arquivo IBGE inválido.');
  if (!entrada.versao.trim()) throw new Error('Versão IBGE ausente.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entrada.capturadaEm) || Number.isNaN(Date.parse(`${entrada.capturadaEm}T00:00:00Z`))) {
    throw new Error('Data de captura IBGE inválida.');
  }
  if (!entrada.linhas.length) throw new Error('Arquivo IBGE sem linhas de alimentos.');

  const registros = entrada.linhas.map((linha): RegistroCatalogoFonte => {
    const codigoAlimento = validarCodigo(linha.codigoAlimento, 'alimento');
    const codigoPreparacao = validarCodigo(linha.codigoPreparacao, 'preparação');
    const nome = linha.nomeAlimento.trim();
    const preparacao = linha.nomePreparacao.trim();
    if (!nome || !preparacao) throw new Error('Registro IBGE sem nome ou preparação.');
    const nutrientesOriginais: Record<string, number | string | null> = {};
    const nutrientesNormalizados: Record<string, number | null> = {};
    for (const [nomeNutriente, valor] of Object.entries(linha.nutrientes)) {
      const chave = nomeNutriente.trim();
      if (chave in nutrientesOriginais) throw new Error(`Nutriente IBGE duplicado: ${chave}.`);
      nutrientesOriginais[chave] = valor;
      nutrientesNormalizados[chave] = normalizarNutrienteIbge(valor);
    }
    const referenciaCodigo = linha.referenciaCodigo.trim();
    const registro: RegistroCatalogoFonte = {
      externalId: `${codigoAlimento}:${codigoPreparacao}`,
      nome: nome.slice(0, 240),
      preparacao: preparacao.slice(0, 180),
      baseGramas: 100,
      nutrientes: {
        energiaKcal: localizarNutriente(linha.nutrientes, COLUNAS.energiaKcal),
        proteinasG: localizarNutriente(linha.nutrientes, COLUNAS.proteinasG),
        lipidiosG: localizarNutriente(linha.nutrientes, COLUNAS.lipidiosG),
        carboidratosG: localizarNutriente(linha.nutrientes, COLUNAS.carboidratosG),
        fibrasG: localizarNutriente(linha.nutrientes, COLUNAS.fibrasG),
        sodioMg: localizarNutriente(linha.nutrientes, COLUNAS.sodioMg)
      },
      metadadosOrigem: {
        codigoAlimento,
        nomeAlimento: nome,
        codigoPreparacao,
        nomePreparacao: preparacao,
        referenciaCodigo,
        referenciaDescricao: linha.referenciaDescricao.trim(),
        fonteReferencia: entrada.referencias?.[referenciaCodigo] ?? null,
        numeroLinhaPlanilha: linha.numeroLinha ?? null,
        unidadeBase: 'por 100 gramas de parte comestível',
        nutrientesOriginais,
        nutrientesNormalizados
      }
    };
    return registro;
  });
  registros.sort((a, b) => (a.externalId < b.externalId ? -1 : a.externalId > b.externalId ? 1 : 0));
  const ids = new Set<string>();
  for (const registro of registros) {
    if (ids.has(registro.externalId)) throw new Error(`Identificador IBGE duplicado: ${registro.externalId}.`);
    ids.add(registro.externalId);
  }

  const fonte = {
    codigo: 'ibge_pof_2008_2009',
    nome: 'IBGE — POF 2008–2009: Tabelas de Composição Nutricional',
    instituicao: 'Instituto Brasileiro de Geografia e Estatística',
    versao: entrada.versao.trim(),
    baseCodigo: 'pof-2008-2009-composicao',
    urlFonte: 'https://www.ibge.gov.br/estatisticas/sociais/populacao/24786-pesquisa-de-orcamentos-familiares-2.html',
    urlArtefato:
      entrada.urlArtefato ??
      'https://ftp.ibge.gov.br/Orcamentos_Familiares/Pesquisa_de_Orcamentos_Familiares_2008_2009/Tabelas_de_Composicao_Nutricional_dos_Alimentos_Consumidos_no_Brasil/tabelacompleta.zip',
    licenca: 'Uso autorizado pelo proprietário; referência documental informada no momento da carga.',
    checksumArquivo: entrada.checksumArquivo.toLowerCase(),
    hashConteudo: calcularHashConteudoCatalogo(registros),
    capturadaEm: `${entrada.capturadaEm}T00:00:00.000Z`,
    esquemaVersao: 'octaclin-composicao-v1',
    contagem: { registros: registros.length },
    metadadosOrigem: entrada.metadadosOrigem ?? {}
  };
  return { fonte, registros };
}
