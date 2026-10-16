import { NextResponse } from 'next/server';
import { ErroCorpoAcimaDoLimite, executarProxyPlanoAlimentar, lerCorpoLimitado } from '../_proxy';

interface Params { params: Promise<{ id: string }> }
const LIMITE_CORPO_CALCULO = 64 * 1024;

export async function POST(request: Request, props: Params) {
  const { id } = await props.params;
  let body: string;
  try {
    body = await lerCorpoLimitado(request, LIMITE_CORPO_CALCULO);
  } catch (erro) {
    if (erro instanceof ErroCorpoAcimaDoLimite) {
      return NextResponse.json({ mensagem: 'Solicitação acima do limite.' }, { status: 413, headers: { 'Cache-Control': 'private, no-store' } });
    }
    throw erro;
  }
  return executarProxyPlanoAlimentar(
    `/pacientes/${encodeURIComponent(id)}/planos-alimentares/calculo-combinado`,
    'planos_alimentares.ler',
    { method: 'POST', body },
    LIMITE_CORPO_CALCULO
  );
}
