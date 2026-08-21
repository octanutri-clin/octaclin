import { NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

async function encaminhar(requisicao: Request, params: Promise<{ id: string; condutaId: string; acao: string }>) {
  try {
    const { id, condutaId, acao } = await params;
    if (!['rascunho', 'publicacao', 'nova-versao', 'arquivamento'].includes(acao)) return NextResponse.json({ mensagem: 'Ação inválida.' }, { status: 404 });
    const resposta = await requisitarBackendAutenticado(`/pacientes/${encodeURIComponent(id)}/condutas-terapeuticas/${encodeURIComponent(condutaId)}/${encodeURIComponent(acao)}`, {
      method: requisicao.method,
      ...(requisicao.method === 'PUT' ? { body: await requisicao.text(), headers: { 'Content-Type': 'application/json' } } : {})
    });
    return new NextResponse(await resposta.text(), { status: resposta.status, headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' } });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}

export async function POST(requisicao: Request, contexto: { params: Promise<{ id: string; condutaId: string; acao: string }> }) { return encaminhar(requisicao, contexto.params); }
export async function PUT(requisicao: Request, contexto: { params: Promise<{ id: string; condutaId: string; acao: string }> }) { return encaminhar(requisicao, contexto.params); }
