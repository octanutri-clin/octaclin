import { cookies, type UnsafeUnwrappedCookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

const COOKIE_LINK_ID = 'octaclin_agendamento_publico_link_id';
const COOKIE_LINK_TOKEN = 'octaclin_agendamento_publico_token';

function tratarErroSessao(erro: unknown) {
  if (erro instanceof ErroSessaoAusente) {
    return NextResponse.json({ mensagem: erro.message }, { status: 401 });
  }
  if (erro instanceof ErroPermissaoAusente) {
    return NextResponse.json({ mensagem: erro.message }, { status: 403 });
  }
  throw erro;
}

function obterTokenMemorizado(linkId: string) {
  const jar = cookies() as unknown as UnsafeUnwrappedCookies;
  const linkIdAtual = jar.get(COOKIE_LINK_ID)?.value;
  if (linkIdAtual !== linkId) return undefined;
  return jar.get(COOKIE_LINK_TOKEN)?.value;
}

function montarUrlPublica(origin: string, token?: string) {
  return token ? `${origin}/agendar/${encodeURIComponent(token)}` : null;
}

export async function GET(request: NextRequest) {
  try {
    await exigirPermissaoBff('agenda.consultas.ler');
    const profissionalId = request.nextUrl.searchParams.get('profissionalId');
    const parametros = new URLSearchParams();
    if (profissionalId) parametros.set('profissionalId', profissionalId);

    const resposta = await requisitarBackendAutenticado(
      `/agenda/agendamento-publico${parametros.size ? `?${parametros.toString()}` : ''}`
    );
    const links = (await resposta.json()) as Array<{
      id: string;
      profissionalId: string;
      duracaoMinutos: number;
      ativo: boolean;
      criadoEm: string;
      atualizadoEm: string;
    }>;

    const linkAtual = links.find((link) => link.ativo) ?? links[0] ?? null;
    if (!linkAtual) return NextResponse.json(null, { status: 200 });

    return NextResponse.json({
      ...linkAtual,
      urlPublica: montarUrlPublica(request.nextUrl.origin, obterTokenMemorizado(linkAtual.id))
    });
  } catch (erro) {
    return tratarErroSessao(erro);
  }
}
