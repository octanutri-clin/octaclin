import { NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function POST(request: Request) {
  try {
    const resposta = await requisitarBackendAutenticado('/portal/paciente/preferencias/receitas/push-subscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: await request.text() });
    return new NextResponse(await resposta.text(), { status: resposta.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}

export async function DELETE(request: Request) {
  try {
    const resposta = await requisitarBackendAutenticado('/portal/paciente/preferencias/receitas/push-subscription/revogar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: await request.text() });
    return new NextResponse(await resposta.text(), { status: resposta.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}
