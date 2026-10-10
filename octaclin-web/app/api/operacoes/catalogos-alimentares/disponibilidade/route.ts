import { NextResponse } from 'next/server';
import {
  ErroPermissaoAusente,
  ErroSessaoAusente,
  exigirPermissaoBff,
  requisitarBackendAutenticado
} from '@/lib/server/sessao-bff';

export async function GET() {
  try {
    await exigirPermissaoBff('operacoes.tenants.gerenciar');
    const resposta = await requisitarBackendAutenticado('/operacoes/catalogos-alimentares/disponibilidade');
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
    throw erro;
  }
}
