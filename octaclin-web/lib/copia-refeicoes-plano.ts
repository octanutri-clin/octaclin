import { interpretarNumeroEdicao, nutrientesNumericosEdicao, type MicronutrientesEdicao, type NutrientesEdicao } from './edicao-plano';
import type { IntencaoEquivalenciaEdicao } from './equivalencias-plano-api';
import type {
  NutrientesPor100gApi,
  MicronutrientesPor100gApi,
  RefeicaoPlanoAlimentarApi,
  SubstituicaoPlanoAlimentarEntrada
} from '@/lib/plano-alimentar-api';

export const LIMITE_REFEICOES_PLANO = 50;
export const LIMITE_ITENS_REFEICAO = 100;
export const LIMITE_SUBSTITUICOES_ITEM = 20;

export interface AlimentoFormularioCopia extends Omit<SubstituicaoPlanoAlimentarEntrada, 'micronutrientesPor100g'> {
  chaveCliente: string;
  descricao: string;
  nutrientesPor100g: NutrientesPor100gApi;
  fonteRotulo?: string;
  micronutrientesPor100g?: MicronutrientesEdicao;
}

export interface AlternativaFormularioCopia extends AlimentoFormularioCopia {
  liberadaParaPaciente: boolean;
  preferida: boolean;
  provenienciaEquivalencia?: true;
  origemCopiaEquivalencia?: {
    pacienteOrigemId: string;
    planoOrigemId: string;
    versaoIdOrigem: string;
    numeroVersaoOrigem: number;
    rascunhoRevisaoOrigemEsperada?: number;
    itemChaveOrigem: string;
    alternativaChaveOrigem: string;
  };
}

export interface ItemFormularioCopia extends AlimentoFormularioCopia {
  substituicoes: AlternativaFormularioCopia[];
  substituicoesVisiveisInicialmente?: number;
}

export interface RefeicaoFormularioCopia {
  chaveCliente: string;
  nome: string;
  horarioLocal?: string;
  orientacoes?: string;
  itens: ItemFormularioCopia[];
}

/** Forma de leitura do editor: campos podem estar em edição e incompletos. */
export interface AlimentoFormularioCopiaFonte extends Omit<AlimentoFormularioCopia, 'nutrientesPor100g' | 'micronutrientesPor100g' | 'quantidade' | 'porcaoGramas'> {
  quantidade: number | string;
  porcaoGramas: number | string;
  nutrientesPor100g: NutrientesEdicao;
  micronutrientesPor100g?: MicronutrientesEdicao;
}

export interface AlternativaFormularioCopiaFonte extends AlimentoFormularioCopiaFonte {
  liberadaParaPaciente: boolean;
  preferida: boolean;
  provenienciaEquivalencia?: true;
  equivalencia?: IntencaoEquivalenciaEdicao;
  origemCopiaEquivalencia?: AlternativaFormularioCopia['origemCopiaEquivalencia'];
}

export interface ItemFormularioCopiaFonte extends AlimentoFormularioCopiaFonte {
  substituicoes: AlternativaFormularioCopiaFonte[];
  substituicoesVisiveisInicialmente?: number | string;
}

export interface RefeicaoFormularioCopiaFonte extends Omit<RefeicaoFormularioCopia, 'itens'> {
  itens: ItemFormularioCopiaFonte[];
}

export type GerarChaveCopia = (prefixo: 'refeicao' | 'alimento') => string;

function validarNutrientes(valores: NutrientesEdicao | undefined): NutrientesPor100gApi {
  if (valores && Object.values(valores).some(valor => valor !== undefined && interpretarNumeroEdicao(valor) === undefined)) {
    throw new Error('A refeição contém valores nutricionais incompletos.');
  }
  const nutrientes = valores ? nutrientesNumericosEdicao(valores) : undefined;
  const essenciais = ['energiaKcal', 'proteinasG', 'carboidratosG', 'gordurasG'] as const;
  if (!nutrientes || essenciais.some((chave) => !Number.isFinite(nutrientes[chave]))) {
    throw new Error('A refeição não pode ser copiada porque contém um snapshot nutricional incompleto.');
  }
  if (Object.values(nutrientes).some((valor) => valor !== undefined && !Number.isFinite(valor))) {
    throw new Error('A refeição não pode ser copiada porque contém valores nutricionais inválidos.');
  }
  return { ...nutrientes } as NutrientesPor100gApi;
}

function copiarAlimento(
  alimento: AlimentoFormularioCopiaFonte,
  gerarChave: GerarChaveCopia
): AlimentoFormularioCopia {
  const quantidade = interpretarNumeroEdicao(alimento.quantidade);
  const porcaoGramas = interpretarNumeroEdicao(alimento.porcaoGramas);
  if (quantidade === undefined || porcaoGramas === undefined || quantidade <= 0 || porcaoGramas <= 0) {
    throw new Error('Complete a quantidade e a porção antes de copiar a refeição.');
  }
  return {
    chaveCliente: gerarChave('alimento'),
    alimentoComposicaoId: alimento.alimentoComposicaoId,
    descricao: alimento.descricao,
    quantidade,
    unidade: alimento.unidade,
    porcaoGramas,
    nutrientesPor100g: validarNutrientes(alimento.nutrientesPor100g),
    ...(!alimento.alimentoComposicaoId && alimento.micronutrientesPor100g ? { micronutrientesPor100g: { ...alimento.micronutrientesPor100g } } : {}),
    fonteRotulo: alimento.fonteRotulo
  };
}

function copiarItemFormulario(item: ItemFormularioCopiaFonte, gerarChave: GerarChaveCopia): ItemFormularioCopia {
  if (item.substituicoes.length > LIMITE_SUBSTITUICOES_ITEM) {
    throw new Error(`A refeição excede o limite de ${LIMITE_SUBSTITUICOES_ITEM} substituições por alimento.`);
  }
  if (item.substituicoes.some((substituicao) => (substituicao.provenienciaEquivalencia === true && !substituicao.origemCopiaEquivalencia) || substituicao.equivalencia !== undefined)) {
    throw new Error('Esta refeição contém equivalência FOOD05. A cópia está bloqueada até preservar a proveniência do cálculo.');
  }
  const base = copiarAlimento(item, gerarChave);
  return {
    ...base,
    substituicoes: item.substituicoes.map((substituicao) => {
      const alternativa = copiarAlimento(substituicao, gerarChave);
      return {
        ...alternativa,
        liberadaParaPaciente: substituicao.liberadaParaPaciente,
        preferida: substituicao.preferida,
        ...(substituicao.origemCopiaEquivalencia ? {
          provenienciaEquivalencia: true as const,
          origemCopiaEquivalencia: { ...substituicao.origemCopiaEquivalencia }
        } : {})
      };
    }),
    substituicoesVisiveisInicialmente: interpretarNumeroEdicao(item.substituicoesVisiveisInicialmente)
  };
}

export function copiarRefeicaoParaFormulario(
  refeicao: RefeicaoPlanoAlimentarApi,
  gerarChave: GerarChaveCopia,
  origem?: { pacienteId: string; planoId: string; versaoId: string; numeroVersao: number; rascunhoRevisao?: number }
): RefeicaoFormularioCopia {
  if (refeicao.itens.length > LIMITE_ITENS_REFEICAO) {
    throw new Error(`A refeição excede o limite de ${LIMITE_ITENS_REFEICAO} alimentos.`);
  }
  const itens = refeicao.itens.map((item) => {
    const nutrientes = validarNutrientes(item.composicaoSnapshot?.nutrientesPor100g);
    const base: AlimentoFormularioCopia = {
      chaveCliente: '',
      alimentoComposicaoId: item.alimentoComposicaoId,
      descricao: item.descricao || item.composicaoSnapshot.descricao,
      quantidade: item.quantidade,
      unidade: item.unidade,
      porcaoGramas: item.porcaoGramas,
      nutrientesPor100g: nutrientes,
      ...(!item.alimentoComposicaoId && item.composicaoSnapshot.micronutrientes ? { micronutrientesPor100g: Object.fromEntries(Object.entries(item.composicaoSnapshot.micronutrientes.nutrientes).flatMap(([codigo, valor]) => valor.estado === 'conhecido' && valor.por100g !== undefined ? [[codigo, valor.por100g]] : [])) as MicronutrientesPor100gApi } : {}),
      fonteRotulo: item.composicaoSnapshot.fonte
        ? `${item.composicaoSnapshot.fonte.nome} - ${item.composicaoSnapshot.fonte.versao}`
        : undefined
    };
    if ((item.substituicoes?.length ?? 0) > LIMITE_SUBSTITUICOES_ITEM) {
      throw new Error(`A refeição excede o limite de ${LIMITE_SUBSTITUICOES_ITEM} substituições por alimento.`);
    }
    const itemDestinoChave = gerarChave('alimento');
    return {
      ...base,
      chaveCliente: itemDestinoChave,
      substituicoes: (item.substituicoes ?? []).map((substituicao) => {
        if (substituicao.equivalenciaAplicada && (!origem || !substituicao.referenciaEquivalencia?.itemChave || !substituicao.referenciaEquivalencia.alternativaChave)) {
          throw new Error('Esta refeição contém equivalência FOOD05 sem referência de origem verificável; a cópia foi cancelada.');
        }
        const substituicaoBase: AlimentoFormularioCopia = {
          chaveCliente: '',
          alimentoComposicaoId: substituicao.alimentoComposicaoId,
          descricao: substituicao.descricao || substituicao.composicaoSnapshot.descricao,
          quantidade: substituicao.quantidade,
          unidade: substituicao.unidade,
          porcaoGramas: substituicao.porcaoGramas,
          nutrientesPor100g: validarNutrientes(substituicao.composicaoSnapshot?.nutrientesPor100g),
          ...(!substituicao.alimentoComposicaoId && substituicao.composicaoSnapshot?.micronutrientes ? { micronutrientesPor100g: Object.fromEntries(Object.entries(substituicao.composicaoSnapshot.micronutrientes.nutrientes).flatMap(([codigo, valor]) => valor.estado === 'conhecido' && valor.por100g !== undefined ? [[codigo, valor.por100g]] : [])) as MicronutrientesPor100gApi } : {}),
          fonteRotulo: substituicao.composicaoSnapshot.fonte
            ? `${substituicao.composicaoSnapshot.fonte.nome} - ${substituicao.composicaoSnapshot.fonte.versao}`
            : undefined
        };
        const alternativaDestinoChave = gerarChave('alimento');
        const equivalenciaCopiada = substituicao.equivalenciaAplicada === true;
        return {
          ...substituicaoBase,
          chaveCliente: alternativaDestinoChave,
          liberadaParaPaciente: equivalenciaCopiada ? false : substituicao.liberadaParaPaciente === true,
          preferida: equivalenciaCopiada ? false : substituicao.preferida === true,
          ...(substituicao.equivalenciaAplicada && origem && substituicao.referenciaEquivalencia ? {
            provenienciaEquivalencia: true as const,
            origemCopiaEquivalencia: {
              pacienteOrigemId: origem.pacienteId,
              planoOrigemId: origem.planoId,
              versaoIdOrigem: origem.versaoId,
              numeroVersaoOrigem: origem.numeroVersao,
              ...(origem.rascunhoRevisao !== undefined ? { rascunhoRevisaoOrigemEsperada: origem.rascunhoRevisao } : {}),
              itemChaveOrigem: substituicao.referenciaEquivalencia.itemChave,
              alternativaChaveOrigem: substituicao.referenciaEquivalencia.alternativaChave
            }
          } : {})
        };
      }),
      substituicoesVisiveisInicialmente: interpretarNumeroEdicao(item.substituicoesVisiveisInicialmente)
    };
  });

  return {
    chaveCliente: gerarChave('refeicao'),
    nome: refeicao.nome,
    horarioLocal: refeicao.horarioLocal?.slice(0, 5) ?? '',
    orientacoes: refeicao.orientacoes ?? '',
    itens
  };
}

export function duplicarRefeicaoNoRascunho(
  refeicoes: RefeicaoFormularioCopiaFonte[],
  indice: number,
  gerarChave: GerarChaveCopia
): RefeicaoFormularioCopiaFonte[] {
  if (refeicoes.length >= LIMITE_REFEICOES_PLANO) {
    throw new Error(`O plano atingiu o limite de ${LIMITE_REFEICOES_PLANO} refeições.`);
  }
  const original = refeicoes[indice];
  if (!original) throw new Error('Não foi possível localizar a refeição selecionada. Atualize a tela e tente novamente.');
  const copia: RefeicaoFormularioCopiaFonte = {
    chaveCliente: gerarChave('refeicao'),
    nome: original.nome,
    horarioLocal: original.horarioLocal,
    orientacoes: original.orientacoes,
    itens: original.itens.map((item) => copiarItemFormulario(item, gerarChave))
  };
  return [...refeicoes.slice(0, indice + 1), copia, ...refeicoes.slice(indice + 1)];
}

export function acrescentarItensDeRefeicao(
  destino: RefeicaoFormularioCopiaFonte,
  itensOrigem: ItemFormularioCopiaFonte[],
  gerarChave: GerarChaveCopia
): RefeicaoFormularioCopiaFonte {
  if (destino.itens.length + itensOrigem.length > LIMITE_ITENS_REFEICAO) {
    throw new Error(`A refeição selecionada excederia o limite de ${LIMITE_ITENS_REFEICAO} alimentos.`);
  }
  const itens = itensOrigem.map((item) => copiarItemFormulario(item, gerarChave));
  return { ...destino, itens: [...destino.itens, ...itens] };
}
