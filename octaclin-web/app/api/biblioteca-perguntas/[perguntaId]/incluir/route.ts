import { NextRequest, NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

interface Params {
  params: Promise<{ perguntaId: string }>;
}

export async function POST(request: NextRequest, props: Params) {
  const { perguntaId } = await props.params;
  try {
    const resposta = await requisitarBackendAutenticado(`/biblioteca-perguntas/${perguntaId}/incluir`, {
      method: 'POST',
      body: await request.text()
    });
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}
