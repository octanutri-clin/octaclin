import { NextRequest, NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function GET(request: NextRequest) {
  try {
    await exigirPermissaoBff('pacientes.listar');
    const parametros = new URLSearchParams({
      pagina: request.nextUrl.searchParams.get('pagina') ?? '1',
      limite: request.nextUrl.searchParams.get('limite') ?? '25'
    });
    const resposta = await requisitarBackendAutenticado(`/pacientes/arquivados?${parametros}`);
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
    throw erro;
  }
}
