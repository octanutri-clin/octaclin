import { NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const resposta = await requisitarBackendAutenticado('/agenda/google/conectar');
    if (!resposta.ok) {
      const detalhe = await resposta.text();
      return NextResponse.json(
        { mensagem: detalhe || 'Falha ao iniciar conexao com a Google Agenda.' },
        { status: resposta.status }
      );
    }
    const corpo = (await resposta.json()) as { url?: string };
    if (!corpo.url) {
      return NextResponse.json({ mensagem: 'Resposta invalida do backend ao gerar URL de autorizacao.' }, { status: 502 });
    }
    return NextResponse.redirect(corpo.url);
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    throw erro;
  }
}
