import { NextRequest, NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function GET(request: NextRequest) {
  try {
    const pagina = request.nextUrl.searchParams.get('pagina') ?? '1';
    const limite = request.nextUrl.searchParams.get('limite') ?? '25';
    const resposta = await requisitarBackendAutenticado(
      `/pacientes?pagina=${encodeURIComponent(pagina)}&limite=${encodeURIComponent(limite)}`
    );
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

export async function POST(request: NextRequest) {
  try {
    const corpo = await request.text();
    const resposta = await requisitarBackendAutenticado('/pacientes', { method: 'POST', body: corpo });
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
