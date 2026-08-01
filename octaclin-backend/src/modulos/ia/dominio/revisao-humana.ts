export type DecisaoRevisaoIa = 'aceita' | 'editada' | 'rejeitada';

export interface RevisaoHumanaIa {
  status: 'pendente' | DecisaoRevisaoIa;
  revisadoPor?: string;
  revisadoEm?: string;
  observacao?: string;
  conteudoEditado?: Record<string, unknown>;
}

export function criarRevisaoHumana(
  decisao: DecisaoRevisaoIa,
  usuarioId: string,
  observacao?: string,
  conteudoEditado?: Record<string, unknown>
): RevisaoHumanaIa {
  return {
    status: decisao,
    revisadoPor: usuarioId,
    revisadoEm: new Date().toISOString(),
    ...(observacao ? { observacao } : {}),
    ...(conteudoEditado ? { conteudoEditado } : {})
  };
}
