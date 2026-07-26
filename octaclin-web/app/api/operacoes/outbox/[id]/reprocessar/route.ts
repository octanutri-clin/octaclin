import { NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function POST(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const resposta = await requisitarBackendAutenticado(`/operacoes/outbox/${params.id}/reprocessar`, { method: 'POST' });
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
