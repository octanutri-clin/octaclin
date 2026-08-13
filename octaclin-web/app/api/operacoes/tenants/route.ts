import { NextRequest, NextResponse } from 'next/server';
import {
  ErroPermissaoAusente,
  ErroSessaoAusente,
  exigirPermissaoBff,
  requisitarBackendAutenticado
} from '@/lib/server/sessao-bff';

function repassar(resposta: Response) {
  return new NextResponse(resposta.body, {
    status: resposta.status,
    headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
  });
}

function tratar(erro: unknown) {
  if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
  if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
  throw erro;
}

export async function GET() {
  try {
    await exigirPermissaoBff('operacoes.tenants.gerenciar');
    return repassar(await requisitarBackendAutenticado('/operacoes/tenants'));
  } catch (erro) {
    return tratar(erro);
  }
}

export async function POST(request: NextRequest) {
  try {
    await exigirPermissaoBff('operacoes.tenants.gerenciar');
    return repassar(
      await requisitarBackendAutenticado('/operacoes/tenants', { method: 'POST', body: await request.text() })
    );
  } catch (erro) {
    return tratar(erro);
  }
}
