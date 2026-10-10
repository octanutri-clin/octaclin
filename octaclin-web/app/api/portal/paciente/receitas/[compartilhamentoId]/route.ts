import { NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

interface Params { params: Promise<{ compartilhamentoId: string }> }

export async function GET(_request: Request, props: Params) {
  const { compartilhamentoId } = await props.params;
  try {
    const resposta = await requisitarBackendAutenticado(`/portal/paciente/receitas/${encodeURIComponent(compartilhamentoId)}`);
    return new NextResponse(await resposta.text(), { status: resposta.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } });
    throw erro;
  }
}
