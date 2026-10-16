import type { PlanoAlimentarApi, ResultadoAtivacaoPlanoApi, VersaoPlanoAlimentarApi } from './plano-alimentar-api';

export interface EstadoAtivacaoRefeicao {
  refeicaoId: string;
  identidadeId: string;
  ativa: boolean;
}
export interface VersaoComAtivacaoRefeicoes {
  ativoParaPaciente?: boolean;
  ativacaoRevisao?: number;
  ativacaoRefeicoes?: EstadoAtivacaoRefeicao[];
  ativacaoEdicao?: Array<{ chaveCliente: string; identidadeId: string; ativa: boolean }>;
}

export function ativacaoOperacionalEstaDesatualizada(
  atual: VersaoComAtivacaoRefeicoes | undefined,
  recebida: VersaoComAtivacaoRefeicoes | undefined
) {
  if (!atual) return false;
  return (recebida?.ativacaoRevisao ?? 0) < (atual.ativacaoRevisao ?? 0);
}

function aplicarAtivacaoVersao(versao: VersaoPlanoAlimentarApi | undefined, resultado: ResultadoAtivacaoPlanoApi) {
  if (!versao || ativacaoOperacionalEstaDesatualizada(versao, resultado)) return versao;
  return {
    ...versao,
    ativoParaPaciente: resultado.ativoParaPaciente,
    ativacaoRevisao: resultado.ativacaoRevisao,
    ...(resultado.identidadeRefeicaoId ? {
      ativacaoRefeicoes: versao.ativacaoRefeicoes?.map((estado) => estado.identidadeId === resultado.identidadeRefeicaoId
        ? { ...estado, ativa: resultado.ativa === true }
        : estado),
      ativacaoEdicao: versao.ativacaoEdicao?.map((estado) => estado.identidadeId === resultado.identidadeRefeicaoId
        ? { ...estado, ativa: resultado.ativa === true }
        : estado)
    } : {})
  };
}

/** Aplica apenas um ACK operacional; conteúdo editorial e histórico não mudam. */
export function aplicarAckAtivacao(plano: PlanoAlimentarApi, resultado: ResultadoAtivacaoPlanoApi): PlanoAlimentarApi {
  if (resultado.ativacaoRevisao < (plano.ativacaoRevisao ?? 0)) return plano;
  return {
    ...plano,
    ativoParaPaciente: resultado.ativoParaPaciente,
    ativacaoRevisao: resultado.ativacaoRevisao,
    ...(resultado.identidadeRefeicaoId ? { resumoNutricionalVigente: { estado: 'indisponivel' as const } } : {}),
    current: aplicarAtivacaoVersao(plano.current, resultado),
    draft: aplicarAtivacaoVersao(plano.draft, resultado)
  };
}

/** Reconcilia somente projeções operacionais sem substituir a edição local. */
export function mesclarProjecaoAtivacao(plano: PlanoAlimentarApi, remoto: PlanoAlimentarApi): PlanoAlimentarApi {
  if ((remoto.ativacaoRevisao ?? 0) < (plano.ativacaoRevisao ?? 0)) return plano;
  const mesclarVersao = (atual: VersaoPlanoAlimentarApi | undefined, recebida: VersaoPlanoAlimentarApi | undefined) => {
    if (!atual || !recebida || atual.id !== recebida.id || ativacaoOperacionalEstaDesatualizada(atual, recebida)) return atual;
    // O GET pode ter sido capturado antes do ACK de autosave mais recente.
    // Nunca reaplique vínculos físicos/chaves de uma revisão editorial antiga.
    if ((recebida.rascunhoRevisao ?? 0) < (atual.rascunhoRevisao ?? 0)) {
      if ((recebida.ativacaoRevisao ?? 0) === (atual.ativacaoRevisao ?? 0)) return atual;
      return { ...atual, ativoParaPaciente: recebida.ativoParaPaciente,
        ativacaoRevisao: recebida.ativacaoRevisao, ativacaoRefeicoes: undefined,
        ativacaoEdicao: undefined, resumoRefeicoesAtivas: { estado: 'indisponivel' as const } };
    }
    return {
      ...atual,
      ativoParaPaciente: recebida.ativoParaPaciente,
      ativacaoRevisao: recebida.ativacaoRevisao,
      ativacaoRefeicoes: recebida.ativacaoRefeicoes,
      ativacaoEdicao: recebida.ativacaoEdicao,
      resumoRefeicoesAtivas: recebida.resumoRefeicoesAtivas
    };
  };
  return {
    ...plano,
    ativoParaPaciente: remoto.ativoParaPaciente,
    ativacaoRevisao: remoto.ativacaoRevisao,
    resumoNutricionalVigente: remoto.resumoNutricionalVigente,
    current: mesclarVersao(plano.current, remoto.current),
    draft: mesclarVersao(plano.draft, remoto.draft)
  };
}

/**
 * Resolve somente vínculos explícitos. No rascunho protegido a chave atual do
 * documento é autoritativa; o fallback legado exige igualdade exata entre a
 * chave antiga e o ID físico da mesma versão.
 */
export function localizarAtivacaoRefeicao(
  versao: VersaoComAtivacaoRefeicoes | undefined,
  chaveCliente: string
): { identidadeId: string; ativa: boolean } | undefined {
  if (!versao || !chaveCliente) return undefined;
  const editada = versao.ativacaoEdicao?.find((estado) => estado.chaveCliente === chaveCliente);
  if (editada) return { identidadeId: editada.identidadeId, ativa: editada.ativa === true };
  const legada = versao.ativacaoRefeicoes?.find((estado) => estado.refeicaoId === chaveCliente);
  if (legada) return { identidadeId: legada.identidadeId, ativa: legada.ativa === true };
  return undefined;
}
