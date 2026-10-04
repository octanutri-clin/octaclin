import { NextRequest, NextResponse } from 'next/server';
import {
  ErroPermissaoAusente,
  ErroSessaoAusente,
  exigirPermissaoBff,
  requisitarBackendAutenticado
} from '@/lib/server/sessao-bff';

type Contexto = { params: Promise<{ segmentos: string[] }> };

const rotasPermitidas = [
  /^acesso$/,
  /^chaves$/,
  /^chaves\/[0-9a-f-]+$/i,
  /^chaves\/[0-9a-f-]+\/rotacao$/i,
  /^webhooks$/,
  /^webhooks\/[0-9a-f-]+$/i,
  /^webhooks\/[0-9a-f-]+\/rotacao$/i,
  /^webhooks\/entregas$/,
  /^webhooks\/entregas\/[0-9a-f-]+\/reprocessamento$/i
];

async function encaminhar(request: NextRequest, contexto: Contexto, metodo: 'GET' | 'POST' | 'DELETE') {
  try {
    await exigirPermissaoBff('integracoes.acessar');
    const { segmentos } = await contexto.params;
    const caminho = segmentos.join('/');
    if (!rotasPermitidas.some((padrao) => padrao.test(caminho))) {
      return NextResponse.json({ mensagem: 'Rota de integração não permitida.' }, { status: 404 });
    }
    if (metodo === 'GET' && caminho !== 'acesso' && caminho !== 'chaves' && caminho !== 'webhooks' && caminho !== 'webhooks/entregas') {
      return NextResponse.json({ mensagem: 'Método não permitido.' }, { status: 405 });
    }
    if (metodo === 'POST' && !/^(chaves|chaves\/[0-9a-f-]+\/rotacao|webhooks|webhooks\/[0-9a-f-]+\/rotacao|webhooks\/entregas\/[0-9a-f-]+\/reprocessamento)$/i.test(caminho)) {
      return NextResponse.json({ mensagem: 'Método não permitido.' }, { status: 405 });
    }
    if (metodo === 'DELETE' && !/^(chaves\/[0-9a-f-]+|webhooks\/[0-9a-f-]+)$/i.test(caminho)) {
      return NextResponse.json({ mensagem: 'Método não permitido.' }, { status: 405 });
    }
    const corpo = metodo === 'POST' ? await request.text() : undefined;
    const resposta = await requisitarBackendAutenticado(`/profissional/integracoes/${caminho}`, {
      method: metodo,
      ...(corpo ? { body: corpo } : {})
    });
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: {
        'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json',
        'Cache-Control': 'private, no-store'
      }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
    throw erro;
  }
}

export const GET = (request: NextRequest, contexto: Contexto) => encaminhar(request, contexto, 'GET');
export const POST = (request: NextRequest, contexto: Contexto) => encaminhar(request, contexto, 'POST');
export const DELETE = (request: NextRequest, contexto: Contexto) => encaminhar(request, contexto, 'DELETE');
