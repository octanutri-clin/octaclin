import { encaminharGrupo } from '../../_proxy';
type Contexto={params:Promise<{grupoId:string}>};
export async function POST(request:Request,{params}:Contexto) { const {grupoId}=await params;return encaminharGrupo(request,'duplicar',grupoId); }
