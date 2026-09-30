import { NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function GET(request: Request) {
  try {
    await exigirPermissaoBff('pacientes.ler');
    const pagina = new URL(request.url).searchParams.get('pagina') ?? '1';
    const resposta = await requisitarBackendAutenticado(`/checkins/revisoes/pendentes?pagina=${encodeURIComponent(pagina)}`);
    return new NextResponse(await resposta.text(), { status: resposta.status, headers: {
      'Content-Type': 'application/json', 'Cache-Control': 'private, no-store'
    } });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
    throw erro;
  }
}
