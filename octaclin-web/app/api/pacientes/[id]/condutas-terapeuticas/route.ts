import { NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return encaminhar(params, '/condutas-terapeuticas');
}

export async function POST(requisicao: Request, { params }: { params: Promise<{ id: string }> }) {
  return encaminhar(params, '/condutas-terapeuticas', { method: 'POST', body: await requisicao.text(), headers: { 'Content-Type': 'application/json' } });
}

async function encaminhar(params: Promise<{ id: string }>, sufixo: string, init?: RequestInit) {
  try {
    const { id } = await params;
    const resposta = await requisitarBackendAutenticado(`/pacientes/${encodeURIComponent(id)}${sufixo}`, init);
    return new NextResponse(await resposta.text(), { status: resposta.status, headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' } });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}
