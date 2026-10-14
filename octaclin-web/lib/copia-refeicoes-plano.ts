import type {
  NutrientesPor100gApi,
  RefeicaoPlanoAlimentarApi,
  SubstituicaoPlanoAlimentarEntrada
} from '@/lib/plano-alimentar-api';

export const LIMITE_REFEICOES_PLANO = 50;
export const LIMITE_ITENS_REFEICAO = 100;
export const LIMITE_SUBSTITUICOES_ITEM = 20;

export interface AlimentoFormularioCopia extends SubstituicaoPlanoAlimentarEntrada {
  chaveCliente: string;
  descricao: string;
  nutrientesPor100g: NutrientesPor100gApi;
  fonteRotulo?: string;
}

export interface AlternativaFormularioCopia extends AlimentoFormularioCopia {
  liberadaParaPaciente: boolean;
  preferida: boolean;
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
export interface AlimentoFormularioCopiaFonte extends Omit<AlimentoFormularioCopia, 'nutrientesPor100g'> {
  nutrientesPor100g: Partial<NutrientesPor100gApi>;
}

export interface AlternativaFormularioCopiaFonte extends AlimentoFormularioCopiaFonte {
  liberadaParaPaciente: boolean;
  preferida: boolean;
}

export interface ItemFormularioCopiaFonte extends AlimentoFormularioCopiaFonte {
  substituicoes: AlternativaFormularioCopiaFonte[];
  substituicoesVisiveisInicialmente?: number;
}

export interface RefeicaoFormularioCopiaFonte extends Omit<RefeicaoFormularioCopia, 'itens'> {
  itens: ItemFormularioCopiaFonte[];
}

export type GerarChaveCopia = (prefixo: 'refeicao' | 'alimento') => string;

function validarNutrientes(nutrientes: Partial<NutrientesPor100gApi> | undefined): NutrientesPor100gApi {
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
  return {
    chaveCliente: gerarChave('alimento'),
    alimentoComposicaoId: alimento.alimentoComposicaoId,
    descricao: alimento.descricao,
    quantidade: alimento.quantidade,
    unidade: alimento.unidade,
    porcaoGramas: alimento.porcaoGramas,
    nutrientesPor100g: validarNutrientes(alimento.nutrientesPor100g),
    fonteRotulo: alimento.fonteRotulo
  };
}

function copiarItemFormulario(item: ItemFormularioCopiaFonte, gerarChave: GerarChaveCopia): ItemFormularioCopia {
  if (item.substituicoes.length > LIMITE_SUBSTITUICOES_ITEM) {
    throw new Error(`A refeição excede o limite de ${LIMITE_SUBSTITUICOES_ITEM} substituições por alimento.`);
  }
  const base = copiarAlimento(item, gerarChave);
  return {
    ...base,
    substituicoes: item.substituicoes.map((substituicao) => ({
      ...copiarAlimento(substituicao, gerarChave),
      liberadaParaPaciente: substituicao.liberadaParaPaciente,
      preferida: substituicao.preferida
    })),
    substituicoesVisiveisInicialmente: item.substituicoesVisiveisInicialmente
  };
}

export function copiarRefeicaoParaFormulario(
  refeicao: RefeicaoPlanoAlimentarApi,
  gerarChave: GerarChaveCopia
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
      fonteRotulo: item.composicaoSnapshot.fonte
        ? `${item.composicaoSnapshot.fonte.nome} - ${item.composicaoSnapshot.fonte.versao}`
        : undefined
    };
    if ((item.substituicoes?.length ?? 0) > LIMITE_SUBSTITUICOES_ITEM) {
      throw new Error(`A refeição excede o limite de ${LIMITE_SUBSTITUICOES_ITEM} substituições por alimento.`);
    }
    return {
      ...base,
      chaveCliente: gerarChave('alimento'),
      substituicoes: (item.substituicoes ?? []).map((substituicao) => {
        const substituicaoBase: AlimentoFormularioCopia = {
          chaveCliente: '',
          alimentoComposicaoId: substituicao.alimentoComposicaoId,
          descricao: substituicao.descricao || substituicao.composicaoSnapshot.descricao,
          quantidade: substituicao.quantidade,
          unidade: substituicao.unidade,
          porcaoGramas: substituicao.porcaoGramas,
          nutrientesPor100g: validarNutrientes(substituicao.composicaoSnapshot?.nutrientesPor100g),
          fonteRotulo: substituicao.composicaoSnapshot.fonte
            ? `${substituicao.composicaoSnapshot.fonte.nome} - ${substituicao.composicaoSnapshot.fonte.versao}`
            : undefined
        };
        return {
          ...substituicaoBase,
          chaveCliente: gerarChave('alimento'),
          liberadaParaPaciente: substituicao.liberadaParaPaciente === true,
          preferida: substituicao.preferida === true
        };
      }),
      substituicoesVisiveisInicialmente: item.substituicoesVisiveisInicialmente
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
