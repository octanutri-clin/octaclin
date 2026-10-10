import { NextResponse } from 'next/server';
import {
  ErroPermissaoAusente,
  ErroSessaoAusente,
  exigirPermissaoBff,
  requisitarBackendAutenticado
} from '@/lib/server/sessao-bff';

const CABECALHOS = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function tratar(erro: unknown) {
  if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401, headers: CABECALHOS });
  if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403, headers: CABECALHOS });
  throw erro;
}

function validarUuid(id: string) {
  return UUID.test(id);
}

async function repassar(resposta: Response) {
  return new NextResponse(await resposta.text(), { status: resposta.status, headers: CABECALHOS });
}

export async function GET(_request: Request, contexto: { params: Promise<{ id: string }> }) {
  try {
    await exigirPermissaoBff('operacoes.tenants.gerenciar');
    const { id } = await contexto.params;
    if (!validarUuid(id)) return NextResponse.json({ mensagem: 'Identificador de clínica inválido.' }, { status: 400, headers: CABECALHOS });
    return repassar(await requisitarBackendAutenticado(`/operacoes/tenants/${encodeURIComponent(id)}/kit-inicial`));
  } catch (erro) {
    return tratar(erro);
  }
}

export async function POST(request: Request, contexto: { params: Promise<{ id: string }> }) {
  try {
    await exigirPermissaoBff('operacoes.tenants.gerenciar');
    const { id } = await contexto.params;
    if (!validarUuid(id)) return NextResponse.json({ mensagem: 'Identificador de clínica inválido.' }, { status: 400, headers: CABECALHOS });
    return repassar(await requisitarBackendAutenticado(`/operacoes/tenants/${encodeURIComponent(id)}/kit-inicial`, {
      method: 'POST',
      body: await request.text()
    }));
  } catch (erro) {
    return tratar(erro);
  }
}
