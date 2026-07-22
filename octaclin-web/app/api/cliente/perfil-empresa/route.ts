import { NextRequest, NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

function tratarErroSessao(erro: unknown) {
  if (erro instanceof ErroSessaoAusente) {
    return NextResponse.json({ mensagem: erro.message }, { status: 401 });
  }
  if (erro instanceof ErroPermissaoAusente) {
    return NextResponse.json({ mensagem: erro.message }, { status: 403 });
  }
  throw erro;
}

export async function GET() {
  try {
    await exigirPermissaoBff('cliente.configuracoes.gerenciar');
    const resposta = await requisitarBackendAutenticado('/cliente/perfil-empresa');
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  } catch (erro) {
    return tratarErroSessao(erro);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await exigirPermissaoBff('cliente.configuracoes.gerenciar');
    const corpo = await request.text();
    const resposta = await requisitarBackendAutenticado('/cliente/perfil-empresa', { method: 'PATCH', body: corpo });
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  } catch (erro) {
    return tratarErroSessao(erro);
  }
}
