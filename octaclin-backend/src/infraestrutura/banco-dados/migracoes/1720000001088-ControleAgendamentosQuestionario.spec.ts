import { criarOpcoesTypeOrm } from '../opcoes-typeorm';
import { IndicesConsultaRespostasQuestionario1720000001087 } from './1720000001087-IndicesConsultaRespostasQuestionario';
import { ControleAgendamentosQuestionario1720000001088 } from './1720000001088-ControleAgendamentosQuestionario';

describe('1088 registro aditivo', () => {
  it('registra uma vez após 1087 sem exigir que seja a última migration', () => {
    const ms = criarOpcoesTypeOrm().migrations as unknown[];
    expect(ms.filter(m => m === ControleAgendamentosQuestionario1720000001088)).toHaveLength(1);
    expect(ms.indexOf(ControleAgendamentosQuestionario1720000001088)).toBe(ms.indexOf(IndicesConsultaRespostasQuestionario1720000001087)+1);
  });
});
