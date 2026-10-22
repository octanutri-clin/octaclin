import { encaminharGrupo } from './_proxy';
export async function POST(request: Request) { return encaminharGrupo(request,'criar',undefined,false); }
