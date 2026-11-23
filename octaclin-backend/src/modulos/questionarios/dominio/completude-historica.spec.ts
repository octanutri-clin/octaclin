import { calcularCompletudeHistorica } from './completude-historica';

const preenchido = (v: unknown) => v !== null && v !== undefined && (typeof v !== 'string' || v.trim().length > 0) && (!Array.isArray(v) || v.length > 0);
const snapshot = { versaoQuestionario: 2, perguntas: [
  { id: 'a', obrigatoria: true }, { id: 'b', obrigatoria: true },
  { id: 'c', obrigatoria: false }, { id: 'd', obrigatoria: false }
] };
describe('QST10-07 completude exclusivamente histórica', () => {
  it('conta zero e falso e não conta vazio ou array vazio', () => {
    const antes=JSON.stringify(snapshot);
    expect(calcularCompletudeHistorica(snapshot,[{perguntaId:'a',valor:0},{perguntaId:'b',valor:false},{perguntaId:'c',valor:'  '},{perguntaId:'d',valor:[]}],preenchido)).toEqual({
      estado:'disponivel',versaoQuestionario:2,totalPerguntas:4,respondidas:2,obrigatorias:2,obrigatoriasRespondidas:2
    });expect(JSON.stringify(snapshot)).toBe(antes);
  });
  it('não inventa denominador sem snapshot nem usa catálogo atual', () => {
    for(const s of [null,undefined])expect(calcularCompletudeHistorica(s,[],preenchido)).toEqual({estado:'desconhecido',motivo:'snapshot_ausente',versaoQuestionario:null,totalPerguntas:null,respondidas:null,obrigatorias:null,obrigatoriasRespondidas:null});
  });
  it.each([{}, {versaoQuestionario:0,perguntas:[]},{versaoQuestionario:2,perguntas:[{id:'a'}]},
    {versaoQuestionario:2,perguntas:[{id:'a',obrigatoria:true},{id:'a',obrigatoria:false}]}])('preserva incerteza em snapshot inválido %#', s => {
    expect(calcularCompletudeHistorica(s,[],preenchido)).toMatchObject({estado:'desconhecido',motivo:'snapshot_invalido',totalPerguntas:null});
  });
  it('não escolhe silenciosamente uma resposta duplicada ou fora do snapshot', () => {
    for(const respostas of [[{perguntaId:'a',valor:1},{perguntaId:'a',valor:2}],[{perguntaId:'externa',valor:1}]])expect(calcularCompletudeHistorica(snapshot,respostas,preenchido)).toMatchObject({estado:'desconhecido',motivo:'respostas_incompativeis',totalPerguntas:null});
  });
  it('preserva um snapshot vazio válido sem inventar percentual', () => {
    expect(calcularCompletudeHistorica({versaoQuestionario:1,perguntas:[]},[],preenchido)).toEqual({estado:'disponivel',versaoQuestionario:1,totalPerguntas:0,respondidas:0,obrigatorias:0,obrigatoriasRespondidas:0});
  });
});
