import { NextRequest, NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

interface Params {
  params: Promise<{ id: string }>;
}

function respostaProxy(resposta: Response) {
  return resposta.text().then(
    (corpo) =>
      new NextResponse(corpo, {
        status: resposta.status,
        headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
      })
  );
}

export async function GET(_request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    return respostaProxy(await requisitarBackendAutenticado(`/questionarios/${params.id}/perguntas`));
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}

export async function POST(request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    return respostaProxy(
      await requisitarBackendAutenticado(`/questionarios/${params.id}/perguntas`, {
        method: 'POST',
        body: await request.text()
      })
    );
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}
