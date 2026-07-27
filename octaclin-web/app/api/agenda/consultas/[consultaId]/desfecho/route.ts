import { NextRequest, NextResponse } from 'next/server';
import {
  ErroPermissaoAusente,
  ErroSessaoAusente,
  exigirPermissaoBff,
  requisitarBackendAutenticado
} from '@/lib/server/sessao-bff';

interface Params {
  params: Promise<{ consultaId: string }>;
}

export async function POST(request: NextRequest, props: Params) {
  try {
    await exigirPermissaoBff('agenda.consultas.criar');
    const params = await props.params;
    const resposta = await requisitarBackendAutenticado(
      `/agenda/consultas/${encodeURIComponent(params.consultaId)}/desfecho`,
      {
        method: 'POST',
        headers: { 'x-octaclin-origem': 'agenda' },
        body: await request.text()
      }
    );
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) {
      return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    }
    if (erro instanceof ErroPermissaoAusente) {
      return NextResponse.json({ mensagem: erro.message }, { status: 403 });
    }
    throw erro;
  }
}
