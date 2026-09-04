import { NextRequest, NextResponse } from 'next/server';
import {
  decidirAcessoRota,
  resolverDestinoPermitido,
  sanitizarDestinoInicial
} from './lib/server/autorizacao-rotas';
import { origemMutacaoPermitida } from './lib/server/seguranca-bff';
import { criarRequestIdBff, NOME_CABECALHO_CORRELACAO } from './lib/server/correlacao-bff';
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

function protegerResposta(resposta: NextResponse, politicaConteudo: string, requestId: string) {
  resposta.headers.set('Content-Security-Policy', politicaConteudo);
  resposta.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  resposta.headers.set('Pragma', 'no-cache');
  // Devolver o id tambem na resposta e o que permite partir de um relato de
  // usuario ou de um erro na tela e chegar na linha correspondente da trilha.
  resposta.headers.set(NOME_CABECALHO_CORRELACAO, requestId);
  return resposta;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const autenticado = possuiSessao(request);
  const requestHeaders = new Headers(request.headers);
  // Um id proprio por requisicao que entra no web, fixado antes de qualquer
  // decisao de rota para que redirecionamento e recusa tambem fiquem
  // correlacionados. O `set` sobrescreve deliberadamente o que o cliente tenha
  // enviado: ver a decisao registrada em `lib/server/correlacao-bff.ts`.
  // O nonce CSP NAO e reaproveitado aqui de proposito - ele e um valor de
  // seguranca da politica de conteudo e nao deve vazar para log nem para a
  // trilha de auditoria.
  const requestId = criarRequestIdBff();
  const nonce = criarNonceCsp();
  const politicaConteudo = criarPoliticaConteudo(nonce);
  requestHeaders.delete('x-middleware-subrequest');
  // O backend cai para `x-correlation-id` quando `x-request-id` esta ausente
  // (`contexto-requisicao.ts`). Nenhum caminho do BFF encaminha cabecalho cru do
  // cliente hoje, entao esse nome e inalcancavel - mas deixa-lo passar faria a
  // garantia depender de "ninguem nunca vai encaminhar", e nao do middleware.
  // Apagar aqui devolve a garantia para o unico ponto que a sustenta.
  requestHeaders.delete('x-correlation-id');
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set(NOME_CABECALHO_CORRELACAO, requestId);
  requestHeaders.set('Content-Security-Policy', politicaConteudo);

  if ((pathname === '/api' || pathname.startsWith('/api/')) && !origemMutacaoPermitida(request)) {
    return protegerResposta(
      NextResponse.json(
        { mensagem: 'Origem da requisicao nao autorizada.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      ),
      politicaConteudo,
      requestId
    );
  }

  const rotaProtegida = ROTAS_PROTEGIDAS.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`));

  if (rotaProtegida && !autenticado) {
    const destino = new URL('/login', request.url);
    destino.searchParams.set('redirect', `${pathname}${search}`);
    return protegerResposta(NextResponse.redirect(destino), politicaConteudo, requestId);
  }

  if (rotaProtegida && autenticado) {
    const decisao = decidirAcessoRota(pathname, papelSessao(request), destinoInicial(request), permissoesSessao(request));
    if (!decisao.permitir && decisao.redirecionarPara) {
      return protegerResposta(NextResponse.redirect(new URL(decisao.redirecionarPara, request.url)), politicaConteudo, requestId);
    }
  }

  if (pathname === '/login' && autenticado) {
    const papel = papelSessao(request);
    const destino = papel
      ? resolverDestinoPermitido(papel, destinoInicial(request), permissoesSessao(request))
      : destinoInicial(request);
    if (destino !== '/login') {
      return protegerResposta(NextResponse.redirect(new URL(destino, request.url)), politicaConteudo, requestId);
    }
  }

  return protegerResposta(NextResponse.next({ request: { headers: requestHeaders } }), politicaConteudo, requestId);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/|sw.js).*)']
};
