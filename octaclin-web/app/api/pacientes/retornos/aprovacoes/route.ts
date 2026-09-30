import { NextRequest, NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function POST(request: NextRequest) {
  try {
    await exigirPermissaoBff('pacientes.gerenciar');
    await exigirPermissaoBff('comunicacoes.mensagens.enviar');
    const resposta = await requisitarBackendAutenticado('/pacientes/retornos/aprovacoes', { method: 'POST', body: await request.text() });
    return new NextResponse(await resposta.text(), { status: resposta.status, headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' } });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
    throw erro;
  }
}
