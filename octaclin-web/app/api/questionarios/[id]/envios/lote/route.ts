import { NextRequest, NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

interface Params { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, props: Params) {
  const { id } = await props.params;
  try {
    await exigirPermissaoBff('questionarios.gerenciar');
    await exigirPermissaoBff('pacientes.gerenciar');
    const resposta = await requisitarBackendAutenticado(`/questionarios/${encodeURIComponent(id)}/envios/lote`, {
      method: 'POST', body: await request.text()
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
