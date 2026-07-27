import { cookies, type UnsafeUnwrappedCookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

const COOKIE_LINK_ID = 'octaclin_agendamento_publico_link_id';
const COOKIE_LINK_TOKEN = 'octaclin_agendamento_publico_token';
const COOKIE_BASE = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.OCTACLIN_COOKIE_SECURE === 'true',
  path: '/'
};

function tratarErroSessao(erro: unknown) {
  if (erro instanceof ErroSessaoAusente) {
    return NextResponse.json({ mensagem: erro.message }, { status: 401 });
  }
  if (erro instanceof ErroPermissaoAusente) {
    return NextResponse.json({ mensagem: erro.message }, { status: 403 });
  }
  throw erro;
}

export async function POST(request: NextRequest) {
  try {
    await exigirPermissaoBff('agenda.consultas.criar');
    const profissionalId = request.nextUrl.searchParams.get('profissionalId');
    const parametros = new URLSearchParams();
    if (profissionalId) parametros.set('profissionalId', profissionalId);

    const resposta = await requisitarBackendAutenticado(
      `/agenda/agendamento-publico/rotacionar${parametros.size ? `?${parametros.toString()}` : ''}`,
      { method: 'POST' }
    );
    const link = (await resposta.json()) as {
      id: string;
      profissionalId: string;
      duracaoMinutos: number;
      ativo: boolean;
      criadoEm: string;
      atualizadoEm: string;
      token: string;
    };

    const jar = cookies() as unknown as UnsafeUnwrappedCookies;
    const maxAge = 60 * 60 * 24 * 30;
    jar.set(COOKIE_LINK_ID, link.id, { ...COOKIE_BASE, maxAge });
    jar.set(COOKIE_LINK_TOKEN, link.token, { ...COOKIE_BASE, maxAge });

    return NextResponse.json({
      id: link.id,
      profissionalId: link.profissionalId,
      duracaoMinutos: link.duracaoMinutos,
      ativo: link.ativo,
      criadoEm: link.criadoEm,
      atualizadoEm: link.atualizadoEm,
      urlPublica: `${request.nextUrl.origin}/agendar/${encodeURIComponent(link.token)}`
    });
  } catch (erro) {
    return tratarErroSessao(erro);
  }
}
