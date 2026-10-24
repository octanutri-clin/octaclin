import { NextResponse } from 'next/server';
import {
  ErroPermissaoAusente,
  ErroSessaoAusente,
  exigirPermissaoBff,
  requisitarBackendAutenticado
} from '@/lib/server/sessao-bff';

const CABECALHOS_PRIVADOS = { 'Cache-Control': 'private, no-store' };

export async function executarProxyPlanoAlimentar(
  caminho: string,
  permissao: 'planos_alimentares.ler' | 'planos_alimentares.gerenciar' | 'grupos_substituicoes.administrar',
  init?: RequestInit,
  limiteCorpoBytes?: number
) {
  try {
    await exigirPermissaoBff(permissao);
    if (limiteCorpoBytes !== undefined && typeof init?.body === 'string'
      && new TextEncoder().encode(init.body).byteLength > limiteCorpoBytes) {
      return NextResponse.json({ mensagem: 'Solicitação acima do limite.' }, { status: 413, headers: CABECALHOS_PRIVADOS });
    }
    const resposta = await requisitarBackendAutenticado(caminho, init);
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: {
        'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json',
        ...CABECALHOS_PRIVADOS
      }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) {
      return NextResponse.json({ mensagem: erro.message }, { status: 401, headers: CABECALHOS_PRIVADOS });
    }
    if (erro instanceof ErroPermissaoAusente) {
      return NextResponse.json({ mensagem: erro.message }, { status: 403, headers: CABECALHOS_PRIVADOS });
    }
    throw erro;
  }
}

export async function lerCorpo(request: Request) {
  const corpo = await request.text();
  return corpo || '{}';
}

export class ErroCorpoAcimaDoLimite extends Error {}

/** Lê o body em blocos e interrompe assim que ultrapassa o limite configurado. */
export async function lerCorpoLimitado(request: Request | Response, limiteBytes: number): Promise<string> {
  const tamanhoDeclarado = Number(request.headers.get('content-length'));
  if (Number.isFinite(tamanhoDeclarado) && tamanhoDeclarado > limiteBytes) throw new ErroCorpoAcimaDoLimite();
  if (!request.body) return '{}';
  const leitor = request.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      total += value.byteLength;
      if (total > limiteBytes) {
        await leitor.cancel();
        throw new ErroCorpoAcimaDoLimite();
      }
      partes.push(value);
    }
  } finally {
    leitor.releaseLock();
  }
  const corpo = new Uint8Array(total);
  let deslocamento = 0;
  for (const parte of partes) { corpo.set(parte, deslocamento); deslocamento += parte.byteLength; }
  return new TextDecoder().decode(corpo) || '{}';
}

// Fail-closed: só os parâmetros nomeados chegam ao backend; o resto é descartado.
// Codifica com encodeURIComponent (espaco vira %20, nao +) para preservar o
// formato ja acordado com o backend nas rotas que existiam antes da paginacao.
export function montarConsultaPermitida(request: Request, permitidos: readonly string[]): string {
  const origem = new URL(request.url).searchParams;
  const partes: string[] = [];
  for (const chave of permitidos) {
    const valor = origem.get(chave);
    if (valor !== null && valor !== '') partes.push(`${chave}=${encodeURIComponent(valor)}`);
  }
  return partes.length ? `?${partes.join('&')}` : '';
}
