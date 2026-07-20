import type { PerguntaEditor, TipoPergunta } from '../components/questionarios/tipos';

export type TipoEntradaPreview = 'checkbox' | 'radio' | 'file' | 'number' | 'range' | 'textarea' | 'likert' | 'sim_nao';

export interface CampoPreview {
  id: string;
  enunciado: string;
  obrigatoria: boolean;
  tipoEntrada: TipoEntradaPreview;
  ajuda: string;
  opcoes: { rotulo: string; valor: string }[];
  atributos: Record<string, unknown>;
}

function texto(configuracao: Record<string, unknown>, chave: string, padrao = '') {
  const valor = configuracao[chave];
  return typeof valor === 'string' ? valor : padrao;
}

function numero(configuracao: Record<string, unknown>, chave: string, padrao: number) {
  const valor = Number(configuracao[chave]);
  return Number.isFinite(valor) ? valor : padrao;
}

function booleano(configuracao: Record<string, unknown>, chave: string, padrao = false) {
  return typeof configuracao[chave] === 'boolean' ? Boolean(configuracao[chave]) : padrao;
}

function listaTexto(configuracao: Record<string, unknown>, chave: string, padrao: string[]) {
  const valor = configuracao[chave];
  return Array.isArray(valor) ? valor.filter((item): item is string => typeof item === 'string') : padrao;
}

function tipoEntrada(tipo: TipoPergunta, configuracao: Record<string, unknown>): TipoEntradaPreview {
  if (tipo === 'multipla_escolha') return booleano(configuracao, 'multipla') ? 'checkbox' : 'radio';
  if (tipo === 'upload_midia') return 'file';
  if (tipo === 'metrica') return 'number';
  if (tipo === 'linear') return 'range';
  if (tipo === 'texto_longo') return 'textarea';
  if (tipo === 'sim_nao') return 'sim_nao';
  return 'likert';
}

function ajudaPorTipo(pergunta: PerguntaEditor, entrada: TipoEntradaPreview) {
  const configuracao = pergunta.configuracao;
  if (entrada === 'checkbox') return 'Selecione uma ou mais opcoes.';
  if (entrada === 'radio') return 'Selecione uma opcao.';
  if (entrada === 'range') {
    return `Deslize entre ${numero(configuracao, 'minimo', 0)} e ${numero(configuracao, 'maximo', 10)}.`;
  }
  if (entrada === 'number') {
    const unidade = texto(configuracao, 'unidade');
    const sufixo = unidade ? ` ${unidade}` : '';
    return `Informe um valor entre ${numero(configuracao, 'minimo', 0)} e ${numero(configuracao, 'maximo', 100)}${sufixo}.`;
  }
  if (entrada === 'file') return 'Anexe os arquivos solicitados.';
  if (entrada === 'textarea') return `Limite de ${numero(configuracao, 'limiteCaracteres', 1000)} caracteres.`;
  if (entrada === 'sim_nao') return 'Escolha uma das alternativas.';
  return `${texto(configuracao, 'rotuloMin', 'Discordo totalmente')} a ${texto(configuracao, 'rotuloMax', 'Concordo totalmente')}.`;
}

function atributosPorTipo(pergunta: PerguntaEditor, entrada: TipoEntradaPreview): Record<string, unknown> {
  const configuracao = pergunta.configuracao;
  if (entrada === 'range' || entrada === 'number') {
    return {
      min: numero(configuracao, 'minimo', 0),
      max: numero(configuracao, 'maximo', entrada === 'range' ? 10 : 100),
      step: numero(configuracao, 'passo', 1),
      ...(entrada === 'number' ? { unidade: texto(configuracao, 'unidade') } : {})
    };
  }
  if (entrada === 'file') {
    return {
      accept: listaTexto(configuracao, 'tiposAceitos', ['image/*']).join(','),
      maxArquivos: numero(configuracao, 'maxArquivos', 1)
    };
  }
  if (entrada === 'textarea') {
    return {
      maxLength: numero(configuracao, 'limiteCaracteres', 1000),
      placeholder: texto(configuracao, 'placeholder')
    };
  }
  if (entrada === 'likert') {
    return {
      escalaMin: numero(configuracao, 'escalaMin', 1),
      escalaMax: numero(configuracao, 'escalaMax', 5),
      rotuloMin: texto(configuracao, 'rotuloMin', 'Discordo totalmente'),
      rotuloMax: texto(configuracao, 'rotuloMax', 'Concordo totalmente')
    };
  }
  if (entrada === 'sim_nao') {
    return {
      rotuloSim: texto(configuracao, 'rotuloSim', 'Sim'),
      rotuloNao: texto(configuracao, 'rotuloNao', 'Nao')
    };
  }
  return {};
}

export function criarCampoPreview(pergunta: PerguntaEditor): CampoPreview {
  const entrada = tipoEntrada(pergunta.tipo, pergunta.configuracao);
  return {
    id: pergunta.id,
    enunciado: pergunta.enunciado,
    obrigatoria: pergunta.obrigatoria,
    tipoEntrada: entrada,
    ajuda: ajudaPorTipo(pergunta, entrada),
    opcoes: pergunta.opcoes.map((opcao) => ({ rotulo: opcao.rotulo, valor: opcao.valor })),
    atributos: atributosPorTipo(pergunta, entrada)
  };
}
