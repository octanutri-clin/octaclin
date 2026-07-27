import { NextResponse } from 'next/server';
import {
  ErroPermissaoAusente,
  ErroSessaoAusente,
  exigirPermissaoBff,
  requisitarBackendAutenticado
} from '@/lib/server/sessao-bff';

interface Params {
  params: Promise<{ envioId: string }>;
}

export async function POST(_request: Request, props: Params) {
  try {
    await exigirPermissaoBff('questionarios.gerenciar');
    const params = await props.params;
    const resposta = await requisitarBackendAutenticado(
      `/questionarios/envios/${encodeURIComponent(params.envioId)}/revisar`,
      {
        method: 'POST',
        headers: { 'x-octaclin-origem': 'dashboard_clinico' }
      }
    );
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
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
