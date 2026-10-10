import { NextRequest, NextResponse } from 'next/server';
import { ErroSessaoAusente, ErroPermissaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', Vary: 'Cookie' };

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    await exigirPermissaoBff('pacientes.ler');
    const parametros = new URLSearchParams();
    for (const nome of ['avaliacaoAnteriorId', 'avaliacaoAtualId']) {
      const valor = request.nextUrl.searchParams.get(nome);
      if (valor) parametros.set(nome, valor);
    }
    const query = parametros.toString();
    const resposta = await requisitarBackendAutenticado(
      `/pacientes/${encodeURIComponent(params.id)}/avaliacoes-antropometricas${query ? `?${query}` : ''}`
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
    return NextResponse.json({ mensagem: 'Não foi possível acessar as avaliações.' }, { status: 502, headers });
  }
}

export async function POST(request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    await exigirPermissaoBff('pacientes.gerenciar');
    const corpo = await request.text();
    if (new TextEncoder().encode(corpo).byteLength > 24000) return NextResponse.json({ mensagem: 'Solicitação acima do limite.' }, { status: 413, headers });
    const resposta = await requisitarBackendAutenticado(
      `/pacientes/${encodeURIComponent(params.id)}/avaliacoes-antropometricas`,
      { method: 'POST', body: corpo }
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
    return NextResponse.json({ mensagem: 'Não foi possível acessar as avaliações.' }, { status: 502, headers });
  }
}
