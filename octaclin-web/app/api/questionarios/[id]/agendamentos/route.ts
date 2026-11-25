import { NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';
import { lerTextoLimitado } from '@/lib/server/restricoes-bff-comum';
import { UUID_QST } from '@/lib/server/questionarios-paginacao-bff';
import { projetarAgendaQst } from '@/lib/server/questionarios-agendamentos-bff';
const headers={'Cache-Control':'private, no-store',Vary:'Cookie'};
const falhar=(status:number)=>NextResponse.json({mensagem:'Não foi possível consultar os agendamentos. Atualize a lista e tente novamente.'},{status,headers});
export async function GET(request:Request,props:{params:Promise<{id:string}>}){
  try{
    await exigirPermissaoBff('questionarios.gerenciar');
    const {id}=await props.params;const query=new URL(request.url).searchParams;
    const pacienteId=query.get('pacienteId'),pagina=Number(query.get('pagina')??1);
    if(!UUID_QST.test(id)||!pacienteId||!UUID_QST.test(pacienteId)||!Number.isSafeInteger(pagina)||pagina<1||pagina>10000
      ||[...query.keys()].some(k=>!['pacienteId','pagina'].includes(k)||query.getAll(k).length!==1))return falhar(400);
    const r=await requisitarBackendAutenticado(`/questionarios/${id.toLowerCase()}/agendamentos?${new URLSearchParams({pacienteId:pacienteId.toLowerCase(),pagina:String(pagina)})}`);
    if(!r.ok)return falhar([400,401,403,404,409,413,429].includes(r.status)?r.status:502);
    const texto=await lerTextoLimitado(r,128*1024);if(texto===null)return falhar(413);
    const d=JSON.parse(texto);if(!d||!Array.isArray(d.itens)||d.itens.length>25||d.pagina!==pagina||typeof d.temMais!=='boolean')return falhar(502);
    const itens=d.itens.map((v:unknown)=>projetarAgendaQst(v,id.toLowerCase(),pacienteId.toLowerCase()));
    if(new Set(itens.map((v:{id:string})=>v.id)).size!==itens.length)return falhar(502);
    return NextResponse.json({itens,pagina,temMais:d.temMais},{headers});
  }catch(e){return falhar(e instanceof ErroSessaoAusente?401:e instanceof ErroPermissaoAusente?403:502);}
}
