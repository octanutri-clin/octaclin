import { NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(_request: Request, props: { params: Promise<{ protocolo: string }> }) {
  try {
    await exigirPermissaoBff('cliente.acessar');
    const { protocolo } = await props.params;
    const resposta = await requisitarBackendAutenticado(`/cliente/lgpd/solicitacoes/${encodeURIComponent(protocolo)}`);
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { ...headers, 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401, headers });
    if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403, headers });
    throw erro;
  }
}
