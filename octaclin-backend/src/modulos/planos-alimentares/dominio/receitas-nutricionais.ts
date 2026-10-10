import type { PapelUsuario } from '../../auth/dominio/usuario-autenticado';
import type { ItemModeloPlanoAlimentar } from './modelos-plano-alimentar';

export const ORIGENS_RECEITA_NUTRICIONAL = ['pessoal', 'clinica'] as const;
export type OrigemReceitaNutricional = (typeof ORIGENS_RECEITA_NUTRICIONAL)[number];

export const TIPOS_RECEITA_NUTRICIONAL = ['receita', 'refeicao_pronta'] as const;
export type TipoReceitaNutricional = (typeof TIPOS_RECEITA_NUTRICIONAL)[number];
export const CATEGORIA_RECEITA_MAX = 80;

export function normalizarCategoriaReceita(valor: string): string {
  if (typeof valor !== 'string') throw new Error('Categoria da receita invalida.');
  const categoria = valor.trim().replace(/\s+/g, ' ');
  if (!categoria || categoria.length > CATEGORIA_RECEITA_MAX || /[\u0000-\u001f\u007f]/.test(categoria) ||
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(categoria) ||
      /\b\d{8,}\b/.test(categoria) ||
      /\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/i.test(categoria)) {
    throw new Error('Categoria da receita invalida.');
  }
  return categoria;
}

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
