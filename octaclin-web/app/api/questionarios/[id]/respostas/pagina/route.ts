import { NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';
import { lerTextoLimitado } from '@/lib/server/restricoes-bff-comum';
import { filtrosPaginaQst, projetarPaginaQst, UUID_QST } from '@/lib/server/questionarios-paginacao-bff';
const privados={'Cache-Control':'private, no-store',Vary:'Cookie'};
const falhar=(status:number)=>NextResponse.json({mensagem:'Não foi possível consultar as respostas. Confira os filtros e tente novamente.'},{status,headers:privados});
export async function GET(request:Request,props:{params:Promise<{id:string}>}){
 try{
  await exigirPermissaoBff('questionarios.ler');
  const {id:recebido}=await props.params;if(!UUID_QST.test(recebido))return falhar(400);const id=recebido.toLowerCase();
  let filtros:Record<string,string|number>;
  try{const consulta=new URL(request.url).searchParams;if([...consulta.keys()].some(k=>consulta.getAll(k).length!==1))return falhar(400);filtros=filtrosPaginaQst(Object.fromEntries(consulta));}catch{return falhar(400);}
  const query=new URLSearchParams(Object.entries(filtros).map(([k,v])=>[k,String(v)]));
  const r=await requisitarBackendAutenticado(`/questionarios/${id}/respostas/pagina?${query}`);
  if(!r.ok)return falhar([400,401,403,404,409,413,429].includes(r.status)?r.status:502);
  const texto=await lerTextoLimitado(r,8*1024*1024);if(texto===null)return falhar(413);
  return NextResponse.json(projetarPaginaQst(JSON.parse(texto),id,filtros),{headers:privados});
 }catch(e){return falhar(e instanceof ErroSessaoAusente?401:e instanceof ErroPermissaoAusente?403:502);}
}
