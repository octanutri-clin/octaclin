import { NextResponse } from 'next/server';
import {
  ErroPermissaoAusente,
  ErroSessaoAusente,
  exigirPermissaoBff,
  requisitarBackendAutenticado
} from '@/lib/server/sessao-bff';

interface Params {
  params: Promise<{ envioId: string }>;
}

export async function POST(request: Request, props: Params) {
  try {
    await exigirPermissaoBff('questionarios.gerenciar');
    const dados = await request.json() as { comprovanteLeitura?: unknown };
    if (typeof dados.comprovanteLeitura !== 'string') return NextResponse.json({ mensagem: 'Abra a resposta antes de concluir.' }, { status: 400 });
    const params = await props.params;
    const resposta = await requisitarBackendAutenticado(
      `/questionarios/envios/${encodeURIComponent(params.envioId)}/revisar`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comprovanteLeitura: dados.comprovanteLeitura }) }
    );
    const texto = await resposta.text();
    if (!resposta.ok) {
      return new NextResponse(texto, {
        status: resposta.status,
        headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
      });
    }

    const corpo = JSON.parse(texto) as Record<string, unknown>;
    return NextResponse.json({
      id: corpo.id,
      status: corpo.status,
      ...(typeof corpo.revisadoEm === 'string' ? { revisadoEm: corpo.revisadoEm } : {}),
      ...(typeof corpo.revisadoPorUsuarioId === 'string'
        ? { revisadoPorUsuarioId: corpo.revisadoPorUsuarioId }
        : {})
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
