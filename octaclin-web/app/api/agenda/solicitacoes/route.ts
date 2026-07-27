import { NextRequest, NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

function tratarErroSessao(erro: unknown) {
  if (erro instanceof ErroSessaoAusente) {
    return NextResponse.json({ mensagem: erro.message }, { status: 401 });
  }
  if (erro instanceof ErroPermissaoAusente) {
    return NextResponse.json({ mensagem: erro.message }, { status: 403 });
  }
  throw erro;
}

function mapearSolicitacao(solicitacao: {
  id: string;
  profissionalId: string;
  inicioEm: string;
  fimEm: string;
  nome: string;
  contato?: { email?: string; whatsapp?: string };
  observacao?: string;
  status: 'pendente' | 'processando' | 'aprovada' | 'recusada' | 'expirada';
  expiraEm: string;
  decididaEm?: string | null;
  decididaPorUsuarioId?: string | null;
  pacienteId?: string | null;
  consultaId?: string | null;
  criadoEm: string;
  atualizadoEm: string;
}) {
  return {
    id: solicitacao.id,
    profissionalId: solicitacao.profissionalId,
    inicioEm: solicitacao.inicioEm,
    fimEm: solicitacao.fimEm,
    nome: solicitacao.nome,
    email: solicitacao.contato?.email,
    whatsapp: solicitacao.contato?.whatsapp,
    observacao: solicitacao.observacao,
    status: solicitacao.status,
    expiraEm: solicitacao.expiraEm,
    decididaEm: solicitacao.decididaEm,
    decididaPorUsuarioId: solicitacao.decididaPorUsuarioId,
    pacienteId: solicitacao.pacienteId,
    consultaId: solicitacao.consultaId,
    criadoEm: solicitacao.criadoEm,
    atualizadoEm: solicitacao.atualizadoEm
  };
}

export async function GET(request: NextRequest) {
  try {
    await exigirPermissaoBff('agenda.consultas.ler');
    const profissionalId = request.nextUrl.searchParams.get('profissionalId');
    const parametros = new URLSearchParams();
    if (profissionalId) parametros.set('profissionalId', profissionalId);

    const resposta = await requisitarBackendAutenticado(
      `/agenda/solicitacoes${parametros.size ? `?${parametros.toString()}` : ''}`
    );
    const solicitacoes = (await resposta.json()) as Array<Parameters<typeof mapearSolicitacao>[0]>;
    const itens = solicitacoes.map(mapearSolicitacao);

    return NextResponse.json({
      itens,
      total: itens.length
    });
  } catch (erro) {
    return tratarErroSessao(erro);
  }
}
