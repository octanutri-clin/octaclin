import { NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

interface Params {
  params: { id: string };
}

export async function DELETE(_request: Request, { params }: Params) {
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
