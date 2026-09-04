import { cabecalhosCorrelacaoBff } from './correlacao-requisicao-bff';

export interface LinkAgendaPublicaBackend {
  id: string;
  profissionalId: string;
  duracaoMinutos: number;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface LinkAgendaPublicaBff extends LinkAgendaPublicaBackend {
  urlPublica: string | null;
  urlPublicaDisponivel: boolean;
  requerRotacaoConfirmada: boolean;
  mensagemUrlPublica: string;
}

/**
 * Em producao, o Next pode receber internamente uma origem localhost do proxy.
 * A URL explicita garante que o link entregue ao paciente continue publico.
 */
export function obterOrigemPublicaAgenda(originDaRequisicao: string): string {
  const origemConfigurada =
    process.env.OCTACLIN_WEB_URL?.trim() ?? process.env.NEXT_PUBLIC_WEB_URL?.trim() ?? process.env.RENDER_EXTERNAL_URL?.trim();
  return (origemConfigurada || originDaRequisicao).replace(/\/$/, '');
}

/**
 * Assincrona porque o id de correlacao so pode ser lido de `headers()`, que no
 * Next 16 e assincrono. Manter uma variante sincrona ao lado foi descartado:
 * seriam dois helpers para o mesmo proxy, e o que esquecesse de propagar o id
 * voltaria a produzir chamada sem correlacao - exatamente a lacuna que a
 * EXC-AUD-004 registra. Um helper so, sempre correlacionado, e o unico desenho
 * em que a propagacao nao depende de o proximo autor lembrar dela.
 *
 * O cabecalho e montado com `Headers`, cujo `set` e case-insensitive: o unico
 * nome que o cliente controla aqui e o `Content-Type` copiado da requisicao, e
 * ele nao pode colidir com o de correlacao em nenhuma grafia. A ordem das
 * chamadas abaixo NAO faz parte dessa protecao - sao nomes diferentes, e
 * inverte-las nao muda o resultado. Quem depende de ordem e
 * `requisitarBackendAutenticado` em `sessao-bff.ts`, onde o chamador entrega
 * `init?.headers` inteiro e pode repetir o proprio nome do cabecalho.
 */
export async function criarHeadersProxyPublico(requisicao?: Request): Promise<Headers> {
  const headers = new Headers();
  headers.set('Accept', 'application/json');

  const contentType = requisicao?.headers.get('Content-Type');
  if (contentType) {
    headers.set('Content-Type', contentType);
  }

  for (const [nome, valor] of Object.entries(await cabecalhosCorrelacaoBff())) {
    headers.set(nome, valor);
  }

  return headers;
}

export function montarLinkAgendaPublicaBff(
  origin: string,
  link: LinkAgendaPublicaBackend,
  tokenAtual?: string
): LinkAgendaPublicaBff {
  if (tokenAtual) {
    return {
      ...link,
      urlPublica: `${obterOrigemPublicaAgenda(origin)}/agendar/${encodeURIComponent(tokenAtual)}`,
      urlPublicaDisponivel: true,
      requerRotacaoConfirmada: false,
      mensagemUrlPublica: 'URL publica disponivel ate nova rotacao confirmada.'
    };
  }

  // O backend preserva apenas o hash do token; sem o token bruto nao existe reconstrucao segura da URL atual.
  return {
    ...link,
    urlPublica: null,
    urlPublicaDisponivel: false,
    requerRotacaoConfirmada: true,
    mensagemUrlPublica:
      'URL atual indisponível nesta sessão. Por segurança, o token bruto não é persistido. Rotacione com confirmação para gerar uma nova URL pública.'
  };
}
