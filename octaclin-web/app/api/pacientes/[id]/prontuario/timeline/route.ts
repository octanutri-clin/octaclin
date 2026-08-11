import { NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, props: Params) {
  const params = await props.params;
  const parametros = new URL(request.url).searchParams;
  const consulta = new URLSearchParams();
  const cursor = parametros.get('cursor');
  const limite = parametros.get('limite');
  if (cursor) consulta.set('cursor', cursor);
  if (limite) consulta.set('limite', limite);

  try {
    const sufixo = consulta.size ? `?${consulta.toString()}` : '';
    const resposta = await requisitarBackendAutenticado(
      `/pacientes/${encodeURIComponent(params.id)}/prontuario/timeline${sufixo}`
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
