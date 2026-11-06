import { NextResponse } from 'next/server';
import { ErroCorpoAcimaDoLimite, executarProxyPlanoAlimentar, lerCorpoLimitado } from '../../../_proxy';
interface Params { params: Promise<{ id: string; planoId: string }> }
const LIMITE_CORPO_PREVIA = 8 * 1024;
export async function POST(request: Request, props: Params) {
  const { id, planoId } = await props.params;
  let body: string;
  try { body = await lerCorpoLimitado(request, LIMITE_CORPO_PREVIA); }
  catch (erro) {
    if (erro instanceof ErroCorpoAcimaDoLimite) return NextResponse.json({mensagem:'Solicitação acima do limite.'}, {status:413,headers:{'Cache-Control':'private, no-store'}});
    throw erro;
  }
  return executarProxyPlanoAlimentar(
    `/pacientes/${encodeURIComponent(id)}/planos-alimentares/${encodeURIComponent(planoId)}/rascunho/previa-micronutrientes`,
    'planos_alimentares.gerenciar', {method:'POST',body}, LIMITE_CORPO_PREVIA
  );
}
