import { NextRequest, NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', Vary: 'Cookie' };

interface Params {
  params: Promise<{ id: string; documentoId: string }>;
}

export async function GET(_request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    await exigirPermissaoBff('pacientes.ler');
    const resposta = await requisitarBackendAutenticado(
      `/pacientes/${encodeURIComponent(params.id)}/documentos/${encodeURIComponent(params.documentoId)}`
    );
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { ...headers, 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) {
      return NextResponse.json({ mensagem: erro.message }, { status: 401, headers });
    }
    if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403, headers });
    return NextResponse.json({ mensagem: 'Não foi possível abrir o documento.' }, { status: 502, headers });
  }
}
