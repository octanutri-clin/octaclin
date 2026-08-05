import { NextRequest, NextResponse } from 'next/server';
import {
  ErroPermissaoAusente,
  ErroSessaoAusente,
  exigirPermissaoBff,
  requisitarBackendAutenticado
} from '@/lib/server/sessao-bff';

export async function GET(request: NextRequest) {
  try {
    await exigirPermissaoBff('agenda.financeiro.ler');
    const parametros = request.nextUrl.searchParams.toString();
    const resposta = await requisitarBackendAutenticado(
      `/agenda/financeiro/recebimentos${parametros ? `?${parametros}` : ''}`
    );
    return new NextResponse(resposta.body, {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
    throw erro;
  }
}
