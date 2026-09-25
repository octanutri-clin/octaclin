import { NextRequest, NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function GET(request: NextRequest) {
  try {
    await exigirPermissaoBff('cliente.acessar');
    const mes = request.nextUrl.searchParams.get('mes');
    if (mes && (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)
      || Number(mes.slice(0, 4)) < 2000 || Number(mes.slice(0, 4)) > 2100)) {
      return NextResponse.json({ mensagem: 'Informe o mês no formato AAAA-MM.' }, { status: 400 });
    }
    const caminho = mes ? `/cliente/painel-operacao?mes=${encodeURIComponent(mes)}` : '/cliente/painel-operacao';
    const resposta = await requisitarBackendAutenticado(caminho);
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: {
        'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json',
        'Cache-Control': 'private, no-store'
      }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
    throw erro;
  }
}
