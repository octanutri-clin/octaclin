import { criarOpcoesTypeOrm } from '../opcoes-typeorm';
import { ContaUnicaPaciente1720000001086 } from './1720000001086-ContaUnicaPaciente';
import { IndicesConsultaRespostasQuestionario1720000001087 } from './1720000001087-IndicesConsultaRespostasQuestionario';

describe('1087 índices de consulta de respostas', () => {
  it('registra uma única vez, imediatamente após a 1086, sem impedir migrations futuras', () => {
    const migracoes = criarOpcoesTypeOrm().migrations as unknown[];
    expect(migracoes.filter(m => m === ContaUnicaPaciente1720000001086)).toHaveLength(1);
    expect(migracoes.filter(m => m === IndicesConsultaRespostasQuestionario1720000001087)).toHaveLength(1);
    expect(migracoes.indexOf(IndicesConsultaRespostasQuestionario1720000001087))
      .toBe(migracoes.indexOf(ContaUnicaPaciente1720000001086) + 1);
  });
});
