import { NextRequest, NextResponse } from 'next/server';
import {
  ErroPermissaoAusente,
  ErroSessaoAusente,
  exigirPermissaoBff,
  requisitarBackendAutenticado
} from '@/lib/server/sessao-bff';

type Contexto = { params: Promise<{ segmentos: string[] }> };

const rotasPermitidas = [
  /^chaves$/,
  /^chaves\/[0-9a-f-]+$/i,
  /^chaves\/[0-9a-f-]+\/rotacao$/i,
  /^webhooks$/,
  /^webhooks\/[0-9a-f-]+$/i,
  /^webhooks\/[0-9a-f-]+\/rotacao$/i,
  /^webhooks\/entregas$/,
  /^webhooks\/entregas\/[0-9a-f-]+\/reprocessamento$/i
];

function tratarErro(erro: unknown) {
  if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
  if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
  throw erro;
}

async function encaminhar(request: NextRequest, contexto: Contexto, metodo: 'GET' | 'POST' | 'DELETE') {
  try {
    await exigirPermissaoBff('cliente.configuracoes.gerenciar');
    const { segmentos } = await contexto.params;
    const caminho = segmentos.join('/');
    if (!rotasPermitidas.some((padrao) => padrao.test(caminho))) {
      return NextResponse.json({ mensagem: 'Rota de integracao nao permitida.' }, { status: 404 });
    }
    const corpo = metodo === 'POST' ? await request.text() : undefined;
    const resposta = await requisitarBackendAutenticado(`/cliente/integracoes/${caminho}`, {
      method: metodo,
      ...(corpo ? { body: corpo } : {})
    });
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  } catch (erro) {
    return tratarErro(erro);
  }
}

export const GET = (request: NextRequest, contexto: Contexto) => encaminhar(request, contexto, 'GET');
export const POST = (request: NextRequest, contexto: Contexto) => encaminhar(request, contexto, 'POST');
export const DELETE = (request: NextRequest, contexto: Contexto) => encaminhar(request, contexto, 'DELETE');
