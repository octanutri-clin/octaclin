import { obterContextoCorrelacao, obterRequestId, RequisicaoComContexto } from './contexto-requisicao';

interface RespostaComCabecalho {
  setHeader(nome: string, valor: string): void;
}

export function middlewareCorrelacao(
  requisicao: RequisicaoComContexto,
  resposta: RespostaComCabecalho,
  proximo: () => void
): void {
  requisicao.requestId = obterRequestId(requisicao.headers);
  requisicao.correlacao = obterContextoCorrelacao(requisicao);
  resposta.setHeader('x-request-id', requisicao.requestId);
  proximo();
}
