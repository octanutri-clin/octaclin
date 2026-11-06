import { NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';
import { lerEntradaConsultaTeor, projetarConsultaTeor } from '@/lib/consulta-teor-catalogo';
import { ErroCorpoAcimaDoLimite, lerCorpoLimitado } from '../../../../pacientes/[id]/planos-alimentares/_proxy';
const privado={'Cache-Control':'private, no-store'};
const respostaErro=(status:number,mensagem:string)=>NextResponse.json({mensagem},{status,headers:privado});
export async function POST(request:Request){
 try{
  await exigirPermissaoBff('planos_alimentares.ler');
  let entrada;
  try{entrada=lerEntradaConsultaTeor(JSON.parse(await lerCorpoLimitado(request,4096)));if(request.signal.aborted)throw new Error();}
  catch(erro){return respostaErro(erro instanceof ErroCorpoAcimaDoLimite?413:400,erro instanceof ErroCorpoAcimaDoLimite?'Solicitação acima do limite.':'Solicitação inválida.');}
  const resposta=await requisitarBackendAutenticado('/planos-alimentares/catalogo/teor-micronutriente/consulta',{method:'POST',body:JSON.stringify(entrada),signal:request.signal});
  if(resposta.status!==200){
   try{await resposta.body?.cancel();}catch{/* erro seguro, sem inspecionar o corpo */}
   const status=[400,401,403,404,409,413,422,429].includes(resposta.status)?resposta.status:503;
   const mensagens:Record<number,string>={400:'Solicitação inválida.',401:'Sessão necessária.',403:'Operação não autorizada.',404:'Consulta indisponível.',409:'Dados alterados. Confira novamente.',413:'Solicitação acima do limite.',422:'Dados indisponíveis.',429:'Muitas solicitações. Tente novamente em instantes.'};
   return respostaErro(status,mensagens[status]??'Serviço temporariamente indisponível.');
  }
  const publico=projetarConsultaTeor(JSON.parse(await lerCorpoLimitado(resposta,256*1024)),entrada);
  if(request.signal.aborted)throw new Error();
  return NextResponse.json(publico,{headers:privado});
 }catch(erro){
  if(erro instanceof ErroSessaoAusente)return respostaErro(401,'Sessão necessária.');
  if(erro instanceof ErroPermissaoAusente)return respostaErro(403,'Operação não autorizada.');
  return respostaErro(503,'Serviço temporariamente indisponível.');
 }
}
