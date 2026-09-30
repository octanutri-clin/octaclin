import { NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

function erroSessao(erro: unknown) {
  if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
  if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
  throw erro;
}

export async function GET() {
  try {
    await exigirPermissaoBff('cliente.configuracoes.gerenciar');
    const resposta = await requisitarBackendAutenticado('/cliente/lembretes-acompanhamento');
    return new NextResponse(await resposta.text(), { status: resposta.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
  } catch (erro) { return erroSessao(erro); }
}

export async function PATCH(request: Request) {
  try {
    await exigirPermissaoBff('cliente.configuracoes.gerenciar');
    const resposta = await requisitarBackendAutenticado('/cliente/lembretes-acompanhamento', {
      method: 'PATCH', body: await request.text()
    });
    return new NextResponse(await resposta.text(), { status: resposta.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
  } catch (erro) { return erroSessao(erro); }
}
