import { NextResponse } from 'next/server';
import { requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function GET() {
  try {
    const resposta = await requisitarBackendAutenticado('/agenda/google/profissionais/status');
    return new NextResponse(await resposta.text(), { status: resposta.status, headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' } });
  } catch {
    return NextResponse.json({ mensagem: 'Falha ao consultar integrações da equipe.' }, { status: 500 });
  }
}
