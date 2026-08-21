import { NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

interface Params { params: Promise<{ id: string; secao: string }>; }
const secoesLeitura = new Set(['identificacao', 'contato', 'operacao', 'fiscal', 'qualidade-acesso']);
const secoesEdicao = new Set(['identificacao', 'contato', 'operacao', 'fiscal']);

export async function GET(_request: Request, props: Params) {
  const { id, secao } = await props.params;
  if (!secoesLeitura.has(secao)) return NextResponse.json({ mensagem: 'Seção inválida.' }, { status: 404 });
  try {
    const resposta = await requisitarBackendAutenticado(`/pacientes/${id}/perfil-cadastro/${secao}`);
    return new NextResponse(await resposta.text(), { status: resposta.status, headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' } });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}

export async function PATCH(request: Request, props: Params) {
  const { id, secao } = await props.params;
  if (!secoesEdicao.has(secao)) return NextResponse.json({ mensagem: 'Seção inválida.' }, { status: 404 });
  try {
    const resposta = await requisitarBackendAutenticado(`/pacientes/${id}/perfil-cadastro/${secao}`, { method: 'PATCH', body: await request.text() });
    return new NextResponse(await resposta.text(), { status: resposta.status, headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' } });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}
