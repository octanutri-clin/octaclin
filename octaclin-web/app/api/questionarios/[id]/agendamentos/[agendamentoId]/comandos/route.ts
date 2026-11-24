import { NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';
import { origemMutacaoPermitida } from '@/lib/server/seguranca-bff';
import { lerTextoLimitado } from '@/lib/server/restricoes-bff-comum';
import { UUID_QST } from '@/lib/server/questionarios-paginacao-bff';
import { comandoAgendaQst, projetarAgendaQst } from '@/lib/server/questionarios-agendamentos-bff';
const headers={'Cache-Control':'private, no-store',Vary:'Cookie'};
const falhar=(status:number)=>NextResponse.json({mensagem:status===409?'O agendamento mudou. Atualize a lista e confirme novamente.':'Não foi possível alterar o agendamento. Atualize a lista e confira seu acesso.'},{status,headers});
export async function POST(request:Request,props:{params:Promise<{id:string;agendamentoId:string}>}){
  try{
    await exigirPermissaoBff('questionarios.gerenciar');if(!origemMutacaoPermitida(request))return falhar(403);
    const {id,agendamentoId}=await props.params;if(!UUID_QST.test(id)||!UUID_QST.test(agendamentoId))return falhar(400);
    const texto=await lerTextoLimitado(request,2048);if(texto===null)return falhar(413);
    let d:ReturnType<typeof comandoAgendaQst>;try{d=comandoAgendaQst(JSON.parse(texto));}catch{return falhar(400);}
    const r=await requisitarBackendAutenticado(`/questionarios/${id.toLowerCase()}/agendamentos/${agendamentoId.toLowerCase()}/comandos`,
      {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});
    if(!r.ok)return falhar([400,401,403,404,409,413,429].includes(r.status)?r.status:502);
    const resultado=await lerTextoLimitado(r,8192);if(resultado===null)return falhar(502);
    const a=projetarAgendaQst(JSON.parse(resultado),id.toLowerCase(),d.pacienteId);
    if(a.id!==agendamentoId.toLowerCase()||a.revisao!==d.revisaoEsperada+1)return falhar(502);
    return NextResponse.json(a,{headers});
  }catch(e){return falhar(e instanceof ErroSessaoAusente?401:e instanceof ErroPermissaoAusente?403:502);}
}
