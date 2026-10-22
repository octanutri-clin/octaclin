import { encaminharGrupo } from '../../grupos-substituicoes/_proxy';
export async function POST(request: Request) { return encaminharGrupo(request,'consultar',undefined,true); }
