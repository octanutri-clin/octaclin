import { NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendReautenticado } from '@/lib/server/sessao-bff';

export async function POST() {
  try {
    const resposta = await requisitarBackendReautenticado('/auth/mfa/configuracao', { method: 'POST' });
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json', 'Cache-Control': 'no-store' }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}
