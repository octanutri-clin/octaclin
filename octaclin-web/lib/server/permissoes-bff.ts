export interface SessaoComPermissoes {
  permissoes?: string[];
}

export function sessaoPossuiPermissao(sessao: SessaoComPermissoes, permissao: string): boolean {
  return Array.isArray(sessao.permissoes) && sessao.permissoes.includes(permissao);
}
