import { headers } from 'next/headers';
import { criarRequestIdBff, NOME_CABECALHO_CORRELACAO, normalizarRequestIdBff } from './correlacao-bff';

/**
 * Lado Node da correlacao: le o id que o `middleware.ts` fixou para a requisicao
 * em curso e monta o cabecalho de saida para o backend.
 *
 * Mora num modulo separado de `correlacao-bff.ts` porque aquele e importado pelo
 * middleware, que roda no runtime Edge e nao suporta `next/headers`. E mora
 * fora de `sessao-bff.ts` porque as rotas publicas (`/auth/login`, formularios
 * por token, agendamento publico) tambem precisam propagar o id e nao devem
 * arrastar cookie de sessao, MFA e permissao so para obter um cabecalho.
 */

/**
 * Quem garante que o valor nao veio do cliente e o middleware, que sobrescreve
 * o cabecalho incondicionalmente antes de entregar a requisicao ao BFF - o
 * matcher dele cobre todas as rotas de `app/api`. A verificacao de formato
 * aplicada aqui e o guarda residual: se algum caminho futuro chegar sem passar
 * pelo middleware, o unico valor externo que ainda seria aceito e um que ja
 * esteja no formato exato emitido pelo proprio BFF, o que barra injecao de
 * conteudo e crescimento descontrolado do valor gravado na trilha imutavel.
 */
// Um rastro por processo, nao um por chamada: ver o comentario no `catch`.
let rastroHeadersIndisponivelEmitido = false;

export async function obterRequestIdBff(): Promise<string> {
  try {
    const cabecalhos = await headers();
    return normalizarRequestIdBff(cabecalhos.get(NOME_CABECALHO_CORRELACAO));
  } catch (erro) {
    // Caso ESPERADO: fora do escopo de uma requisicao HTTP (script, job, teste)
    // nao ha id para herdar. Emitir um novo mantem a chamada rastreavel no
    // backend em vez de deixa-la sem correlacao nenhuma.
    //
    // Caso INESPERADO: se `headers()` passar a lancar DENTRO de uma requisicao
    // (contexto cacheado, `after()`, mudanca de versao do Next), cada chamada
    // cunharia um id DIFERENTE na MESMA requisicao e a correlacao quebraria
    // calada - exatamente a lacuna da EXC-AUD-004, so que agora invisivel.
    //
    // Os dois casos chegam aqui com o mesmo erro e nao ha como separa-los sem
    // depender da mensagem interna do Next, que muda entre versoes. Entao o que
    // se faz aqui e o minimo honesto: deixar rastro fora de producao, para que
    // a degradacao pare de ser totalmente silenciosa.
    //
    // Uma vez por processo, e nao por chamada, de proposito. A condicao e
    // estrutural - ou `headers()` funciona neste contexto ou nunca funciona -
    // entao a primeira ocorrencia ja carrega toda a informacao, e repetir por
    // chamada afogaria o aviso no proprio ruido (o que de fato acontecia: as
    // suites vizinhas que nao expoem `headers` no mock imprimiam dezenas de
    // linhas identicas, escondendo qualquer sinal real).
    if (process.env.NODE_ENV !== 'production' && !rastroHeadersIndisponivelEmitido) {
      rastroHeadersIndisponivelEmitido = true;
      console.warn(
        '[correlacao-bff] headers() indisponivel neste contexto; cada chamada emite um id proprio. ' +
          'Esperado fora de requisicao (script, job, teste); DENTRO de uma requisicao significa correlacao quebrada.',
        erro
      );
    }
    return criarRequestIdBff();
  }
}

export async function cabecalhosCorrelacaoBff(): Promise<Record<string, string>> {
  return { [NOME_CABECALHO_CORRELACAO]: await obterRequestIdBff() };
}
