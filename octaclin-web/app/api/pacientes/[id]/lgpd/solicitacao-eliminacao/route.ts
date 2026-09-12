import { NextRequest, NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

interface Params { params: Promise<{ id: string }> }

/**
 * Solicitacao de eliminacao de dados LGPD -- nao e "excluir paciente".
 * Rota distinta de arquivar (encerrar acompanhamento) e de
 * conta-acesso/desativacao (so a conta de login). Ver
 * ServicoPacientes.solicitarEliminacaoDadosLgpd no backend.
 */
export async function PATCH(_request: NextRequest, props: Params) {
  const { id } = await props.params;
  try {
    await exigirPermissaoBff('pacientes.gerenciar');
    const resposta = await requisitarBackendAutenticado(`/pacientes/${encodeURIComponent(id)}/lgpd/solicitacao-eliminacao`, {
      method: 'PATCH'
    });
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
    throw erro;
  }
}
