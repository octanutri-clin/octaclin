import { NextRequest, NextResponse } from 'next/server';
import { ErroSessaoAusente, ErroPermissaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';
import { origemMutacaoPermitida } from '@/lib/server/seguranca-bff';
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Params { params: Promise<{ id: string; caminho?: string[] }> }
async function encaminhar(req: NextRequest, props: Params, method: 'GET'|'POST'|'PUT') {
  try {
    await exigirPermissaoBff(method === 'GET' ? 'pacientes.ler' : 'pacientes.gerenciar');
    if (!origemMutacaoPermitida(req)) return NextResponse.json({ mensagem: 'Origem não autorizada.' },{ status: 403,headers });
    const { id,caminho = [] } = await props.params;
    const valido = uuid.test(id) && (method === 'GET' ? caminho.length === 0 || caminho.length === 1 && uuid.test(caminho[0]) : method === 'POST' ? caminho.length === 0 || caminho.length === 2 && uuid.test(caminho[0]) && ['referencias','encerrar','reabrir'].includes(caminho[1]) : caminho.length === 2 && uuid.test(caminho[0]) && caminho[1] === 'compartilhamento');
    if (!valido) return NextResponse.json({ mensagem: 'Recurso invalido.' },{ status: 404,headers });
    for (const key of req.nextUrl.searchParams.keys()) if (!['cursor','limite'].includes(key) || req.nextUrl.searchParams.getAll(key).length !== 1) return NextResponse.json({ mensagem: 'Filtro invalido.' },{ status: 400,headers });
    const body = method === 'GET' ? undefined : await req.text();
    if (body && new TextEncoder().encode(body).byteLength > 24000) return NextResponse.json({ mensagem: 'Solicitação acima do limite.' },{ status: 413,headers });
    const path = `/pacientes/${encodeURIComponent(id)}/gestacoes${caminho.length ? '/' + caminho.map(encodeURIComponent).join('/') : ''}${req.nextUrl.search}`;
    const resposta = await requisitarBackendAutenticado(path,{ method,body });
    return new NextResponse(await resposta.text(),{ status: resposta.status,headers });
  } catch (e) {
    return NextResponse.json({ mensagem: e instanceof ErroSessaoAusente || e instanceof ErroPermissaoAusente ? e.message : 'Nao foi possivel acessar o acompanhamento.' },{ status: e instanceof ErroSessaoAusente ? 401 : e instanceof ErroPermissaoAusente ? 403 : 502,headers });
  }
}
export function GET(req: NextRequest, props: Params) { return encaminhar(req,props,'GET'); }
export function POST(req: NextRequest, props: Params) { return encaminhar(req,props,'POST'); }
export function PUT(req: NextRequest, props: Params) { return encaminhar(req,props,'PUT'); }
