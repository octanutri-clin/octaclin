import { NextRequest, NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

async function encaminhar(metodo: 'GET' | 'PUT', request?: NextRequest) {
  try {
    const resposta = await requisitarBackendAutenticado('/agenda/followups/padrao', {
      method: metodo,
      ...(request ? { body: await request.text() } : {})
    });
    return new NextResponse(await resposta.text(), { status: resposta.status, headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' } });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}

export async function GET() { return encaminhar('GET'); }
export async function PUT(request: NextRequest) { return encaminhar('PUT', request); }
