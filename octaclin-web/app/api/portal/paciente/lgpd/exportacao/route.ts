import { NextResponse } from 'next/server';
import { requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function GET() {
  try {
    const resposta = await requisitarBackendAutenticado('/portal/paciente/lgpd/exportacao');
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Sessao ausente.';
    return NextResponse.json({ mensagem }, { status: 401 });
  }
}
