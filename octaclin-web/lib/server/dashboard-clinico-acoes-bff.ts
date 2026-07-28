import { NextResponse } from 'next/server';
import {
  ErroPermissaoAusente,
  exigirPermissaoBff,
  type SessaoBff
} from './sessao-bff';

export async function exigirAcaoDashboardClinico(permissao: string): Promise<SessaoBff> {
  const sessao = await exigirPermissaoBff(permissao);
  if (sessao.papel !== 'SuperAdmin' && sessao.papel !== 'Professional') {
    throw new ErroPermissaoAusente();
  }
  return sessao;
}

export function encaminharRespostaDashboardClinico(resposta: Response) {
  return new NextResponse(resposta.body, {
    status: resposta.status,
    headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
  });
}
