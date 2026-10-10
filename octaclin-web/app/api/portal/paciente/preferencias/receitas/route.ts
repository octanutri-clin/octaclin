import { NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function GET() {
  try {
    const resposta = await requisitarBackendAutenticado('/portal/paciente/preferencias/receitas');
    return new NextResponse(await resposta.text(), { status: resposta.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}

export async function PUT(request: Request) {
  try {
    const resposta = await requisitarBackendAutenticado('/portal/paciente/preferencias/receitas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: await request.text() });
    return new NextResponse(await resposta.text(), { status: resposta.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}
