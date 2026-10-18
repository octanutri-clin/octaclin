import { NextResponse } from 'next/server';
import { executarProxyPlanoAlimentar, ErroCorpoAcimaDoLimite, lerCorpoLimitado, montarConsultaPermitida } from '../../pacientes/[id]/planos-alimentares/_proxy';

export const LIMITE_CORPO_BIBLIOTECA = 16 * 1024;
export const LIMITE_CORPO_MEDIDA = 4 * 1024;
export const privado = { 'Cache-Control': 'private, no-store' };
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function encaminhar(caminho: string, permissao: 'planos_alimentares.ler' | 'planos_alimentares.gerenciar', init?: RequestInit, limite?: number) {
  try {
    return await executarProxyPlanoAlimentar(caminho, permissao, init, limite);
  } catch {
    return NextResponse.json({ mensagem: 'Serviço temporariamente indisponível.' }, { status: 503, headers: privado });
  }
}

export async function lerCorpoBiblioteca(request: Request, limite: number) {
  try { return { corpo: await lerCorpoLimitado(request, limite) }; }
  catch (erro) {
    if (erro instanceof ErroCorpoAcimaDoLimite) return { resposta: NextResponse.json({ mensagem: 'Solicitação acima do limite.' }, { status: 413, headers: privado }) };
    return { resposta: NextResponse.json({ mensagem: 'Não foi possível ler a solicitação.' }, { status: 400, headers: privado }) };
  }
}

export function consultaBiblioteca(request: Request) {
  return montarConsultaPermitida(request, ['pagina', 'limite', 'escopo']);
}
