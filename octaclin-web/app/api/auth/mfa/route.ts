import { NextResponse } from 'next/server';
import { ErroSessaoAusente, limparSessaoBff, requisitarBackendAutenticado, requisitarBackendReautenticado } from '@/lib/server/sessao-bff';

export async function GET() {
  try {
    const resposta = await requisitarBackendAutenticado('/auth/mfa');
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json', 'Cache-Control': 'no-store' }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}

export async function DELETE() {
  try {
    const resposta = await requisitarBackendReautenticado('/auth/mfa', { method: 'DELETE' });
    if (resposta.ok) await limparSessaoBff();
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json', 'Cache-Control': 'no-store' }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}
