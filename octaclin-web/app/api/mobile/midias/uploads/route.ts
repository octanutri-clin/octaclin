import { NextRequest, NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function GET(request: NextRequest) {
  try {
    const pacienteId = request.nextUrl.searchParams.get('pacienteId');
    const resposta = await requisitarBackendAutenticado(
      `/mobile/midias/uploads${pacienteId ? `?pacienteId=${encodeURIComponent(pacienteId)}` : ''}`
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
    const resposta = await requisitarBackendAutenticado('/mobile/midias/uploads', {
      method: 'POST',
      body: await request.text()
    });
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
