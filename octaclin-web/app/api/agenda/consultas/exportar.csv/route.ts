import { NextRequest, NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function GET(request: NextRequest) {
  try {
    const parametros = new URLSearchParams();
    for (const nome of ['inicioEm', 'fimEm', 'profissionalId']) {
      const valor = request.nextUrl.searchParams.get(nome);
      if (valor) parametros.set(nome, valor);
    }

    const resposta = await requisitarBackendAutenticado(`/agenda/consultas/exportar.csv?${parametros}`);
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: {
        'Content-Type': resposta.headers.get('Content-Type') ?? 'text/csv; charset=utf-8',
        'Content-Disposition':
          resposta.headers.get('Content-Disposition') ?? 'attachment; filename="octaclin-agenda.csv"'
      }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) {
      return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    }
    throw erro;
  }
}
