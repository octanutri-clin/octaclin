import { NextResponse } from 'next/server';
import {
  ErroPermissaoAusente,
  ErroSessaoAusente,
  exigirPermissaoBff,
  requisitarBackendAutenticado
} from '@/lib/server/sessao-bff';

const CABECALHOS = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' };

function tratar(erro: unknown) {
  if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
  if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
  throw erro;
}

async function repassar(resposta: Response) {
  return new NextResponse(await resposta.text(), { status: resposta.status, headers: CABECALHOS });
}

export async function GET() {
  try {
    await exigirPermissaoBff('cliente.configuracoes.gerenciar');
    return repassar(await requisitarBackendAutenticado('/cliente/kit-inicial'));
  } catch (erro) {
    return tratar(erro);
  }
}

export async function POST(request: Request) {
  try {
    await exigirPermissaoBff('cliente.configuracoes.gerenciar');
    return repassar(await requisitarBackendAutenticado('/cliente/kit-inicial', {
      method: 'POST',
      body: await request.text()
    }));
  } catch (erro) {
    return tratar(erro);
  }
}
