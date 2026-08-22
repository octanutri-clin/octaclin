import { NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

interface Params {
  params: Promise<{ filtroId: string }>;
}

export async function DELETE(_request: Request, props: Params) {
  try {
    const { filtroId } = await props.params;
    const resposta = await requisitarBackendAutenticado(
      `/pacientes/filtros-salvos/${encodeURIComponent(filtroId)}`,
      { method: 'DELETE' }
    );
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}
