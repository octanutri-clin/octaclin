import { NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

interface Params {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, props: Params) {
  const params = await props.params;
  try {
    await exigirPermissaoBff('cliente.convites.gerenciar');
    const resposta = await requisitarBackendAutenticado(`/cliente/usuarios/${params.id}/convite`, { method: 'DELETE' });
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
