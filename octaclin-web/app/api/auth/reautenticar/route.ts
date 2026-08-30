import { NextRequest, NextResponse } from 'next/server';
import { salvarProvaReautenticacao } from '@/lib/server/mfa-bff';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function POST(request: NextRequest) {
  try {
    const corpo = (await request.json()) as { senha?: string };
    if (typeof corpo.senha !== 'string' || !corpo.senha) {
      return NextResponse.json({ mensagem: 'Informe sua senha.' }, { status: 400 });
    }
    const resposta = await requisitarBackendAutenticado('/auth/reautenticar', {
      method: 'POST',
      body: JSON.stringify({ senha: corpo.senha })
    });
    const texto = await resposta.text();
    if (!resposta.ok) {
      return new NextResponse(texto, { status: resposta.status, headers: { 'Content-Type': 'application/json' } });
    }
    const resultado = JSON.parse(texto) as { prova: string; expiraEmSegundos: number };
    if (typeof resultado.prova !== 'string' || typeof resultado.expiraEmSegundos !== 'number') {
      return NextResponse.json({ mensagem: 'O serviço de acesso retornou uma confirmação inválida.' }, { status: 502 });
    }
    await salvarProvaReautenticacao(resultado.prova, resultado.expiraEmSegundos);
    return NextResponse.json({ confirmado: true, expiraEmSegundos: resultado.expiraEmSegundos });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) {
      return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    }
    throw erro;
  }
}
