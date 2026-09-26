import { NextRequest, NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

const filtrosPermitidos = new Set(['pagina', 'limite', 'usuarioId', 'acao', 'recursoTipo', 'inicio', 'fim']);
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(request: NextRequest) {
  try {
    await exigirPermissaoBff('cliente.acessar');
    const filtros = new URLSearchParams();
    for (const [chave, valor] of request.nextUrl.searchParams) {
      if (!filtrosPermitidos.has(chave) || filtros.has(chave) || valor.length > 120) {
        return NextResponse.json({ mensagem: 'Filtros de auditoria inválidos.' }, { status: 400, headers });
      }
      filtros.set(chave, valor);
    }
    const query = filtros.toString();
    const resposta = await requisitarBackendAutenticado(`/cliente/auditoria${query ? `?${query}` : ''}`);
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
