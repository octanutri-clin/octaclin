import { NextRequest, NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const consulta = request.nextUrl.searchParams.toString();
    const caminho = `/questionarios/${params.id}/respostas/leitura-clinica${consulta ? `?${consulta}` : ''}`;
    const resposta = await requisitarBackendAutenticado(caminho);
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}
