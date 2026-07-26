import { NextRequest, NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

interface Params {
  params: Promise<{ id: string; tarefaId: string }>;
}

export async function PATCH(request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const corpo = await request.text();
    const resposta = await requisitarBackendAutenticado(
      `/pacientes/${encodeURIComponent(params.id)}/tarefas-acompanhamento/${encodeURIComponent(params.tarefaId)}`,
      {
        method: 'PATCH',
        body: corpo
      }
    );
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) {
      return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    }
    throw erro;
  }
}
