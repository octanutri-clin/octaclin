import { NextRequest, NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

function responder(resposta: Response) {
  return resposta.text().then((corpo) => new NextResponse(corpo, {
    status: resposta.status,
    headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
  }));
}

export async function GET(request: NextRequest) {
  try {
    const origem = request.nextUrl.searchParams.get('origem');
    const parametros = new URLSearchParams();
    if (origem === 'pessoal' || origem === 'clinica') parametros.set('origem', origem);
    const query = parametros.toString();
    return responder(await requisitarBackendAutenticado(`/pacientes/filtros-salvos${query ? `?${query}` : ''}`));
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}

export async function POST(request: NextRequest) {
  try {
    const resposta = await requisitarBackendAutenticado('/pacientes/filtros-salvos', {
      method: 'POST',
      body: await request.text()
    });
    return responder(resposta);
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}
