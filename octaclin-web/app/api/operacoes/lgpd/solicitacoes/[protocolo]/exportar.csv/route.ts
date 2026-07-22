import { NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function GET(_request: Request, { params }: { params: { protocolo: string } }) {
  try {
    const resposta = await requisitarBackendAutenticado(
      `/operacoes/lgpd/solicitacoes/${encodeURIComponent(params.protocolo)}/exportar.csv`
    );
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: {
        'Content-Type': resposta.headers.get('Content-Type') ?? 'text/csv; charset=utf-8',
        'Content-Disposition':
          resposta.headers.get('Content-Disposition') ??
          `attachment; filename="octaclin-lgpd-${params.protocolo}.csv"`
      }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) {
      return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    }
    throw erro;
  }
}
