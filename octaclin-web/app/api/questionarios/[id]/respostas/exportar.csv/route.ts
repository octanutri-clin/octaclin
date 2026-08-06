import { NextRequest, NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const resposta = await requisitarBackendAutenticado(`/questionarios/${params.id}/respostas/exportar.csv`);
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: {
        'Content-Type': resposta.headers.get('Content-Type') ?? 'text/csv; charset=utf-8',
        'Content-Disposition':
          resposta.headers.get('Content-Disposition') ??
          'attachment; filename="octaclin-respostas-formulario.csv"'
      }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}
