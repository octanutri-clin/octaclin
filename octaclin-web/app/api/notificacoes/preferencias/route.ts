import { NextResponse } from 'next/server';
import {
  ErroPermissaoAusente,
  ErroSessaoAusente,
  exigirPermissaoBff,
  requisitarBackendAutenticado
} from '@/lib/server/sessao-bff';

const headersNoStore = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

export async function GET() {
  try {
    await exigirPermissaoBff('console.acessar');
    const resposta = await requisitarBackendAutenticado('/notificacoes/preferencias');
    return new NextResponse(resposta.body, { status: resposta.status, headers: headersNoStore });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401, headers: headersNoStore });
    if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403, headers: headersNoStore });
    return NextResponse.json({ mensagem: 'Serviço de notificações indisponível.' }, { status: 502, headers: headersNoStore });
  }
}

export async function PUT(request: Request) {
  try {
    await exigirPermissaoBff('console.acessar');
    const resposta = await requisitarBackendAutenticado('/notificacoes/preferencias', {
      method: 'PUT', body: await request.text()
    });
    return new NextResponse(resposta.body, { status: resposta.status, headers: headersNoStore });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401, headers: headersNoStore });
    if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403, headers: headersNoStore });
    return NextResponse.json({ mensagem: 'Serviço de notificações indisponível.' }, { status: 502, headers: headersNoStore });
  }
}
