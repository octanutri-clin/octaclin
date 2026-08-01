import { NextRequest, NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

interface Params {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, props: Params) {
  const params = await props.params;
  try {
    await exigirPermissaoBff('cliente.usuarios.desativar');
    const resposta = await requisitarBackendAutenticado(`/cliente/usuarios/${params.id}`, { method: 'DELETE' });
    return new NextResponse(null, { status: resposta.status });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) {
      return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    }
    if (erro instanceof ErroPermissaoAusente) {
      return NextResponse.json({ mensagem: erro.message }, { status: 403 });
    }
    throw erro;
  }
}

export async function PATCH(request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    await exigirPermissaoBff('cliente.usuarios.gerenciar');
    const resposta = await requisitarBackendAutenticado(`/cliente/usuarios/${params.id}`, {
      method: 'PATCH',
      body: await request.text()
    });
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
