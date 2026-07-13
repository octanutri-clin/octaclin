import { NextRequest, NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function GET(request: NextRequest) {
  try {
    const parametros = new URLSearchParams();
    const nomes = ['acao', 'recursoTipo', 'recursoId', 'usuarioId', 'inicio', 'fim', 'limite'];

    nomes.forEach((nome) => {
      const valor = request.nextUrl.searchParams.get(nome);
      if (valor) parametros.set(nome, valor);
    });

    if (!parametros.has('limite')) parametros.set('limite', '500');

    const resposta = await requisitarBackendAutenticado(`/operacoes/auditoria/exportar.csv?${parametros.toString()}`);
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: {
        'Content-Type': resposta.headers.get('Content-Type') ?? 'text/csv; charset=utf-8',
        'Content-Disposition': resposta.headers.get('Content-Disposition') ?? 'attachment; filename="octaclin-auditoria.csv"'
      }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) {
      return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    }
    throw erro;
  }
}
