import { NextRequest, NextResponse } from 'next/server';
import { montarLinkAgendaPublicaBff } from '@/lib/server/agendamento-publico-bff';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

function tratarErroSessao(erro: unknown) {
  if (erro instanceof ErroSessaoAusente) {
    return NextResponse.json({ mensagem: erro.message }, { status: 401 });
  }
  if (erro instanceof ErroPermissaoAusente) {
    return NextResponse.json({ mensagem: erro.message }, { status: 403 });
  }
  throw erro;
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

    return NextResponse.json(montarLinkAgendaPublicaBff(request.nextUrl.origin, linkAtual));
  } catch (erro) {
    return tratarErroSessao(erro);
  }
}
