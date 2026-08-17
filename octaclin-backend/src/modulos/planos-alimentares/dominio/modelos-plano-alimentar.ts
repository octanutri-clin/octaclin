import type { PapelUsuario } from '../../auth/dominio/usuario-autenticado';

/**
 * Origens suportadas de modelo de plano alimentar.
 *
 * `catalogo` esta deliberadamente fora: um modelo fornecido pelo sistema viveria
 * em codigo, e nesse caso ele nao pode guardar `alimentoComposicaoId`, porque o
 * UUID de `alimentos_composicao` e gerado por banco e difere entre a base de
 * integracao e a de producao. Um modelo de catalogo portavel precisa referenciar
 * alimento por `(fonte, versao, base, codigo_origem)` — o par unico que a Fase
 * 234 ja garante — e resolver o UUID no momento de aplicar. Fica para quando
 * essa resolucao existir.
 */
export const ORIGENS_MODELO_PLANO_ALIMENTAR = ['pessoal', 'clinica'] as const;

export type OrigemModeloPlanoAlimentar = (typeof ORIGENS_MODELO_PLANO_ALIMENTAR)[number];

/** Item do modelo: mesmo formato aceito pelo rascunho, para aplicar sem traducao. */
export interface ItemModeloPlanoAlimentar {
  alimentoComposicaoId?: string;
  descricao?: string;
  quantidade: number;
  unidade: string;
  porcaoGramas: number;
  nutrientesPor100g?: Record<string, number | undefined>;
  substituicoes?: ItemModeloPlanoAlimentar[];
}

export interface RefeicaoModeloPlanoAlimentar {
  nome: string;
  horarioLocal?: string;
  orientacoes?: string;
  itens: ItemModeloPlanoAlimentar[];
}

export interface EscopoAcessoModelo {
  papel: PapelUsuario;
  /** `undefined` quando o usuario nao tem profissional resolvido no tenant. */
  profissionalId?: string;
}

export interface IdentidadeModelo {
  origem: OrigemModeloPlanoAlimentar;
  profissionalId?: string;
}

export function contarEstruturaModelo(
  refeicoes: RefeicaoModeloPlanoAlimentar[]
): { totalRefeicoes: number; totalItens: number } {
  if (!refeicoes.length) {
    throw new Error('Modelo precisa de ao menos uma refeicao.');
  }
  // Conta so os itens principais: substituicao e alternativa de um item, nao um
  // item a mais no plano, e contar as duas juntas inflaria o resumo da listagem.
  const totalItens = refeicoes.reduce((soma, refeicao) => soma + refeicao.itens.length, 0);
  if (!totalItens) {
    throw new Error('Modelo precisa de ao menos um alimento.');
  }
  return { totalRefeicoes: refeicoes.length, totalItens };
}

export function podeAcessarModelo(modelo: IdentidadeModelo, escopo: EscopoAcessoModelo): boolean {
  // SuperAdmin sem filtro, igual ao resto do modulo de planos alimentares.
  if (escopo.papel === 'SuperAdmin') return true;
  if (modelo.origem === 'clinica') return true;
  // Modelo pessoal so para o dono. Sem profissional resolvido nao ha dono
  // possivel, entao nega em vez de deixar passar por comparacao indefinida.
  return Boolean(escopo.profissionalId) && modelo.profissionalId === escopo.profissionalId;
}

/** Ids de catalogo usados pelo modelo, para revalidar contra as fontes ativas. */
export function resumirAlimentosDoModelo(refeicoes: RefeicaoModeloPlanoAlimentar[]): string[] {
  const ids = new Set<string>();
  for (const refeicao of refeicoes) {
    for (const item of refeicao.itens) {
      if (item.alimentoComposicaoId) ids.add(item.alimentoComposicaoId);
      for (const substituicao of item.substituicoes ?? []) {
        if (substituicao.alimentoComposicaoId) ids.add(substituicao.alimentoComposicaoId);
      }
    }
  }
  return [...ids];
}
