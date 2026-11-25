import { NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';
import { origemMutacaoPermitida } from '@/lib/server/seguranca-bff';
import { lerTextoLimitado } from '@/lib/server/restricoes-bff-comum';
import { corpoExportacaoQst, UUID_QST } from '@/lib/server/questionarios-paginacao-bff';
const privados={'Cache-Control':'private, no-store',Vary:'Cookie'};
const falhar=(status:number)=>NextResponse.json({mensagem:status===400||status===413?'Confira os filtros: exporte até 1000 respostas por vez.':'Não foi possível exportar. Atualize a consulta e tente novamente.'},{status,headers:privados});
export async function POST(request:Request,props:{params:Promise<{id:string}>}){
 try{
  await exigirPermissaoBff('questionarios.ler');if(!origemMutacaoPermitida(request))return falhar(403);
  const {id}=await props.params;if(!UUID_QST.test(id))return falhar(400);
  const texto=await lerTextoLimitado(request,64*1024);if(texto===null)return falhar(413);
  let corpo:ReturnType<typeof corpoExportacaoQst>;try{corpo=corpoExportacaoQst(JSON.parse(texto));}catch{return falhar(400);}
  const r=await requisitarBackendAutenticado(`/questionarios/${id.toLowerCase()}/respostas/exportacao.csv`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(corpo)});
  if(!r.ok)return falhar([400,401,403,404,409,413,429].includes(r.status)?r.status:502);
  if(!r.headers.get('Content-Type')?.toLowerCase().startsWith('text/csv'))return falhar(502);
  const csv=await lerTextoLimitado(r,8*1024*1024);if(csv===null)return falhar(413);
  return new NextResponse(csv,{headers:{...privados,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="octaclin-respostas.csv"','X-Content-Type-Options':'nosniff'}});
 }catch(e){return falhar(e instanceof ErroSessaoAusente?401:e instanceof ErroPermissaoAusente?403:502);}
}
