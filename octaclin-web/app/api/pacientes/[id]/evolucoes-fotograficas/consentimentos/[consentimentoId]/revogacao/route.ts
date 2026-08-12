import { NextRequest, NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

interface Params { params: Promise<{ id: string; consentimentoId: string }>; }

export async function POST(_request: NextRequest, props: Params) {
  const { id, consentimentoId } = await props.params;
  try {
    const resposta = await requisitarBackendAutenticado(
      `/pacientes/${encodeURIComponent(id)}/evolucoes-fotograficas/consentimentos/${encodeURIComponent(consentimentoId)}/revogacao`,
      { method: 'POST' }
    );
    return new NextResponse(await resposta.text(), { status: resposta.status, headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' } });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}
