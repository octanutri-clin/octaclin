import { selecionarItensCombinados, type EntradaPlanoCombinado } from './calculo-combinado';
import { classificarContribuicao } from './cobertura-dietetica';
import { CODIGOS_MICRONUTRIENTES, type CodigoMicronutriente } from './micronutrientes';

export type TipoFonteNutriente = 'TACO' | 'USDA' | 'IBGE' | 'manual' | 'custom';
export interface FonteNutrienteDietetica {
  tipo: TipoFonteNutriente;
  codigo?: string;
  versao?: string;
  quantidade: number;
}
export interface FontesNutrienteDietetica {
  /** Itens que o classificador de cobertura conta como conhecidos (inclui zero conhecido). */
  contribuintes: number;
  fontes: FonteNutrienteDietetica[];
  /** Contribuintes conhecidos cuja origem congelada não é utilizável; nunca presumida. */
  semOrigemDocumentada: number;
  /** Contribuintes de grupos além do limite de detalhamento. */
  fontesNaoDetalhadas: number;
}
export interface FontesPorNutrienteDietetica {
  schemaVersao: 1;
  /** Origem do registro de composição congelado, não prova de medição por nutriente. */
  vinculo: 'origem_do_registro_de_composicao';
  nutrientes: Record<CodigoMicronutriente, FontesNutrienteDietetica>;
}
export const LIMITE_GRUPOS_FONTE_POR_NUTRIENTE = 50;

type Origem = Pick<FonteNutrienteDietetica, 'tipo' | 'codigo' | 'versao'>;
const BASES_CATALOGO: readonly string[] = ['TACO', 'USDA', 'IBGE'];
const CODIGO_FONTE = /^[A-Za-z0-9_.-]{1,80}$/;
const VERSAO_FONTE = /^\d+(?:[._-]\d+){0,7}$/;

function objeto(valor: unknown): Record<string, unknown> | undefined {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor as Record<string, unknown> : undefined;
}
/**
 * Somente metadados congelados no próprio snapshot. Nada é completado pelo catálogo
 * atual: código ou versão ausentes/malformados permanecem desconhecidos.
 */
function origemDoItem(item: unknown): Origem | undefined {
  const snapshot = objeto(item);
  if (!snapshot) return undefined;
  if (snapshot.origem === 'manual' || snapshot.origem === 'custom') return { tipo: snapshot.origem };
  if (snapshot.origem !== 'catalogo') return undefined;
  const fonte = objeto(snapshot.fonte);
  if (!fonte || typeof fonte.baseCodigo !== 'string' || !BASES_CATALOGO.includes(fonte.baseCodigo)) return undefined;
  const codigo = typeof fonte.codigo === 'string' && CODIGO_FONTE.test(fonte.codigo) ? fonte.codigo : undefined;
  const versao = typeof fonte.versao === 'string' && fonte.versao.length <= 64 && VERSAO_FONTE.test(fonte.versao) ? fonte.versao : undefined;
  return { tipo: fonte.baseCodigo as TipoFonteNutriente, ...(codigo ? { codigo } : {}), ...(versao ? { versao } : {}) };
}
const comparar = (a?: string, b?: string) => (a ?? '').localeCompare(b ?? '', 'pt-BR', { numeric: true });

/**
 * Origem registrada dos contribuintes conhecidos, por nutriente. Usa a mesma seleção e o
 * mesmo classificador da cobertura, sem consultar catálogo, direitos ou contexto clínico.
 * Projeção interna por allowlist; o vínculo é com o registro de composição do item.
 */
export function analisarFontesPorNutriente(planos: EntradaPlanoCombinado[]): FontesPorNutrienteDietetica {
  const { itens } = selecionarItensCombinados(planos);
  const origens = itens.map(origemDoItem);
  const nutrientes = Object.fromEntries(CODIGOS_MICRONUTRIENTES.map(codigo => {
    const grupos = new Map<string, FonteNutrienteDietetica>();
    let contribuintes = 0, semOrigemDocumentada = 0;
    itens.forEach((item, indice) => {
      if (classificarContribuicao(item, codigo).contagem !== 'conhecidos') return;
      contribuintes++;
      const origem = origens[indice];
      if (!origem) { semOrigemDocumentada++; return; }
      const chave = JSON.stringify([origem.tipo, origem.codigo, origem.versao]);
      const existente = grupos.get(chave);
      if (existente) existente.quantidade++;
      else grupos.set(chave, { tipo: origem.tipo, ...(origem.codigo ? { codigo: origem.codigo } : {}), ...(origem.versao ? { versao: origem.versao } : {}), quantidade: 1 });
    });
    const ordenados = [...grupos.values()].sort((a, b) => comparar(a.tipo, b.tipo) || comparar(a.codigo, b.codigo) || comparar(a.versao, b.versao));
    const resultado: FontesNutrienteDietetica = {
      contribuintes,
      fontes: ordenados.slice(0, LIMITE_GRUPOS_FONTE_POR_NUTRIENTE),
      semOrigemDocumentada,
      fontesNaoDetalhadas: ordenados.slice(LIMITE_GRUPOS_FONTE_POR_NUTRIENTE).reduce((n, f) => n + f.quantidade, 0)
    };
    return [codigo, resultado];
  })) as unknown as FontesPorNutrienteDietetica['nutrientes'];
  return { schemaVersao: 1, vinculo: 'origem_do_registro_de_composicao', nutrientes };
}
