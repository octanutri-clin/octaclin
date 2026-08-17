import { NextResponse } from 'next/server';
import {
  ErroPermissaoAusente,
  ErroSessaoAusente,
  exigirPermissaoBff,
  requisitarBackendAutenticado
} from '@/lib/server/sessao-bff';

export async function executarProxyPlanoAlimentar(
  caminho: string,
  permissao: 'planos_alimentares.ler' | 'planos_alimentares.gerenciar',
  init?: RequestInit
) {
  try {
    await exigirPermissaoBff(permissao);
    const resposta = await requisitarBackendAutenticado(caminho, init);
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: {
        'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json',
        'Cache-Control': 'no-store'
      }
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

export async function lerCorpo(request: Request) {
  const corpo = await request.text();
  return corpo || '{}';
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
