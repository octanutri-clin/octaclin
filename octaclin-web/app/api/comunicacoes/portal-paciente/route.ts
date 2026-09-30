import { NextRequest, NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function GET(request: NextRequest) {
  try {
    const atrasadas = request.nextUrl.searchParams.get('atrasadas');
    const pagina = request.nextUrl.searchParams.get('pagina');
    const status = request.nextUrl.searchParams.get('status');
    const parametros = new URLSearchParams();
    if (atrasadas === 'true') parametros.set('atrasadas', 'true');
    if (pagina !== null) parametros.set('pagina', pagina);
    if (status !== null) parametros.set('status', status);
    const sufixo = parametros.size ? `?${parametros.toString()}` : '';
    const resposta = await requisitarBackendAutenticado(`/comunicacoes/portal-paciente${sufixo}`);
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json', 'Cache-Control': 'private, no-store' }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}
