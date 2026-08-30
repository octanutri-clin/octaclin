import { NextRequest, NextResponse } from 'next/server';
import {
  decidirAcessoRota,
  resolverDestinoPermitido,
  sanitizarDestinoInicial
} from './lib/server/autorizacao-rotas';
import { origemMutacaoPermitida } from './lib/server/seguranca-bff';
import { criarNonceCsp, criarPoliticaConteudo } from './lib/server/csp';

const COOKIE_ACCESS_TOKEN = 'octaclin_access_token';
const COOKIE_REFRESH_TOKEN = 'octaclin_refresh_token';
const COOKIE_DESTINO_INICIAL = 'octaclin_destino_inicial';
const COOKIE_PAPEL = 'octaclin_papel';
const COOKIE_PERMISSOES = 'octaclin_permissoes';
const ROTAS_PROTEGIDAS = [
  '/dashboard',
  '/agenda',
  '/operacoes',
  '/questionarios',
  '/comunicacoes',
  '/automacoes',
  '/ia',
  '/mobile',
  '/gamificacao',
  '/pacientes',
  '/profissionais',
  '/portal',
  '/cliente'
];

function possuiSessao(request: NextRequest) {
  return Boolean(request.cookies.get(COOKIE_ACCESS_TOKEN)?.value && request.cookies.get(COOKIE_REFRESH_TOKEN)?.value);
}

function destinoInicial(request: NextRequest) {
  const valor = request.cookies.get(COOKIE_DESTINO_INICIAL)?.value;

  try {
    return sanitizarDestinoInicial(valor ? decodeURIComponent(valor) : undefined);
  } catch {
    return '/operacoes';
  }
}

function papelSessao(request: NextRequest) {
  const valor = request.cookies.get(COOKIE_PAPEL)?.value;
  if (!valor) return undefined;

  try {
    return decodeURIComponent(valor);
  } catch {
    return undefined;
  }
}

function permissoesSessao(request: NextRequest) {
  const valor = request.cookies.get(COOKIE_PERMISSOES)?.value;
  if (!valor) return undefined;

  try {
    const permissoes = JSON.parse(decodeURIComponent(valor));
    return Array.isArray(permissoes) ? permissoes.filter((permissao) => typeof permissao === 'string') : undefined;
  } catch {
    return undefined;
  }
}

function protegerResposta(resposta: NextResponse, politicaConteudo: string) {
  resposta.headers.set('Content-Security-Policy', politicaConteudo);
  resposta.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  resposta.headers.set('Pragma', 'no-cache');
  return resposta;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const autenticado = possuiSessao(request);
  const requestHeaders = new Headers(request.headers);
  const nonce = criarNonceCsp();
  const politicaConteudo = criarPoliticaConteudo(nonce);
  requestHeaders.delete('x-middleware-subrequest');
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', politicaConteudo);

  if ((pathname === '/api' || pathname.startsWith('/api/')) && !origemMutacaoPermitida(request)) {
    return protegerResposta(
      NextResponse.json(
        { mensagem: 'Origem da requisicao nao autorizada.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      ),
      politicaConteudo
    );
  }

  const rotaProtegida = ROTAS_PROTEGIDAS.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`));

  if (rotaProtegida && !autenticado) {
    const destino = new URL('/login', request.url);
    destino.searchParams.set('redirect', `${pathname}${search}`);
    return protegerResposta(NextResponse.redirect(destino), politicaConteudo);
  }

  if (rotaProtegida && autenticado) {
    const decisao = decidirAcessoRota(pathname, papelSessao(request), destinoInicial(request), permissoesSessao(request));
    if (!decisao.permitir && decisao.redirecionarPara) {
      return protegerResposta(NextResponse.redirect(new URL(decisao.redirecionarPara, request.url)), politicaConteudo);
    }
  }

  if (pathname === '/login' && autenticado) {
    const papel = papelSessao(request);
    const destino = papel
      ? resolverDestinoPermitido(papel, destinoInicial(request), permissoesSessao(request))
      : destinoInicial(request);
    if (destino !== '/login') {
      return protegerResposta(NextResponse.redirect(new URL(destino, request.url)), politicaConteudo);
    }
  }

  return protegerResposta(NextResponse.next({ request: { headers: requestHeaders } }), politicaConteudo);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/|sw.js).*)']
};
