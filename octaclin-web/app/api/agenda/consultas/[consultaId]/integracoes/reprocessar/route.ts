import { NextResponse } from 'next/server';
import {
  ErroPermissaoAusente,
  ErroSessaoAusente,
  exigirPermissaoBff,
  requisitarBackendAutenticado
} from '@/lib/server/sessao-bff';

interface Params {
  params: Promise<{ consultaId: string }>;
}

export async function POST(_request: Request, props: Params) {
  try {
    await exigirPermissaoBff('agenda.consultas.criar');
    const { consultaId } = await props.params;
    const resposta = await requisitarBackendAutenticado(
      `/agenda/consultas/${encodeURIComponent(consultaId)}/integracoes/reprocessar`,
      { method: 'POST' }
    );
    return new NextResponse(resposta.body, {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
    throw erro;
  }
}
