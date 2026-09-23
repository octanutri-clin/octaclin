import { NextRequest, NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ tipoId: string }> }) {
  try {
    const { tipoId } = await params;
    const resposta = await requisitarBackendAutenticado(`/agenda/tipos-atendimento/${encodeURIComponent(tipoId)}`, {
      method: 'DELETE'
    });
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
