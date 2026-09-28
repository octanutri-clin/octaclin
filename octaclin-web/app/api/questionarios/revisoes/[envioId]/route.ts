import { NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function GET(_request: Request, props: { params: Promise<{ envioId: string }> }) {
  try {
    await exigirPermissaoBff('questionarios.gerenciar');
    const { envioId } = await props.params;
    const resposta = await requisitarBackendAutenticado(`/questionarios/revisoes/${encodeURIComponent(envioId)}`);
    return new NextResponse(await resposta.text(), { status: resposta.status, headers: {
      'Content-Type': 'application/json', 'Cache-Control': 'private, no-store'
    } });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
    throw erro;
  }
}
