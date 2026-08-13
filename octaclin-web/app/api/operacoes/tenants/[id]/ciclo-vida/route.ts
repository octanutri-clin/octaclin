import { NextRequest, NextResponse } from 'next/server';
import {
  ErroPermissaoAusente,
  ErroSessaoAusente,
  exigirPermissaoBff,
  requisitarBackendAutenticado
} from '@/lib/server/sessao-bff';

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, props: Params) {
  try {
    await exigirPermissaoBff('operacoes.tenants.gerenciar');
    const { id } = await props.params;
    const resposta = await requisitarBackendAutenticado(
      `/operacoes/tenants/${encodeURIComponent(id)}/ciclo-vida`,
      { method: 'POST', body: await request.text() }
    );
    return new NextResponse(resposta.body, {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
    throw erro;
  }
}
