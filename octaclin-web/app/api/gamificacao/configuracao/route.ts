import { NextRequest, NextResponse } from 'next/server';
import {
  ErroPermissaoAusente,
  ErroSessaoAusente,
  exigirPermissaoBff,
  requisitarBackendAutenticado
} from '@/lib/server/sessao-bff';

function tratarErro(erro: unknown) {
  if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
  if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
  throw erro;
}

export async function GET() {
  try {
    await exigirPermissaoBff('gamificacao.gerenciar');
    const resposta = await requisitarBackendAutenticado('/gamificacao/configuracao');
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  } catch (erro) {
    return tratarErro(erro);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await exigirPermissaoBff('gamificacao.gerenciar');
    const resposta = await requisitarBackendAutenticado('/gamificacao/configuracao', {
      method: 'PATCH',
      body: await request.text()
    });
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  } catch (erro) {
    return tratarErro(erro);
  }
}
