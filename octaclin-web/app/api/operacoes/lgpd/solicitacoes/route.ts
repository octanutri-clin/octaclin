import { NextRequest, NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function GET(request: NextRequest) {
  try {
    const parametros = new URLSearchParams();
    const nomes = ['status', 'tipo', 'pagina', 'limite'];

    nomes.forEach((nome) => {
      const valor = request.nextUrl.searchParams.get(nome);
      if (valor) parametros.set(nome, valor);
    });

    if (!parametros.has('pagina')) parametros.set('pagina', '1');
    if (!parametros.has('limite')) parametros.set('limite', '25');

    const resposta = await requisitarBackendAutenticado(`/operacoes/lgpd/solicitacoes?${parametros.toString()}`);
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) {
      return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    }
    throw erro;
  }
}
