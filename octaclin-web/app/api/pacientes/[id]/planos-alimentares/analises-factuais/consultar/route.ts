import { executarProxyAnaliseFactual,type ParametrosAnaliseFactual } from '../_proxy';
export async function POST(request:Request,props:ParametrosAnaliseFactual){return executarProxyAnaliseFactual(request,props,'consultar');}
