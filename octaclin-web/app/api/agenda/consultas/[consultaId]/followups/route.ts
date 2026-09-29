import { NextRequest, NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

interface Params { params: Promise<{ consultaId: string }> }

async function encaminhar(metodo: 'GET' | 'PUT' | 'DELETE', props: Params, request?: NextRequest) {
  const { consultaId } = await props.params;
  try {
    const resposta = await requisitarBackendAutenticado(`/agenda/consultas/${encodeURIComponent(consultaId)}/followups`, {
      method: metodo,
      ...(request ? { body: await request.text() } : {})
    });
    return new NextResponse(await resposta.text(), { status: resposta.status, headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' } });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}

export async function GET(_request: NextRequest, props: Params) { return encaminhar('GET', props); }
export async function PUT(request: NextRequest, props: Params) { return encaminhar('PUT', props, request); }
export async function DELETE(_request: NextRequest, props: Params) { return encaminhar('DELETE', props); }
