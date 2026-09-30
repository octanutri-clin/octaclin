import { NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function GET(_request: Request, { params }: { params: Promise<{ conversaId: string }> }) {
  try {
    const { conversaId } = await params;
    const resposta = await requisitarBackendAutenticado(`/comunicacoes/portal-paciente/${encodeURIComponent(conversaId)}`);
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json', 'Cache-Control': 'private, no-store' }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}
