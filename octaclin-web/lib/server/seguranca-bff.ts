const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

export class ErroConfiguracaoSegurancaBff extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroConfiguracaoSegurancaBff';
  }
}

function normalizarOrigemConfigurada(valor: string, exigirHttps: boolean, nomeVariavel: string): string {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new ErroConfiguracaoSegurancaBff(`${nomeVariavel} deve conter apenas origens HTTP(S) validas.`);
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new ErroConfiguracaoSegurancaBff(`${nomeVariavel} deve conter apenas origens HTTP(S) validas.`);
  }
  const hostLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (exigirHttps && url.protocol !== 'https:' && !(url.protocol === 'http:' && hostLoopback)) {
    throw new ErroConfiguracaoSegurancaBff(`${nomeVariavel} deve usar HTTPS em producao.`);
  }
  if (url.pathname !== '/' || url.search || url.hash || valor.replace(/\/$/, '') !== url.origin) {
    throw new ErroConfiguracaoSegurancaBff(`${nomeVariavel} deve conter origens, sem caminho, credencial, query ou hash.`);
  }

  return url.origin;
}

function lerOrigens(nomeVariavel: string, exigirHttps: boolean, ambiente: NodeJS.ProcessEnv): string[] {
  const origens = (ambiente[nomeVariavel] ?? '')
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean)
    .map((origem) => normalizarOrigemConfigurada(origem, exigirHttps, nomeVariavel));

  return [...new Set(origens)];
}

function origemEncaminhada(request: Pick<Request, 'headers' | 'url'>): string | undefined {
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host'))?.split(',')[0]?.trim();
  if (!host || /[\s/\\]/.test(host)) return undefined;

  const protocoloEncaminhado = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  let protocolo = protocoloEncaminhado;
  if (!protocolo) {
    try {
      protocolo = new URL(request.url).protocol.replace(':', '');
    } catch {
      return undefined;
    }
  }
  if (!['http', 'https'].includes(protocolo)) return undefined;

  try {
    return new URL(`${protocolo}://${host}`).origin;
  } catch {
    return undefined;
  }
}

export function validarConfiguracaoSegurancaBff(ambiente: NodeJS.ProcessEnv = process.env) {
  const producao = ambiente.NODE_ENV === 'production';
  const cookieSecure = ambiente.OCTACLIN_COOKIE_SECURE === 'true';
  const origensApiPermitidas = lerOrigens('OCTACLIN_API_ORIGENS_PERMITIDAS', producao, ambiente);

  if (producao && !cookieSecure) {
    throw new ErroConfiguracaoSegurancaBff('OCTACLIN_COOKIE_SECURE=true e obrigatorio em producao.');
  }
  if (producao && !origensApiPermitidas.length) {
    throw new ErroConfiguracaoSegurancaBff('OCTACLIN_API_ORIGENS_PERMITIDAS e obrigatoria em producao.');
  }

  return { cookieSecure, origensApiPermitidas };
}

export function origemMutacaoPermitida(
  request: Pick<Request, 'headers' | 'method' | 'url'>,
  ambiente: NodeJS.ProcessEnv = process.env
): boolean {
  if (METODOS_SEGUROS.has(request.method.toUpperCase())) return true;

  const origemInformada = request.headers.get('origin');
  if (!origemInformada) return false;

  const contextoNavegacao = request.headers.get('sec-fetch-site');
  if (contextoNavegacao && contextoNavegacao !== 'same-origin') return false;

  let origemNormalizada: string;
  try {
    origemNormalizada = normalizarOrigemConfigurada(origemInformada, false, 'Origin');
  } catch {
    return false;
  }

  // Sec-Fetch-Site e controlado pelo navegador e evita depender da origem
  // interna reconstruida pelo Next quando a aplicacao esta atras de proxy.
  if (contextoNavegacao === 'same-origin') return true;

  const origensPermitidas = new Set<string>();
  try {
    origensPermitidas.add(new URL(request.url).origin);
    const encaminhada = origemEncaminhada(request);
    if (encaminhada) origensPermitidas.add(encaminhada);
    for (const origem of lerOrigens(
      'OCTACLIN_WEB_ORIGENS_PERMITIDAS',
      ambiente.NODE_ENV === 'production',
      ambiente
    )) {
      origensPermitidas.add(origem);
    }
  } catch {
    return false;
  }

  return origensPermitidas.has(origemNormalizada);
}
