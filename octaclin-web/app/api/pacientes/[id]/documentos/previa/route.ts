import { NextRequest, NextResponse } from 'next/server';
import {
  ErroPermissaoAusente,
  ErroSessaoAusente,
  exigirPermissaoBff,
  requisitarBackendAutenticado
} from '@/lib/server/sessao-bff';

interface Params {
  params: Promise<{ id: string }>;
}

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', Vary: 'Cookie' };

function respostaErro(erro: unknown) {
  if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401, headers });
  if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403, headers });
  return NextResponse.json({ mensagem: 'Não foi possível preparar a prévia.' }, { status: 502, headers });
}

export async function POST(request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    await exigirPermissaoBff('pacientes.gerenciar');
    const corpo = await request.text();
    if (new TextEncoder().encode(corpo).byteLength > 24_000) {
      return NextResponse.json({ mensagem: 'Solicitação acima do limite.' }, { status: 413, headers });
    }
    const resposta = await requisitarBackendAutenticado(
      `/pacientes/${encodeURIComponent(params.id)}/documentos/previa`,
      { method: 'POST', body: corpo }
    );
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { ...headers, 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  } catch (erro) {
    return respostaErro(erro);
  }
}
