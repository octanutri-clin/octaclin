import { NextResponse } from 'next/server';
import { ErroCorpoAcimaDoLimite, executarProxyPlanoAlimentar, lerCorpoLimitado } from '../../../../../pacientes/[id]/planos-alimentares/_proxy';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LIMITE_CORPO = 4 * 1024;
const privado = { 'Cache-Control': 'private, no-store' };
type Contexto = { params: Promise<{ alimentoId: string; medidaId: string }> };

async function encaminhar(caminho: string, init: RequestInit) {
  try { return await executarProxyPlanoAlimentar(caminho, 'planos_alimentares.gerenciar', init, LIMITE_CORPO); }
  catch { return NextResponse.json({ mensagem: 'Serviço temporariamente indisponível.' }, { status: 503, headers: privado }); }
}

export async function PATCH(request: Request, { params }: Contexto) {
  const { alimentoId, medidaId } = await params;
  if (!UUID.test(alimentoId) || !UUID.test(medidaId)) {
    return NextResponse.json({ mensagem: 'Identificador de medida inválido.' }, { status: 400, headers: privado });
  }
  let body: string;
  try {
    body = await lerCorpoLimitado(request, LIMITE_CORPO);
  } catch (erro) {
    if (erro instanceof ErroCorpoAcimaDoLimite) return NextResponse.json({ mensagem: 'Solicitação acima do limite.' }, { status: 413, headers: privado });
    return NextResponse.json({ mensagem: 'Não foi possível ler a solicitação.' }, { status: 400, headers: privado });
  }
  return encaminhar(`/planos-alimentares/alimentos/${encodeURIComponent(alimentoId)}/medidas-caseiras/${encodeURIComponent(medidaId)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body
  });
}
