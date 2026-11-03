import { executarProxyAnaliseFactual } from '../_proxy';
export async function POST(request:Request,props:{params:Promise<{id:string}>}){const params=await props.params;return executarProxyAnaliseFactual(request,{params:Promise.resolve(params)},'comparar');}
