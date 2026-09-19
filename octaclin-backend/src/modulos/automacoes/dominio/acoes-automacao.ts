export const TIPOS_ACAO_AUTOMACAO = ['notificar_profissional', 'enviar_template', 'criar_tarefa'] as const;

export type TipoAcaoAutomacao = (typeof TIPOS_ACAO_AUTOMACAO)[number];

export interface AcaoAutomacaoSimples {
  tipo: Exclude<TipoAcaoAutomacao, 'criar_tarefa'>;
}

export type PrioridadeTarefaAutomacao = 'baixa' | 'media' | 'alta';

export interface AcaoCriarTarefaAutomacao {
  tipo: 'criar_tarefa';
  titulo: string;
  prioridade: PrioridadeTarefaAutomacao;
  prazoDias: number;
}

export type AcaoAutomacao = AcaoAutomacaoSimples | AcaoCriarTarefaAutomacao;

export type StatusResultadoAcaoAutomacao =
  | 'pendente'
  | 'executando'
  | 'executada'
  | 'ignorada'
  | 'falhou'
  | 'simulada';

export interface ResultadoAcaoAutomacao {
  indice: number;
  tipo: TipoAcaoAutomacao;
  chaveIdempotencia: string;
  status: StatusResultadoAcaoAutomacao;
  tentativas: number;
  codigoErro?: string;
}

export class ContratoAcaoAutomacaoInvalido extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ContratoAcaoAutomacaoInvalido';
  }
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function possuiExatamenteAsChaves(item: Record<string, unknown>, esperadas: string[]): boolean {
  const chaves = Object.keys(item);
  return chaves.length === esperadas.length && esperadas.every((chave) => chaves.includes(chave));
}

export function validarAcoesAutomacao(valor: unknown): AcaoAutomacao[] {
  if (!Array.isArray(valor) || valor.length === 0) {
    throw new ContratoAcaoAutomacaoInvalido('A regra precisa conter ao menos uma acao.');
  }
  if (valor.length > 10) {
    throw new ContratoAcaoAutomacaoInvalido('A regra aceita no maximo 10 acoes.');
  }

  return valor.map((item, indice) => {
    if (!ehObjeto(item)) {
      throw new ContratoAcaoAutomacaoInvalido(`Acao ${indice + 1} precisa ser um objeto.`);
    }
    if (!TIPOS_ACAO_AUTOMACAO.includes(item.tipo as TipoAcaoAutomacao)) {
      throw new ContratoAcaoAutomacaoInvalido(`Acao ${indice + 1} possui tipo nao suportado.`);
    }

    if (item.tipo === 'criar_tarefa') {
      if (!possuiExatamenteAsChaves(item, ['tipo', 'titulo', 'prioridade', 'prazoDias'])) {
        throw new ContratoAcaoAutomacaoInvalido(`Acao ${indice + 1} contem campos fora do contrato atual.`);
      }
      const titulo = typeof item.titulo === 'string' ? item.titulo.trim() : '';
      if (titulo.length < 3 || titulo.length > 180) {
        throw new ContratoAcaoAutomacaoInvalido(`Acao ${indice + 1} possui titulo invalido.`);
      }
      if (!['baixa', 'media', 'alta'].includes(item.prioridade as string)) {
        throw new ContratoAcaoAutomacaoInvalido(`Acao ${indice + 1} possui prioridade invalida.`);
      }
      if (!Number.isInteger(item.prazoDias) || Number(item.prazoDias) < 1 || Number(item.prazoDias) > 365) {
        throw new ContratoAcaoAutomacaoInvalido(`Acao ${indice + 1} possui prazo invalido.`);
      }
      return {
        tipo: 'criar_tarefa',
        titulo,
        prioridade: item.prioridade as PrioridadeTarefaAutomacao,
        prazoDias: Number(item.prazoDias)
      };
    }

    if (!possuiExatamenteAsChaves(item, ['tipo'])) {
      throw new ContratoAcaoAutomacaoInvalido(`Acao ${indice + 1} contem campos fora do contrato atual.`);
    }
    return { tipo: item.tipo as AcaoAutomacaoSimples['tipo'] };
  });
}

export function criarResultadosAcoes(
  execucaoId: string,
  acoes: AcaoAutomacao[],
  status: 'pendente' | 'simulada',
  anteriores: unknown = []
): ResultadoAcaoAutomacao[] {
  const resultadosAnteriores = Array.isArray(anteriores) ? anteriores : [];
  return acoes.map((acao, indice) => {
    const chaveIdempotencia = `automacao:${execucaoId}:acao:${indice}`;
    const anterior = resultadosAnteriores.find(
      (item): item is ResultadoAcaoAutomacao =>
        ehObjeto(item) && item.chaveIdempotencia === chaveIdempotencia && item.tipo === acao.tipo
    );
    if (anterior && ['executada', 'ignorada'].includes(anterior.status)) return anterior;
    return {
      indice,
      tipo: acao.tipo,
      chaveIdempotencia,
      status,
      tentativas: anterior?.tentativas ?? 0,
      ...(anterior?.codigoErro ? { codigoErro: anterior.codigoErro } : {})
    };
  });
}
