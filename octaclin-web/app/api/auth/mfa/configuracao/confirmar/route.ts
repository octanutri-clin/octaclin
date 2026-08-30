import { NextRequest, NextResponse } from 'next/server';
import { ErroSessaoAusente, limparSessaoBff, requisitarBackendReautenticado } from '@/lib/server/sessao-bff';

export async function POST(request: NextRequest) {
  try {
    const corpo = (await request.json()) as { codigo?: string };
    const resposta = await requisitarBackendReautenticado('/auth/mfa/configuracao/confirmar', {
      method: 'POST',
      body: JSON.stringify({ codigo: corpo.codigo })
    });
    const texto = await resposta.text();
    if (resposta.ok) await limparSessaoBff();
    return new NextResponse(texto, { status: resposta.status, headers: { 'Content-Type': 'application/json' } });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}
