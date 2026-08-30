import { NextResponse } from 'next/server';
import { ErroSessaoAusente, limparSessaoBff, requisitarBackendReautenticado } from '@/lib/server/sessao-bff';

export async function POST() {
  try {
    const resposta = await requisitarBackendReautenticado('/auth/sessoes/encerrar-todas', { method: 'POST' });
    const corpo = await resposta.text();
    if (resposta.ok) await limparSessaoBff();
    return new NextResponse(corpo, {
      status: resposta.status,
      headers: {
        'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) {
      return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    }
    throw erro;
  }
}
