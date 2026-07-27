import { NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

interface Params {
  params: Promise<{ consultaId: string }>;
}

export async function POST(_request: Request, props: Params) {
  const params = await props.params;
  try {
    const resposta = await requisitarBackendAutenticado(`/portal/paciente/consultas/${params.consultaId}/desmarcar`, {
      method: 'POST'
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
