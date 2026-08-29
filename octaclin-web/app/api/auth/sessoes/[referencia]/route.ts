import { NextRequest, NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ referencia: string }> }) {
  try {
    const { referencia } = await params;
    const resposta = await requisitarBackendAutenticado(
      `/auth/sessoes/${encodeURIComponent(referencia)}`,
      { method: 'DELETE' }
    );
    const corpo = resposta.status === 204 ? null : await resposta.text();
    return new NextResponse(corpo, {
      status: resposta.status,
      headers: {
        'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) {
      return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    }
    throw erro;
  }
}
