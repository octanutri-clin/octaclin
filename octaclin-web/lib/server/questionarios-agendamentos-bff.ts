import { UUID_QST } from './questionarios-paginacao-bff';
const objeto=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const uuid=(v:unknown):v is string=>typeof v==='string'&&UUID_QST.test(v);
const data=(v:unknown)=>v===null||(typeof v==='string'&&Number.isFinite(Date.parse(v)));
const revisao=(v:unknown):v is number=>Number.isInteger(v)&&Number(v)>=1&&Number(v)<=2147483647;
export function comandoAgendaQst(v:unknown){
  if(!objeto(v)||Object.keys(v).some(k=>!['pacienteId','acao','revisaoEsperada','confirmar'].includes(k))||!uuid(v.pacienteId)
    ||!['pausar','retomar','reconfirmar'].includes(String(v.acao))||!revisao(v.revisaoEsperada)||v.revisaoEsperada>=2147483647||v.confirmar!==true)throw new Error();
  return {pacienteId:v.pacienteId.toLowerCase(),acao:v.acao as 'pausar'|'retomar'|'reconfirmar',revisaoEsperada:v.revisaoEsperada,confirmar:true};
}
export function projetarAgendaQst(v:unknown,qid:string,pid:string){
  if(!objeto(v)||!uuid(v.id)||v.questionarioId!==qid||v.pacienteId!==pid||!revisao(v.revisao)||typeof v.ativo!=='boolean'
    ||!['ativo','pausado','encerrado','inativo_legado'].includes(String(v.estado))||typeof v.reconfirmacaoNecessaria!=='boolean'
    ||typeof v.timezone!=='string'||v.timezone.length>80||!(v.regraCron===null||(typeof v.regraCron==='string'&&v.regraCron.length<=120))
    ||!data(v.proximaOcorrenciaFutura)||!data(v.dataFixa)||!data(v.pausadoEm)||!data(v.ultimaExecucaoEm)||!data(v.proximaExecucaoEm))throw new Error();
  new Intl.DateTimeFormat('pt-BR',{timeZone:v.timezone});
  if((v.estado==='ativo')!==v.ativo||(v.estado==='pausado')!==(v.pausadoEm!==null))throw new Error();
  return {id:v.id,questionarioId:qid,pacienteId:pid,revisao:v.revisao,ativo:v.ativo,estado:v.estado as 'ativo'|'pausado'|'encerrado'|'inativo_legado',
    reconfirmacaoNecessaria:v.reconfirmacaoNecessaria,timezone:v.timezone,regraCron:v.regraCron as string|null,
    proximaOcorrenciaFutura:v.proximaOcorrenciaFutura as string|null,dataFixa:v.dataFixa as string|null,pausadoEm:v.pausadoEm as string|null,
    ultimaExecucaoEm:v.ultimaExecucaoEm as string|null,proximaExecucaoEm:v.proximaExecucaoEm as string|null};
}
