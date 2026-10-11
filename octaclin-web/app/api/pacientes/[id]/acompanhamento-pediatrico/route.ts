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
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const cursor = request.nextUrl.searchParams.get('cursor');
    const limite = request.nextUrl.searchParams.get('limite');
    if (!uuid.test(params.id) || (cursor && !uuid.test(cursor)) || (limite && (!/^\d+$/.test(limite) || Number(limite) < 1 || Number(limite) > 100))) return NextResponse.json({ mensagem: 'Parâmetros inválidos.' }, { status: 400, headers });
    const parametros = new URLSearchParams();
    for (const nome of ['cursor', 'limite']) {
      const valor = request.nextUrl.searchParams.get(nome);
      if (valor) parametros.set(nome, valor);
    }
    const query = parametros.toString();
    const resposta = await requisitarBackendAutenticado(
      `/pacientes/${encodeURIComponent(params.id)}/acompanhamento-pediatrico${query ? `?${query}` : ''}`
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

