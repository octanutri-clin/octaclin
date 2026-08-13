import { NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; evolucaoId: string }> }) {
  try {
    const { id, evolucaoId } = await params;
    const resposta = await requisitarBackendAutenticado(
      `/pacientes/${encodeURIComponent(id)}/evolucoes-fotograficas/${encodeURIComponent(evolucaoId)}`,
      { method: 'DELETE' }
    );
    return new NextResponse(await resposta.text(), { status: resposta.status, headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' } });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}
