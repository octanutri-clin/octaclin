import { encaminharGrupo } from '../../_proxy';
type Contexto={params:Promise<{grupoId:string}>};
export async function POST(request:Request,{params}:Contexto) { const {grupoId}=await params;return encaminharGrupo(request,'favoritar',grupoId); }
export async function DELETE(request:Request,{params}:Contexto) { const {grupoId}=await params;return encaminharGrupo(request,'desfavoritar',grupoId); }
