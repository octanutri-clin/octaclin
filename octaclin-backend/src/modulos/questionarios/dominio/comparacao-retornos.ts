import { BadRequestException } from '@nestjs/common';
import { validarTipoPergunta } from './tipos-pergunta';

export interface RetornoParaComparacao {
  respostaId: string;
  envioId: string;
  pacienteId: string;
  questionarioId: string;
  finalizadoEm: string | null;
  snapshot: unknown;
  valores: { perguntaId: string; valor: unknown }[];
}
export type MotivoComparacao = 'snapshot_ausente' | 'snapshot_invalido' | 'pergunta_ausente' | 'definicao_alterada'
  | 'sem_resposta' | 'valor_invalido' | 'parametros_ausentes' | 'nao_numerico' | 'anexo';
export interface ValorComparado {
  estado: 'respondida' | 'sem_resposta' | 'valor_indisponivel' | 'anexo';
  valor: string | number | boolean | string[] | null;
  quantidadeArquivos?: number;
}
export interface ItemComparado {
  perguntaId: string;
  enunciadoA: string | null;
  enunciadoB: string | null;
  tipoA: string | null;
  tipoB: string | null;
  unidade: string | null;
  unidadeA: string | null;
  unidadeB: string | null;
  a: ValorComparado;
  b: ValorComparado;
  compativel: boolean;
  motivo: MotivoComparacao | null;
  delta: number | null;
}
export interface ComparacaoRetornos {
  questionarioId: string;
  pacienteId: string;
  ordem: 'cronologica' | 'selecao';
  a: { respostaId: string; envioId: string; finalizadoEm: string | null; versaoQuestionario: number | null };
  b: { respostaId: string; envioId: string; finalizadoEm: string | null; versaoQuestionario: number | null };
  itens: ItemComparado[];
}

const objeto=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const texto=(v:string)=>v.normalize('NFC').trim().replace(/\s+/g,' ');
interface Definicao {id:string;enunciado:string;tipo:string;configuracao:Record<string,unknown>;assinatura:string}
interface Historico {motivo:'snapshot_ausente'|'snapshot_invalido'|null;versao:number|null;perguntas:Map<string,Definicao>}
function canonico(v:unknown,profundidade=0):unknown {
  if(profundidade>8)throw new Error('Estrutura profunda.');
  if(v===null||typeof v==='boolean'||typeof v==='string')return v;
  if(typeof v==='number'&&Number.isFinite(v))return v;
  if(Array.isArray(v))return v.map(x=>canonico(x,profundidade+1));
  if(objeto(v))return Object.keys(v).sort().map(k=>[k,canonico(v[k],profundidade+1)]);
  throw new Error('Configuração histórica inválida.');
}
function historico(snapshot:unknown):Historico {
  const vazio=(motivo:Historico['motivo']):Historico=>({motivo,versao:null,perguntas:new Map()});
  if(snapshot==null)return vazio('snapshot_ausente');
  if(!objeto(snapshot)||!Number.isSafeInteger(snapshot.versaoQuestionario)||Number(snapshot.versaoQuestionario)<1
    ||!Array.isArray(snapshot.perguntas)||snapshot.perguntas.length>1000)return vazio('snapshot_invalido');
  const perguntas=new Map<string,Definicao>();
  try{
    for(const p of snapshot.perguntas){
      if(!objeto(p)||typeof p.id!=='string'||!p.id.trim()||perguntas.has(p.id)||typeof p.enunciado!=='string'
        ||typeof p.tipo!=='string'||!validarTipoPergunta(p.tipo)||!objeto(p.configuracao))return vazio('snapshot_invalido');
      // Seção/ordem/categoria não mudam a medição; textos auxiliares e chaves desconhecidas
      // permanecem relevantes por precaução. Nunca normalizar histórico com defaults atuais.
      const cfg=Object.fromEntries(Object.entries(p.configuracao).filter(([k])=>k!=='secao'));
      let opcoes:unknown[]=[];
      if(p.tipo==='multipla_escolha'){
        if(!Array.isArray(p.opcoes)||p.opcoes.length<2||p.opcoes.length>1000)return vazio('snapshot_invalido');
        const ids=new Set<string>();
        opcoes=p.opcoes.map(o=>{
          if(!objeto(o)||typeof o.id!=='string'||ids.has(o.id)||typeof o.rotulo!=='string'||typeof o.valor!=='string'
            ||(o.imagemUrl!=null&&typeof o.imagemUrl!=='string'))throw new Error('Opção inválida.');
          ids.add(o.id);return [o.id,texto(o.rotulo),o.valor,o.imagemUrl??null];
        }).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b),'en'));
      }
      perguntas.set(p.id,{id:p.id,enunciado:p.enunciado,tipo:p.tipo,configuracao:cfg,
        assinatura:JSON.stringify([texto(p.enunciado),p.tipo,canonico(cfg),opcoes])});
    }
    return {motivo:null,versao:snapshot.versaoQuestionario as number,perguntas};
  }catch{return vazio('snapshot_invalido');}
}
function valorHistorico(valor:unknown,tipo?:string):ValorComparado {
  if(valor==null||(typeof valor==='string'&&!valor.trim())||(Array.isArray(valor)&&!valor.length))return {estado:'sem_resposta',valor:null};
  if(tipo==='upload_midia')return Array.isArray(valor)&&valor.length<=10&&valor.every(v=>typeof v==='string')
    ? {estado:'anexo',valor:null,quantidadeArquivos:valor.length}:{estado:'valor_indisponivel',valor:null};
  if(!tipo&&Array.isArray(valor))return {estado:'valor_indisponivel',valor:null};
  if(typeof valor==='string'||typeof valor==='boolean'||(typeof valor==='number'&&Number.isFinite(valor))
    ||(Array.isArray(valor)&&valor.length<=1000&&valor.every(v=>typeof v==='string')))return {estado:'respondida',valor};
  return {estado:'valor_indisponivel',valor:null};
}
function numero(v:unknown):number|null {
  if(typeof v==='number')return Number.isFinite(v)?v:null;
  if(typeof v!=='string'||!v.trim()||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(v.trim()))return null;
  const n=Number(v);return Number.isFinite(n)?n:null;
}
function unidade(p?:Definicao){return p?.tipo==='metrica'&&typeof p.configuracao.unidade==='string'&&p.configuracao.unidade.trim()?p.configuracao.unidade:null;}
function faixa(p:Definicao):{minimo:number;maximo:number}|null {
  const c=p.configuracao;const minimo=p.tipo==='likert'?c.escalaMin:c.minimo;const maximo=p.tipo==='likert'?c.escalaMax:c.maximo;
  if(typeof minimo!=='number'||typeof maximo!=='number'||!Number.isFinite(minimo)||!Number.isFinite(maximo)||minimo>=maximo)return null;
  if(p.tipo==='metrica'&&!unidade(p))return null;
  if(p.tipo!=='likert'&&(typeof c.passo!=='number'||!Number.isFinite(c.passo)||c.passo<=0))return null;
  return {minimo,maximo};
}
function valores(r:RetornoParaComparacao){
  const mapa=new Map<string,unknown>();
  if(!Array.isArray(r.valores)||r.valores.length>1000)throw new BadRequestException('Resposta histórica indisponível.');
  for(const v of r.valores){
    if(typeof v.perguntaId!=='string'||!v.perguntaId.trim()||mapa.has(v.perguntaId))throw new BadRequestException('Resposta histórica inconsistente.');
    mapa.set(v.perguntaId,v.valor);
  }
  return mapa;
}
export function compararRetornos(primeiro:RetornoParaComparacao,segundo:RetornoParaComparacao):ComparacaoRetornos {
  if(primeiro.respostaId===segundo.respostaId||primeiro.pacienteId!==segundo.pacienteId||primeiro.questionarioId!==segundo.questionarioId)
    throw new BadRequestException('Selecione dois retornos do mesmo paciente e formulário.');
  const data=(r:RetornoParaComparacao)=>typeof r.finalizadoEm==='string'&&Number.isFinite(Date.parse(r.finalizadoEm))?r.finalizadoEm:null;
  const da=data(primeiro),db=data(segundo);const cronologica=!!da&&!!db&&Date.parse(da)!==Date.parse(db);
  const [a,b]=cronologica&&Date.parse(da!)>Date.parse(db!)?[segundo,primeiro]:[primeiro,segundo];
  const ha=historico(a.snapshot),hb=historico(b.snapshot),va=valores(a),vb=valores(b);
  const ids=[...new Set([...ha.perguntas.keys(),...hb.perguntas.keys(),...va.keys(),...vb.keys()])];
  const itens:ItemComparado[]=ids.map(id=>{
    const pa=ha.perguntas.get(id),pb=hb.perguntas.get(id);
    const av=valorHistorico(va.get(id),pa?.tipo),bv=valorHistorico(vb.get(id),pb?.tipo);
    const item:ItemComparado={perguntaId:id,enunciadoA:pa?.enunciado??null,enunciadoB:pb?.enunciado??null,tipoA:pa?.tipo??null,tipoB:pb?.tipo??null,
      unidade:unidade(pa),unidadeA:unidade(pa),unidadeB:unidade(pb),a:av,b:bv,compativel:false,motivo:null,delta:null};
    if(ha.motivo||hb.motivo){item.motivo=ha.motivo??hb.motivo;return item;}
    if(!pa||!pb){item.motivo='pergunta_ausente';return item;}
    if(pa.assinatura!==pb.assinatura){item.motivo='definicao_alterada';return item;}
    item.compativel=true;
    if(av.estado==='sem_resposta'||bv.estado==='sem_resposta'){item.motivo='sem_resposta';return item;}
    if(av.estado==='anexo'||bv.estado==='anexo'){item.motivo='anexo';return item;}
    if(av.estado!=='respondida'||bv.estado!=='respondida'){item.motivo='valor_invalido';return item;}
    if(!['metrica','linear','likert'].includes(pa.tipo)){item.motivo='nao_numerico';return item;}
    const f=faixa(pa);if(!f){item.motivo='parametros_ausentes';return item;}
    const na=numero(av.valor),nb=numero(bv.valor);
    if(na===null||nb===null||na<f.minimo||na>f.maximo||nb<f.minimo||nb>f.maximo||!Number.isFinite(nb-na)){item.motivo='valor_invalido';return item;}
    item.delta=Object.is(nb-na,-0)?0:nb-na;return item;
  });
  const cabecalho=(r:RetornoParaComparacao,h:Historico)=>({respostaId:r.respostaId,envioId:r.envioId,finalizadoEm:data(r),versaoQuestionario:h.versao});
  return {questionarioId:a.questionarioId,pacienteId:a.pacienteId,ordem:cronologica?'cronologica':'selecao',a:cabecalho(a,ha),b:cabecalho(b,hb),itens};
}
