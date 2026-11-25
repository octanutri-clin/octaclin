import { resumirRespostas } from './resumo-respostas';
import type { RespostaQuestionarioRecebida } from './servico-questionarios';
const pergunta = {id:'pergunta',enunciado:'Quantidade',tipo:'metrica' as const};
function respostas(valores:unknown[]):RespostaQuestionarioRecebida[] {return valores.map((valor,i)=>({respostaId:String(i),envioId:String(i),pacienteId:'paciente',questionarioId:'q',totalRespostas:1,respostas:[{perguntaId:'pergunta',enunciado:'Quantidade',tipo:'metrica',valor}]}));}
describe('resumo factual limitado à página',()=>{
  it('não transforma ausência, texto vazio ou booleano em zero na página',()=>{
    const r=resumirRespostas('q',respostas([10,null,'',false,0,'2']),[pergunta],undefined,true);
    expect(r.perguntas[0].mediaNumerica).toBe(4); expect(r.resumo.totalRespostas).toBe(6);
  });
  it('não agrega média de definições históricas incompatíveis',()=>{
    expect(resumirRespostas('q',respostas([10,20]),[pergunta],undefined,true,new Set(['pergunta'])).perguntas[0].mediaNumerica).toBeUndefined();
  });
  it('mantém o contrato legado fora da página e todas as respostas originais',()=>{
    const valores=respostas([null,10]); const r=resumirRespostas('q',valores,[pergunta]);
    expect(r.perguntas[0].mediaNumerica).toBe(5);expect(r.respostas).toBe(valores);
  });
});
