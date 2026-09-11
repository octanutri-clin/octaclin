/**
 * Erro compartilhado para chamadas ao BFF (`app/api/**`).
 *
 * `requestId` vem do cabecalho `x-request-id` que o middleware grava em toda
 * resposta do BFF (ver `lib/server/correlacao-bff.ts`) e que o backend usa
 * para correlacionar a mesma requisicao em `user_action_logs.metadados.
 * requestId`. Propagar esse valor ate o erro deixa o usuario reportar um
 * identificador que liga a falha vista na tela a linha correspondente na
 * trilha de auditoria e nos logs estruturados, sem expor PHI: o valor e um
 * UUID aleatorio, sem relacao com sessao, tenant ou conteudo clinico.
 */
export class ErroApi extends Error {
  constructor(
    public readonly status: number,
    mensagem: string,
    public readonly requestId?: string
  ) {
    super(mensagem);
    this.name = 'ErroApi';
  }
}

export async function lancarErroApi(resposta: Response): Promise<never> {
  const detalhe = await resposta.text();
  const requestId = resposta.headers.get('x-request-id') ?? undefined;
  throw new ErroApi(resposta.status, detalhe || `Falha HTTP ${resposta.status}`, requestId);
}
