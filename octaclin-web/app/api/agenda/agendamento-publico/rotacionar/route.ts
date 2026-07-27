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

    return NextResponse.json(
      montarLinkAgendaPublicaBff(
        request.nextUrl.origin,
        {
          id: link.id,
          profissionalId: link.profissionalId,
          duracaoMinutos: link.duracaoMinutos,
          ativo: link.ativo,
          criadoEm: link.criadoEm,
          atualizadoEm: link.atualizadoEm
        },
        link.token
      )
    );
  } catch (erro) {
    return tratarErroSessao(erro);
  }
}
