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

export function criarHeadersProxyPublico(requisicao?: Request): Headers {
  const headers = new Headers();
  headers.set('Accept', 'application/json');

  const contentType = requisicao?.headers.get('Content-Type');
  if (contentType) {
    headers.set('Content-Type', contentType);
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
      urlPublica: `${origin}/agendar/${encodeURIComponent(tokenAtual)}`,
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
      'URL atual indisponivel nesta sessao. Por seguranca, o token bruto nao e persistido. Rotacione com confirmacao para gerar uma nova URL publica.'
  };
}
