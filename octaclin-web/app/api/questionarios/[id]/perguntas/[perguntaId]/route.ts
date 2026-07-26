import { NextRequest, NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

interface Params {
  params: Promise<{ id: string; perguntaId: string }>;
}

export async function PATCH(request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const resposta = await requisitarBackendAutenticado(`/questionarios/${params.id}/perguntas/${params.perguntaId}`, {
      method: 'PATCH',
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
