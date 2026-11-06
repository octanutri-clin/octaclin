import { NextResponse } from 'next/server';
import { executarProxyPlanoAlimentar } from '../_proxy';
export interface ParametrosAnaliseFactual {params:Promise<{id:string}>}
export async function executarProxyAnaliseFactual(request:Request,props:ParametrosAnaliseFactual,operacao:''|'listar'|'historico'|'consultar'|'comparar'|'relatorio'){
 try{
  const {id}=await props.params;
  const resposta=await executarProxyPlanoAlimentar(`/pacientes/${encodeURIComponent(id)}/planos-alimentares/analises-factuais${operacao?'/'+operacao:''}`,
   operacao&&operacao!=='relatorio'?'planos_alimentares.ler':'planos_alimentares.gerenciar',{method:'POST'},16*1024,request);
  if(resposta.status>=400){
   const mensagens:Record<number,string>={400:'Solicitação inválida.',401:'Sessão necessária.',403:'Operação não autorizada.',404:'Registro ou origem indisponível.',409:'Dados alterados. Confira novamente antes de confirmar.',413:'Solicitação acima do limite.',422:'Dados indisponíveis para esta análise.',429:'Muitas solicitações. Tente novamente em instantes.'};
   return NextResponse.json({mensagem:mensagens[resposta.status]??'Serviço temporariamente indisponível.'},{status:resposta.status,headers:{'Cache-Control':'private, no-store'}});
  }
  return resposta;
 }catch{
  return NextResponse.json({mensagem:'Serviço temporariamente indisponível.'},{status:503,headers:{'Cache-Control':'private, no-store'}});
 }
}
