import { NextRequest, NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

/**
 * Importacao em massa. `?previa=1` valida e devolve o relatorio sem gravar —
 * e o mesmo corpo, entao a tela nunca envia um arquivo que ela nao mostrou.
 */
export async function POST(request: NextRequest) {
  try {
    const corpo = await request.text();
    const previa = request.nextUrl.searchParams.get('previa') === '1';
    const resposta = await requisitarBackendAutenticado(`/pacientes/importar${previa ? '/previa' : ''}`, {
      method: 'POST',
      body: corpo
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
