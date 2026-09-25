import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';

export interface CamposOperacaoIndexaveis {
  categoria?: string;
  origem?: string;
  tags?: string[];
}

export function gerarIndicesPerfilPaciente(
  criptografia: CriptografiaDadosSensiveis,
  tenantId: string,
  dados: CamposOperacaoIndexaveis
): string[] {
  const hashes: string[] = [];
  for (const campo of ['categoria', 'origem'] as const) {
    if (dados[campo]?.trim()) hashes.push(criptografia.gerarHashPerfilExato(tenantId, campo, dados[campo]));
  }
  for (const tag of dados.tags ?? []) {
    if (tag.trim()) hashes.push(criptografia.gerarHashPerfilExato(tenantId, 'tag', tag));
  }
  return [...new Set(hashes)];
}
