import type { PapelUsuario } from '../../auth/dominio/usuario-autenticado';
import type { ItemModeloPlanoAlimentar } from './modelos-plano-alimentar';

export const ORIGENS_RECEITA_NUTRICIONAL = ['pessoal', 'clinica'] as const;
export type OrigemReceitaNutricional = (typeof ORIGENS_RECEITA_NUTRICIONAL)[number];

export const TIPOS_RECEITA_NUTRICIONAL = ['receita', 'refeicao_pronta'] as const;
export type TipoReceitaNutricional = (typeof TIPOS_RECEITA_NUTRICIONAL)[number];

/**
 * Uma receita e aplicada expandindo estes itens em uma refeicao do rascunho.
 * Nao se grava uma referencia a receita no plano publicado: a versao continua
 * autocontida, imutavel e calculavel mesmo se a receita for arquivada depois.
 */
export interface ConteudoReceitaNutricional {
  instrucoes?: string;
  itens: ItemModeloPlanoAlimentar[];
}

export interface EscopoAcessoReceita {
  papel: PapelUsuario;
  profissionalId?: string;
}

export interface IdentidadeReceita {
  origem: OrigemReceitaNutricional;
  profissionalId?: string;
}

export function contarItensReceita(conteudo: ConteudoReceitaNutricional): number {
  if (!conteudo.itens.length) throw new Error('Receita precisa de ao menos um alimento.');
  return conteudo.itens.length;
}

export function podeAcessarReceita(receita: IdentidadeReceita, escopo: EscopoAcessoReceita): boolean {
  if (escopo.papel === 'SuperAdmin') return true;
  if (receita.origem === 'clinica') return true;
  return Boolean(escopo.profissionalId) && receita.profissionalId === escopo.profissionalId;
}

/** Ids de catalogo que precisam ser revalidados quando a receita for aplicada. */
export function resumirAlimentosDaReceita(conteudo: ConteudoReceitaNutricional): string[] {
  const ids = new Set<string>();
  for (const item of conteudo.itens) {
    if (item.alimentoComposicaoId) ids.add(item.alimentoComposicaoId);
    for (const substituicao of item.substituicoes ?? []) {
      if (substituicao.alimentoComposicaoId) ids.add(substituicao.alimentoComposicaoId);
    }
  }
  return [...ids];
}
