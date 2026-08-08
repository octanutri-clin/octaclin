import { NextRequest, NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

interface Params { params: Promise<{ id: string }> }

export async function PATCH(_request: NextRequest, props: Params) {
  const { id } = await props.params;
  try {
    await exigirPermissaoBff('pacientes.gerenciar');
    const resposta = await requisitarBackendAutenticado(`/pacientes/${encodeURIComponent(id)}/restaurar`, { method: 'PATCH' });
    return new NextResponse(null, { status: resposta.status });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
    throw erro;
  }
}
