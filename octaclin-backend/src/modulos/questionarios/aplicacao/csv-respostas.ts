import { montarCsv } from '../../../infraestrutura/exportacao/csv';
import type { RespostaQuestionarioRecebida } from './servico-questionarios';
export function formatarCsvRespostas(respostas: RespostaQuestionarioRecebida[]): string {
    const enunciadoPorPergunta = new Map<string, string>();
    respostas.forEach((resposta) =>
      resposta.respostas.forEach((item) => {
        if (!enunciadoPorPergunta.has(item.perguntaId)) enunciadoPorPergunta.set(item.perguntaId, item.enunciado);
      })
    );
    const perguntasIds = [...enunciadoPorPergunta.keys()];

    return montarCsv(
      ['respostaId', 'pacienteId', 'finalizadoEm', ...perguntasIds.map((id) => enunciadoPorPergunta.get(id) ?? id)],
      respostas.map((resposta) => {
        const valores = new Map(resposta.respostas.map((item) => [item.perguntaId, item.valor]));
        return [
          resposta.respostaId,
          resposta.pacienteId,
          resposta.finalizadoEm?.toISOString() ?? '',
          ...perguntasIds.map((id) => {
            const valor = valores.get(id);
            if (valor === undefined || valor === null) return '';
            return typeof valor === 'object' ? JSON.stringify(valor) : valor;
          })
        ];
      })
    );
}
