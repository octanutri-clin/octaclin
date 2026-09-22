import type { PapelUsuario } from '../../auth/dominio/usuario-autenticado';

/**
 * Mesmo vocabulario de origem dos modelos de plano alimentar (Fase 269):
 * `pessoal` pertence a um profissional, `clinica` e compartilhado no tenant.
 */
export const ORIGENS_MODELO_EVOLUCAO_CLINICA = ['pessoal', 'clinica'] as const;

export type OrigemModeloEvolucaoClinica = (typeof ORIGENS_MODELO_EVOLUCAO_CLINICA)[number];

export interface EscopoAcessoModeloEvolucao {
  papel: PapelUsuario;
  /** `undefined` quando o usuario nao tem profissional resolvido no tenant. */
  profissionalId?: string;
}

export interface IdentidadeModeloEvolucao {
  origem: OrigemModeloEvolucaoClinica;
  profissionalId?: string;
}

export function podeAcessarModeloEvolucao(
  modelo: IdentidadeModeloEvolucao,
  escopo: EscopoAcessoModeloEvolucao
): boolean {
  if (escopo.papel === 'SuperAdmin') return true;
  if (modelo.origem === 'clinica') return true;
  // Modelo pessoal so para o dono. Sem profissional resolvido nao ha dono
  // possivel, entao nega em vez de deixar passar por comparacao indefinida.
  return Boolean(escopo.profissionalId) && modelo.profissionalId === escopo.profissionalId;
}
