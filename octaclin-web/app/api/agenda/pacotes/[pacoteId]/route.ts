import { NextResponse } from 'next/server';
import {
  ErroPermissaoAusente,
  ErroSessaoAusente,
  exigirPermissaoBff,
  requisitarBackendAutenticado
} from '@/lib/server/sessao-bff';

interface Params {
  params: Promise<{ pacoteId: string }>;
}

export async function DELETE(_request: Request, props: Params) {
  try {
    await exigirPermissaoBff('agenda.consultas.criar');
    const { pacoteId } = await props.params;
    const resposta = await requisitarBackendAutenticado(`/agenda/pacotes/${encodeURIComponent(pacoteId)}`, {
      method: 'DELETE'
    });
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
