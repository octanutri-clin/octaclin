import { NextRequest, NextResponse } from 'next/server';

const COOKIE_ACCESS_TOKEN = 'octaclin_access_token';
const COOKIE_REFRESH_TOKEN = 'octaclin_refresh_token';
const ROTAS_PROTEGIDAS = [
  '/operacoes',
  '/questionarios',
  '/comunicacoes',
  '/automacoes',
  '/ia',
  '/mobile',
  '/gamificacao',
  '/pacientes',
  '/profissionais'
];

function possuiSessao(request: NextRequest) {
  return Boolean(request.cookies.get(COOKIE_ACCESS_TOKEN)?.value && request.cookies.get(COOKIE_REFRESH_TOKEN)?.value);
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

  if (pathname === '/login' && autenticado) {
    return NextResponse.redirect(new URL('/operacoes', request.url));
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    '/login',
    '/operacoes/:path*',
    '/questionarios/:path*',
    '/comunicacoes/:path*',
    '/automacoes/:path*',
    '/ia/:path*',
    '/mobile/:path*',
    '/gamificacao/:path*',
    '/pacientes/:path*',
    '/profissionais/:path*'
  ]
};
