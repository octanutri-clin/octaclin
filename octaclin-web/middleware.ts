import { NextRequest, NextResponse } from 'next/server';
import { decidirAcessoRota, sanitizarDestinoInicial } from './lib/server/autorizacao-rotas';

const COOKIE_ACCESS_TOKEN = 'octaclin_access_token';
const COOKIE_REFRESH_TOKEN = 'octaclin_refresh_token';
const COOKIE_DESTINO_INICIAL = 'octaclin_destino_inicial';
const COOKIE_PAPEL = 'octaclin_papel';
const ROTAS_PROTEGIDAS = [
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
  '/portal'
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

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const autenticado = possuiSessao(request);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('x-middleware-subrequest');

  const rotaProtegida = ROTAS_PROTEGIDAS.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`));

  if (rotaProtegida && !autenticado) {
    const destino = new URL('/login', request.url);
    destino.searchParams.set('redirect', `${pathname}${search}`);
    return NextResponse.redirect(destino);
  }

  if (rotaProtegida && autenticado) {
    const decisao = decidirAcessoRota(pathname, papelSessao(request), destinoInicial(request));
    if (!decisao.permitir && decisao.redirecionarPara) {
      return NextResponse.redirect(new URL(decisao.redirecionarPara, request.url));
    }
  }

  if (pathname === '/login' && autenticado) {
    return NextResponse.redirect(new URL(destinoInicial(request), request.url));
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    '/login',
    '/agenda/:path*',
    '/operacoes/:path*',
    '/questionarios/:path*',
    '/comunicacoes/:path*',
    '/automacoes/:path*',
    '/ia/:path*',
    '/mobile/:path*',
    '/gamificacao/:path*',
    '/pacientes/:path*',
    '/profissionais/:path*',
    '/portal/:path*'
  ]
};
