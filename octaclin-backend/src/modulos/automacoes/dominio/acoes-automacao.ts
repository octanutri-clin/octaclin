export const TIPOS_ACAO_AUTOMACAO = ['notificar_profissional', 'enviar_template', 'criar_tarefa'] as const;

export type TipoAcaoAutomacao = (typeof TIPOS_ACAO_AUTOMACAO)[number];

export interface AcaoAutomacao {
  tipo: TipoAcaoAutomacao;
}

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
    const chaves = Object.keys(item);
    if (chaves.length !== 1 || chaves[0] !== 'tipo') {
      throw new ContratoAcaoAutomacaoInvalido(`Acao ${indice + 1} contem campos fora do contrato atual.`);
    }
    if (!TIPOS_ACAO_AUTOMACAO.includes(item.tipo as TipoAcaoAutomacao)) {
      throw new ContratoAcaoAutomacaoInvalido(`Acao ${indice + 1} possui tipo nao suportado.`);
    }
    return { tipo: item.tipo as TipoAcaoAutomacao };
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
