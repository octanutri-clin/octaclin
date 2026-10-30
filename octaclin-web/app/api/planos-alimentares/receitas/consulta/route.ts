import { encaminharReceitaFood07 } from '../_food07-proxy';
export async function POST(request: Request) { return encaminharReceitaFood07(request, 'consulta'); }
