import { NextRequest, NextResponse } from 'next/server';
import {
  ErroPermissaoAusente,
  ErroSessaoAusente,
  exigirPermissaoBff,
  requisitarBackendAutenticado
} from '@/lib/server/sessao-bff';

function tratar(erro: unknown) {
  if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
  if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
  throw erro;
}

export async function GET(_requisicao: NextRequest, contexto: { params: Promise<{ tenantId: string }> }) {
  try {
    await exigirPermissaoBff('operacoes.tenants.gerenciar');
    const { tenantId } = await contexto.params;
    const resposta = await requisitarBackendAutenticado(`/operacoes/feature-flags/${encodeURIComponent(tenantId)}`);
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('content-type') ?? 'application/json' }
    });
  } catch (erro) {
    return tratar(erro);
  }
}
