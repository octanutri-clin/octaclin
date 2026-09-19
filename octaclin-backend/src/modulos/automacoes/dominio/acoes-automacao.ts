export const TIPOS_ACAO_AUTOMACAO = ['notificar_profissional', 'enviar_template', 'criar_tarefa'] as const;

export type TipoAcaoAutomacao = (typeof TIPOS_ACAO_AUTOMACAO)[number];

export interface AcaoAutomacaoSimples {
  tipo: 'notificar_profissional';
}

export interface AcaoEnviarTemplateAutomacao {
  tipo: 'enviar_template';
  canalId: string;
  templateId: string;
  intervaloMinimoHoras: number;
}

/** Contrato exclusivo do recall especializado, que escolhe canal por paciente. */
export interface AcaoEnviarTemplateEspecializado {
  tipo: 'enviar_template';
}

export type PrioridadeTarefaAutomacao = 'baixa' | 'media' | 'alta';

export interface AcaoCriarTarefaAutomacao {
  tipo: 'criar_tarefa';
  titulo: string;
  prioridade: PrioridadeTarefaAutomacao;
  prazoDias: number;
}

export type AcaoAutomacao =
  | AcaoAutomacaoSimples
  | AcaoEnviarTemplateAutomacao
  | AcaoEnviarTemplateEspecializado
  | AcaoCriarTarefaAutomacao;

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

function ehUuidCanonico(valor: unknown): valor is string {
  return (
    typeof valor === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor)
  );
}

export function validarAcoesAutomacao(
  valor: unknown,
  opcoes: { permitirTemplateEspecializado?: boolean } = {}
): AcaoAutomacao[] {
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

    if (item.tipo === 'enviar_template') {
      if (opcoes.permitirTemplateEspecializado && possuiExatamenteAsChaves(item, ['tipo'])) {
        return { tipo: 'enviar_template' };
      }
      if (!possuiExatamenteAsChaves(item, ['tipo', 'canalId', 'templateId', 'intervaloMinimoHoras'])) {
        throw new ContratoAcaoAutomacaoInvalido(`Acao ${indice + 1} contem campos fora do contrato atual.`);
      }
      if (!ehUuidCanonico(item.canalId)) {
        throw new ContratoAcaoAutomacaoInvalido(`Acao ${indice + 1} possui canal invalido.`);
      }
      if (!ehUuidCanonico(item.templateId)) {
        throw new ContratoAcaoAutomacaoInvalido(`Acao ${indice + 1} possui template invalido.`);
      }
      if (
        !Number.isInteger(item.intervaloMinimoHoras) ||
        Number(item.intervaloMinimoHoras) < 1 ||
        Number(item.intervaloMinimoHoras) > 720
      ) {
        throw new ContratoAcaoAutomacaoInvalido(`Acao ${indice + 1} possui intervalo de frequencia invalido.`);
      }
      return {
        tipo: 'enviar_template',
        canalId: item.canalId,
        templateId: item.templateId,
        intervaloMinimoHoras: Number(item.intervaloMinimoHoras)
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
