import { NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function executarProxyCatalogoMarcadores(
  caminho: string,
  permissao: 'pacientes.ler' | 'pacientes.gerenciar',
  init?: RequestInit | (() => Promise<RequestInit>)
) {
  try {
    await exigirPermissaoBff(permissao);
    const opcoes = typeof init === 'function' ? await init() : init;
    const resposta = await requisitarBackendAutenticado(caminho, opcoes);
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: {
        'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
    throw erro;
  }
}

export function montarConsultaCatalogo(request: Request) {
  const origem = new URL(request.url).searchParams;
  const partes: string[] = [];
  for (const chave of ['pagina', 'limite']) {
    const valor = origem.get(chave);
    if (valor !== null && valor !== '') partes.push(`${chave}=${encodeURIComponent(valor)}`);
  }
  return partes.length ? `?${partes.join('&')}` : '';
}
