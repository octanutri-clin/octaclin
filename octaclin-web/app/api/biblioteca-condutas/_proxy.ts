import { NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

// Item de biblioteca nao pertence a um paciente (e conhecimento da clinica,
// compartilhado no tenant inteiro), mesma decisao ja tomada para modelos de
// evolucao clinica (Fase 271): a rota vive fora de `/pacientes/[id]`.
export async function executarProxyBibliotecaCondutas(
  caminho: string,
  permissao: 'pacientes.ler' | 'pacientes.gerenciar',
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

// Fail-closed: so os parametros nomeados chegam ao backend; o resto e descartado.
export function montarConsultaPermitida(request: Request, permitidos: readonly string[]): string {
  const origem = new URL(request.url).searchParams;
  const partes: string[] = [];
  for (const chave of permitidos) {
    const valor = origem.get(chave);
    if (valor !== null && valor !== '') partes.push(`${chave}=${encodeURIComponent(valor)}`);
  }
  return partes.length ? `?${partes.join('&')}` : '';
}
