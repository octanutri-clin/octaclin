import { compararRetornos, RetornoParaComparacao } from './comparacao-retornos';
interface PerguntaTeste {id:string;enunciado:string;tipo:string;ordem:number;obrigatoria:boolean;configuracao:Record<string,unknown>;opcoes:{id:string;rotulo:string;valor:string;ordem:number}[]}
const pergunta=(alteracoes:Partial<PerguntaTeste>&Record<string,unknown>={}):PerguntaTeste=>({id:'pergunta-1',enunciado:'Medida sintética',tipo:'metrica',ordem:1,obrigatoria:false,
  configuracao:{unidade:'kg',minimo:0,maximo:200,passo:0.1},opcoes:[],...alteracoes});
const retorno=(id:string,valor:unknown,snapshot:unknown={versaoQuestionario:1,perguntas:[pergunta()]}):RetornoParaComparacao=>({
  respostaId:id,envioId:`envio-${id}`,questionarioId:'q',pacienteId:'p',finalizadoEm:id==='a'?'2026-01-01T12:00:00Z':'2026-02-01T12:00:00Z',
  snapshot,valores:[{perguntaId:'pergunta-1',valor}],
});
const comPergunta=(id:string,valor:unknown,p:Record<string,unknown>|PerguntaTeste)=>retorno(id,valor,{versaoQuestionario:2,perguntas:[p]});
describe('comparação factual por identidade e definição histórica',()=>{
  it('preserva zero conhecido e calcula diferença neutra na ordem cronológica',()=>{
    const resultado=compararRetornos(retorno('b',2),retorno('a',0));
    expect(resultado.ordem).toBe('cronologica');expect(resultado.a.respostaId).toBe('a');
    expect(resultado.itens[0]).toMatchObject({a:{estado:'respondida',valor:0},b:{valor:2},compativel:true,delta:2,unidade:'kg'});
  });
  it('não confunde falso com ausência nem produz diferença numérica para booleanos',()=>{
    const p=pergunta({tipo:'sim_nao',configuracao:{rotuloSim:'Sim',rotuloNao:'Não'}});
    expect(compararRetornos(comPergunta('a',false,p),comPergunta('b',true,p)).itens[0])
      .toMatchObject({a:{estado:'respondida',valor:false},b:{valor:true},delta:null,motivo:'nao_numerico',compativel:true});
  });
  it.each([null,undefined,'',[], '  '])('ausência %s não vira zero',valor=>{
    expect(compararRetornos(retorno('a',valor),retorno('b',2)).itens[0]).toMatchObject({a:{estado:'sem_resposta',valor:null},delta:null,motivo:'sem_resposta'});
  });
  it.each([
    {enunciado:'Outra medição'}, {tipo:'linear'}, {configuracao:{unidade:'g',minimo:0,maximo:200,passo:0.1}},
    {configuracao:{unidade:'kg',minimo:0,maximo:100,passo:0.1}}, {configuracao:{unidade:'kg',minimo:0,maximo:200,passo:1}},
  ])('mudança relevante %j impede diferença, mantendo valores originais',alteracao=>{
    expect(compararRetornos(retorno('a',1),comPergunta('b',2,pergunta(alteracao))).itens[0])
      .toMatchObject({compativel:false,motivo:'definicao_alterada',a:{valor:1},b:{valor:2},delta:null});
  });
  it('ordem, seção, categoria e obrigatoriedade não inventam mudança na medição',()=>{
    const p=pergunta({ordem:20,categoriaId:'outra',obrigatoria:true,configuracao:{passo:0.1,maximo:200,minimo:0,unidade:'kg',secao:'Outra seção'}});
    expect(compararRetornos(retorno('a',1),comPergunta('b',2,p)).itens[0]).toMatchObject({compativel:true,delta:1});
  });
  it('mesmo nome com nova identidade não é pareado',()=>{
    const b=comPergunta('b',2,pergunta({id:'nova'}));b.valores=[{perguntaId:'nova',valor:2}];
    const itens=compararRetornos(retorno('a',1),b).itens;
    expect(itens.map(i=>i.perguntaId)).toEqual(['pergunta-1','nova']);expect(itens.every(i=>i.delta===null&&i.motivo==='pergunta_ausente')).toBe(true);
  });
  it.each([null,undefined])('snapshot ausente %s não usa definição atual',snapshot=>{
    expect(compararRetornos({...retorno('a',1),snapshot},retorno('b',2)).itens[0])
      .toMatchObject({compativel:false,delta:null,motivo:'snapshot_ausente',enunciadoA:null,a:{valor:1}});
  });
  it('snapshot inválido e duplicatas de definição falham sem escolher definição arbitrária',()=>{
    const a=retorno('a',1,{versaoQuestionario:1,perguntas:[pergunta(),pergunta()]});
    expect(compararRetornos(a,retorno('b',2)).itens[0]).toMatchObject({compativel:false,delta:null,motivo:'snapshot_invalido'});
  });
  it('falta de unidade ou escala explícita impede delta numérico',()=>{
    const p=pergunta({configuracao:{}});
    expect(compararRetornos(comPergunta('a',1,p),comPergunta('b',2,p)).itens[0]).toMatchObject({delta:null,motivo:'parametros_ausentes'});
  });
  it('opções são comparadas por identidade/conteúdo, sem falso alerta por ordem',()=>{
    const p=pergunta({tipo:'multipla_escolha',configuracao:{multipla:false},opcoes:[{id:'o1',rotulo:'Uma',valor:'uma',ordem:1},{id:'o2',rotulo:'Outra',valor:'outra',ordem:2}]});
    const q={...p,opcoes:[...p.opcoes].reverse()};
    expect(compararRetornos(comPergunta('a','uma',p),comPergunta('b','outra',q)).itens[0]).toMatchObject({compativel:true,delta:null});
    q.opcoes=[{...p.opcoes[0],rotulo:'Mudou'},p.opcoes[1]];
    expect(compararRetornos(comPergunta('a','uma',p),comPergunta('b','outra',q)).itens[0]).toMatchObject({compativel:false,motivo:'definicao_alterada'});
  });
  it('anexos não transportam URLs/capabilities nem são calculados',()=>{
    const p=pergunta({tipo:'upload_midia',configuracao:{maxArquivos:1,tiposAceitos:['image/*']}});
    const r=compararRetornos(comPergunta('a',['referencia-protegida'],p),comPergunta('b',['outra-referencia'],p));
    expect(r.itens[0]).toMatchObject({a:{estado:'anexo',valor:null,quantidadeArquivos:1},delta:null,motivo:'anexo'});
    expect(JSON.stringify(r)).not.toContain('referencia-protegida');
  });
  it('datas ausentes preservam ordem explícita de seleção sem inventar cronologia',()=>{
    const a={...retorno('a',1),finalizadoEm:null};
    const r=compararRetornos(retorno('b',2),a);expect(r.ordem).toBe('selecao');expect(r.a.respostaId).toBe('b');expect(r.b.finalizadoEm).toBeNull();
  });
  it.each([NaN,Infinity,-Infinity,{},true])('valor numérico inválido %s não produz delta',valor=>{
    expect(compararRetornos(retorno('a',valor),retorno('b',2)).itens[0].delta).toBeNull();
  });
  it('preserva números fracionários e rejeita diferença que excede número finito',()=>{
    expect(compararRetornos(retorno('a',1.25),retorno('b',1.5)).itens[0].delta).toBe(0.25);
    const p=pergunta({configuracao:{unidade:'kg',minimo:-Number.MAX_VALUE,maximo:Number.MAX_VALUE,passo:1}});
    expect(compararRetornos(comPergunta('a',-Number.MAX_VALUE,p),comPergunta('b',Number.MAX_VALUE,p)).itens[0].delta).toBeNull();
  });
  it('não altera os objetos históricos e ignora só metadados visuais conhecidos',()=>{
    const a=retorno('a',1),b=retorno('b',2);const antes=JSON.stringify([a,b]);compararRetornos(a,b);expect(JSON.stringify([a,b])).toBe(antes);
    const p=pergunta({configuracao:{unidade:'kg',minimo:0,maximo:200,passo:0.1,desconhecido:'novo'}});
    expect(compararRetornos(a,comPergunta('b',2,p)).itens[0].compativel).toBe(false);
  });
  it('mesmo retorno, outro paciente ou outro formulário são rejeitados',()=>{
    const a=retorno('a',1);
    expect(()=>compararRetornos(a,a)).toThrow();
    expect(()=>compararRetornos(a,{...retorno('b',2),pacienteId:'outro'})).toThrow();
    expect(()=>compararRetornos(a,{...retorno('b',2),questionarioId:'outro'})).toThrow();
  });
  it('zero textual continua conhecido, sem converter booleano ou espaço em número',()=>{
    expect(compararRetornos(retorno('a','0'),retorno('b','1.5')).itens[0]).toMatchObject({a:{valor:'0'},delta:1.5});
  });
  it('array com origem/tipo desconhecidos não divulga possível referência de arquivo',()=>{
    const a={...retorno('a',[]),snapshot:null,valores:[{perguntaId:'pergunta-1',valor:['referencia-nao-divulgar']}]};
    const r=compararRetornos(a,retorno('b',2));expect(r.itens[0].a).toEqual({estado:'valor_indisponivel',valor:null});
    expect(JSON.stringify(r)).not.toContain('referencia-nao-divulgar');
  });
  it('valores duplicados para a mesma pergunta não escolhem um valor arbitrário',()=>{
    const a=retorno('a',1);a.valores.push({perguntaId:'pergunta-1',valor:2});
    expect(()=>compararRetornos(a,retorno('b',3))).toThrow('inconsistente');
  });
  it('metadados especiais são dados e não poluem protótipos',()=>{
    const cfg=JSON.parse('{"unidade":"kg","minimo":0,"maximo":200,"passo":0.1,"__proto__":{"injetado":true},"constructor":"dado"}');
    expect(compararRetornos(retorno('a',1),comPergunta('b',2,pergunta({configuracao:cfg}))).itens[0]).toMatchObject({compativel:false,delta:null});
    expect(Object.prototype).not.toHaveProperty('injetado');
  });

  it.each([[{a:1},[['a',1]]],[{},[]]])('distingue objeto %j de array %j em configuração histórica', (objeto,array)=>{
    const config={unidade:'kg',minimo:0,maximo:200,passo:0.1};
    const r=compararRetornos(comPergunta('a',1,pergunta({configuracao:{...config,extra:objeto}})),
      comPergunta('b',2,pergunta({configuracao:{...config,extra:array}})));
    expect(r.itens[0]).toMatchObject({compativel:false,motivo:'definicao_alterada',delta:null});
  });

});
