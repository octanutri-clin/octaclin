import { NextRequest, NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

function respostaProxy(resposta: Response) {
  return resposta.text().then(
    (corpo) =>
      new NextResponse(corpo, {
        status: resposta.status,
        headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
      })
  );
}

export async function GET() {
  try {
    return respostaProxy(await requisitarBackendAutenticado('/automacoes/regras'));
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}

export async function POST(request: NextRequest) {
  try {
    return respostaProxy(
      await requisitarBackendAutenticado('/automacoes/regras', { method: 'POST', body: await request.text() })
    );
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}
