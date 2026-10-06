import type { PerguntaSnapshotQuestionario, SnapshotEstruturaQuestionario } from '../../questionarios/infraestrutura/envio-questionario.orm';

export interface RespostaHistoricaProjetada {
  perguntaId: string;
  enunciado: string;
  unidade?: string;
  estado: 'informada' | 'nao_informada';
  valor?: string | number | boolean | Array<string | number | boolean>;
}

export interface QuestionarioLongitudinalProjetado {
  versao?: number;
  titulo?: string;
  estruturaIndisponivel: boolean;
  respostas: RespostaHistoricaProjetada[];
}

function valorSeguro(valor: unknown): string | number | boolean | Array<string | number | boolean> | undefined {
  if (typeof valor === 'string' || typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : undefined;
  if (Array.isArray(valor) && valor.every((item) =>
    typeof item === 'string' || typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item)))) {
    return valor as Array<string | number | boolean>;
  }
  return undefined;
}

function projetarValor(pergunta: PerguntaSnapshotQuestionario, valor: unknown) {
  if (pergunta.tipo === 'upload_midia' && Array.isArray(valor)) {
    return `${valor.length} ${valor.length === 1 ? 'anexo informado' : 'anexos informados'}`;
  }
  const seguro = valorSeguro(valor);
  if (seguro === undefined) return undefined;
  if (pergunta.tipo !== 'multipla_escolha') return seguro;

  const rotulos = new Map(pergunta.opcoes.map((opcao) => [opcao.valor, opcao.rotulo]));
  const rotular = (item: string | number | boolean) => typeof item === 'string' ? rotulos.get(item) ?? item : item;
  return Array.isArray(seguro) ? seguro.map(rotular) : rotular(seguro);
}

export function projetarRespostasQuestionario(
  snapshot: SnapshotEstruturaQuestionario | undefined,
  valores: Array<{ perguntaId: string; valor: unknown }>
): QuestionarioLongitudinalProjetado {
  if (!snapshot) return { estruturaIndisponivel: true, respostas: [] };

  const valoresPorPergunta = new Map(valores.map((item) => [item.perguntaId, item.valor]));
  const respostas = [...snapshot.perguntas]
    .sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id))
    .map((pergunta): RespostaHistoricaProjetada => {
      const informado = valoresPorPergunta.has(pergunta.id);
      const valor = informado ? projetarValor(pergunta, valoresPorPergunta.get(pergunta.id)) : undefined;
      const unidade = pergunta.configuracao.unidade;
      return {
        perguntaId: pergunta.id,
        enunciado: pergunta.enunciado,
        ...(typeof unidade === 'string' && unidade.trim() ? { unidade: unidade.trim() } : {}),
        estado: informado && valor !== undefined ? 'informada' : 'nao_informada',
        ...(informado && valor !== undefined ? { valor } : {})
      };
    });

  return {
    versao: snapshot.versaoQuestionario,
    titulo: snapshot.titulo,
    estruturaIndisponivel: false,
    respostas
  };
}
