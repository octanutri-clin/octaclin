import { idadePediatrica, instanteCivil } from '../../pacientes/dominio/idade-pediatrica';
import type { ContextoComparacaoDietetica } from './comparacao-dietetica';
export interface EntradaContextoDietetico {
  nascimento?: string;
  dataAnalise: string;
  populacaoReferencia: 'masculina' | 'feminina' | 'nao_informada';
  populacaoConfirmada: boolean;
  gestacao: 'sim' | 'nao' | 'nao_informada';
  lactacao: 'sim' | 'nao' | 'nao_informada';
  aplicabilidade: 'confirmada' | 'nao_aplicavel' | 'nao_informada';
  mesmoDiaPlanejado: boolean;
  tabagismo: ContextoComparacaoDietetica['tabagismo'];
}
export type MotivoContextoDietetico = 'data_invalida' | 'nascimento_nao_informado' | 'nascimento_futuro' |
  'idade_fora_do_escopo' | 'populacao_nao_confirmada' | 'gestacao_fora_do_escopo' |
  'lactacao_fora_do_escopo' | 'fisiologia_nao_confirmada' | 'aplicabilidade_nao_confirmada' | 'confirmacao_invalida';
export interface ContextoDieteticoResolvido {
  contexto: ContextoComparacaoDietetica;
  motivos: MotivoContextoDietetico[];
  idadeAnos?: number;
  populacaoReferencia?: 'masculina' | 'feminina';
}
/** Contrato interno; a camada autorizada deve obter a data no fuso canônico do tenant. */
export function resolverContextoDietetico(entrada: EntradaContextoDietetico): ContextoDieteticoResolvido {
  const motivos = new Set<MotivoContextoDietetico>();
  const resultado: ContextoDieteticoResolvido = {
    contexto: { elegivel: false, mesmoDiaPlanejado: false, tabagismo: 'nao_informado' }, motivos: []
  };
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) {
    return { ...resultado, motivos: ['confirmacao_invalida'] };
  }
  const populacaoValida = entrada.populacaoReferencia === 'masculina' || entrada.populacaoReferencia === 'feminina';
  const fisiologiaValida = (valor: unknown): boolean => valor === 'sim' || valor === 'nao' || valor === 'nao_informada';
  const tabagismoValido = entrada.tabagismo === 'sim' || entrada.tabagismo === 'nao' || entrada.tabagismo === 'nao_informado';
  if (typeof entrada.populacaoConfirmada !== 'boolean' || typeof entrada.mesmoDiaPlanejado !== 'boolean' ||
      (!populacaoValida && entrada.populacaoReferencia !== 'nao_informada') ||
      !fisiologiaValida(entrada.gestacao) || !fisiologiaValida(entrada.lactacao) || !tabagismoValido ||
      !['confirmada', 'nao_aplicavel', 'nao_informada'].includes(entrada.aplicabilidade)) motivos.add('confirmacao_invalida');
  resultado.contexto.mesmoDiaPlanejado = entrada.mesmoDiaPlanejado === true;
  if (tabagismoValido) resultado.contexto.tabagismo = entrada.tabagismo;
  try {
    // Valida a data de análise mesmo quando o nascimento estiver ausente.
    if (typeof entrada.dataAnalise !== 'string') throw new Error('data_civil_invalida');
    instanteCivil(entrada.dataAnalise);
    if (entrada.nascimento === undefined) motivos.add('nascimento_nao_informado');
    else {
      if (typeof entrada.nascimento !== 'string') throw new Error('data_civil_invalida');
      instanteCivil(entrada.nascimento);
      if (entrada.nascimento > entrada.dataAnalise) motivos.add('nascimento_futuro');
      else {
        resultado.idadeAnos = idadePediatrica(entrada.nascimento, entrada.dataAnalise).anosCompletos;
        if (resultado.idadeAnos < 19) motivos.add('idade_fora_do_escopo');
      }
    }
  } catch { motivos.add('data_invalida'); }
  if (!populacaoValida || entrada.populacaoConfirmada !== true) motivos.add('populacao_nao_confirmada');
  else resultado.populacaoReferencia = entrada.populacaoReferencia as 'masculina' | 'feminina';
  if (entrada.gestacao === 'sim') motivos.add('gestacao_fora_do_escopo');
  if (entrada.lactacao === 'sim') motivos.add('lactacao_fora_do_escopo');
  if (entrada.gestacao === 'nao_informada' || entrada.lactacao === 'nao_informada') motivos.add('fisiologia_nao_confirmada');
  if (entrada.aplicabilidade !== 'confirmada') motivos.add('aplicabilidade_nao_confirmada');
  resultado.motivos = [...motivos];
  resultado.contexto.elegivel = motivos.size === 0;
  return resultado;
}

