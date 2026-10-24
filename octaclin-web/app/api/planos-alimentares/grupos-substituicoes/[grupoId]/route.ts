import { encaminharGrupo } from '../_proxy';
type Contexto={params:Promise<{grupoId:string}>};
export async function GET(request:Request,{params}:Contexto) { const {grupoId}=await params;return encaminharGrupo(request,'obter',grupoId,false); }
export async function PATCH(request:Request,{params}:Contexto) { const {grupoId}=await params;return encaminharGrupo(request,'atualizar',grupoId,false); }
