import { NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

interface Params { params: Promise<{ planoId: string }> }
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', Vary: 'Cookie' };

export async function GET(_request: Request, props: Params) {
  const { planoId } = await props.params;
  try {
    const resposta = await requisitarBackendAutenticado(`/portal/paciente/planos-alimentares/${encodeURIComponent(planoId)}`);
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { ...headers, 'Content-Type': resposta.headers.get('Content-Type') ?? headers['Content-Type'] }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401, headers });
    throw erro;
  }
}
