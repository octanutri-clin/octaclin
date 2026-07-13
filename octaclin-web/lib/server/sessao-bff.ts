import { cookies } from 'next/headers';

const nomes = {
  accessToken: 'octaclin_access_token',
  refreshToken: 'octaclin_refresh_token',
  apiUrl: 'octaclin_api_url',
  tenantSlug: 'octaclin_tenant_slug',
  email: 'octaclin_email',
  expiraEm: 'octaclin_access_expira_em'
};

const cookieBase = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.OCTACLIN_COOKIE_SECURE === 'true',
  path: '/'
};

export interface RespostaToken {
  accessToken: string;
  refreshToken: string;
  tipoToken: 'Bearer';
  expiraEmSegundos: number;
}

export interface SessaoBff {
  apiUrl: string;
  tenantSlug: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiraEm: string;
}

export class ErroSessaoAusente extends Error {
  constructor() {
    super('Sessao ausente ou expirada.');
    this.name = 'ErroSessaoAusente';
  }
}

export class ErroApiUrlInvalida extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroApiUrlInvalida';
  }
}

function codificar(valor: string) {
  return encodeURIComponent(valor);
}

function decodificar(valor: string) {
  return decodeURIComponent(valor);
}

function expiraEm(resposta: RespostaToken) {
  return new Date(Date.now() + resposta.expiraEmSegundos * 1000).toISOString();
}

export function normalizarApiUrlBff(apiUrl: string): string {
  let url: URL;

  try {
    url = new URL(apiUrl);
  } catch {
    throw new ErroApiUrlInvalida('O campo API precisa ser uma URL completa, como http://localhost:3001.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new ErroApiUrlInvalida('O campo API aceita apenas URLs HTTP ou HTTPS.');
  }

  if (url.username || url.password) {
    throw new ErroApiUrlInvalida('O campo API nao pode conter usuario ou senha na URL.');
  }

  if (url.search || url.hash) {
    throw new ErroApiUrlInvalida('O campo API deve conter apenas origem e caminho base, sem query string ou hash.');
  }

  const origensPermitidas = (process.env.OCTACLIN_API_ORIGENS_PERMITIDAS ?? '')
    .split(',')
    .map((origem) => origem.trim().replace(/\/$/, ''))
    .filter(Boolean);

  if (origensPermitidas.length && !origensPermitidas.includes(url.origin)) {
    throw new ErroApiUrlInvalida('A origem informada no campo API nao esta autorizada para este ambiente.');
  }

  const caminhoBase = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '');
  return `${url.origin}${caminhoBase}`;
}

export function salvarSessaoBff(
  entrada: { apiUrl: string; tenantSlug: string; email: string },
  resposta: RespostaToken
) {
  const jar = cookies();
  const maxAge = 60 * 60 * 24 * 30;
  const apiUrlNormalizada = normalizarApiUrlBff(entrada.apiUrl);
  jar.set(nomes.accessToken, resposta.accessToken, { ...cookieBase, maxAge: resposta.expiraEmSegundos });
  jar.set(nomes.refreshToken, resposta.refreshToken, { ...cookieBase, maxAge });
  jar.set(nomes.apiUrl, codificar(apiUrlNormalizada), { ...cookieBase, maxAge });
  jar.set(nomes.tenantSlug, codificar(entrada.tenantSlug), { ...cookieBase, maxAge });
  jar.set(nomes.email, codificar(entrada.email), { ...cookieBase, maxAge });
  jar.set(nomes.expiraEm, expiraEm(resposta), { ...cookieBase, maxAge });
}

export function obterSessaoBff(): SessaoBff | null {
  const jar = cookies();
  const accessToken = jar.get(nomes.accessToken)?.value;
  const refreshToken = jar.get(nomes.refreshToken)?.value;
  const apiUrl = jar.get(nomes.apiUrl)?.value;
  const tenantSlug = jar.get(nomes.tenantSlug)?.value;
  const email = jar.get(nomes.email)?.value;
  const expiraEmValor = jar.get(nomes.expiraEm)?.value;

  if (!accessToken || !refreshToken || !apiUrl || !tenantSlug || !email || !expiraEmValor) return null;

  return {
    accessToken,
    refreshToken,
    apiUrl: decodificar(apiUrl),
    tenantSlug: decodificar(tenantSlug),
    email: decodificar(email),
    expiraEm: expiraEmValor
  };
}

export function limparSessaoBff() {
  const jar = cookies();
  Object.values(nomes).forEach((nome) => jar.delete(nome));
}

function sessaoExpiraEmBreve(sessao: SessaoBff, margemMs = 60_000) {
  return new Date(sessao.expiraEm).getTime() <= Date.now() + margemMs;
}

function respostaJsonBff(status: number, mensagem: string) {
  return new Response(JSON.stringify({ mensagem }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

async function normalizarRespostaBackend(resposta: Response, contexto: string): Promise<Response> {
  const tipoConteudo = resposta.headers.get('Content-Type') ?? '';
  if (!tipoConteudo.includes('text/html')) return resposta;

  await resposta.text();
  return respostaJsonBff(
    502,
    `${contexto}: backend retornou HTML em vez de JSON. Verifique se o campo API aponta para o backend OctaClin.`
  );
}

async function renovarSessao(sessao: SessaoBff): Promise<SessaoBff | null> {
  let resposta: Response;

  try {
    resposta = await fetch(`${normalizarApiUrlBff(sessao.apiUrl)}/auth/renovar`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: sessao.refreshToken }),
      cache: 'no-store'
    });
  } catch {
    limparSessaoBff();
    return null;
  }

  if (!resposta.ok) {
    limparSessaoBff();
    return null;
  }

  const tokens = (await resposta.json()) as RespostaToken;
  salvarSessaoBff(
    { apiUrl: sessao.apiUrl, tenantSlug: sessao.tenantSlug, email: sessao.email },
    tokens
  );

  return {
    ...sessao,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiraEm: expiraEm(tokens)
  };
}

export async function obterSessaoValidaBff(): Promise<SessaoBff> {
  const sessao = obterSessaoBff();
  if (!sessao) throw new ErroSessaoAusente();
  if (!sessaoExpiraEmBreve(sessao)) return sessao;

  const renovada = await renovarSessao(sessao);
  if (!renovada) throw new ErroSessaoAusente();
  return renovada;
}

export async function requisitarBackendAutenticado(caminho: string, init?: RequestInit): Promise<Response> {
  let sessao = await obterSessaoValidaBff();
  let apiUrl: string;

  try {
    apiUrl = normalizarApiUrlBff(sessao.apiUrl);
  } catch {
    limparSessaoBff();
    throw new ErroSessaoAusente();
  }

  const executar = () =>
    fetch(`${apiUrl}${caminho}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${sessao.accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...init?.headers
      },
      cache: 'no-store'
    });

  let resposta: Response;
  try {
    resposta = await executar();
  } catch {
    return respostaJsonBff(502, 'Nao foi possivel conectar ao backend configurado para esta sessao.');
  }

  if (resposta.status === 401) {
    const renovada = await renovarSessao(sessao);
    if (!renovada) throw new ErroSessaoAusente();
    sessao = renovada;
    try {
      resposta = await executar();
    } catch {
      return respostaJsonBff(502, 'Nao foi possivel conectar ao backend configurado para esta sessao.');
    }
  }

  return normalizarRespostaBackend(resposta, `Proxy BFF ${caminho}`);
}

export async function revogarSessaoAtual() {
  const sessao = obterSessaoBff();
  if (sessao) {
    try {
      await fetch(`${normalizarApiUrlBff(sessao.apiUrl)}/auth/sair`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: sessao.refreshToken }),
        cache: 'no-store'
      });
    } catch {
      // O logout local continua sendo a fonte de verdade para a interface web.
    }
  }

  limparSessaoBff();
}
