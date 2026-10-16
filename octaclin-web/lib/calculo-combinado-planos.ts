import type { SelecaoCalculoLocal, SelecaoCalculoPlanoApi } from './plano-alimentar-api';

export function iniciarSelecaoCalculo(plano: SelecaoCalculoPlanoApi, titulo: string): SelecaoCalculoLocal | null {
  if (!plano.versao || !plano.ativoParaPaciente) return null;
  return {
    planoId: plano.planoId,
    titulo,
    versaoId: plano.versao.id,
    numeroVersao: plano.versao.numero,
    publicadaEm: plano.versao.publicadaEm,
    ativacaoRevisao: plano.ativacaoRevisao,
    ativoParaPaciente: plano.ativoParaPaciente,
    refeicoes: plano.refeicoes.map(refeicao => ({ ...refeicao, selecionada: refeicao.ativa }))
  };
}

/** Após 409, mantém só identidades antes selecionadas que ainda existem. */
export function atualizarSelecaoCalculo(obsoleta: SelecaoCalculoLocal, atual: SelecaoCalculoPlanoApi): SelecaoCalculoLocal | null {
  if (!atual.versao || atual.planoId !== obsoleta.planoId) return null;
  const selecionadas = new Set(obsoleta.refeicoes.filter(refeicao => refeicao.selecionada).map(refeicao => refeicao.identidadeId));
  return {
    planoId: atual.planoId,
    titulo: obsoleta.titulo,
    versaoId: atual.versao.id,
    numeroVersao: atual.versao.numero,
    publicadaEm: atual.versao.publicadaEm,
    ativacaoRevisao: atual.ativacaoRevisao,
    ativoParaPaciente: atual.ativoParaPaciente,
    refeicoes: atual.refeicoes.map(refeicao => ({ ...refeicao, selecionada: selecionadas.has(refeicao.identidadeId) }))
  };
}

export function montarEntradaCalculoCombinado(selecoes: readonly SelecaoCalculoLocal[]) {
  return {
    selecoes: selecoes.map(plano => ({
      planoId: plano.planoId,
      versaoIdEsperada: plano.versaoId,
      ativacaoRevisaoEsperada: plano.ativacaoRevisao,
      identidadesRefeicoes: plano.refeicoes.filter(refeicao => refeicao.selecionada).map(refeicao => refeicao.identidadeId)
    }))
  };
}
