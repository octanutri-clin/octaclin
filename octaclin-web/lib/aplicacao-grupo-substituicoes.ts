import type { IntencaoGrupoSubstituicoesEdicao } from './grupos-substituicoes-tipos';
import type { IntencaoEquivalenciaEdicao } from './equivalencias-plano-api';
import type { MedidaCaseiraAplicadaApi, MedidaCaseiraReferenciaApi } from './medidas-caseiras-plano';

export interface AlternativaAplicacaoGrupo {
  entradaId: string;
  origem: 'catalogo' | 'custom';
  alimentoId: string;
  revisao?: number;
  descricao: string;
  quantidade: number;
  unidade: string;
  porcaoGramas: number;
  nutrientesPor100g: Record<string, number>;
  micronutrientesPor100g?: Record<string, number>;
}

export interface AlternativaExistenteGrupo {
  origem: 'catalogo' | 'custom';
  alimentoId?: string;
  alimentoComposicaoId?: string;
  porcaoGramas: number | string;
}

export interface OpcaoAplicacaoGrupo extends AlternativaAplicacaoGrupo {
  estado: 'nova' | 'existente' | 'porcao-divergente';
}

export function prepararOpcoesAplicacaoGrupo(
  entradas: AlternativaAplicacaoGrupo[],
  existentes: AlternativaExistenteGrupo[],
  identidadePrincipal: { origem: 'catalogo' | 'custom'; alimentoId: string }
): OpcaoAplicacaoGrupo[] {
  const vistas = new Map<string, number[]>();
  return entradas.flatMap((entrada) => {
    if (entrada.origem === identidadePrincipal.origem && entrada.alimentoId === identidadePrincipal.alimentoId) return [];
    const identidade = `${entrada.origem}:${entrada.alimentoId}`;
    const iguais = existentes.filter((atual) => atual.origem === entrada.origem
      && (atual.alimentoId ?? atual.alimentoComposicaoId) === entrada.alimentoId);
    const anteriores = vistas.get(identidade) ?? [];
    const porcoesAnteriores = [...iguais.map((atual) => Number(atual.porcaoGramas)), ...anteriores];
    const exata = porcoesAnteriores.some((peso) => peso === entrada.porcaoGramas);
    vistas.set(identidade, [...anteriores, entrada.porcaoGramas]);
    return [{ ...entrada, estado: exata ? 'existente' : porcoesAnteriores.length ? 'porcao-divergente' : 'nova' }];
  });
}

export function criarAlternativasAplicadasGrupo(
  opcoes: OpcaoAplicacaoGrupo[],
  selecionadas: Set<string>,
  porcoes: Record<string, number>,
  intencao: Omit<IntencaoGrupoSubstituicoesEdicao, 'entradaId'>,
  gerarChave: () => string,
  confirmarDivergentes: Set<string> = new Set()
) {
  const alternativas = [] as Array<AlternativaAplicacaoGrupo & {
    chaveCliente: string; preferida: false; liberadaParaPaciente: false;
    origemGrupo: IntencaoGrupoSubstituicoesEdicao;
  }>;
  for (const opcao of opcoes) {
    if (!selecionadas.has(opcao.entradaId) || opcao.estado === 'existente') continue;
    if (opcao.estado === 'porcao-divergente' && !confirmarDivergentes.has(opcao.entradaId)) {
      throw new Error('Confirme explicitamente a inclusão da porção diferente da já existente.');
    }
    const porcaoGramas = porcoes[opcao.entradaId] ?? opcao.porcaoGramas;
    if (!Number.isFinite(porcaoGramas) || porcaoGramas <= 0 || porcaoGramas > 10000 || Math.round(porcaoGramas * 1000) !== porcaoGramas * 1000) {
      throw new Error('Informe porções válidas em gramas, com até três casas decimais.');
    }
    alternativas.push({
      ...opcao,
      quantidade: porcaoGramas,
      unidade: 'g',
      porcaoGramas,
      chaveCliente: gerarChave(),
      preferida: false,
      liberadaParaPaciente: false,
      origemGrupo: { ...intencao, entradaId: opcao.entradaId, ...(opcao.estado === 'porcao-divergente' ? { confirmarPorcaoDistinta: true } : {}) }
    });
  }
  return alternativas;
}

export type AlternativaAplicadaGrupo = ReturnType<typeof criarAlternativasAplicadasGrupo>[number] & {
  equivalencia?: IntencaoEquivalenciaEdicao;
  medidaCaseira?: MedidaCaseiraAplicadaApi | null;
  referenciaMedidaCaseira?: MedidaCaseiraReferenciaApi;
};
